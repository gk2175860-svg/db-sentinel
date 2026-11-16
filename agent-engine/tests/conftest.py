"""Pytest fixtures for auth API tests."""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes.auth import router as auth_router
from app.api.routes.databases import router as databases_router
from app.api.routes.health import router as health_router
from app.api.routes.websocket import router as websocket_router
from app.config import get_settings
from app.db.init_db import init_db
from app.main import (
    http_exception_handler,
    request_validation_exception_handler,
    unhandled_exception_handler,
)


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture
async def test_engine(tmp_path):
    """Create a test database engine."""
    engine = create_async_engine(f"sqlite+aiosqlite:///{(tmp_path / 'test.db').as_posix()}")
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session_factory(test_engine):
    """Create a test session factory with seeded data."""
    factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with factory() as session:
        print("Initializing database...")
        await init_db(session)
        print("Database initialized!")
        # Check tables
        from sqlalchemy import text
        result = await session.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
        tables = [row[0] for row in result]
        print("Tables after init_db:", tables)
    print(f"test_session_factory engine: {test_engine}")
    yield factory


@pytest_asyncio.fixture
async def session(test_session_factory) -> AsyncSession:
    """Get a test database session."""
    async with test_session_factory() as db_session:
        yield db_session


def create_test_app(test_session_factory) -> FastAPI:
    """Create a test FastAPI app without lifespan (tables already seeded)."""
    settings = get_settings()
    print(f"create_test_app called with session_factory: {test_session_factory}")
    print(f"create_test_app session_factory bind: {test_session_factory.kw.get('bind') if hasattr(test_session_factory, 'kw') else 'unknown'}")

    @asynccontextmanager
    async def noop_lifespan(app: FastAPI) -> AsyncIterator[None]:
        yield

    app = FastAPI(title=settings.app_name, lifespan=noop_lifespan)
    app.state.session_factory = test_session_factory
    print(f"app.state.session_factory set to: {app.state.session_factory}")
    print(f"app.state.session_factory bind: {app.state.session_factory.kw.get('bind') if hasattr(app.state.session_factory, 'kw') else 'unknown'}")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router, prefix=settings.api_prefix)
    app.include_router(auth_router, prefix=settings.api_prefix)
    app.include_router(databases_router, prefix=settings.api_prefix)
    app.include_router(websocket_router, prefix=settings.api_prefix)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, request_validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    from app.api.deps import get_session_factory_dep

    async def override_get_session_factory():
        return test_session_factory

    app.dependency_overrides[get_session_factory_dep] = override_get_session_factory
    return app


@pytest_asyncio.fixture
async def app(test_session_factory):
    """Create a test FastAPI app with overridden session factory."""
    print("app fixture called, creating test app...")
    app = create_test_app(test_session_factory)
    print(f"app fixture created app: {app}")
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app):
    """Create an async test client."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def admin_token(client):
    """Get an access token for the seeded admin user."""
    settings = get_settings()
    response = await client.post(
        f"{settings.api_prefix}/auth/login",
        json={"email": settings.seed_admin_email, "password": settings.seed_admin_password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest_asyncio.fixture
async def admin_refresh_token(client):
    """Get a refresh token for the seeded admin user."""
    settings = get_settings()
    response = await client.post(
        f"{settings.api_prefix}/auth/login",
        json={"email": settings.seed_admin_email, "password": settings.seed_admin_password},
    )
    assert response.status_code == 200
    return response.json()["refresh_token"]