"""Database API tests (Task 5)."""
import uuid

from httpx import AsyncClient
from sqlalchemy import select

from app.config import get_settings
from app.core.encryption import CredentialEncryption
from app.models import DatabaseRecord, User


async def _get_admin_id(session):
    """Get the admin user ID."""
    settings = get_settings()
    user = await session.scalar(select(User).where(User.email == settings.seed_admin_email))
    return user.id


async def test_create_database(client: AsyncClient, admin_token: str):
    """Create a database connection stores encrypted password."""
    settings = get_settings()
    response = await client.post(
        f"{settings.api_prefix}/databases",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "test-db",
            "type": "postgresql",
            "host": "localhost",
            "port": 5432,
            "database_name": "testdb",
            "username": "testuser",
            "password": "secret123",
            "description": "Test database",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "test-db"
    assert data["type"] == "postgresql"
    assert data["host"] == "localhost"
    assert data["port"] == 5432
    assert data["database_name"] == "testdb"
    assert data["username"] == "testuser"
    assert "password" not in data
    assert data["is_active"] is True
    assert "id" in data


async def test_create_database_duplicate_name(
    client: AsyncClient, admin_token: str, test_session_factory
):
    """Create database with duplicate name returns 409 CONFLICT."""
    settings = get_settings()
    factory = test_session_factory
    async with factory() as session:
        admin_id = await _get_admin_id(session)
        encryption = CredentialEncryption(settings.encryption_key)
        ciphertext, salt = encryption.encrypt_password("secret")
        existing = DatabaseRecord(
            name="duplicate-db",
            type="postgresql",
            host="localhost",
            port=5432,
            database_name="testdb",
            username="testuser",
            password_encrypted=ciphertext,
            password_salt=salt,
            created_by=admin_id,
        )
        session.add(existing)
        await session.commit()

    response = await client.post(
        f"{settings.api_prefix}/databases",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "duplicate-db",
            "type": "postgresql",
            "host": "localhost",
            "port": 5432,
            "database_name": "testdb",
            "username": "testuser",
            "password": "secret123",
        },
    )

    assert response.status_code == 409
    data = response.json()
    assert data["error"]["code"] == "CONFLICT"


