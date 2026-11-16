"""SQLite database adapter implementation."""
import time
from typing import Any

import aiosqlite

from app.adapters.base import (
    ColumnInfo,
    DatabaseAdapter,
    QueryPlan,
    QueryResult,
    TableInfo,
)


class SQLiteAdapter(DatabaseAdapter):
    """SQLite database adapter using aiosqlite."""

    dialect_name = "sqlite"
    driver_name = "aiosqlite"
    default_port = None

    def __init__(self, config: dict[str, Any]):
        self.config = config
        self._connection: aiosqlite.Connection | None = None

    async def connect(self, connection_string: str) -> aiosqlite.Connection:
        """Create a connection to the SQLite database."""
        # Remove sqlite:// or sqlite+aiosqlite:// prefix
        if connection_string.startswith("sqlite+aiosqlite://"):
            path = connection_string[len("sqlite+aiosqlite://") :]
        elif connection_string.startswith("sqlite://"):
            path = connection_string[len("sqlite://") :]
        else:
            path = connection_string

        # Handle relative paths
        if path.startswith("./"):
            path = path[2:]

        conn = await aiosqlite.connect(path)
        conn.row_factory = aiosqlite.Row
        self._connection = conn
        return conn

    async def close(self, connection: aiosqlite.Connection) -> None:
        """Close the database connection."""
        await connection.close()
        if self._connection is connection:
            self._connection = None

    async def test_connection(self, connection: aiosqlite.Connection) -> tuple[bool, str | None]:
        """Test if connection is alive."""
        try:
            cursor = await connection.execute("SELECT 1")
            await cursor.fetchone()
            return True, None
        except Exception as e:
            return False, str(e)

    async def get_tables(self, connection: aiosqlite.Connection, schema: str | None = None) -> list[TableInfo]:
        """Get all tables in the database."""
        tables = []

        # Get table names
        cursor = await connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        rows = await cursor.fetchall()

        for row in rows:
            table_name = row[0]
            # Get table info for each table
            table_info = await self.get_table_info(connection, table_name)
            tables.append(table_info)

        return tables

    async def get_table_info(self, connection: aiosqlite.Connection, table_name: str, schema: str | None = None) -> TableInfo:
        """Get detailed information about a specific table."""
        # Get column info
        cursor = await connection.execute(f"PRAGMA table_info({table_name})")
        columns_raw = await cursor.fetchall()

        columns = []
        for col in columns_raw:
            # col: cid, name, type, notnull, dflt_value, pk
            columns.append(
                ColumnInfo(
                    name=col[1],
                    type=col[2],
                    nullable=col[3] == 0,
                    default=col[4],
                    is_primary_key=col[5] == 1,
                    is_foreign_key=False,  # Would need PRAGMA foreign_key_list
                    references=None,
                )
            )

        # Get indexes
        cursor = await connection.execute(f"PRAGMA index_list({table_name})")
        indexes_raw = await cursor.fetchall()
        indexes = []
        for idx in indexes_raw:
            # seq, name, unique, origin, partial
            indexes.append(
                {
                    "name": idx[1],
                    "unique": bool(idx[2]),
                    "origin": idx[3],
                    "partial": bool(idx[4]),
                }
            )

        # Get row count estimate
        cursor = await connection.execute(f"SELECT COUNT(*) FROM {table_name}")
        row = await cursor.fetchone()
        row_count = row[0] if row else 0

        return TableInfo(
            name=table_name,
            columns=columns,
            indexes=indexes,
            row_count_estimate=row_count,
            schema_name=schema,
        )

    async def execute_query(
        self,
        connection: aiosqlite.Connection,
        query: str,
        params: list[Any] | None = None,
        limit: int = 10000,
    ) -> QueryResult:
        """Execute a SELECT query and return results."""
        start_time = time.perf_counter()

        # Add LIMIT if not present
        query_upper = query.strip().upper()
        if not query_upper.endswith(";") and "LIMIT" not in query_upper:
            query = f"{query} LIMIT {limit}"

        cursor = await connection.execute(query, params or [])
        rows_raw = await cursor.fetchall()

        execution_time_ms = (time.perf_counter() - start_time) * 1000

        if not rows_raw:
            return QueryResult(
                columns=[],
                rows=[],
                row_count=0,
                execution_time_ms=execution_time_ms,
                truncated=False,
            )

        # Get column names from cursor description
        columns = [desc[0] for desc in cursor.description] if cursor.description else []

        # Convert rows to list of lists
        rows = [list(row) for row in rows_raw]

        truncated = len(rows) >= limit

        return QueryResult(
            columns=columns,
            rows=rows,
            row_count=len(rows),
            execution_time_ms=execution_time_ms,
            truncated=truncated,
        )

    async def execute_command(self, connection: aiosqlite.Connection, command: str) -> int:
        """Execute a DDL/DML command. Returns affected rows."""
        cursor = await connection.execute(command)
        await connection.commit()
        return cursor.rowcount

    async def explain_query(self, connection: aiosqlite.Connection, query: str, params: list[Any] | None = None) -> QueryPlan:
        """Get execution plan for a query using EXPLAIN QUERY PLAN."""
        explain_query = f"EXPLAIN QUERY PLAN {query}"
        cursor = await connection.execute(explain_query, params or [])
        rows = await cursor.fetchall()

        operations = []
        for row in rows:
            # id, parent, notused, detail
            operations.append(
                {
                    "id": row[0],
                    "parent": row[1],
                    "detail": row[3],
                }
            )

        # SQLite doesn't provide cost estimates in EXPLAIN QUERY PLAN
        return QueryPlan(
            raw=rows,
            estimated_cost=None,
            estimated_rows=None,
            operations=operations,
        )

    async def get_indexes(self, connection: aiosqlite.Connection, table_name: str, schema: str | None = None) -> list[dict[str, Any]]:
        """Get indexes for a table."""
        cursor = await connection.execute(f"PRAGMA index_list({table_name})")
        indexes_raw = await cursor.fetchall()

        indexes = []
        for idx in indexes_raw:
            # seq, name, unique, origin, partial
            idx_name = idx[1]
            # Get index columns
            cursor2 = await connection.execute(f"PRAGMA index_info({idx_name})")
            cols_raw = await cursor2.fetchall()
            columns = [col[2] for col in cols_raw]  # col[2] is column name

            indexes.append(
                {
                    "name": idx_name,
                    "unique": bool(idx[2]),
                    "origin": idx[3],
                    "partial": bool(idx[4]),
                    "columns": columns,
                }
            )

        return indexes

    async def get_table_stats(self, connection: aiosqlite.Connection, table_name: str, schema: str | None = None) -> dict[str, Any]:
        """Get table statistics."""
        # Get row count
        cursor = await connection.execute(f"SELECT COUNT(*) FROM {table_name}")
        row = await cursor.fetchone()
        row_count = row[0] if row else 0

        # Get table size (approximate)
        cursor = await connection.execute("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()")
        row = await cursor.fetchone()
        db_size = row[0] if row else 0

        return {
            "table_name": table_name,
            "row_count": row_count,
            "size_bytes": db_size,
        }

    def build_connection_string(self, config: dict[str, Any]) -> str:
        """Build connection string from config dict."""
        database = config.get("database_name", "")
        if not database:
            raise ValueError("database_name is required for SQLite connection")
        return f"sqlite+aiosqlite:///{database}"

    def get_type_mapping(self) -> dict[str, str]:
        """Get mapping from SQLite types to standard types."""
        return {
            "INTEGER": "integer",
            "REAL": "float",
            "TEXT": "text",
            "BLOB": "bytes",
            "NUMERIC": "numeric",
            "BOOLEAN": "boolean",
            "DATE": "date",
            "DATETIME": "datetime",
        }