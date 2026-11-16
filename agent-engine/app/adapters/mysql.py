"""MySQL/MariaDB database adapter implementation."""
import time
from typing import Any

import aiomysql

from app.adapters.base import (
    ColumnInfo,
    DatabaseAdapter,
    QueryPlan,
    QueryResult,
    TableInfo,
)


class MySQLAdapter(DatabaseAdapter):
    """MySQL/MariaDB database adapter using aiomysql."""

    dialect_name = "mysql"
    driver_name = "aiomysql"
    default_port = 3306

    def __init__(self, config: dict[str, Any]):
        self.config = config
        self._connection: aiomysql.Connection | None = None
        self._pool: aiomysql.Pool | None = None

    async def connect(self, connection_string: str) -> aiomysql.Connection:
        """Create a connection to the MySQL database."""
        # Parse connection string or use config dict
        if isinstance(connection_string, dict):
            config = {**self.config, **connection_string}
        elif connection_string.startswith(("mysql://", "mysql+aiomysql://")):
            # Parse SQLAlchemy-style connection string
            import urllib.parse
            parsed = urllib.parse.urlparse(connection_string)
            config = {
                "host": parsed.hostname or "localhost",
                "port": parsed.port or self.default_port,
                "user": parsed.username,
                "password": parsed.password,
                "db": parsed.path.lstrip("/") if parsed.path else None,
            }
            # Merge with existing config for any additional options
            config = {**self.config, **config}
        else:
            config = self.config

        self._pool = await aiomysql.create_pool(
            host=config.get("host", "localhost"),
            port=int(config.get("port", self.default_port)),
            user=config.get("username") or config.get("user"),
            password=config.get("password"),
            db=config.get("database_name") or config.get("db"),
            charset="utf8mb4",
            autocommit=True,
        )
        conn = await self._pool.acquire()

        self._connection = conn
        return conn

    async def close(self, connection: aiomysql.Connection) -> None:
        """Close the database connection."""
        if self._pool and connection:
            await self._pool.release(connection)
        if self._pool:
            self._pool.close()
            await self._pool.wait_closed()
            self._pool = None
        self._connection = None

    async def test_connection(self, connection: aiomysql.Connection) -> tuple[bool, str | None]:
        """Test if connection is alive."""
        try:
            async with connection.cursor() as cursor:
                await cursor.execute("SELECT 1")
                await cursor.fetchone()
            return True, None
        except Exception as e:
            return False, str(e)

    async def get_tables(self, connection: aiomysql.Connection, schema: str | None = None) -> list[TableInfo]:
        """Get all tables in the database/schema."""
        schema = schema or self.config.get("database_name", "")
        tables = []

        query = """
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        """
        async with connection.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(query, (schema,))
            rows = await cursor.fetchall()

        for row in rows:
            table_name = row["TABLE_NAME"]
            table_info = await self.get_table_info(connection, table_name, schema)
            tables.append(table_info)

        return tables

    async def get_table_info(self, connection: aiomysql.Connection, table_name: str, schema: str | None = None) -> TableInfo:
        """Get detailed information about a specific table."""
        schema = schema or self.config.get("database_name", "")

        # Get column info
        col_query = """
            SELECT
                COLUMN_NAME,
                DATA_TYPE,
                IS_NULLABLE,
                COLUMN_DEFAULT,
                COLUMN_KEY,
                EXTRA,
                CASE WHEN CONSTRAINT_NAME IS NOT NULL THEN 'YES' ELSE 'NO' END as IS_FOREIGN_KEY,
                REFERENCED_TABLE_NAME,
                REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS c
            LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                ON c.TABLE_SCHEMA = kcu.TABLE_SCHEMA
                AND c.TABLE_NAME = kcu.TABLE_NAME
                AND c.COLUMN_NAME = kcu.COLUMN_NAME
                AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
            WHERE c.TABLE_SCHEMA = %s AND c.TABLE_NAME = %s
            ORDER BY c.ORDINAL_POSITION
        """
        async with connection.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(col_query, (schema, table_name))
            col_rows = await cursor.fetchall()

        columns = []
        for col in col_rows:
            is_pk = col["COLUMN_KEY"] == "PRI"
            is_fk = col["IS_FOREIGN_KEY"] == "YES"
            references = None
            if is_fk and col["REFERENCED_TABLE_NAME"] and col["REFERENCED_COLUMN_NAME"]:
                references = f"{col['REFERENCED_TABLE_NAME']}.{col['REFERENCED_COLUMN_NAME']}"

            columns.append(
                ColumnInfo(
                    name=col["COLUMN_NAME"],
                    type=col["DATA_TYPE"],
                    nullable=col["IS_NULLABLE"] == "YES",
                    default=col["COLUMN_DEFAULT"],
                    is_primary_key=is_pk,
                    is_foreign_key=is_fk,
                    references=references,
                )
            )

        # Get indexes
        idx_query = """
            SELECT
                INDEX_NAME,
                COLUMN_NAME,
                NON_UNIQUE,
                INDEX_TYPE
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            ORDER BY INDEX_NAME, SEQ_IN_INDEX
        """
        async with connection.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(idx_query, (schema, table_name))
            idx_rows = await cursor.fetchall()

        indexes = {}
        for idx in idx_rows:
            name = idx["INDEX_NAME"]
            if name not in indexes:
                indexes[name] = {
                    "name": name,
                    "columns": [],
                    "unique": idx["NON_UNIQUE"] == 0,
                    "type": idx["INDEX_TYPE"],
                }
            indexes[name]["columns"].append(idx["COLUMN_NAME"])

        # Get row count estimate
        try:
            count_query = f'SELECT COUNT(*) FROM `{schema}`.`{table_name}`'
            async with connection.cursor() as cursor:
                await cursor.execute(count_query)
                row = await cursor.fetchone()
                row_count = row[0] if row else 0
        except Exception:
            row_count = None

        return TableInfo(
            name=table_name,
            columns=columns,
            indexes=list(indexes.values()),
            row_count_estimate=row_count,
            schema_name=schema,
        )

    async def execute_query(
        self,
        connection: aiomysql.Connection,
        query: str,
        params: list[Any] | None = None,
        limit: int = 10000,
    ) -> QueryResult:
        """Execute a SELECT query and return results."""
        start_time = time.perf_counter()

        query_upper = query.strip().upper()
        if not query_upper.endswith(";") and "LIMIT" not in query_upper:
            query = f"{query} LIMIT {limit}"

        async with connection.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(query, params or [])
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

        columns = list(rows_raw[0].keys())
        rows_list = [list(row.values()) for row in rows_raw]
        truncated = len(rows_list) >= limit

        return QueryResult(
            columns=columns,
            rows=rows_list,
            row_count=len(rows_list),
            execution_time_ms=execution_time_ms,
            truncated=truncated,
        )

    async def execute_command(self, connection: aiomysql.Connection, command: str) -> int:
        """Execute a DDL/DML command. Returns affected rows."""
        async with connection.cursor() as cursor:
            await cursor.execute(command)
            return cursor.rowcount

    async def explain_query(self, connection: aiomysql.Connection, query: str, params: list[Any] | None = None) -> QueryPlan:
        """Get execution plan for a query using EXPLAIN FORMAT=JSON."""
        explain_query = f"EXPLAIN FORMAT=JSON {query}"

        async with connection.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(explain_query, params or [])
            rows = await cursor.fetchall()

        if not rows:
            return QueryPlan(raw=[], estimated_cost=None, estimated_rows=None, operations=[])

        import json
        plan_json = rows[0].get("EXPLAIN", {})
        if isinstance(plan_json, str):
            plan_json = json.loads(plan_json)

        return parse_mysql_explain_json(plan_json)

    async def get_indexes(self, connection: aiomysql.Connection, table_name: str, schema: str | None = None) -> list[dict[str, Any]]:
        """Get indexes for a table."""
        schema = schema or self.config.get("database_name", "")
        query = """
            SELECT
                INDEX_NAME,
                COLUMN_NAME,
                NON_UNIQUE,
                INDEX_TYPE
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            ORDER BY INDEX_NAME, SEQ_IN_INDEX
        """
        async with connection.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(query, (schema, table_name))
            rows = await cursor.fetchall()

        indexes = {}
        for row in rows:
            name = row["INDEX_NAME"]
            if name not in indexes:
                indexes[name] = {
                    "name": name,
                    "columns": [],
                    "unique": row["NON_UNIQUE"] == 0,
                    "type": row["INDEX_TYPE"],
                }
            indexes[name]["columns"].append(row["COLUMN_NAME"])

        return list(indexes.values())

    async def get_table_stats(self, connection: aiomysql.Connection, table_name: str, schema: str | None = None) -> dict[str, Any]:
        """Get table statistics."""
        schema = schema or self.config.get("database_name", "")

        # Get row count
        try:
            count_query = f'SELECT COUNT(*) FROM `{schema}`.`{table_name}`'
            async with connection.cursor() as cursor:
                await cursor.execute(count_query)
                row = await cursor.fetchone()
                row_count = row[0] if row else 0
        except Exception:
            row_count = None

        # Get table size info
        size_query = """
            SELECT
                TABLE_NAME,
                ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS SIZE_MB,
                TABLE_ROWS
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
        """
        async with connection.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(size_query, (schema, table_name))
            row = await cursor.fetchone()
            size_info = dict(row) if row else {}

        return {
            "table_name": table_name,
            "schema_name": schema,
            "row_count": row_count,
            **size_info,
        }

    def build_connection_string(self, config: dict[str, Any]) -> str:
        """Build connection string from config dict."""
        username = config.get("username") or ""
        password = config.get("password") or ""
        host = config.get("host", "localhost")
        port = config.get("port", self.default_port)
        database_name = config.get("database_name") or ""
        
        auth = ""
        if username:
            if password:
                auth = f"{username}:{password}@"
            else:
                auth = f"{username}@"
        
        return f"mysql+aiomysql://{auth}{host}:{port}/{database_name}"

    def get_type_mapping(self) -> dict[str, str]:
        """Get mapping from MySQL types to standard types."""
        return {
            "tinyint": "integer",
            "smallint": "integer",
            "mediumint": "integer",
            "int": "integer",
            "integer": "integer",
            "bigint": "integer",
            "decimal": "numeric",
            "numeric": "numeric",
            "float": "float",
            "double": "float",
            "bit": "boolean",
            "char": "text",
            "varchar": "text",
            "tinytext": "text",
            "text": "text",
            "mediumtext": "text",
            "longtext": "text",
            "binary": "bytes",
            "varbinary": "bytes",
            "tinyblob": "bytes",
            "blob": "bytes",
            "mediumblob": "bytes",
            "longblob": "bytes",
            "date": "date",
            "datetime": "datetime",
            "timestamp": "datetime",
            "time": "time",
            "year": "integer",
            "json": "json",
            "enum": "text",
            "set": "text",
        }


