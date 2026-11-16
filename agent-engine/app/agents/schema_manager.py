"""Schema Manager Agent - introspects schema and detects drift."""
from typing import Any

from app.adapters import get_adapter_instance
from app.ai import ai_router, AIMessage
from app.core.agent_base import BaseAgent, AgentContext
from app.core.encryption import CredentialEncryption
from app.config import get_settings


class SchemaManagerAgent(BaseAgent):
    """Manages database schema introspection and drift detection."""

    agent_type = "schema_manager"
    name = "Schema Manager"
    description = "Introspects database schema and detects drift from baseline"
    version = "1.0.0"
    capabilities = ["schema_introspection", "drift_detection", "migration_generation", "erd_generation"]
    required_params = ["database_id"]
    optional_params = ["baseline_id", "include_erd", "max_tokens"]

    async def _execute(self, context: AgentContext) -> dict[str, Any]:
        database_id = context.parameters.get("database_id")
        baseline_id = context.parameters.get("baseline_id")
        include_erd = context.parameters.get("include_erd", True)

        if not database_id:
            raise ValueError("database_id is required")

        await context.report_progress(10, "connecting", "Connecting to database...")

        # Get database record and adapter
        from app.db.session import get_session_factory
        from app.models import DatabaseRecord
        from sqlalchemy import select

        session_factory = get_session_factory()
        async with session_factory() as session:
            database = await session.get(DatabaseRecord, database_id)
            if not database:
                raise ValueError(f"Database {database_id} not found")

            password = None
            if database.password_encrypted and database.password_salt:
                settings = get_settings()
                encryption = CredentialEncryption(settings.encryption_key)
                password = encryption.decrypt_password(database.password_encrypted, database.password_salt)

            config = {
                "type": database.type,
                "host": database.host,
                "port": database.port,
                "database_name": database.database_name,
                "username": database.username,
                "password": password,
                "connection_options": database.connection_config,
            }

        adapter = get_adapter_instance(database.type, config)
        conn_str = adapter.build_connection_string(config)
        connection = await adapter.connect(conn_str)

        try:
            await context.report_progress(30, "introspecting", "Introspecting full schema...")
            tables = await adapter.get_tables(connection)

            # Build schema snapshot
            schema_snapshot = {
                "database_id": str(database_id),
                "database_type": database.type,
                "tables": [],
            }

            for table in tables:
                table_info = {
                    "name": table.name,
                    "schema": table.schema_name,
                    "row_count": table.row_count_estimate,
                    "columns": [],
                    "indexes": table.indexes,
                }
                for col in table.columns:
                    table_info["columns"].append({
                        "name": col.name,
                        "type": col.type,
                        "nullable": col.nullable,
                        "default": col.default,
                        "is_primary_key": col.is_primary_key,
                        "is_foreign_key": col.is_foreign_key,
                        "references": col.references,
                    })
                schema_snapshot["tables"].append(table_info)

            await context.report_progress(60, "drift_detection", "Checking for schema drift...")

            drift_result = None
            if baseline_id:
                # Compare with baseline
                drift_result = await self._compare_schemas(baseline_id, schema_snapshot)

            await context.report_progress(80, "erd_generation", "Generating ERD...")

            erd = None
            if include_erd:
                erd = await self._generate_erd(schema_snapshot)

            await context.report_progress(100, "completed", "Schema management complete")

            return {
                "schema": schema_snapshot,
                "drift": drift_result,
                "erd": erd,
                "table_count": len(tables),
            }
        finally:
            await adapter.close(connection)

    async def _compare_schemas(self, baseline_id: str, current: dict) -> dict[str, Any]:
        """Compare current schema with baseline."""
        # In a real implementation, this would fetch the baseline from storage
        # For now, return a placeholder
        return {
            "baseline_id": baseline_id,
            "changes": [],
            "summary": "No baseline comparison implemented yet",
        }

    async def _generate_erd(self, schema: dict) -> dict[str, Any]:
        """Generate ERD data for visualization."""
        nodes = []
        edges = []

        for table in schema["tables"]:
            nodes.append({
                "id": table["name"],
                "type": "table",
                "data": {
                    "label": table["name"],
                    "columns": table["columns"],
                },
                "position": {"x": 0, "y": 0},  # Will be laid out by frontend
            })

            # Add foreign key edges
            for col in table["columns"]:
                if col["is_foreign_key"] and col["references"]:
                    ref_table, ref_col = col["references"].split(".")
                    edges.append({
                        "id": f"{table['name']}-{ref_table}",
                        "source": table["name"],
                        "target": ref_table,
                        "label": col["name"],
                        "type": "foreign_key",
                    })

        return {
            "nodes": nodes,
            "edges": edges,
        }


from app.core.agent_base import event_bus
event_bus.subscribe(lambda ch, p: None, [])  # Placeholder for agent registration