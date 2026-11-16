"""Agents package."""
from app.agents.sql_generator import SQLGeneratorAgent
from app.agents.query_optimizer import QueryOptimizerAgent
from app.agents.schema_manager import SchemaManagerAgent

# Register agents in the global registry
from app.core.agent_base import event_bus

# Simple agent registry
_agent_registry: dict[str, type] = {
    "sql_generator": SQLGeneratorAgent,
    "query_optimizer": QueryOptimizerAgent,
    "schema_manager": SchemaManagerAgent,
}


def get_agent_class(agent_type: str):
    """Get agent class by type."""
    return _agent_registry.get(agent_type)


def list_agents() -> list[dict]:
    """List all available agents."""
    return [
        {
            "agent_type": agent_type,
            "name": agent_cls.name,
            "description": agent_cls.description,
            "version": agent_cls.version,
            "capabilities": agent_cls.capabilities,
            "required_params": agent_cls.required_params,
            "optional_params": agent_cls.optional_params,
        }
        for agent_type, agent_cls in _agent_registry.items()
    ]


async def create_agent(agent_type: str):
    """Create an agent instance."""
    agent_class = get_agent_class(agent_type)
    if not agent_class:
        return None
    return agent_class()


__all__ = [
    "SQLGeneratorAgent",
    "QueryOptimizerAgent",
    "SchemaManagerAgent",
    "get_agent_class",
    "list_agents",
    "create_agent",
]