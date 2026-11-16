"""SQL Generator Agent - converts natural language to SQL."""
from typing import Any

from app.adapters import get_adapter_instance
from app.ai import ai_router, AIMessage
from app.core.agent_base import BaseAgent, AgentContext
from app.core.encryption import CredentialEncryption
from app.config import get_settings


class SQLGeneratorAgent(BaseAgent):
    """Generates SQL from natural language using database schema context."""

    agent_type = "sql_generator"
    name = "SQL Generator"
    description = "Converts natural language queries to SQL using database schema"
    version = "1.0.0"
    capabilities = ["nl_to_sql", "schema_aware_generation", "dialect_specific"]
    required_params = ["question", "database_id"]
    optional_params = ["dialect", "include_explanation", "max_tokens"]

    SQL_GENERATION_PROMPT = """You are an expert SQL generator. Convert the user's natural language question into a valid SQL query.

Database Schema:
{schema}

Database Type: {dialect}

Rules:
1. Only generate SELECT queries (no INSERT, UPDATE, DELETE, DROP, etc.)
2. Use proper table and column names from the schema
3. Handle JOINs correctly based on foreign keys
4. Use appropriate dialect-specific syntax
5. Add LIMIT clause if not present (max 1000 rows)
6. Return only the SQL query, no explanations unless requested

Question: {question}

SQL:"""

    async def _execute(self, context: AgentContext) -> dict[str, Any]:
        question = context.parameters.get("question", "")
        database_id = context.parameters.get("database_id")
        dialect = context.parameters.get("dialect")
        include_explanation = context.parameters.get("include_explanation", False)

        if not question or not database_id:
            raise ValueError("question and database_id are required")

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

            # Decrypt password
            password = None
            if database.password_encrypted and database.password_salt:
                settings = get_settings()
                encryption = CredentialEncryption(settings.encryption_key)
                password = encryption.decrypt_password(database.password_encrypted, database.password_salt)

            # Build adapter config
            config = {
                "type": database.type,
                "host": database.host,
                "port": database.port,
                "database_name": database.database_name,
                "username": database.username,
                "password": password,
                "connection_options": database.connection_config,
            }

        # Get schema using adapter
        adapter = get_adapter_instance(database.type, config)
        conn_str = adapter.build_connection_string(config)
        connection = await adapter.connect(conn_str)

        try:
            await context.report_progress(30, "introspecting", "Introspecting database schema...")
            tables = await adapter.get_tables(connection)

            # Build schema description
            schema_parts = []
            for table in tables:
                cols = []
                for col in table.columns:
                    col_desc = f"{col.name} {col.type}"
                    if col.is_primary_key:
                        col_desc += " PRIMARY KEY"
                    if col.is_foreign_key and col.references:
                        col_desc += f" REFERENCES {col.references}"
                    if not col.nullable:
                        col_desc += " NOT NULL"
                    cols.append(col_desc)

                schema_parts.append(f"TABLE {table.name}:\n  " + "\n  ".join(cols))

            schema_text = "\n\n".join(schema_parts)
            target_dialect = dialect or database.type

            await context.report_progress(50, "generating", "Generating SQL...")

            # Generate SQL using AI
            prompt = self.SQL_GENERATION_PROMPT.format(
                schema=schema_text,
                dialect=target_dialect,
                question=question,
            )

            messages = [
                AIMessage(role="system", content="You are an expert SQL generator. Output only valid SQL."),
                AIMessage(role="user", content=prompt),
            ]

            response = await ai_router.complete(messages, max_tokens=context.parameters.get("max_tokens", 2000))
            sql = response.content.strip()

            # Clean up SQL (remove markdown code blocks if present)
            if sql.startswith("```sql"):
                sql = sql[6:]
            if sql.startswith("```"):
                sql = sql[3:]
            if sql.endswith("```"):
                sql = sql[:-3]
            sql = sql.strip()

            await context.report_progress(80, "validating", "Validating SQL...")

            # Validate by explaining
            try:
                plan = await adapter.explain_query(connection, sql)
                valid = True
                explain = plan.operations
            except Exception as e:
                valid = False
                explain = str(e)

            await context.report_progress(100, "completed", "SQL generation complete")

            result = {
                "sql": sql,
                "valid": valid,
                "explain": explain if valid else None,
                "dialect": target_dialect,
                "schema_tables": len(tables),
            }

            if include_explanation:
                result["explanation"] = await self._generate_explanation(sql, schema_text, target_dialect)

            return result
        finally:
            await adapter.close(connection)

    async def _generate_explanation(self, sql: str, schema: str, dialect: str) -> str:
        """Generate natural language explanation of the SQL."""
        prompt = f"""Explain this SQL query in simple terms:

SQL: {sql}

Database Dialect: {dialect}

Provide a brief, clear explanation of what this query does."""

        messages = [
            AIMessage(role="system", content="You are a SQL expert explaining queries to non-technical users."),
            AIMessage(role="user", content=prompt),
        ]

        response = await ai_router.complete(messages, max_tokens=500)
        return response.content.strip()


# Register agent
from app.core.agent_base import event_bus
event_bus.subscribe(lambda ch, p: None, [])  # Placeholder for agent registration