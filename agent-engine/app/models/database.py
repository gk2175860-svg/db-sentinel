"""Managed target-database registration model (BACKEND_SCHEMA §3.2.1)."""
import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JSONType, TimestampMixin, UUIDMixin, GUID

DEFAULT_POOL_CONFIG: dict[str, Any] = {
    "pool_size": 5,
    "max_overflow": 10,
    "pool_timeout": 30,
    "pool_recycle": 3600,
}


class DatabaseRecord(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "databases"

    name: Mapped[str] = mapped_column(sa.String(255))
    type: Mapped[str] = mapped_column(sa.String(50))
    host: Mapped[str] = mapped_column(sa.String(255))
    port: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    database_name: Mapped[str] = mapped_column(sa.String(255))
    schema_name: Mapped[str | None] = mapped_column(sa.String(255))
    username: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    password_encrypted: Mapped[bytes | None] = mapped_column(sa.LargeBinary, nullable=True)
    password_salt: Mapped[bytes | None] = mapped_column(sa.LargeBinary, nullable=True)
    connection_config: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    pool_config: Mapped[dict[str, Any]] = mapped_column(
        JSONType, default=lambda: dict(DEFAULT_POOL_CONFIG)
    )
    tags: Mapped[list[str]] = mapped_column(JSONType, default=list)
    description: Mapped[str | None] = mapped_column(sa.Text)
    is_active: Mapped[bool] = mapped_column(default=True)
    last_tested_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    last_test_status: Mapped[str | None] = mapped_column(sa.String(20))
    last_test_error: Mapped[str | None] = mapped_column(sa.Text)
    version: Mapped[str | None] = mapped_column(sa.String(100))
    created_by: Mapped[uuid.UUID] = mapped_column(GUID(), sa.ForeignKey("users.id"))

    __table_args__ = (
        sa.Index("idx_databases_type", "type"),
        sa.Index("idx_databases_is_active", "is_active"),
        sa.Index("idx_databases_created_by", "created_by"),
    )