def parse_mysql_explain_json(plan_json: dict[str, Any]) -> QueryPlan:
    """Parse MySQL EXPLAIN FORMAT=JSON output into structured QueryPlan."""
    if not plan_json:
        return QueryPlan(raw=[], estimated_cost=None, estimated_rows=None, operations=[])

    query_block = plan_json.get("query_block", plan_json)
    operations = list(iter_mysql_plan_nodes(query_block))

    estimated_cost = query_block.get("cost_info", {}).get("query_cost")
    estimated_rows = None

    return QueryPlan(
        raw=[plan_json],
        estimated_cost=float(estimated_cost) if estimated_cost is not None else None,
        estimated_rows=float(estimated_rows) if estimated_rows is not None else None,
        operations=operations,
    )


def iter_mysql_plan_nodes(node: dict[str, Any]) -> list[dict[str, Any]]:
    """Iterate through all nodes in a MySQL EXPLAIN plan tree."""
    if not node or not isinstance(node, dict):
        return []

    nodes = []

    def visit(n: dict[str, Any], parent: dict[str, Any] | None = None):
        node_info = {
            "id": n.get("id"),
            "select_type": n.get("select_type"),
            "table": n.get("table", {}).get("table_name") if isinstance(n.get("table"), dict) else n.get("table"),
            "partitions": n.get("partitions"),
            "type": n.get("access_type") or n.get("type"),
            "possible_keys": n.get("possible_keys"),
            "key": n.get("key"),
            "key_len": n.get("key_length"),
            "ref": n.get("ref"),
            "rows": n.get("rows"),
            "filtered": n.get("filtered"),
            "extra": n.get("attached_condition") or n.get("extra"),
            "cost_info": n.get("cost_info"),
        }
        node_info = {k: v for k, v in node_info.items() if v is not None}
        nodes.append(node_info)

        # Recurse into children
        for child_key in ("nested_loop", "materialized_from_subquery", "dependent_subqueries", "subqueries"):
            if child_key in n:
                child = n[child_key]
                if isinstance(child, list):
                    for c in child:
                        visit(c, n)
                elif isinstance(child, dict):
                    visit(child, n)

        # Handle joined tables
        if "table" in n and isinstance(n["table"], dict):
            for key in ("joined", "nested_join"):
                if key in n["table"]:
                    visit(n["table"][key], n)

    visit(node)
    return nodes