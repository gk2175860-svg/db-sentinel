"""Adapter framework tests (Task 6)."""
import os
import tempfile

import pytest

from app.adapters import (
    SQLiteAdapter,
    get_adapter,
    get_adapter_instance,
    list_adapters,
    register_adapter,
)
from app.adapters.base import DatabaseAdapter as BaseDatabaseAdapter


class TestAdapterRegistry:
    """Tests for adapter registry."""

    def test_list_adapters_includes_sqlite(self):
        """SQLite adapter should be registered by default."""
        adapters = list_adapters()
        assert "sqlite" in adapters

    def test_get_adapter_returns_sqlite_class(self):
        """get_adapter should return SQLiteAdapter class."""
        adapter_class = get_adapter("sqlite")
        assert adapter_class is SQLiteAdapter

    def test_get_adapter_raises_for_unknown(self):
        """get_adapter should raise KeyError for unknown dialect."""
        with pytest.raises(KeyError):
            get_adapter("nonexistent")

    def test_register_adapter_works(self):
        """register_adapter should register a new adapter."""

        class TestAdapter(BaseDatabaseAdapter):
            dialect_name = "test"
            driver_name = "test"
            default_port = 1234

            async def connect(self, connection_string: str):
                pass

            async def close(self, connection):
                pass

            async def test_connection(self, connection):
                pass

            async def get_tables(self, connection, schema=None):
                pass

            async def get_table_info(self, connection, table_name, schema=None):
                pass

            async def execute_query(self, connection, query, params=None, limit=10000):
                pass

            async def execute_command(self, connection, command):
                pass

            async def explain_query(self, connection, query, params=None):
                pass

            async def get_indexes(self, connection, table_name, schema=None):
                pass

            async def get_table_stats(self, connection, table_name, schema=None):
                pass

            def build_connection_string(self, config):
                pass

            def get_type_mapping(self):
                pass

        register_adapter(TestAdapter)
        assert "test" in list_adapters()
        assert get_adapter("test") is TestAdapter


