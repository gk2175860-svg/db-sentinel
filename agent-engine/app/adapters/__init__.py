"""Database adapter package."""
from app.adapters.base import (
    ColumnInfo,
    DatabaseAdapter,
    QueryPlan,
    QueryResult,
    TableInfo,
)
from app.adapters.mysql import MySQLAdapter
from app.adapters.postgresql import PostgreSQLAdapter, iter_plan_nodes, parse_pg_explain_json
from app.adapters.registry import (
    get_adapter,
    get_adapter_instance,
    list_adapters,
    register_adapter,
)
from app.adapters.sqlite import SQLiteAdapter

# Register built-in adapters
register_adapter(SQLiteAdapter)
register_adapter(PostgreSQLAdapter)
register_adapter(MySQLAdapter)

__all__ = [
    "ColumnInfo",
    "DatabaseAdapter",
    "MySQLAdapter",
    "PostgreSQLAdapter",
    "QueryPlan",
    "QueryResult",
    "SQLiteAdapter",
    "TableInfo",
    "get_adapter",
    "get_adapter_instance",
    "list_adapters",
    "parse_pg_explain_json",
    "register_adapter",
]