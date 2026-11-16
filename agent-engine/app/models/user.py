"""User, role, and permission models plus RBAC association tables."""
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin, GUID, utcnow


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(sa.String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(sa.String(255))
    full_name: Mapped[str | None] = mapped_column(sa.String(255))
    is_active: Mapped[bool] = mapped_column(default=True)
    is_superuser: Mapped[bool] = mapped_column(default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))

    __table_args__ = (sa.Index("idx_users_is_active", "is_active"),)


class Role(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(sa.String(100), unique=True)
    description: Mapped[str | None] = mapped_column(sa.Text)
    is_system: Mapped[bool] = mapped_column(default=False)


class Permission(UUIDMixin, Base):
    __tablename__ = "permissions"

    name: Mapped[str] = mapped_column(sa.String(100), unique=True)
    resource: Mapped[str] = mapped_column(sa.String(50))
    action: Mapped[str] = mapped_column(sa.String(50))
    description: Mapped[str | None] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, server_default=sa.func.now()
    )


user_roles = sa.Table(
    "user_roles",
    Base.metadata,
    sa.Column("user_id", GUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    sa.Column("role_id", GUID(), sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)

role_permissions = sa.Table(
    "role_permissions",
    Base.metadata,
    sa.Column("role_id", GUID(), sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    sa.Column(
        "permission_id",
        GUID(),
        sa.ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)