class TestSQLiteAdapter:
    """Tests for SQLite adapter implementation."""

    @pytest.fixture
    def temp_db(self):
        """Create a temporary SQLite database with test data."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name

        import aiosqlite

        async def setup():
            conn = await aiosqlite.connect(db_path)
            await conn.execute("""
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            await conn.execute("""
                CREATE TABLE orders (
                    id INTEGER PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
                    amount REAL,
                    status TEXT
                )
            """)
            await conn.execute("CREATE INDEX idx_orders_user_id ON orders(user_id)")
            await conn.execute("INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')")
            await conn.execute("INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com')")
            await conn.execute("INSERT INTO orders (user_id, amount, status) VALUES (1, 100.50, 'completed')")
            await conn.execute("INSERT INTO orders (user_id, amount, status) VALUES (1, 200.00, 'pending')")
            await conn.execute("INSERT INTO orders (user_id, amount, status) VALUES (2, 50.00, 'completed')")
            await conn.commit()
            await conn.close()

        import asyncio
        asyncio.run(setup())

        yield db_path

        os.unlink(db_path)

    @pytest.fixture
    def adapter(self, temp_db):
        """Create a SQLiteAdapter instance."""
        config = {"database_name": temp_db}
        return get_adapter_instance("sqlite", config)

    @pytest.fixture
    async def connection(self, adapter, temp_db):
        """Create a database connection."""
        conn_str = adapter.build_connection_string({"database_name": temp_db})
        conn = await adapter.connect(conn_str)
        yield conn
        await adapter.close(conn)

    async def test_connect_and_close(self, adapter, temp_db):
        """Test connecting and closing."""
        conn_str = adapter.build_connection_string({"database_name": temp_db})
        conn = await adapter.connect(conn_str)
        assert conn is not None
        await adapter.close(conn)

    async def test_test_connection(self, adapter, connection):
        """Test connection test."""
        success, error = await adapter.test_connection(connection)
        assert success is True
        assert error is None

    async def test_get_tables(self, adapter, connection):
        """Test getting all tables."""
        tables = await adapter.get_tables(connection)
        table_names = {t.name for t in tables}
        assert "users" in table_names
        assert "orders" in table_names

    async def test_get_table_info(self, adapter, connection):
        """Test getting table info."""
        table_info = await adapter.get_table_info(connection, "users")

        assert table_info.name == "users"
        assert len(table_info.columns) == 4
        col_names = {c.name for c in table_info.columns}
        assert col_names == {"id", "name", "email", "created_at"}

        # Check primary key
        pk_cols = [c for c in table_info.columns if c.is_primary_key]
        assert len(pk_cols) == 1
        assert pk_cols[0].name == "id"

        # Check not null
        name_col = next(c for c in table_info.columns if c.name == "name")
        assert name_col.nullable is False

    async def test_execute_query(self, adapter, connection):
        """Test executing a query."""
        result = await adapter.execute_query(connection, "SELECT * FROM users")

        assert result.row_count == 2
        assert len(result.columns) == 4
        assert "id" in result.columns
        assert "name" in result.columns
        assert "email" in result.columns
        assert result.execution_time_ms > 0
        assert not result.truncated

    async def test_execute_query_with_params(self, adapter, connection):
        """Test executing a query with parameters."""
        result = await adapter.execute_query(
            connection, "SELECT * FROM users WHERE name = ?", ["Alice"]
        )

        assert result.row_count == 1
        assert result.rows[0][1] == "Alice"

    async def test_execute_query_with_limit(self, adapter, connection):
        """Test query limit."""
        result = await adapter.execute_query(connection, "SELECT * FROM users", limit=1)

        assert result.row_count == 1
        assert result.truncated is True

    async def test_execute_command(self, adapter, connection):
        """Test executing a command."""
        affected = await adapter.execute_command(connection, "INSERT INTO users (name, email) VALUES ('Charlie', 'charlie@example.com')")
        assert affected == 1

        # Verify insert
        result = await adapter.execute_query(connection, "SELECT COUNT(*) as cnt FROM users")
        assert result.rows[0][0] == 3

    async def test_explain_query(self, adapter, connection):
        """Test explaining a query."""
        plan = await adapter.explain_query(connection, "SELECT * FROM users WHERE name = ?", ["Alice"])

        assert isinstance(plan.operations, list)
        assert len(plan.operations) > 0
        assert plan.raw is not None

    async def test_get_indexes(self, adapter, connection):
        """Test getting indexes."""
        indexes = await adapter.get_indexes(connection, "orders")

        idx_names = {idx["name"] for idx in indexes}
        assert "idx_orders_user_id" in idx_names

        # Check unique index on users table
        user_indexes = await adapter.get_indexes(connection, "users")
        unique_indexes = [idx for idx in user_indexes if idx["unique"]]
        assert len(unique_indexes) > 0  # email has unique index

    async def test_get_table_stats(self, adapter, connection):
        """Test getting table stats."""
        stats = await adapter.get_table_stats(connection, "users")

        assert stats["table_name"] == "users"
        assert stats["row_count"] == 2
        assert stats["size_bytes"] > 0

    async def test_build_connection_string(self, adapter, temp_db):
        """Test building connection string."""
        conn_str = adapter.build_connection_string({"database_name": temp_db})
        assert conn_str == f"sqlite+aiosqlite:///{temp_db}"

    async def test_build_connection_string_missing_db(self, adapter):
        """Test building connection string without database_name."""
        with pytest.raises(ValueError, match="database_name is required"):
            adapter.build_connection_string({})

    def test_get_type_mapping(self, adapter):
        """Test type mapping."""
        mapping = adapter.get_type_mapping()
        assert "INTEGER" in mapping
        assert "TEXT" in mapping
        assert mapping["INTEGER"] == "integer"
        assert mapping["TEXT"] == "text"

    def test_dialect_attributes(self, adapter):
        """Test dialect attributes."""
        assert adapter.dialect_name == "sqlite"
        assert adapter.driver_name == "aiosqlite"
        assert adapter.default_port is None