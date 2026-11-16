"""Metadata DB models, engine/session module, and idempotent init/seed tests (Task 2)."""
import bcrypt
import pytest
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.db.init_db import init_db
from app.db.session import async_engine, get_session_factory
from app.models import (
    AgentRecord,
    DatabaseRecord,
    Permission,
    Role,
    TaskLog,
    TaskPriority,
    TaskRecord,
    TaskStatus,
    User,
    role_permissions,
    user_roles,
)

RESOURCES = ("databases", "agents", "tasks", "ai_providers", "users", "settings", "audit_logs")
ACTIONS = ("create", "read", "update", "delete", "execute", "connect")
ALL_PERMISSIONS = {f"{resource}:{action}" for resource in RESOURCES for action in ACTIONS}

EXPECTED_ROLES = {
    "Admin": "Full system access",
    "DBA": "Database administrator access",
    "Developer": "Developer access",
    "Viewer": "Read-only access",
}

DBA_PERMISSIONS = {
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
}

DEVELOPER_PERMISSIONS = {
    "databases:create",
    "databases:read",
    "databases:connect",
    "agents:execute",
    "tasks:create",
    "tasks:read",
}

VIEWER_PERMISSIONS = {"databases:read", "agents:read", "tasks:read"}

EXPECTED_AGENTS = {
    "sql_generator": {
        "name": "SQL Generator",
        "description": "Convert natural language to SQL queries",
        "capabilities": ["nl_to_sql", "sql_explanation", "query_refinement"],
        "required_params": ["natural_language_query", "database_id"],
        "optional_params": ["schema_context", "dialect", "examples", "model"],
    },
    "query_optimizer": {
        "name": "Query Optimizer",
        "description": "Analyze execution plans and suggest optimizations",
        "capabilities": ["explain_analysis", "index_suggestions", "query_rewrite"],
        "required_params": ["query", "database_id"],
        "optional_params": ["include_explain", "model"],
    },
}

EXPECTED_TABLES = {
    "agents",
    "databases",
    "permissions",
    "role_permissions",
    "roles",
    "task_logs",
    "tasks",
    "user_roles",
    "users",
}

EXPECTED_POOL_CONFIG = {
    "pool_size": 5,
    "max_overflow": 10,
    "pool_timeout": 30,
    "pool_recycle": 3600,
}

OUT_OF_CONTRACT_STATUS = "PENDING"
OUT_OF_CONTRACT_PRIORITY = "URGENT"


