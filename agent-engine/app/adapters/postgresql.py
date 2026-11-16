"""PostgreSQL database adapter implementation with EXPLAIN JSON parsing."""
import time
from typing import Any

import asyncpg

from app.adapters.base import (
    ColumnInfo,
    DatabaseAdapter,
    QueryPlan,
    QueryResult,
    TableInfo,
)


class PostgreSQLAdapter(DatabaseAdapter):
    """PostgreSQL database adapter using asyncpg."""

    dialect_name = "postgresql"
    driver_name = "asyncpg"
    default_port = 5432

    def __init__(self, config: dict[str, Any]):
        self.config = config
        self._connection: asyncpg.Connection | None = None
        self._pool: asyncpg.Pool | None = None

    async def connect(self, connection_string: str) -> asyncpg.Connection:
        """Create a connection to the PostgreSQL database."""
        # Parse connection string or use config
        if connection_string.startswith(("postgresql://", "postgres://")):
            # Use connection string directly
            self._pool = await asyncpg.create_pool(connection_string)
            conn = await self._pool.acquire()
        else:
            # Build from config
            config = {**self.config, **connection_string} if isinstance(connection_string, dict) else self.config
            self._pool = await asyncpg.create_pool(
                host=config.get("host", "localhost"),
                port=config.get("port", self.default_port),
                user=config.get("username"),
                password=config.get("password"),
                database=config.get("database_name"),
            )
            conn = await self._pool.acquire()

        self._connection = conn
        return conn

    async def close(self, connection: asyncpg.Connection) -> None:
        """Close the database connection."""
        if self._pool and connection:
            await self._pool.release(connection)
        if self._pool:
            await self._pool.close()
            self._pool = None
        self._connection = None

    async def test_connection(self, connection: asyncpg.Connection) -> tuple[bool, str | None]:
        """Test if connection is alive."""
        try:
            await connection.execute("SELECT 1")
            return True, None
        except Exception as e:
            return False, str(e)

    async def get_tables(self, connection: asyncpg.Connection, schema: str | None = None) -> list[TableInfo]:
        """Get all tables in the database/schema."""
        schema = schema or "public"
        tables = []

        query = """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = $1 AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """
        rows = await connection.fetch(query, schema)

        for row in rows:
            table_name = row["table_name"]
            table_info = await self.get_table_info(connection, table_name, schema)
            tables.append(table_info)

        return tables

    async def get_table_info(self, connection: asyncpg.Connection, table_name: str, schema: str | None = None) -> TableInfo:
        """Get detailed information about a specific table."""
        schema = schema or "public"

        # Get column info
        col_query = """
            SELECT
                column_name,
                data_type,
                is_nullable,
                column_default,
                CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
                CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
                fk.foreign_table_name,
                fk.foreign_column_name
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT ku.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku
                    ON tc.constraint_name = ku.constraint_name
                WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_schema = $1
                    AND tc.table_name = $2
            ) pk ON c.column_name = pk.column_name
            LEFT JOIN (
                SELECT
                    kcu.column_name,
                    ccu.table_name as foreign_table_name,
                    ccu.column_name as foreign_column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage ccu
                    ON tc.constraint_name = ccu.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_schema = $1
                    AND tc.table_name = $2
            ) fk ON c.column_name = fk.column_name
            WHERE c.table_schema = $1 AND c.table_name = $2
            ORDER BY c.ordinal_position
        """
        col_rows = await connection.fetch(col_query, schema, table_name)

        columns = []
        for col in col_rows:
            references = None
            if col["is_foreign_key"] and col["foreign_table_name"] and col["foreign_column_name"]:
                references = f"{col['foreign_table_name']}.{col['foreign_column_name']}"

            columns.append(
                ColumnInfo(
                    name=col["column_name"],
                    type=col["data_type"],
                    nullable=col["is_nullable"] == "YES",
                    default=col["column_default"],
                    is_primary_key=col["is_primary_key"],
                    is_foreign_key=col["is_foreign_key"],
                    references=references,
                )
            )

        # Get indexes
        idx_query = """
            SELECT
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = $1 AND tablename = $2
        """
        idx_rows = await connection.fetch(idx_query, schema, table_name)
        indexes = []
        for idx in idx_rows:
            indexes.append({
                "name": idx["indexname"],
                "definition": idx["indexdef"],
            })

        # Get row count estimate
        try:
            count_query = f'SELECT COUNT(*) FROM "{schema}"."{table_name}"'
            row = await connection.fetchrow(count_query)
            row_count = row[0] if row else 0
        except Exception:
            row_count = None

        return TableInfo(
            name=table_name,
            columns=columns,
            indexes=indexes,
            row_count_estimate=row_count,
            schema_name=schema,
        )

    async def execute_query(
        self,
        connection: asyncpg.Connection,
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

        # Convert ? placeholders to $1, $2, etc. for asyncpg
        if params:
            # Simple conversion - assumes ? placeholders in order
            import re
            def replace_placeholder(match):
                replace_placeholder.counter += 1
                return f"${replace_placeholder.counter}"
            replace_placeholder.counter = 0
            query = re.sub(r"\?", replace_placeholder, query)

        rows = await connection.fetch(query, *(params or []))

        execution_time_ms = (time.perf_counter() - start_time) * 1000

        if not rows:
            return QueryResult(
                columns=[],
                rows=[],
                row_count=0,
                execution_time_ms=execution_time_ms,
                truncated=False,
            )

        columns = list(rows[0].keys())
        rows_list = [list(row.values()) for row in rows]
        truncated = len(rows_list) >= limit

        return QueryResult(
            columns=columns,
            rows=rows_list,
            row_count=len(rows_list),
            execution_time_ms=execution_time_ms,
            truncated=truncated,
        )

    async def execute_command(self, connection: asyncpg.Connection, command: str) -> int:
        """Execute a DDL/DML command. Returns affected rows."""
        result = await connection.execute(command)
        # asyncpg returns "INSERT 0 1" etc., parse the count
        parts = result.split()
        return int(parts[-1]) if parts[-1].isdigit() else 0

    async def explain_query(self, connection: asyncpg.Connection, query: str, params: list[Any] | None = None) -> QueryPlan:
        """Get execution plan for a query using EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)."""
        explain_query = f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {query}"

        # Convert ? placeholders to $1, $2, etc.
        if params:
            import re
            def replace_placeholder(match):
                replace_placeholder.counter += 1
                return f"${replace_placeholder.counter}"
            replace_placeholder.counter = 0
            explain_query = re.sub(r"\?", replace_placeholder, explain_query)

        rows = await connection.fetch(explain_query, *(params or []))

        if not rows:
            return QueryPlan(raw=[], estimated_cost=None, estimated_rows=None, operations=[])

        # The result is a JSON array with one element containing the plan
        plan_json = rows[0][0] if rows[0] else {}
        if isinstance(plan_json, str):
            import json
            plan_json = json.loads(plan_json)

        return parse_pg_explain_json(plan_json)

    async def get_indexes(self, connection: asyncpg.Connection, table_name: str, schema: str | None = None) -> list[dict[str, Any]]:
        """Get indexes for a table."""
        schema = schema or "public"
        query = """
            SELECT
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = $1 AND tablename = $2
        """
        rows = await connection.fetch(query, schema, table_name)
        return [{"name": row["indexname"], "definition": row["indexdef"]} for row in rows]

    async def get_table_stats(self, connection: asyncpg.Connection, table_name: str, schema: str | None = None) -> dict[str, Any]:
        """Get table statistics."""
        schema = schema or "public"
        query = """
            SELECT
                pg_total_relation_size($1::regclass) as total_size,
                pg_relation_size($1::regclass) as table_size,
                pg_total_relation_size($1::regclass) - pg_relation_size($1::regclass) as index_size
        """
        row = await connection.fetchrow(query, f"{schema}.{table_name}")
        size_info = dict(row) if row else {}

        # Get row count
        try:
            count_query = f'SELECT COUNT(*) FROM "{schema}"."{table_name}"'
            count_row = await connection.fetchrow(count_query)
            row_count = count_row[0] if count_row else 0
        except Exception:
            row_count = None

        return {
            "table_name": table_name,
            "schema_name": schema,
            "row_count": row_count,
            **size_info,
        }

    def build_connection_string(self, config: dict[str, Any]) -> str:
        """Build connection string from config dict."""
        parts = []
        if config.get("username"):
            parts.append(f"user={config['username']}")
        if config.get("password"):
            parts.append(f"password={config['password']}")
        if config.get("host"):
            parts.append(f"host={config['host']}")
        if config.get("port"):
            parts.append(f"port={config['port']}")
        if config.get("database_name"):
            parts.append(f"dbname={config['database_name']}")
        return "postgresql://" + "&".join(parts) if not parts[0].startswith("postgresql") else " ".join(parts)

    def get_type_mapping(self) -> dict[str, str]:
        """Get mapping from PostgreSQL types to standard types."""
        return {
            "integer": "integer",
            "bigint": "integer",
            "smallint": "integer",
            "serial": "integer",
            "bigserial": "integer",
            "numeric": "numeric",
            "decimal": "numeric",
            "real": "float",
            "double precision": "float",
            "text": "text",
            "varchar": "text",
            "char": "text",
            "boolean": "boolean",
            "date": "date",
            "timestamp": "datetime",
            "timestamptz": "datetime",
            "time": "time",
            "timetz": "time",
            "uuid": "uuid",
            "json": "json",
            "jsonb": "json",
            "bytea": "bytes",
        }


# ============================================================
# Pure function EXPLAIN JSON parsing
# ============================================================

def parse_pg_explain_json(json_list: list[dict[str, Any]]) -> QueryPlan:
    """
    Parse PostgreSQL EXPLAIN (FORMAT JSON) output into structured QueryPlan.
    
    Args:
        json_list: The JSON list returned by EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        
    Returns:
        QueryPlan with estimated_cost, estimated_rows, and operations list
    """
    if not json_list:
        return QueryPlan(raw=[], estimated_cost=None, estimated_rows=None, operations=[])

    # The JSON is a list with one element containing the plan
    plan_root = json_list[0] if isinstance(json_list, list) else json_list
    plan = plan_root.get("Plan", plan_root) if isinstance(plan_root, dict) else {}

    estimated_cost = plan.get("Total Cost") or plan.get("Estimated Total Cost")
    estimated_rows = plan.get("Plan Rows") or plan.get("Estimated Rows")

    operations = list(iter_plan_nodes(plan))

    return QueryPlan(
        raw=json_list,
        estimated_cost=float(estimated_cost) if estimated_cost is not None else None,
        estimated_rows=float(estimated_rows) if estimated_rows is not None else None,
        operations=operations,
    )


def iter_plan_nodes(plan_dict: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Iterate through all nodes in an EXPLAIN plan tree.
    
    Args:
        plan_dict: The root plan dictionary from EXPLAIN JSON
        
    Yields:
        Node dictionaries with keys: Node Type, Relation Name, Total Cost, 
        Actual Rows, Filter, Index Cond, etc.
    """
    if not plan_dict or not isinstance(plan_dict, dict):
        return []

    nodes = []

    def visit(node: dict[str, Any], parent: dict[str, Any] | None = None):
        # Create a clean node dict with relevant fields
        node_info = {
            "Node Type": node.get("Node Type"),
            "Relation Name": node.get("Relation Name"),
            "Alias": node.get("Alias"),
            "Startup Cost": node.get("Startup Cost"),
            "Total Cost": node.get("Total Cost"),
            "Plan Rows": node.get("Plan Rows"),
            "Plan Width": node.get("Plan Width"),
            "Actual Startup Time": node.get("Actual Startup Time"),
            "Actual Total Time": node.get("Actual Total Time"),
            "Actual Rows": node.get("Actual Rows"),
            "Actual Loops": node.get("Actual Loops"),
            "Filter": node.get("Filter"),
            "Index Cond": node.get("Index Cond"),
            "Recheck Cond": node.get("Recheck Cond"),
            "Hash Cond": node.get("Hash Cond"),
            "Merge Cond": node.get("Merge Cond"),
            "Join Type": node.get("Join Type"),
            "Parent Relationship": node.get("Parent Relationship"),
            "Parallel Aware": node.get("Parallel Aware"),
            "Workers Planned": node.get("Workers Planned"),
            "Workers Launched": node.get("Workers Launched"),
            "Shared Hit Blocks": node.get("Shared Hit Blocks"),
            "Shared Read Blocks": node.get("Shared Read Blocks"),
            "Shared Dirtied Blocks": node.get("Shared Dirtied Blocks"),
            "Shared Written Blocks": node.get("Shared Written Blocks"),
            "Local Hit Blocks": node.get("Local Hit Blocks"),
            "Local Read Blocks": node.get("Local Read Blocks"),
            "Local Dirtied Blocks": node.get("Local Dirtied Blocks"),
            "Local Written Blocks": node.get("Local Written Blocks"),
            "Temp Read Blocks": node.get("Temp Read Blocks"),
            "Temp Written Blocks": node.get("Temp Written Blocks"),
            "Sort Key": node.get("Sort Key"),
            "Sort Method": node.get("Sort Method"),
            "Sort Space Used": node.get("Sort Space Used"),
            "Sort Space Type": node.get("Sort Space Type"),
        }
        # Remove None values for cleaner output
        node_info = {k: v for k, v in node_info.items() if v is not None}
        nodes.append(node_info)

        # Recurse into child plans
        for child in node.get("Plans", []):
            visit(child, node)

    visit(plan_dict)
    return nodes