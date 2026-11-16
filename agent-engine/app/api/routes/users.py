"""User management API routes (Admin only)."""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_permission
from app.config import get_settings
from app.core.security import hash_password, verify_password
from app.models import Role, User, user_roles
from app.schemas.auth import (
    PasswordChangeRequest,
    PermissionResponse,
    RoleCreateRequest,
    RoleResponse,
    RoleUpdateRequest,
    UserCreateRequest,
    UserListResponse,
    UserResponse,
    UserUpdateRequest,
)

router = APIRouter(prefix="/users", tags=["users"])

limiter = Limiter(key_func=get_remote_address)


@router.get("", response_model=UserListResponse)
@limiter.limit("30/minute")
async def list_users(
    http_request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("users:read")),
) -> UserListResponse:
    """List all users with pagination and search."""
    stmt = select(User)
    
    if search:
        stmt = stmt.where(
            User.email.ilike(f"%{search}%") | 
            User.full_name.ilike(f"%{search}%")
        )
    
    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await session.scalar(count_stmt)
    
    # Paginate
    stmt = stmt.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(stmt)
    users = result.scalars().all()
    
    # Get roles for each user
    user_responses = []
    for user in users:
        stmt = select(Role.name).join(
            user_roles, user_roles.c.role_id == Role.id
        ).where(user_roles.c.user_id == user.id)
        result = await session.execute(stmt)
        roles = list(result.scalars())
        
        user_responses.append(UserResponse(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            roles=roles,
            is_active=user.is_active,
            last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
        ))
    
    return UserListResponse(
        users=user_responses,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{user_id}", response_model=UserResponse)
@limiter.limit("30/minute")
async def get_user(
    http_request: Request,
    user_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("users:read")),
) -> UserResponse:
    """Get a user by ID."""
    user = await session.get(User, uuid.UUID(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Get user's roles
    stmt = select(Role.name).join(
        user_roles, user_roles.c.role_id == Role.id
    ).where(user_roles.c.user_id == user.id)
    result = await session.execute(stmt)
    roles = list(result.scalars())
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        roles=roles,
        is_active=user.is_active,
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_user(
    http_request: Request,
    request: UserCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("users:create")),
) -> UserResponse:
    """Create a new user (admin only)."""
    settings = get_settings()
    if not settings.allow_registration:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User creation is disabled",
        )
    
    # Check if email already exists
    existing = await session.scalar(select(User).where(User.email == request.email))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    
    # Validate roles exist
    role_objects = []
    if request.roles:
        stmt = select(Role).where(Role.name.in_(request.roles))
        result = await session.execute(stmt)
        role_objects = list(result.scalars())
        if len(role_objects) != len(request.roles):
            found_names = {r.name for r in role_objects}
            missing = set(request.roles) - found_names
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Roles not found: {', '.join(missing)}",
            )
    
    # Create user
    password_hash = hash_password(request.password)
    user = User(
        email=request.email,
        password_hash=password_hash,
        full_name=request.full_name,
        is_active=request.is_active,
    )
    session.add(user)
    await session.flush()
    
    # Assign roles
    for role in role_objects:
        await session.execute(
            user_roles.insert().values(user_id=user.id, role_id=role.id)
        )
    
    await session.commit()
    await session.refresh(user)
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        roles=[r.name for r in role_objects],
        is_active=user.is_active,
        last_login_at=None,
    )


