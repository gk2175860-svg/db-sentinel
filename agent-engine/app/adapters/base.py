"""Database adapter base classes and data structures."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class ColumnInfo:
    """Information about a database column."""
    name: str
    type: str
    nullable: bool
    default: Any
    is_primary_key: bool
    is_foreign_key: bool
    references: str | None = None


@dataclass
class TableInfo:
    """Information about a database table."""
    name: str
    columns: list[ColumnInfo]
    indexes: list[dict[str, Any]]
    row_count_estimate: int | None
    schema_name: str | None = None


@dataclass
class QueryResult:
    """Result of a query execution."""
    columns: list[str]
    rows: list[list[Any]]
    row_count: int
    execution_time_ms: float
    truncated: bool


@dataclass
class QueryPlan:
    """Query execution plan."""
    raw: Any
    estimated_cost: float | None
    estimated_rows: float | None
    operations: list[dict[str, Any]]


class DatabaseAdapter(ABC):
    """Abstract base class for database adapters."""

    dialect_name: str
    driver_name: str
    default_port: int

    @abstractmethod
    async def connect(self, connection_string: str) -> Any:
        """Create a connection to the database."""

    @abstractmethod
    async def close(self, connection: Any) -> None:
        """Close a database connection."""

    @abstractmethod
    async def test_connection(self, connection: Any) -> tuple[bool, str | None]:
        """Test if connection is alive. Returns (success, error_message)."""

    @abstractmethod
    async def get_tables(self, connection: Any, schema: str | None = None) -> list[TableInfo]:
        """Get all tables in the database/schema."""

    @abstractmethod
    async def get_table_info(self, connection: Any, table_name: str, schema: str | None = None) -> TableInfo:
        """Get detailed information about a specific table."""

    @abstractmethod
    async def execute_query(
        self,
        connection: Any,
        query: str,
        params: list[Any] | None = None,
        limit: int = 10000,
    ) -> QueryResult:
        """Execute a SELECT query and return results."""

    @abstractmethod
    async def execute_command(self, connection: Any, command: str) -> int:
        """Execute a DDL/DML command (INSERT, UPDATE, DELETE, CREATE, etc.). Returns affected rows."""

    @abstractmethod
    async def explain_query(self, connection: Any, query: str, params: list[Any] | None = None) -> QueryPlan:
        """Get execution plan for a query."""

    @abstractmethod
    async def get_indexes(self, connection: Any, table_name: str, schema: str | None = None) -> list[dict[str, Any]]:
        """Get indexes for a table."""

    @abstractmethod
    async def get_table_stats(self, connection: Any, table_name: str, schema: str | None = None) -> dict[str, Any]:
        """Get table statistics (row count, size, etc.)."""

    @abstractmethod
    def build_connection_string(self, config: dict[str, Any]) -> str:
        """Build connection string from config dict."""

    @abstractmethod
    def get_type_mapping(self) -> dict[str, str]:
        """Get mapping from database types to standard types."""
