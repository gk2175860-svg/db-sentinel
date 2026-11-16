"""Task and task-log models with lifecycle enums (BACKEND_SCHEMA §3.3.2-§3.3.3)."""
import enum
import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JSONType, TimestampMixin, UUIDMixin, GUID, utcnow


class TaskStatus(enum.StrEnum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    WAITING_INPUT = "waiting_input"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskPriority(enum.StrEnum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


def _enum_values(enum_class: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_class]


class TaskRecord(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "tasks"

    agent_type: Mapped[str] = mapped_column(sa.String(100), sa.ForeignKey("agents.agent_type"))
    database_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), sa.ForeignKey("databases.id", ondelete="SET NULL")
    )
    status: Mapped[TaskStatus] = mapped_column(
        sa.Enum(
            TaskStatus,
            native_enum=False,
            create_constraint=True,
            values_callable=_enum_values,
            length=20,
        ),
        default=TaskStatus.PENDING,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        sa.Enum(
            TaskPriority,
            native_enum=False,
            create_constraint=True,
            values_callable=_enum_values,
            length=10,
        ),
        default=TaskPriority.NORMAL,
    )
    parameters: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONType)
    error: Mapped[str | None] = mapped_column(sa.Text)
    progress: Mapped[int] = mapped_column(sa.Integer, default=0)
    current_step: Mapped[str | None] = mapped_column(sa.String(255))
    steps_completed: Mapped[list[str]] = mapped_column(JSONType, default=list)
    total_steps: Mapped[int | None] = mapped_column(sa.Integer)
    parent_task_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), sa.ForeignKey("tasks.id", ondelete="SET NULL")
    )
    worker_id: Mapped[str | None] = mapped_column(sa.String(255))
    retries: Mapped[int] = mapped_column(sa.Integer, default=0)
    max_retries: Mapped[int] = mapped_column(sa.Integer, default=3)
    tags: Mapped[list[str]] = mapped_column(JSONType, default=list)
    queued_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    created_by: Mapped[uuid.UUID | None] = mapped_column(GUID(), sa.ForeignKey("users.id"))

    __table_args__ = (
        sa.Index("idx_tasks_agent_type", "agent_type"),
        sa.Index("idx_tasks_database_id", "database_id"),
        sa.Index("idx_tasks_status", "status"),
        sa.Index("idx_tasks_priority", "priority"),
        sa.Index("idx_tasks_created_by", "created_by"),
        sa.Index("idx_tasks_parent_task_id", "parent_task_id"),
        sa.Index("idx_tasks_created_at", "created_at"),
        sa.Index("idx_tasks_worker_id", "worker_id"),
        sa.Index("idx_tasks_status_priority_created", "status", "priority", "created_at"),
        sa.Index("idx_tasks_database_status", "database_id", "status"),
    )


class TaskLog(UUIDMixin, Base):
    __tablename__ = "task_logs"

    task_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), sa.ForeignKey("tasks.id", ondelete="CASCADE")
    )
    level: Mapped[str] = mapped_column(sa.String(10))
    message: Mapped[str] = mapped_column(sa.Text)
    context: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    timestamp: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, server_default=sa.func.now()
    )

    __table_args__ = (
        sa.Index("idx_task_logs_task_id", "task_id"),
        sa.Index("idx_task_logs_timestamp", "timestamp"),
    )