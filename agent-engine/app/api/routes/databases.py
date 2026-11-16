"""Database connection CRUD API routes."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_permission
from app.config import get_settings
from app.core.encryption import CredentialEncryption
from app.models import DatabaseRecord, User
from app.schemas.database import DatabaseCreate, DatabaseOut, DatabaseUpdate, TestResult

router = APIRouter(prefix="/databases", tags=["databases"])


def get_credential_encryption() -> CredentialEncryption:
    settings = get_settings()
    return CredentialEncryption(settings.encryption_key)


@router.post("", response_model=DatabaseOut, status_code=status.HTTP_201_CREATED)
async def create_database(
    request: DatabaseCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("databases:create")),
    encryption: CredentialEncryption = Depends(get_credential_encryption),
) -> DatabaseOut:
    """Create a new database connection."""
    # Check for duplicate name
    existing = await session.scalar(
        select(DatabaseRecord).where(DatabaseRecord.name == request.name)
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Database with name '{request.name}' already exists",
        )

    # Encrypt password if provided
    password_encrypted = None
    password_salt = None
    if request.password:
        password_encrypted, password_salt = encryption.encrypt_password(request.password)

    # Prepare pool config with defaults
    pool_config = {
        "pool_size": 5,
        "max_overflow": 10,
        "pool_timeout": 30,
        "pool_recycle": 3600,
    }
    pool_config.update(request.pool_config)

    database = DatabaseRecord(
        name=request.name,
        type=request.type,
        host=request.host,
        port=request.port,
        database_name=request.database_name,
        schema_name=request.schema_name,
        username=request.username,
        password_encrypted=password_encrypted,
        password_salt=password_salt,
        connection_config=request.connection_options,
        pool_config=pool_config,
        tags=request.tags,
        description=request.description,
        is_active=True,
        created_by=current_user.id,
    )
    session.add(database)
    await session.commit()
    await session.refresh(database)

    return DatabaseOut(
        id=str(database.id),
        name=database.name,
        type=database.type,
        host=database.host,
        port=database.port,
        database_name=database.database_name,
        schema_name=database.schema_name,
        username=database.username,
        connection_config=database.connection_config,
        pool_config=database.pool_config,
        tags=database.tags,
        description=database.description,
        is_active=database.is_active,
        last_tested_at=database.last_tested_at.isoformat() if database.last_tested_at else None,
        last_test_status=database.last_test_status,
        last_test_error=database.last_test_error,
        version=database.version,
        created_by=str(database.created_by),
        created_at=database.created_at.isoformat() if database.created_at else None,
        updated_at=database.updated_at.isoformat() if database.updated_at else None,
    )


@router.get("", response_model=list[DatabaseOut])
async def list_databases(
    active_only: bool = True,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("databases:read")),
) -> list[DatabaseOut]:
    """List all database connections."""
    stmt = select(DatabaseRecord)
    if active_only:
        stmt = stmt.where(DatabaseRecord.is_active.is_(True))
    stmt = stmt.order_by(DatabaseRecord.created_at.desc())

    result = await session.execute(stmt)
    databases = result.scalars().all()

    return [
        DatabaseOut(
            id=str(db.id),
            name=db.name,
            type=db.type,
            host=db.host,
            port=db.port,
            database_name=db.database_name,
            schema_name=db.schema_name,
            username=db.username,
            connection_config=db.connection_config,
            pool_config=db.pool_config,
            tags=db.tags,
            description=db.description,
            is_active=db.is_active,
            last_tested_at=db.last_tested_at.isoformat() if db.last_tested_at else None,
            last_test_status=db.last_test_status,
            last_test_error=db.last_test_error,
            version=db.version,
            created_by=str(db.created_by),
            created_at=db.created_at.isoformat() if db.created_at else None,
            updated_at=db.updated_at.isoformat() if db.updated_at else None,
        )
        for db in databases
    ]


@router.get("/{database_id}", response_model=DatabaseOut)
async def get_database(
    database_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("databases:read")),
) -> DatabaseOut:
    """Get a database connection by ID."""
    database = await session.get(DatabaseRecord, uuid.UUID(database_id))
    if database is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database not found",
        )

    return DatabaseOut(
        id=str(database.id),
        name=database.name,
        type=database.type,
        host=database.host,
        port=database.port,
        database_name=database.database_name,
        schema_name=database.schema_name,
        username=database.username,
        connection_config=database.connection_config,
        pool_config=database.pool_config,
        tags=database.tags,
        description=database.description,
        is_active=database.is_active,
        last_tested_at=database.last_tested_at.isoformat() if database.last_tested_at else None,
        last_test_status=database.last_test_status,
        last_test_error=database.last_test_error,
        version=database.version,
        created_by=str(database.created_by),
        created_at=database.created_at.isoformat() if database.created_at else None,
        updated_at=database.updated_at.isoformat() if database.updated_at else None,
    )


@router.put("/{database_id}", response_model=DatabaseOut)
async def update_database(
    database_id: str,
    request: DatabaseUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("databases:update")),
    encryption: CredentialEncryption = Depends(get_credential_encryption),
) -> DatabaseOut:
    """Update a database connection."""
    database = await session.get(DatabaseRecord, uuid.UUID(database_id))
    if database is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database not found",
        )

    # Check for duplicate name if name is being changed
    if request.name is not None and request.name != database.name:
        existing = await session.scalar(
            select(DatabaseRecord).where(DatabaseRecord.name == request.name)
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Database with name '{request.name}' already exists",
            )

    # Update fields
    update_data = request.model_dump(exclude_unset=True)

    # Handle password encryption
    if "password" in update_data:
        password = update_data.pop("password")
        if password:
            password_encrypted, password_salt = encryption.encrypt_password(password)
            database.password_encrypted = password_encrypted
            database.password_salt = password_salt
        # If password is None/empty, keep existing encrypted password

    for field, value in update_data.items():
        setattr(database, field, value)

    await session.commit()
    await session.refresh(database)

    return DatabaseOut(
        id=str(database.id),
        name=database.name,
        type=database.type,
        host=database.host,
        port=database.port,
        database_name=database.database_name,
        schema_name=database.schema_name,
        username=database.username,
        connection_config=database.connection_config,
        pool_config=database.pool_config,
        tags=database.tags,
        description=database.description,
        is_active=database.is_active,
        last_tested_at=database.last_tested_at.isoformat() if database.last_tested_at else None,
        last_test_status=database.last_test_status,
        last_test_error=database.last_test_error,
        version=database.version,
        created_by=str(database.created_by),
        created_at=database.created_at.isoformat() if database.created_at else None,
        updated_at=database.updated_at.isoformat() if database.updated_at else None,
    )


@router.delete("/{database_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_database(
    database_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("databases:delete")),
) -> None:
    """Delete a database connection."""
    database = await session.get(DatabaseRecord, uuid.UUID(database_id))
    if database is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database not found",
        )

    await session.delete(database)
    await session.commit()


@router.post("/{database_id}/test", response_model=TestResult)
async def test_database_connection(
    database_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("databases:connect")),
) -> TestResult:
    """Test a database connection using the adapter registry."""
    from datetime import UTC, datetime

    database = await session.get(DatabaseRecord, uuid.UUID(database_id))
    if database is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database not found",
        )

    try:
        from app.adapters import get_adapter_instance
        from app.config import get_settings
        from app.core.encryption import CredentialEncryption

        # Decrypt password if present
        password = None
        if database.password_encrypted and database.password_salt:
            settings = get_settings()
            encryption = CredentialEncryption(settings.encryption_key)
            password = encryption.decrypt_password(database.password_encrypted, database.password_salt)

        # Build config for adapter
        config = {
            "type": database.type,
            "host": database.host,
            "port": database.port,
            "database_name": database.database_name,
            "username": database.username,
            "password": password,
            "connection_options": database.connection_config,
        }

        # Get adapter instance and test connection
        adapter = get_adapter_instance(database.type, config)
        connection_string = adapter.build_connection_string(config)
        connection = await adapter.connect(connection_string)

        try:
            success, error = await adapter.test_connection(connection)
            latency_ms = 0  # Could measure actual latency
            version = "unknown"

            database.last_tested_at = datetime.now(UTC)
            database.last_test_status = "success" if success else "failed"
            database.last_test_error = error
            await session.commit()

            return TestResult(
                success=success,
                latency_ms=latency_ms,
                version=version,
                error=error,
            )
        finally:
            await adapter.close(connection)

    except KeyError:
        # No adapter registered for this database type
        database.last_tested_at = datetime.now(UTC)
        database.last_test_status = "failed"
        database.last_test_error = f"No adapter registered for database type: {database.type}"
        await session.commit()

        return TestResult(
            success=False,
            latency_ms=0,
            version=None,
            error=f"No adapter registered for database type: {database.type}",
        )
    except Exception as e:
        database.last_tested_at = datetime.now(UTC)
        database.last_test_status = "failed"
        database.last_test_error = str(e)
        await session.commit()

        return TestResult(
            success=False,
            latency_ms=0,
            version=None,
            error=str(e),
        )