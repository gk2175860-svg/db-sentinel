"""Database initialization: create_all plus idempotent seed data."""
from typing import Any

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.security import hash_password
from app.db.base import Base
from app.models import (
    AgentRecord,
    Permission,
    Role,
    User,
    role_permissions,
    user_roles,
)

ROLES: tuple[tuple[str, str], ...] = (
    ("Admin", "Full system access"),
    ("DBA", "Database administrator access"),
    ("Developer", "Developer access"),
    ("Viewer", "Read-only access"),
)

RESOURCES: tuple[str, ...] = (
    "databases",
    "agents",
    "tasks",
    "ai_providers",
    "users",
    "settings",
    "audit_logs",
)

ACTIONS: tuple[str, ...] = ("create", "read", "update", "delete", "execute", "connect")

ROLE_GRANTS: dict[str, set[str]] = {
    "Admin": {f"{resource}:{action}" for resource in RESOURCES for action in ACTIONS},
    "DBA": {
        "databases:create",
        "databases:read",
        "databases:update",
        "databases:delete",
        "databases:connect",
        "agents:execute",
        "tasks:create",
        "tasks:read",
        "tasks:update",
        "tasks:delete",
        "tasks:execute",
        "ai_providers:read",
        "users:read",
        "settings:read",
        "audit_logs:read",
    },
    "Developer": {
        "databases:create",
        "databases:read",
        "databases:connect",
        "agents:execute",
        "tasks:create",
        "tasks:read",
    },
    "Viewer": {"databases:read", "agents:read", "tasks:read"},
}

AGENTS: tuple[dict[str, Any], ...] = (
    {
        "agent_type": "sql_generator",
        "name": "SQL Generator",
        "description": "Convert natural language to SQL queries",
        "capabilities": ["nl_to_sql", "sql_explanation", "query_refinement"],
        "required_params": ["natural_language_query", "database_id"],
        "optional_params": ["schema_context", "dialect", "examples", "model"],
    },
    {
        "agent_type": "query_optimizer",
        "name": "Query Optimizer",
        "description": "Analyze execution plans and suggest optimizations",
        "capabilities": ["explain_analysis", "index_suggestions", "query_rewrite"],
        "required_params": ["query", "database_id"],
        "optional_params": ["include_explain", "model"],
    },
)


async def init_db(session: AsyncSession) -> None:
    """Create every metadata table and seed the system rows (idempotently)."""
    connection = await session.connection()
    await connection.run_sync(Base.metadata.create_all)
    await _seed_roles(session)
    await _seed_permissions(session)
    await _seed_role_permissions(session)
    await _seed_admin_user(session)
    await _seed_agents(session)
    await session.commit()


async def _seed_roles(session: AsyncSession) -> None:
    for name, description in ROLES:
        existing = await session.scalar(sa.select(Role).where(Role.name == name))
        if existing is None:
            session.add(Role(name=name, description=description, is_system=True))
    await session.flush()


async def _seed_permissions(session: AsyncSession) -> None:
    for resource in RESOURCES:
        for action in ACTIONS:
            name = f"{resource}:{action}"
            existing = await session.scalar(sa.select(Permission).where(Permission.name == name))
            if existing is None:
                session.add(Permission(name=name, resource=resource, action=action))
    await session.flush()


async def _seed_role_permissions(session: AsyncSession) -> None:
    roles = {role.name: role for role in (await session.scalars(sa.select(Role))).all()}
    permissions = {
        permission.name: permission
        for permission in (await session.scalars(sa.select(Permission))).all()
    }
    for role_name, grant_names in ROLE_GRANTS.items():
        role = roles[role_name]
        for permission_name in sorted(grant_names):
            permission = permissions[permission_name]
            existing = await session.scalar(
                sa.select(role_permissions.c.role_id).where(
                    role_permissions.c.role_id == role.id,
                    role_permissions.c.permission_id == permission.id,
                )
            )
            if existing is None:
                await session.execute(
                    sa.insert(role_permissions).values(role_id=role.id, permission_id=permission.id)
                )


async def _seed_admin_user(session: AsyncSession) -> None:
    settings = get_settings()
    user = await session.scalar(sa.select(User).where(User.email == settings.seed_admin_email))
    if user is None:
        password_hash = hash_password(settings.seed_admin_password)
        user = User(email=settings.seed_admin_email, password_hash=password_hash)
        session.add(user)
        await session.flush()
    admin_role = await session.scalar(sa.select(Role).where(Role.name == "Admin"))
    existing = await session.scalar(
        sa.select(user_roles.c.user_id).where(
            user_roles.c.user_id == user.id,
            user_roles.c.role_id == admin_role.id,
        )
    )
    if existing is None:
        await session.execute(
            sa.insert(user_roles).values(user_id=user.id, role_id=admin_role.id)
        )


async def _seed_agents(session: AsyncSession) -> None:
    for agent in AGENTS:
        existing = await session.scalar(
            sa.select(AgentRecord).where(AgentRecord.agent_type == agent["agent_type"])
        )
        if existing is None:
            session.add(AgentRecord(**agent))
    await session.flush()