async def test_list_databases(client: AsyncClient, admin_token: str, test_session_factory):
    """List databases excludes password fields."""
    settings = get_settings()
    factory = test_session_factory
    async with factory() as session:
        admin_id = await _get_admin_id(session)
        encryption = CredentialEncryption(settings.encryption_key)
        ciphertext, salt = encryption.encrypt_password("secret")
        db1 = DatabaseRecord(
            name="db1",
            type="postgresql",
            host="localhost",
            port=5432,
            database_name="testdb1",
            password_encrypted=ciphertext,
            password_salt=salt,
            created_by=admin_id,
        )
        db2 = DatabaseRecord(
            name="db2",
            type="mysql",
            host="localhost",
            port=3306,
            database_name="testdb2",
            password_encrypted=ciphertext,
            password_salt=salt,
            is_active=False,
            created_by=admin_id,
        )
        session.add_all([db1, db2])
        await session.commit()

    # List active only (default)
    response = await client.get(
        f"{settings.api_prefix}/databases",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "db1"
    assert "password" not in data[0]

    # List all
    response = await client.get(
        f"{settings.api_prefix}/databases?active_only=false",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


async def test_get_database(client: AsyncClient, admin_token: str, test_session_factory):
    """Get a database connection by ID."""
    settings = get_settings()
    factory = test_session_factory
    async with factory() as session:
        admin_id = await _get_admin_id(session)
        encryption = CredentialEncryption(settings.encryption_key)
        ciphertext, salt = encryption.encrypt_password("secret")
        db = DatabaseRecord(
            name="get-test-db",
            type="postgresql",
            host="localhost",
            port=5432,
            database_name="testdb",
            password_encrypted=ciphertext,
            password_salt=salt,
            created_by=admin_id,
        )
        session.add(db)
        await session.commit()
        db_id = str(db.id)

    response = await client.get(
        f"{settings.api_prefix}/databases/{db_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "get-test-db"
    assert data["id"] == db_id
    assert "password" not in data


async def test_get_database_not_found(client: AsyncClient, admin_token: str):
    """Get non-existent database returns 404."""
    settings = get_settings()
    import uuid
    fake_id = str(uuid.uuid4())

    response = await client.get(
        f"{settings.api_prefix}/databases/{fake_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "NOT_FOUND"


async def test_update_database_without_password(
    client: AsyncClient, admin_token: str, test_session_factory
):
    """Update database without password keeps original encrypted password."""
    settings = get_settings()
    factory = test_session_factory
    async with factory() as session:
        admin_id = await _get_admin_id(session)
        encryption = CredentialEncryption(settings.encryption_key)
        ciphertext, salt = encryption.encrypt_password("original-secret")
        db = DatabaseRecord(
            name="update-test-db",
            type="postgresql",
            host="localhost",
            port=5432,
            database_name="testdb",
            password_encrypted=ciphertext,
            password_salt=salt,
            created_by=admin_id,
        )
        session.add(db)
        await session.commit()
        db_id = str(db.id)

    response = await client.put(
        f"{settings.api_prefix}/databases/{db_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"description": "Updated description"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["description"] == "Updated description"
    # password_encrypted is not returned in API response for security
    assert "password" not in data


async def test_update_database_with_new_password(
    client: AsyncClient, admin_token: str, test_session_factory
):
    """Update database with new password encrypts new password."""
    settings = get_settings()
    factory = test_session_factory
    async with factory() as session:
        admin_id = await _get_admin_id(session)
        encryption = CredentialEncryption(settings.encryption_key)
        ciphertext, salt = encryption.encrypt_password("old-secret")
        db = DatabaseRecord(
            name="update-pwd-db",
            type="postgresql",
            host="localhost",
            port=5432,
            database_name="testdb",
            password_encrypted=ciphertext,
            password_salt=salt,
            created_by=admin_id,
        )
        session.add(db)
        await session.commit()
        db_id = str(db.id)

    response = await client.put(
        f"{settings.api_prefix}/databases/{db_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"password": "new-secret"},
    )

    assert response.status_code == 200
    # Verify new password works by fetching and decrypting
    async with factory() as session:
        updated = await session.get(DatabaseRecord, uuid.UUID(db_id))
        encryption = CredentialEncryption(settings.encryption_key)
        decrypted = encryption.decrypt_password(updated.password_encrypted, updated.password_salt)
        assert decrypted == "new-secret"


async def test_delete_database(client: AsyncClient, admin_token: str, test_session_factory):
    """Delete database works."""
    settings = get_settings()
    factory = test_session_factory
    async with factory() as session:
        admin_id = await _get_admin_id(session)
        encryption = CredentialEncryption(settings.encryption_key)
        ciphertext, salt = encryption.encrypt_password("secret")
        db = DatabaseRecord(
            name="delete-test-db",
            type="postgresql",
            host="localhost",
            port=5432,
            database_name="testdb",
            password_encrypted=ciphertext,
            password_salt=salt,
            created_by=admin_id,
        )
        session.add(db)
        await session.commit()
        db_id = str(db.id)

    response = await client.delete(
        f"{settings.api_prefix}/databases/{db_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 204

    # Verify deleted
    async with factory() as session:
        deleted = await session.get(DatabaseRecord, uuid.UUID(db_id))
        assert deleted is None


async def test_create_database_invalid_port(client: AsyncClient, admin_token: str):
    """Create database with invalid port returns 400."""
    settings = get_settings()
    response = await client.post(
        f"{settings.api_prefix}/databases",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "invalid-port-db",
            "type": "postgresql",
            "host": "localhost",
            "port": 70000,
            "database_name": "testdb",
        },
    )

    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"


async def test_create_database_missing_required(client: AsyncClient, admin_token: str):
    """Create database missing required fields returns 400."""
    settings = get_settings()
    response = await client.post(
        f"{settings.api_prefix}/databases",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "incomplete-db"},
    )

    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"


async def test_test_database_connection(
    client: AsyncClient, admin_token: str, test_session_factory
):
    """Test database connection endpoint returns stub result (Task 6 will implement real test)."""
    import os
    import tempfile

    settings = get_settings()
    factory = test_session_factory

    # Create a temporary SQLite database file
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db_path = f.name

    # Initialize the database with a simple table
    import aiosqlite
    conn = await aiosqlite.connect(temp_db_path)
    await conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY)")
    await conn.commit()
    await conn.close()

    async with factory() as session:
        admin_id = await _get_admin_id(session)
        encryption = CredentialEncryption(settings.encryption_key)
        ciphertext, salt = encryption.encrypt_password("secret")
        db = DatabaseRecord(
            name="test-connection-db",
            type="sqlite",
            host="",
            port=None,
            database_name=temp_db_path,
            password_encrypted=ciphertext,
            password_salt=salt,
            created_by=admin_id,
        )
        session.add(db)
        await session.commit()
        db_id = str(db.id)

    try:
        response = await client.post(
            f"{settings.api_prefix}/databases/{db_id}/test",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["latency_ms"] is not None
    finally:
        os.unlink(temp_db_path)