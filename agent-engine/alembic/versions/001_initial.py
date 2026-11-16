"""Initial migration: create all tables.

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255)),
        sa.Column("is_active", sa.Boolean(), default=True, nullable=False),
        sa.Column("is_superuser", sa.Boolean(), default=False, nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), onupdate=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )

    # Create roles table
    op.create_table(
        "roles",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("name", sa.String(50), unique=True, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), onupdate=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )

    # Create permissions table
    op.create_table(
        "permissions",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("resource", sa.String(50), nullable=False, index=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )

    # Create user_roles association table
    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role_id", sa.CHAR(36), sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    )

    # Create role_permissions association table
    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.CHAR(36), sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("permission_id", sa.CHAR(36), sa.ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
    )

    # Create databases table
    op.create_table(
        "databases",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(50), nullable=False, index=True),
        sa.Column("host", sa.String(255), nullable=False),
        sa.Column("port", sa.Integer),
        sa.Column("database_name", sa.String(255), nullable=False),
        sa.Column("schema_name", sa.String(255)),
        sa.Column("username", sa.String(255)),
        sa.Column("password_encrypted", sa.LargeBinary),
        sa.Column("password_salt", sa.LargeBinary),
        sa.Column("connection_config", mysql.JSON, default={}, nullable=False),
        sa.Column("pool_config", mysql.JSON, default={}, nullable=False),
        sa.Column("tags", mysql.JSON, default=[], nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("is_active", sa.Boolean(), default=True, nullable=False, index=True),
        sa.Column("last_tested_at", sa.DateTime(timezone=True)),
        sa.Column("last_test_status", sa.String(20)),
        sa.Column("last_test_error", sa.Text),
        sa.Column("version", sa.String(100)),
        sa.Column("created_by", sa.CHAR(36), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), onupdate=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )

    # Create agents table
    op.create_table(
        "agents",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("agent_type", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("version", sa.String(20), nullable=False),
        sa.Column("capabilities", mysql.JSON, default=[], nullable=False),
        sa.Column("required_params", mysql.JSON, default=[], nullable=False),
        sa.Column("optional_params", mysql.JSON, default=[], nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True, nullable=False),
        sa.Column("config_schema", mysql.JSON),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), onupdate=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )

    # Create tasks table with check constraints (MySQL 8.0.16+)
    op.create_table(
        "tasks",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("agent_type", sa.String(50), sa.ForeignKey("agents.agent_type"), nullable=False, index=True),
        sa.Column("database_id", sa.CHAR(36), sa.ForeignKey("databases.id", ondelete="SET NULL"), index=True),
        sa.Column("parameters", mysql.JSON, default={}, nullable=False),
        sa.Column("status", sa.String(20), default="queued", nullable=False, index=True),
        sa.Column("priority", sa.Integer(), default=0, nullable=False),
        sa.Column("result", mysql.JSON),
        sa.Column("error", sa.Text),
        sa.Column("progress", sa.Integer(), default=0, nullable=False),
        sa.Column("current_step", sa.String(100)),
        sa.Column("steps_completed", sa.Integer(), default=0, nullable=False),
        sa.Column("retries", sa.Integer(), default=0, nullable=False),
        sa.Column("max_retries", sa.Integer(), default=3, nullable=False),
        sa.Column("queued_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False, index=True),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("worker_id", sa.String(50)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), onupdate=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'waiting_input', 'completed', 'failed', 'cancelled')",
            name="ck_tasks_status",
        ),
        sa.CheckConstraint(
            "priority >= 0 AND priority <= 10",
            name="ck_tasks_priority",
        ),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )

    # Create task_logs table
    op.create_table(
        "task_logs",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("task_id", sa.CHAR(36), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("level", sa.String(20), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )


def downgrade() -> None:
    op.drop_table("task_logs")
    op.drop_table("tasks")
    op.drop_table("agents")
    op.drop_table("databases")
    op.drop_table("role_permissions")
    op.drop_table("user_roles")
    op.drop_table("permissions")
    op.drop_table("roles")
    op.drop_table("users")