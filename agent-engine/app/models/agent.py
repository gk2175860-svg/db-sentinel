"""Agent registry model (BACKEND_SCHEMA §3.3.1, string PK per plan)."""
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JSONType, TimestampMixin


class AgentRecord(TimestampMixin, Base):
    __tablename__ = "agents"

    agent_type: Mapped[str] = mapped_column(sa.String(100), primary_key=True)
    name: Mapped[str] = mapped_column(sa.String(255))
    description: Mapped[str | None] = mapped_column(sa.Text)
    version: Mapped[str] = mapped_column(sa.String(50), default="1.0.0")
    capabilities: Mapped[list[str]] = mapped_column(JSONType, default=list)
    required_params: Mapped[list[str]] = mapped_column(JSONType, default=list)
    optional_params: Mapped[list[str]] = mapped_column(JSONType, default=list)
    is_enabled: Mapped[bool] = mapped_column(default=True)
