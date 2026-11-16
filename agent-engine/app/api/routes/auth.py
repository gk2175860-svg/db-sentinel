"""Authentication API routes."""
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.config import get_settings
from app.core.security import (
    InvalidTokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models import Role, User, user_roles
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# Rate limiter for auth endpoints
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=TokenPair)
@limiter.limit("5/minute")
async def login(
    http_request: Request,
    request: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenPair:
    """Authenticate a user and return access and refresh tokens."""
    user = await session.scalar(select(User).where(User.email == request.email))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user's roles
    stmt = select(Role.name).join(
        user_roles, user_roles.c.role_id == Role.id
    ).where(user_roles.c.user_id == user.id)
    result = await session.execute(stmt)
    roles = list(result.scalars())

    # Update last login
    user.last_login_at = datetime.now(UTC)
    await session.commit()

    access_token = create_access_token(user, roles=roles)
    refresh_token = create_refresh_token(user, roles=roles)
    settings = get_settings()
    expires_in = settings.jwt_expire_minutes * 60

    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=expires_in,
    )


@router.post("/refresh", response_model=TokenPair)
@limiter.limit("10/minute")
async def refresh(
    http_request: Request,
    request: RefreshRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenPair:
    """Exchange a refresh token for a new access and refresh token pair."""
    try:
        claims = decode_token(request.refresh_token, expected_type="refresh")
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = claims.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await session.get(User, uuid.UUID(user_id))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user's roles
    stmt = select(Role.name).join(
        user_roles, user_roles.c.role_id == Role.id
    ).where(user_roles.c.user_id == user.id)
    result = await session.execute(stmt)
    roles = list(result.scalars())

    access_token = create_access_token(user, roles=roles)
    refresh_token = create_refresh_token(user, roles=roles)
    settings = get_settings()
    expires_in = settings.jwt_expire_minutes * 60

    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=expires_in,
    )


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserResponse:
    """Return the current authenticated user's profile."""
    # Get user's roles
    stmt = select(Role.name).join(
        user_roles, user_roles.c.role_id == Role.id
    ).where(user_roles.c.user_id == current_user.id)
    result = await session.execute(stmt)
    roles = list(result.scalars())

    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        roles=roles,
        is_active=current_user.is_active,
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
async def register(
    http_request: Request,
    request: RegisterRequest,
    session: AsyncSession = Depends(get_session),
) -> UserResponse:
    """Register a new user (requires allow_registration setting)."""
    settings = get_settings()
    if not settings.allow_registration:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is disabled",
        )

    # Check if email already exists
    existing = await session.scalar(select(User).where(User.email == request.email))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create user with Developer role
    password_hash = hash_password(request.password)
    user = User(
        email=request.email,
        password_hash=password_hash,
        full_name=request.full_name,
    )
    session.add(user)
    await session.flush()

    # Assign Developer role
    developer_role = await session.scalar(select(Role).where(Role.name == "Developer"))
    if developer_role is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Developer role not found",
        )

    await session.execute(
        user_roles.insert().values(user_id=user.id, role_id=developer_role.id)
    )
    await session.commit()

    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        roles=["Developer"],
        is_active=user.is_active,
    )