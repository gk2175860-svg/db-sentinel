"""WebSocket schemas."""
from typing import Any, Literal
from pydantic import BaseModel, Field


class WSConnect(BaseModel):
    """Initial connection message."""
    type: Literal["connect"] = "connect"
    token: str


class WSSubscribe(BaseModel):
    """Subscribe to channels."""
    type: Literal["subscribe"] = "subscribe"
    channels: list[str]


class WSUnsubscribe(BaseModel):
    """Unsubscribe from channels."""
    type: Literal["unsubscribe"] = "unsubscribe"
    channels: list[str]


class WSPing(BaseModel):
    """Ping message."""
    type: Literal["ping"] = "ping"


class WSPong(BaseModel):
    """Pong response."""
    type: Literal["pong"] = "pong"


class WSConnected(BaseModel):
    """Connection acknowledged."""
    type: Literal["connected"] = "connected"
    connection_id: str


class WSEvent(BaseModel):
    """Generic event from server."""
    type: str
    payload: dict[str, Any]


WSClientMessage = WSConnect | WSSubscribe | WSUnsubscribe | WSPing
WSServerMessage = WSConnected | WSEvent | WSPong