@router.put("/{user_id}", response_model=UserResponse)
@limiter.limit("10/minute")
async def update_user(
    http_request: Request,
    user_id: str,
    request: UserUpdateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("users:update")),
) -> UserResponse:
    """Update a user (admin only)."""
    user = await session.get(User, uuid.UUID(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Prevent non-superusers from modifying superusers
    if user.is_superuser and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify superuser",
        )
    
    # Prevent users from removing their own admin role
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify your own account",
        )
    
    update_data = request.model_dump(exclude_unset=True)
    
    # Handle email uniqueness
    if "email" in update_data:
        existing = await session.scalar(
            select(User).where(User.email == update_data["email"], User.id != user.id)
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already in use",
            )
    
    # Handle roles
    if "roles" in update_data:
        role_names = update_data.pop("roles")
        stmt = select(Role).where(Role.name.in_(role_names))
        result = await session.execute(stmt)
        role_objects = list(result.scalars())
        if len(role_objects) != len(role_names):
            found_names = {r.name for r in role_objects}
            missing = set(role_names) - found_names
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Roles not found: {', '.join(missing)}",
            )
        
        # Update roles
        await session.execute(
            user_roles.delete().where(user_roles.c.user_id == user.id)
        )
        for role in role_objects:
            await session.execute(
                user_roles.insert().values(user_id=user.id, role_id=role.id)
            )
    
    # Update other fields
    for field, value in update_data.items():
        setattr(user, field, value)
    
    await session.commit()
    await session.refresh(user)
    
    # Get updated roles
    stmt = select(Role.name).join(
        user_roles, user_roles.c.role_id == Role.id
    ).where(user_roles.c.user_id == user.id)
    result = await session.execute(stmt)
    roles = list(result.scalars())
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        roles=roles,
        is_active=user.is_active,
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def delete_user(
    http_request: Request,
    user_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("users:delete")),
) -> None:
    """Delete a user (admin only)."""
    user = await session.get(User, uuid.UUID(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Prevent deletion of superusers by non-superusers
    if user.is_superuser and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete superuser",
        )
    
    # Prevent self-deletion
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete your own account",
        )
    
    await session.delete(user)
    await session.commit()


@router.post("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def change_user_password(
    http_request: Request,
    user_id: str,
    request: PasswordChangeRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("users:update")),
) -> None:
    """Change a user's password (admin only)."""
    user = await session.get(User, uuid.UUID(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Prevent non-superusers from modifying superusers
    if user.is_superuser and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify superuser password",
        )
    
    user.password_hash = hash_password(request.new_password)
    await session.commit()


# Role Management
@router.get("/roles", response_model=list[RoleResponse])
@limiter.limit("30/minute")
async def list_roles(
    http_request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("users:read")),
) -> list[RoleResponse]:
    """List all roles."""
    result = await session.execute(select(Role).order_by(Role.name))
    roles = result.scalars().all()
    
    return [
        RoleResponse(
            id=str(role.id),
            name=role.name,
            description=role.description,
            is_system=role.is_system,
        )
        for role in roles
    ]


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_role(
    http_request: Request,
    request: RoleCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("users:create")),
) -> RoleResponse:
    """Create a new role."""
    existing = await session.scalar(select(Role).where(Role.name == request.name))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Role already exists",
        )
    
    role = Role(name=request.name, description=request.description)
    session.add(role)
    await session.commit()
    await session.refresh(role)
    
    return RoleResponse(
        id=str(role.id),
        name=role.name,
        description=role.description,
        is_system=role.is_system,
    )


@router.put("/roles/{role_id}", response_model=RoleResponse)
@limiter.limit("10/minute")
async def update_role(
    http_request: Request,
    role_id: str,
    request: RoleUpdateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("users:update")),
) -> RoleResponse:
    """Update a role."""
    role = await session.get(Role, uuid.UUID(role_id))
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )
    
    # Prevent modifying system roles
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify system role",
        )
    
    if request.description is not None:
        role.description = request.description
    
    await session.commit()
    await session.refresh(role)
    
    return RoleResponse(
        id=str(role.id),
        name=role.name,
        description=role.description,
        is_system=role.is_system,
    )


@router.get("/permissions", response_model=list[PermissionResponse])
@limiter.limit("30/minute")
async def list_permissions(
    http_request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("users:read")),
) -> list[PermissionResponse]:
    """List all permissions."""
    from app.models import Permission
    result = await session.execute(select(Permission).order_by(Permission.name))
    permissions = result.scalars().all()
    
    return [
        PermissionResponse(
            id=str(p.id),
            name=p.name,
            resource=p.resource,
            action=p.action,
            description=p.description,
        )
        for p in permissions
    ]