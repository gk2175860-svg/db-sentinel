"""WebSocket tests (Task 10)."""
import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from app.core.security import create_access_token
from app.models import User


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def admin_token(test_session_factory):
    """Create a valid access token for the admin user."""
    async def _get_token():
        from app.config import get_settings
        settings = get_settings()
        async with test_session_factory() as session:
            from sqlalchemy import select
            user = await session.scalar(select(User).where(User.email == settings.seed_admin_email))
            return create_access_token(user, roles=["Admin", "DBA"])
    import asyncio
    return asyncio.run(_get_token())


class TestWebSocket:
    """WebSocket endpoint tests."""

    def test_websocket_connect_with_valid_token(self, client, admin_token):
        """Test WebSocket connection with valid token."""
        with client.websocket_connect(f"/api/v1/ws?token={admin_token}") as ws:
            data = ws.receive_json()
            assert data["type"] == "connected"
            assert "connection_id" in data

    def test_websocket_rejects_invalid_token(self, client):
        """Test WebSocket rejects invalid token."""
        with pytest.raises(Exception):
            with client.websocket_connect("/api/v1/ws?token=invalid.token.here") as ws:
                pass

    def test_websocket_rejects_missing_token(self, client):
        """Test WebSocket rejects missing token."""
        with pytest.raises(Exception):
            with client.websocket_connect("/api/v1/ws") as ws:
                pass

    def test_websocket_ping_pong(self, client, admin_token):
        """Test ping/pong."""
        with client.websocket_connect(f"/api/v1/ws?token={admin_token}") as ws:
            # Receive connected message
            ws.receive_json()
            
            # Send ping
            ws.send_json({"type": "ping"})
            
            # Receive pong
            data = ws.receive_json()
            assert data["type"] == "pong"

    def test_websocket_subscribe_unsubscribe(self, client, admin_token):
        """Test subscribe and unsubscribe."""
        with client.websocket_connect(f"/api/v1/ws?token={admin_token}") as ws:
            # Receive connected message
            ws.receive_json()
            
            # Subscribe to a channel
            ws.send_json({"type": "subscribe", "channels": ["tasks:123", "global"]})
            
            # Unsubscribe
            ws.send_json({"type": "unsubscribe", "channels": ["tasks:123"]})

    def test_websocket_invalid_message(self, client, admin_token):
        """Test invalid message handling."""
        with client.websocket_connect(f"/api/v1/ws?token={admin_token}") as ws:
            ws.receive_json()  # connected
            
            # Send invalid message
            ws.send_json({"type": "invalid", "data": "test"})
            
            # Should receive error
            data = ws.receive_json()
            assert data["type"] == "error"

    def test_websocket_disconnect(self, client, admin_token):
        """Test clean disconnect."""
        with client.websocket_connect(f"/api/v1/ws?token={admin_token}") as ws:
            ws.receive_json()  # connected
            # Just close the connection
        # Should not raise


class TestConnectionManager:
    """Tests for ConnectionManager."""

    def test_connect_disconnect(self):
        """Test basic connect/disconnect."""
        from app.api.routes.websocket import manager
        
        # We can't easily test WebSocket without a real connection
        # but we can test the internal data structures
        assert isinstance(manager._connections, dict)
        assert isinstance(manager._subscriptions, dict)
        assert isinstance(manager._channel_subscribers, dict)

    def test_subscribe_unsubscribe(self):
        """Test subscribe/unsubscribe logic."""
        from app.api.routes.websocket import manager
        
        conn_id = "test-conn"
        manager._subscriptions[conn_id] = set()
        
        # Subscribe
        manager.subscribe(conn_id, ["channel1", "channel2"])
        assert "channel1" in manager._subscriptions[conn_id]
        assert "channel2" in manager._subscriptions[conn_id]
        assert conn_id in manager._channel_subscribers["channel1"]
        assert conn_id in manager._channel_subscribers["channel2"]
        
        # Unsubscribe
        manager.unsubscribe(conn_id, ["channel1"])
        assert "channel1" not in manager._subscriptions[conn_id]
        assert conn_id not in manager._channel_subscribers["channel1"]
        assert "channel2" in manager._subscriptions[conn_id]


class TestWebSocketSchemas:
    """Tests for WebSocket schemas."""

    def test_ws_connect_schema(self):
        """Test WSConnect schema."""
        from app.schemas.websocket import WSConnect
        msg = WSConnect(token="test-token")
        assert msg.type == "connect"
        assert msg.token == "test-token"

    def test_ws_subscribe_schema(self):
        """Test WSSubscribe schema."""
        from app.schemas.websocket import WSSubscribe
        msg = WSSubscribe(channels=["tasks:123", "global"])
        assert msg.type == "subscribe"
        assert msg.channels == ["tasks:123", "global"]

    def test_ws_unsubscribe_schema(self):
        """Test WSUnsubscribe schema."""
        from app.schemas.websocket import WSUnsubscribe
        msg = WSUnsubscribe(channels=["tasks:123"])
        assert msg.type == "unsubscribe"
        assert msg.channels == ["tasks:123"]

    def test_ws_ping_schema(self):
        """Test WSPing schema."""
        from app.schemas.websocket import WSPing
        msg = WSPing()
        assert msg.type == "ping"

    def test_ws_pong_schema(self):
        """Test WSPong schema."""
        from app.schemas.websocket import WSPong
        msg = WSPong()
        assert msg.type == "pong"

    def test_ws_connected_schema(self):
        """Test WSConnected schema."""
        from app.schemas.websocket import WSConnected
        msg = WSConnected(connection_id="test-id")
        assert msg.type == "connected"
        assert msg.connection_id == "test-id"

    def test_ws_event_schema(self):
        """Test WSEvent schema."""
        from app.schemas.websocket import WSEvent
        msg = WSEvent(type="task_progress", payload={"progress": 50})
        assert msg.type == "task_progress"
        assert msg.payload == {"progress": 50}