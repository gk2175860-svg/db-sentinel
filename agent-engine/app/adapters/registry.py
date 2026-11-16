"""Database adapter registry."""
from typing import Any

from app.adapters.base import DatabaseAdapter

_adapters: dict[str, type[DatabaseAdapter]] = {}


def register_adapter(adapter_class: type[DatabaseAdapter]) -> None:
    """Register a database adapter class."""
    if not issubclass(adapter_class, DatabaseAdapter):
        raise TypeError(f"{adapter_class} must be a subclass of DatabaseAdapter")
    if not hasattr(adapter_class, "dialect_name") or not adapter_class.dialect_name:
        raise ValueError("Adapter must have a dialect_name class attribute")
    _adapters[adapter_class.dialect_name] = adapter_class


def get_adapter(dialect: str) -> type[DatabaseAdapter]:
    """Get an adapter class by dialect name."""
    if dialect not in _adapters:
        raise KeyError(f"No adapter registered for dialect: {dialect}")
    return _adapters[dialect]


def list_adapters() -> list[str]:
    """List all registered adapter dialects."""
    return list(_adapters.keys())


def get_adapter_instance(dialect: str, config: dict[str, Any]) -> DatabaseAdapter:
    """Create an adapter instance with the given config."""
    adapter_class = get_adapter(dialect)
    return adapter_class(config)