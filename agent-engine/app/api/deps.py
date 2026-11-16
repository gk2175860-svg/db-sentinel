"""FastAPI dependencies for database sessions, authentication, and authorization."""
import uuid
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.security import InvalidTokenError, decode_token
from app.db.session import get_session_factory
from app.models import Role, User, role_permissions, user_roles


async def get_session_factory_dep() -> async_sessionmaker[AsyncSession]:
    """Dependency that provides the session factory (overridable in tests)."""
    return get_session_factory()


async def get_session(
    factory: Annotated[async_sessionmaker[AsyncSession], Depends(get_session_factory_dep)],
) -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session."""
    async with factory() as session:
        yield session


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    session: AsyncSession = Depends(get_session),
) -> User:
    """Extract and validate the current user from the Authorization header."""
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization[7:]
    try:
        claims = decode_token(token, expected_type="access")
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

    return user


def require_permission(permission: str):
    """Dependency factory that requires a specific permission."""

    async def _check_permission(
        current_user: Annotated[User, Depends(get_current_user)],
        session: AsyncSession = Depends(get_session),
    ) -> User:
        # Superusers bypass permission checks
        if current_user.is_superuser:
            return current_user

        # Get user's roles
        result = await session.execute(
            select(Role)
            .join(user_roles, user_roles.c.role_id == Role.id)
            .where(user_roles.c.user_id == current_user.id)
        )
        roles = result.scalars().all()

        # Get permissions for those roles
        role_ids = [role.id for role in roles]
        if not role_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission}",
            )

        perm_result = await session.execute(
            select(role_permissions.c.permission_id).where(
                role_permissions.c.role_id.in_(role_ids)
            )
        )
        permission_ids = {row[0] for row in perm_result}

        # Check if user has the required permission
        from app.models import Permission

        perm = await session.scalar(
            select(Permission).where(Permission.name == permission)
        )
        if perm is None or perm.id not in permission_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission}",
            )

        return current_user

    return _check_permission