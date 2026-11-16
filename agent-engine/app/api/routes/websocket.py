"""WebSocket connection manager and endpoint."""
import uuid
from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from pydantic import ValidationError

from app.api.deps import get_current_user
from app.core.agent_base import event_bus
from app.models import User
from app.schemas.websocket import (
    WSClientMessage,
    WSConnected,
    WSEvent,
    WSPing,
    WSPong,
    WSSubscribe,
    WSUnsubscribe,
)


class ConnectionManager:
    """Manages WebSocket connections and channel subscriptions."""

    def __init__(self):
        self._connections: dict[str, WebSocket] = {}
        self._subscriptions: dict[str, set[str]] = {}  # connection_id -> channels
        self._channel_subscribers: dict[str, set[str]] = {}  # channel -> connection_ids

    async def connect(self, websocket: WebSocket, connection_id: str) -> None:
        """Register a new connection."""
        await websocket.accept()
        self._connections[connection_id] = websocket
        self._subscriptions[connection_id] = set()
        # Subscribe to global channel by default
        self._subscribe_to_channel(connection_id, "global")

    def disconnect(self, connection_id: str) -> None:
        """Remove a connection and its subscriptions."""
        if connection_id in self._connections:
            del self._connections[connection_id]
        if connection_id in self._subscriptions:
            for channel in self._subscriptions[connection_id]:
                if channel in self._channel_subscribers:
                    self._channel_subscribers[channel].discard(connection_id)
            del self._subscriptions[connection_id]

    def subscribe(self, connection_id: str, channels: list[str]) -> None:
        """Subscribe a connection to channels."""
        if connection_id not in self._subscriptions:
            return
        for channel in channels:
            self._subscribe_to_channel(connection_id, channel)

    def unsubscribe(self, connection_id: str, channels: list[str]) -> None:
        """Unsubscribe a connection from channels."""
        if connection_id not in self._subscriptions:
            return
        for channel in channels:
            self._unsubscribe_from_channel(connection_id, channel)

    def _subscribe_to_channel(self, connection_id: str, channel: str) -> None:
        """Add connection to channel subscribers."""
        self._subscriptions[connection_id].add(channel)
        if channel not in self._channel_subscribers:
            self._channel_subscribers[channel] = set()
        self._channel_subscribers[channel].add(connection_id)

    def _unsubscribe_from_channel(self, connection_id: str, channel: str) -> None:
        """Remove connection from channel subscribers."""
        self._subscriptions[connection_id].discard(channel)
        if channel in self._channel_subscribers:
            self._channel_subscribers[channel].discard(connection_id)

    async def send(self, connection_id: str, message: dict[str, Any]) -> bool:
        """Send a message to a specific connection."""
        websocket = self._connections.get(connection_id)
        if not websocket:
            return False
        try:
            await websocket.send_json(message)
            return True
        except Exception:
            self.disconnect(connection_id)
            return False

    async def broadcast(self, channel: str, message: dict[str, Any]) -> None:
        """Broadcast a message to all subscribers of a channel."""
        subscribers = self._channel_subscribers.get(channel, set()).copy()
        for connection_id in subscribers:
            await self.send(connection_id, message)


# Global connection manager
manager = ConnectionManager()


router = APIRouter(prefix="/ws", tags=["websocket"])


async def get_token_from_query(token: str = Query(...)) -> str:
    """Extract token from query parameter."""
    return token


@router.websocket("")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Depends(get_token_from_query),
) -> None:
    """
    WebSocket endpoint for real-time updates.
    
    Connect with: ws://host/api/v1/ws?token=<jwt>
    
    Client messages:
    - {"type": "subscribe", "channels": ["tasks:abc", "global"]}
    - {"type": "unsubscribe", "channels": ["tasks:abc"]}
    - {"type": "ping"}
    
    Server messages:
    - {"type": "connected", "connection_id": "..."}
    - {"type": "pong"}
    - {"type": "task_progress", "payload": {...}}
    """
    connection_id = str(uuid.uuid4())
    
    # Get session factory from app state (set during app creation)
    session_factory = websocket.app.state.session_factory
    
    # Validate token by trying to get current user
    try:
        from app.core.security import decode_token, InvalidTokenError
        
        claims = decode_token(token, expected_type="access")
        user_id = claims.get("sub")
        if not user_id:
            await websocket.close(code=4401, reason="Invalid token: missing subject")
            return
        
        async with session_factory() as session:
            user = await session.get(User, uuid.UUID(user_id))
            if not user or not user.is_active:
                await websocket.close(code=4401, reason="User not found or inactive")
                return
    except InvalidTokenError:
        await websocket.close(code=4401, reason="Invalid token")
        return
    except Exception as e:
        print(f"WebSocket authentication error: {e}")
        await websocket.close(code=4401, reason="Authentication failed")
        return

    await manager.connect(websocket, connection_id)
    
    # Send connected message
    await websocket.send_json(WSConnected(connection_id=connection_id).model_dump())
    
    try:
        while True:
            data = await websocket.receive_json()
            
            try:
                message = WSClientMessage(**data)
            except ValidationError as e:
                await websocket.send_json({"type": "error", "message": f"Invalid message: {e}"})
                continue
            
            if isinstance(message, WSSubscribe):
                manager.subscribe(connection_id, message.channels)
            elif isinstance(message, WSUnsubscribe):
                manager.unsubscribe(connection_id, message.channels)
            elif isinstance(message, WSPing):
                print(f"Received ping, sending pong")
                await websocket.send_json(WSPong().model_dump())
            # connect type is only for initial connection, ignore if received again
            
    except WebSocketDisconnect:
        print("WebSocket disconnected")
        pass
    except Exception as e:
        # Log error but don't crash
        print(f"WebSocket error: {e}")
        pass
    finally:
        manager.disconnect(connection_id)


# Event bus subscriber to bridge events to WebSocket
async def _event_to_websocket(channel: str, payload: dict[str, Any]) -> None:
    """Forward event bus messages to WebSocket connections."""
    await manager.broadcast(channel, payload)


# Subscribe to event bus on module load
# This will be called when the app starts
async def setup_websocket_event_bridge() -> None:
    """Set up the event bus to WebSocket bridge."""
    event_bus.subscribe(_event_to_websocket, ["*"])


# Export for manual setup
__all__ = ["manager", "router", "setup_websocket_event_bridge"]