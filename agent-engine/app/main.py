from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware

from app.api.routes.agents import router as agents_router
from app.api.routes.auth import router as auth_router
from app.api.routes.databases import router as databases_router
from app.api.routes.health import router as health_router
from app.api.routes.users import router as users_router
from app.api.routes.websocket import router as websocket_router, setup_websocket_event_bridge
from app.config import get_settings
from app.core.task_queue import TaskRunner
from app.db.init_db import init_db
from app.db.session import get_session_factory

_ERROR_CODES: dict[int, str] = {
    400: "VALIDATION_ERROR",
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    429: "RATE_LIMITED",
    502: "AI_PROVIDER_ERROR",
}

_task_runner: TaskRunner | None = None


async def get_task_runner() -> TaskRunner:
    global _task_runner
    if _task_runner is None:
        _task_runner = TaskRunner(
            session_factory=get_session_factory(),
            agent_factory=None,  # Will be set by agents module
            worker_concurrency=2,
        )
    return _task_runner


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    factory = get_session_factory()
    async with factory() as session:
        await init_db(session)
    await setup_websocket_event_bridge()

    # Start task runner
    runner = await get_task_runner()
    # Import here to avoid circular imports
    from app.agents import create_agent
    runner.agent_factory = create_agent
    await runner.start()

    # Store in app state for dependency injection
    app.state.task_runner = runner

    yield

    # Stop task runner
    if _task_runner:
        await _task_runner.stop()


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = _ERROR_CODES.get(exc.status_code, "INTERNAL_ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": code, "message": str(exc.detail), "details": []}},
    )


async def request_validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request body",
                "details": jsonable_encoder(exc.errors()),
            }
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "error": {"code": "INTERNAL_ERROR", "message": "Internal server error", "details": []}
        },
    )


def create_app() -> FastAPI:
    settings = get_settings()
    
    # Rate limiter
    limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
    
    app = FastAPI(
        title=settings.app_name, 
        lifespan=lifespan,
        docs_url="/docs" if settings.app_env != "production" else None,
        redoc_url="/redoc" if settings.app_env != "production" else None,
    )
    
    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    
    # Security headers middleware
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if settings.app_env == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self'; "
                "connect-src 'self' ws: wss:; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            )
        return response
    
    app.state.session_factory = get_session_factory()
    
    # Session middleware for CSRF protection
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.jwt_secret,
        https_only=settings.app_env == "production",
        same_site="lax",
    )
    
    # CORS - restrict in production
    cors_origins = settings.cors_origins
    if settings.app_env == "production":
        cors_origins = [o for o in cors_origins if not o.startswith("http://localhost")]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
        expose_headers=["X-Request-ID"],
    )
    
    app.include_router(health_router, prefix=settings.api_prefix)
    app.include_router(auth_router, prefix=settings.api_prefix)
    app.include_router(databases_router, prefix=settings.api_prefix)
    app.include_router(users_router, prefix=settings.api_prefix)
    app.include_router(agents_router, prefix=settings.api_prefix)
    app.include_router(websocket_router, prefix=settings.api_prefix)
    
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, request_validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    
    return app