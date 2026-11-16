"""Query Optimizer Agent - analyzes and optimizes SQL queries."""
from typing import Any

from app.adapters import get_adapter_instance
from app.ai import ai_router, AIMessage
from app.core.agent_base import BaseAgent, AgentContext
from app.core.encryption import CredentialEncryption
from app.config import get_settings


class QueryOptimizerAgent(BaseAgent):
    """Analyzes query execution plans and suggests optimizations."""

    agent_type = "query_optimizer"
    name = "Query Optimizer"
    description = "Analyzes EXPLAIN plans and suggests index/query optimizations"
    version = "1.0.0"
    capabilities = ["explain_analysis", "index_recommendations", "query_rewriting"]
    required_params = ["query", "database_id"]
    optional_params = ["include_rewrite", "max_tokens"]

    OPTIMIZATION_PROMPT = """You are a database performance expert. Analyze the query execution plan and provide optimization recommendations.

Query:
{query}

Execution Plan:
{plan}

Database Type: {dialect}

Schema Context:
{schema}

Provide:
1. Performance issues identified
2. Missing index recommendations (with CREATE INDEX statements)
3. Query rewrite suggestions (if applicable)
4. Estimated impact

Format your response as structured JSON with keys: issues, indexes, rewrites, impact."""

    async def _execute(self, context: AgentContext) -> dict[str, Any]:
        query = context.parameters.get("query", "")
        database_id = context.parameters.get("database_id")
        include_rewrite = context.parameters.get("include_rewrite", True)

        if not query or not database_id:
            raise ValueError("query and database_id are required")

        await context.report_progress(10, "fetching_schema", "Fetching database schema...")

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
            await context.report_progress(30, "explain", "Running EXPLAIN...")
            plan = await adapter.explain_query(connection, query)

            await context.report_progress(50, "fetching_schema", "Fetching schema for context...")
            tables = await adapter.get_tables(connection)

            # Build schema description for tables referenced in query
            schema_parts = []
            for table in tables:
                cols = []
                for col in table.columns:
                    col_desc = f"{col.name} {col.type}"
                    if col.is_primary_key:
                        col_desc += " PRIMARY KEY"
                    if col.is_foreign_key and col.references:
                        col_desc += f" REFERENCES {col.references}"
                    cols.append(col_desc)

                # Include indexes
                idx_parts = []
                for idx in table.indexes:
                    idx_parts.append(f"  INDEX {idx['name']}: {idx.get('definition', idx.get('columns', []))}")

                schema_parts.append(
                    f"TABLE {table.name}:\n"
                    f"  COLUMNS:\n    " + "\n    ".join(cols) + "\n"
                    + ("  INDEXES:\n" + "\n".join(idx_parts) if idx_parts else "")
                )

            schema_text = "\n\n".join(schema_parts[:20])  # Limit to avoid token overflow

            await context.report_progress(70, "analyzing", "Analyzing plan with AI...")

            # Analyze with AI
            prompt = self.OPTIMIZATION_PROMPT.format(
                query=query,
                plan=plan.operations,
                dialect=database.type,
                schema=schema_text,
            )

            messages = [
                AIMessage(role="system", content="You are a database performance expert. Output structured JSON only."),
                AIMessage(role="user", content=prompt),
            ]

            response = await ai_router.complete(messages, max_tokens=context.parameters.get("max_tokens", 3000))

            # Parse AI response
            import json
            try:
                ai_analysis = json.loads(response.content)
            except json.JSONDecodeError:
                ai_analysis = {
                    "issues": ["Failed to parse AI response"],
                    "indexes": [],
                    "rewrites": [],
                    "impact": "unknown",
                }

            # Add plan metadata
            ai_analysis["plan_metadata"] = {
                "estimated_cost": plan.estimated_cost,
                "estimated_rows": plan.estimated_rows,
                "operations_count": len(plan.operations),
            }

            await context.report_progress(100, "completed", "Optimization analysis complete")

            return {
                "query": query,
                "dialect": database.type,
                "analysis": ai_analysis,
                "plan": plan.operations,
            }
        finally:
            await adapter.close(connection)


# Register agent
from app.core.agent_base import event_bus
event_bus.subscribe(lambda ch, p: None, [])  # Placeholder for agent registration