"""Agent base and event bus tests (Task 8)."""
from typing import Any

import pytest

from app.core.agent_base import (
    AgentContext,
    AgentState,
    BaseAgent,
    EventBus,
    InvalidTransitionError,
)


class TestAgentStateTransitions:
    """Tests for agent state machine transitions."""

    @pytest.fixture
    def context(self):
        """Create a test context."""
        return AgentContext(
            task_id="test-task",
            database_id="test-db",
            parameters={},
        )

    async def test_happy_path_transitions(self, context):
        """Test IDLE -> INITIALIZING -> RUNNING -> COMPLETED."""
        assert context.state == AgentState.IDLE

        await context.initialize()
        assert context.state == AgentState.INITIALIZING

        await context.run()
        assert context.state == AgentState.RUNNING

        await context.complete()
        assert context.state == AgentState.COMPLETED

    async def test_failure_transition(self, context):
        """Test RUNNING -> FAILED."""
        await context.initialize()
        await context.run()
        await context.fail()
        assert context.state == AgentState.FAILED

    async def test_retry_from_failed(self, context):
        """Test FAILED -> INITIALIZING (retry)."""
        await context.initialize()
        await context.run()
        await context.fail()
        assert context.state == AgentState.FAILED

        await context.retry()
        assert context.state == AgentState.INITIALIZING

    async def test_cancel_from_idle(self, context):
        """Test IDLE -> CANCELLED."""
        await context.cancel()
        assert context.state == AgentState.CANCELLED

    async def test_cancel_from_running(self, context):
        """Test RUNNING -> CANCELLED."""
        await context.initialize()
        await context.run()
        await context.cancel()
        assert context.state == AgentState.CANCELLED

    async def test_waiting_input_transition(self, context):
        """Test RUNNING -> WAITING_INPUT -> RUNNING."""
        await context.initialize()
        await context.run()
        await context.wait_for_input()
        assert context.state == AgentState.WAITING_INPUT

        await context.run()
        assert context.state == AgentState.RUNNING

    async def test_invalid_transition_idle_to_running(self, context):
        """Test IDLE -> RUNNING is invalid (must go through INITIALIZING)."""
        with pytest.raises(InvalidTransitionError):
            await context.run()

    async def test_invalid_transition_completed_to_any(self, context):
        """Test COMPLETED is terminal."""
        await context.initialize()
        await context.run()
        await context.complete()

        with pytest.raises(InvalidTransitionError):
            await context.run()
        with pytest.raises(InvalidTransitionError):
            await context.fail()
        with pytest.raises(InvalidTransitionError):
            await context.initialize()

    async def test_invalid_transition_cancelled_to_any(self, context):
        """Test CANCELLED is terminal."""
        await context.cancel()

        with pytest.raises(InvalidTransitionError):
            await context.run()
        with pytest.raises(InvalidTransitionError):
            await context.fail()

    async def test_retry_only_from_failed(self, context):
        """Test retry only works from FAILED state."""
        await context.initialize()
        with pytest.raises(InvalidTransitionError):
            await context.retry()

        await context.run()
        await context.complete()
        with pytest.raises(InvalidTransitionError):
            await context.retry()


class TestAgentContextProgress:
    """Tests for progress reporting."""

    async def test_report_progress_calls_callback(self):
        """Test progress callback is invoked."""
        calls = []

        async def callback(progress: int, step: str, message: str):
            calls.append((progress, step, message))

        context = AgentContext(
            task_id="test",
            database_id=None,
            parameters={},
            progress_callback=callback,
        )

        await context.report_progress(50, "step1", "halfway")

        assert len(calls) == 1
        assert calls[0] == (50, "step1", "halfway")

    async def test_report_progress_no_callback(self):
        """Test no callback doesn't error."""
        context = AgentContext(
            task_id="test",
            database_id=None,
            parameters={},
            progress_callback=None,
        )
        # Should not raise
        await context.report_progress(100, "done", "finished")


class MockAgent(BaseAgent):
    """Mock agent for testing."""

    agent_type = "mock"
    name = "Mock Agent"
    description = "Test agent"
    version = "1.0"
    capabilities = ["test"]
    required_params = ["param1"]
    optional_params = ["param2"]

    def __init__(self, should_succeed: bool = True, result: dict | None = None):
        super().__init__()
        self._should_succeed = should_succeed
        self._result = result or {"output": "test result"}
        self.execute_called = False

    async def _execute(self, context: AgentContext) -> dict[str, Any]:
        self.execute_called = True
        if not self._should_succeed:
            raise ValueError("Agent execution failed")
        return self._result