@pytest.fixture
async def session_factory(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{(tmp_path / 'metadata.db').as_posix()}")
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as seed_session:
        await init_db(seed_session)
    yield factory
    await engine.dispose()


@pytest.fixture
async def session(session_factory):
    async with session_factory() as db_session:
        yield db_session


async def permission_names_for_role(session: AsyncSession, role_name: str) -> set[str]:
    result = await session.execute(
        sa.select(Permission.name)
        .join(role_permissions, role_permissions.c.permission_id == Permission.id)
        .join(Role, Role.id == role_permissions.c.role_id)
        .where(Role.name == role_name)
    )
    return set(result.scalars())


def test_async_engine_binds_settings_url():
    assert str(async_engine().url) == get_settings().database_url


def test_get_session_factory_binds_cached_engine():
    factory = get_session_factory()
    assert isinstance(factory, async_sessionmaker)
    assert factory.kw["bind"] is async_engine()
    assert factory.kw["expire_on_commit"] is False


async def test_init_db_creates_all_metadata_tables(session):
    def table_names(sync_connection) -> list[str]:
        return sa.inspect(sync_connection).get_table_names()

    connection = await session.connection()
    assert EXPECTED_TABLES <= set(await connection.run_sync(table_names))


async def test_init_db_seeds_system_roles(session):
    roles = (await session.scalars(sa.select(Role))).all()
    assert {role.name for role in roles} == set(EXPECTED_ROLES)
    assert all(role.is_system for role in roles)
    assert {role.name: role.description for role in roles} == EXPECTED_ROLES


async def test_init_db_seeds_full_permission_set(session):
    permissions = (await session.scalars(sa.select(Permission))).all()
    assert {p.name for p in permissions} == ALL_PERMISSIONS
    for permission in permissions:
        resource, action = permission.name.split(":")
        assert resource in RESOURCES
        assert action in ACTIONS
        assert permission.resource == resource
        assert permission.action == action


async def test_init_db_grants_rbac_matrix(session):
    assert await permission_names_for_role(session, "Admin") == ALL_PERMISSIONS
    assert await permission_names_for_role(session, "DBA") == DBA_PERMISSIONS
    assert await permission_names_for_role(session, "Developer") == DEVELOPER_PERMISSIONS
    assert await permission_names_for_role(session, "Viewer") == VIEWER_PERMISSIONS


async def test_init_db_seeds_admin_user_with_admin_role(session):
    settings = get_settings()
    user = await session.scalar(sa.select(User).where(User.email == settings.seed_admin_email))
    assert user is not None
    assert user.is_active
    assert bcrypt.checkpw(settings.seed_admin_password.encode(), user.password_hash.encode())
    result = await session.execute(
        sa.select(Role.name)
        .join(user_roles, user_roles.c.role_id == Role.id)
        .where(user_roles.c.user_id == user.id)
    )
    assert set(result.scalars()) == {"Admin"}


async def test_init_db_seeds_agents(session):
    agents = (await session.scalars(sa.select(AgentRecord))).all()
    assert {agent.agent_type for agent in agents} == set(EXPECTED_AGENTS)
    for agent in agents:
        expected = EXPECTED_AGENTS[agent.agent_type]
        assert agent.name == expected["name"]
        assert agent.description == expected["description"]
        assert agent.capabilities == expected["capabilities"]
        assert agent.required_params == expected["required_params"]
        assert agent.optional_params == expected["optional_params"]
        assert agent.is_enabled


async def test_init_db_is_idempotent(session):
    await init_db(session)

    assert len((await session.scalars(sa.select(Role))).all()) == 4
    assert len((await session.scalars(sa.select(Permission))).all()) == len(ALL_PERMISSIONS)
    assert len((await session.scalars(sa.select(User))).all()) == 1
    assert len((await session.scalars(sa.select(AgentRecord))).all()) == 2
    assert len((await session.execute(sa.select(user_roles))).all()) == 1
    expected_links = (
        len(ALL_PERMISSIONS)
        + len(DBA_PERMISSIONS)
        + len(DEVELOPER_PERMISSIONS)
        + len(VIEWER_PERMISSIONS)
    )
    assert len((await session.execute(sa.select(role_permissions))).all()) == expected_links


async def test_task_and_database_models_roundtrip(session, session_factory):
    settings = get_settings()
    admin = await session.scalar(
        sa.select(User).where(User.email == settings.seed_admin_email)
    )
    database = DatabaseRecord(
        name="primary",
        type="postgresql",
        host="localhost",
        port=5432,
        database_name="app",
        username="app",
        password_encrypted=b"encrypted-secret",
        password_salt=b"salt",
        created_by=admin.id,
    )
    session.add(database)
    await session.flush()

    assert database.connection_config == {}
    assert database.pool_config == EXPECTED_POOL_CONFIG
    assert database.tags == []
    assert database.is_active
    assert database.created_at is not None

    task = TaskRecord(
        agent_type="sql_generator",
        database_id=database.id,
        status=TaskStatus.COMPLETED,
        priority=TaskPriority.HIGH,
        created_by=admin.id,
    )
    session.add(task)
    await session.flush()

    assert task.status is TaskStatus.COMPLETED
    assert task.priority is TaskPriority.HIGH
    assert task.parameters == {}
    assert task.result is None
    assert task.progress == 0
    assert task.steps_completed == []
    assert task.total_steps is None
    assert task.retries == 0
    assert task.max_retries == 3
    assert task.tags == []
    assert task.parent_task_id is None
    assert task.created_at is not None

    log = TaskLog(task_id=task.id, level="info", message="started")
    session.add(log)
    await session.flush()

    assert log.context == {}
    assert log.timestamp is not None

    database_id = database.id
    task_id = task.id
    log_id = log.id
    await session.commit()

    async with session_factory() as fresh_session:
        reloaded_database = await fresh_session.get(DatabaseRecord, database_id)
        reloaded_task = await fresh_session.get(TaskRecord, task_id)
        reloaded_log = await fresh_session.get(TaskLog, log_id)

    assert reloaded_database is not None
    assert reloaded_database.name == "primary"
    assert reloaded_database.type == "postgresql"
    assert reloaded_database.port == 5432
    assert reloaded_database.connection_config == {}
    assert reloaded_database.pool_config == EXPECTED_POOL_CONFIG
    assert reloaded_database.tags == []
    assert reloaded_database.password_encrypted == b"encrypted-secret"
    assert reloaded_database.password_salt == b"salt"

    assert reloaded_task is not None
    assert reloaded_task.status is TaskStatus.COMPLETED
    assert reloaded_task.priority is TaskPriority.HIGH
    assert reloaded_task.database_id == database_id
    assert reloaded_task.parameters == {}
    assert reloaded_task.result is None
    assert reloaded_task.progress == 0
    assert reloaded_task.steps_completed == []
    assert reloaded_task.retries == 0
    assert reloaded_task.max_retries == 3
    assert reloaded_task.tags == []

    assert reloaded_log is not None
    assert reloaded_log.level == "info"
    assert reloaded_log.message == "started"
    assert reloaded_log.context == {}


async def test_task_status_rejects_out_of_contract_value(session):
    session.add(TaskRecord(agent_type="sql_generator", status=OUT_OF_CONTRACT_STATUS))

    with pytest.raises(sa.exc.IntegrityError) as excinfo:
        await session.commit()
    await session.rollback()

    assert "CHECK constraint failed" in str(excinfo.value)
    assert await session.scalar(sa.select(sa.func.count()).select_from(TaskRecord)) == 0


async def test_task_priority_rejects_out_of_contract_value(session):
    session.add(TaskRecord(agent_type="sql_generator", priority=OUT_OF_CONTRACT_PRIORITY))

    with pytest.raises(sa.exc.IntegrityError) as excinfo:
        await session.commit()
    await session.rollback()

    assert "CHECK constraint failed" in str(excinfo.value)
    assert await session.scalar(sa.select(sa.func.count()).select_from(TaskRecord)) == 0


async def test_task_enum_check_constraints_are_enforced_by_database(session):
    for column, out_of_contract_value in (
        ("status", OUT_OF_CONTRACT_STATUS),
        ("priority", OUT_OF_CONTRACT_PRIORITY),
    ):
        statement = sa.insert(TaskRecord.__table__).values(
            agent_type="sql_generator",
            **{column: sa.literal(out_of_contract_value)},
        )

        with pytest.raises(sa.exc.IntegrityError) as excinfo:
            await session.execute(statement)
        await session.rollback()

        assert "CHECK constraint failed" in str(excinfo.value)
        assert await session.scalar(sa.select(sa.func.count()).select_from(TaskRecord)) == 0