class TestBaseAgent:
    """Tests for BaseAgent class."""

    async def test_run_success(self):
        """Test successful agent run."""
        agent = MockAgent(should_succeed=True)
        context = AgentContext(
            task_id="test",
            database_id="test-db",
            parameters={"param1": "value"},
        )

        result = await agent.run(context)

        assert result == {"output": "test result"}
        assert context.state == AgentState.COMPLETED
        assert agent.execute_called is True

    async def test_run_failure(self):
        """Test agent run with exception."""
        agent = MockAgent(should_succeed=False)
        context = AgentContext(
            task_id="test",
            database_id="test-db",
            parameters={"param1": "value"},
        )

        with pytest.raises(ValueError, match="Agent execution failed"):
            await agent.run(context)

        assert context.state == AgentState.FAILED
        assert agent.execute_called is True

    async def test_state_transitions_during_run(self):
        """Test state transitions during successful run."""
        agent = MockAgent()
        context = AgentContext(
            task_id="test",
            database_id="test-db",
            parameters={"param1": "value"},
        )


        # We can't easily hook into state changes, but we can verify final state
        await agent.run(context)
        assert context.state == AgentState.COMPLETED


class TestEventBus:
    """Tests for EventBus."""

    @pytest.fixture
    def bus(self):
        """Create a fresh event bus."""
        return EventBus()

    async def test_publish_subscribe(self, bus):
        """Test basic publish/subscribe."""
        received = []

        async def callback(channel: str, payload: dict):
            received.append((channel, payload))

        bus.subscribe(callback, ["test_channel"])
        await bus.publish("test_channel", {"message": "hello"})

        assert len(received) == 1
        assert received[0] == ("test_channel", {"message": "hello"})

    async def test_subscribe_multiple_channels(self, bus):
        """Test subscribing to multiple channels."""
        received = []

        async def callback(channel: str, payload: dict):
            received.append((channel, payload))

        bus.subscribe(callback, ["channel_a", "channel_b"])
        await bus.publish("channel_a", {"data": 1})
        await bus.publish("channel_b", {"data": 2})

        assert len(received) == 2

    async def test_unsubscribe(self, bus):
        """Test unsubscribe removes callback."""
        received = []

        async def callback(channel: str, payload: dict):
            received.append(payload)

        bus.subscribe(callback, ["test"])
        await bus.publish("test", {"a": 1})

        bus.unsubscribe(callback, ["test"])
        await bus.publish("test", {"b": 2})

        assert len(received) == 1
        assert received[0] == {"a": 1}

    async def test_unsubscribe_all(self, bus):
        """Test unsubscribe_all removes from all channels."""
        received = []

        async def callback(channel: str, payload: dict):
            received.append(payload)

        bus.subscribe(callback, ["a", "b"])
        bus.unsubscribe_all(callback)

        await bus.publish("a", {"x": 1})
        await bus.publish("b", {"y": 2})

        assert len(received) == 0

    async def test_publish_to_empty_channel(self, bus):
        """Test publish to channel with no subscribers doesn't error."""
        # Should not raise
        await bus.publish("empty", {"data": "ignored"})

    async def test_wildcard_channel(self, bus):
        """Test wildcard channel subscription."""
        received = []

        async def callback(channel: str, payload: dict):
            received.append((channel, payload))

        bus.subscribe(callback, ["*"])
        await bus.publish("any_channel", {"wildcard": True})

        assert len(received) == 1
        assert received[0][0] == "any_channel"

    async def test_channel_isolation(self, bus):
        """Test channels are isolated."""
        received_a = []
        received_b = []

        async def callback_a(channel: str, payload: dict):
            received_a.append(payload)

        async def callback_b(channel: str, payload: dict):
            received_b.append(payload)

        bus.subscribe(callback_a, ["channel_a"])
        bus.subscribe(callback_b, ["channel_b"])

        await bus.publish("channel_a", {"for": "a"})
        await bus.publish("channel_b", {"for": "b"})

        assert received_a == [{"for": "a"}]
        assert received_b == [{"for": "b"}]

    async def test_global_event_bus_singleton(self):
        """Test global event_bus is a singleton."""
        from app.core.agent_base import event_bus as global_bus

        assert isinstance(global_bus, EventBus)

        # Test it works
        received = []

        async def callback(channel: str, payload: dict):
            received.append(payload)

        global_bus.subscribe(callback, ["global_test"])
        await global_bus.publish("global_test", {"singleton": True})

        assert received == [{"singleton": True}]
        # Clean up
        global_bus.unsubscribe(callback, ["global_test"])


class TestAgentEventHandlers:
    """Tests for agent event handling."""

    async def test_on_event_and_emit(self):
        """Test agent event registration and emission."""
        agent = MockAgent()
        events = []

        def handler(payload):
            events.append(payload)

        agent.on_event("test_event", handler)
        agent.emit("test_event", {"data": "test"})

        assert events == [{"data": "test"}]

    async def test_multiple_handlers(self):
        """Test multiple handlers for same event."""
        agent = MockAgent()
        events = []

        agent.on_event("multi", lambda p: events.append(("first", p)))
        agent.on_event("multi", lambda p: events.append(("second", p)))
        agent.emit("multi", {"value": 42})

        assert len(events) == 2
        assert events[0][0] == "first"
        assert events[1][0] == "second"