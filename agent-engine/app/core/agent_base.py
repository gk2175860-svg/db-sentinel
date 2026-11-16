"""Agent state machine and event bus."""
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class AgentState(StrEnum):
    """Agent execution states per TRD §2.1.4."""
    IDLE = "idle"
    INITIALIZING = "initializing"
    RUNNING = "running"
    WAITING_INPUT = "waiting_input"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# Valid state transitions per TRD §2.1.4 table
VALID_TRANSITIONS: dict[AgentState, set[AgentState]] = {
    AgentState.IDLE: {AgentState.INITIALIZING, AgentState.CANCELLED},
    AgentState.INITIALIZING: {AgentState.RUNNING, AgentState.FAILED, AgentState.CANCELLED},
    AgentState.RUNNING: {
        AgentState.WAITING_INPUT,
        AgentState.COMPLETED,
        AgentState.FAILED,
        AgentState.CANCELLED,
    },
    AgentState.WAITING_INPUT: {AgentState.RUNNING, AgentState.FAILED, AgentState.CANCELLED},
    AgentState.COMPLETED: set(),  # Terminal
    AgentState.FAILED: {AgentState.INITIALIZING},  # Retry
    AgentState.CANCELLED: set(),  # Terminal
}


class InvalidTransitionError(Exception):
    """Raised when attempting an invalid state transition."""


@dataclass
class AgentContext:
    """Context passed to agent during execution."""
    task_id: str
    database_id: str | None
    parameters: dict[str, Any]
    progress_callback: Callable[[int, str, str], Awaitable[None]] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    _state: AgentState = field(default=AgentState.IDLE, init=False)

    @property
    def state(self) -> AgentState:
        return self._state

    async def _transition(self, new_state: AgentState) -> None:
        """Transition to a new state, validating the transition."""
        if new_state not in VALID_TRANSITIONS.get(self._state, set()):
            raise InvalidTransitionError(
                f"Invalid transition from {self._state.value} to {new_state.value}"
            )
        self._state = new_state

    async def initialize(self) -> None:
        await self._transition(AgentState.INITIALIZING)

    async def run(self) -> None:
        await self._transition(AgentState.RUNNING)

    async def wait_for_input(self) -> None:
        await self._transition(AgentState.WAITING_INPUT)

    async def complete(self) -> None:
        await self._transition(AgentState.COMPLETED)

    async def fail(self) -> None:
        await self._transition(AgentState.FAILED)

    async def cancel(self) -> None:
        await self._transition(AgentState.CANCELLED)

    async def retry(self) -> None:
        """Transition from FAILED back to INITIALIZING for retry."""
        if self._state != AgentState.FAILED:
            raise InvalidTransitionError(f"Can only retry from FAILED state, not {self._state.value}")
        await self._transition(AgentState.INITIALIZING)

    async def report_progress(self, progress: int, step: str, message: str) -> None:
        """Report progress via callback."""
        if self.progress_callback:
            await self.progress_callback(progress, step, message)


class BaseAgent:
    """Base class for all agents per ARCHITECTURE §7.1."""

    agent_type: str
    name: str
    description: str
    version: str
    capabilities: list[str]
    required_params: list[str]
    optional_params: list[str] = []

    def __init__(self):
        self._event_handlers: dict[str, list[Callable]] = {}

    async def run(self, context: AgentContext) -> dict[str, Any]:
        """
        Execute the agent with the given context.
        Manages state transitions and error handling.
        """
        await context.initialize()
        try:
            await context.run()
            result = await self._execute(context)
            await context.complete()
            return result
        except Exception:
            await context.fail()
            raise

    async def _execute(self, context: AgentContext) -> dict[str, Any]:
        """Override in subclasses to implement agent logic."""
        raise NotImplementedError("Subclasses must implement _execute")

    def on_event(self, event_type: str, handler: Callable) -> None:
        """Register an event handler."""
        if event_type not in self._event_handlers:
            self._event_handlers[event_type] = []
        self._event_handlers[event_type].append(handler)

    def emit(self, event_type: str, payload: dict[str, Any]) -> None:
        """Emit an event to registered handlers."""
        for handler in self._event_handlers.get(event_type, []):
            handler(payload)


# ============================================================
# Event Bus
# ============================================================

EventCallback = Callable[[str, dict[str, Any]], Awaitable[None]]


class EventBus:
    """Simple in-process event bus with channel-based pub/sub."""

    def __init__(self):
        self._subscribers: dict[str, list[EventCallback]] = {}

    async def publish(self, channel: str, payload: dict[str, Any]) -> None:
        """Publish a payload to a channel."""
        # Notify specific channel subscribers
        for callback in self._subscribers.get(channel, []):
            try:
                await callback(channel, payload)
            except Exception:
                pass

        # Also notify wildcard subscribers
        for callback in self._subscribers.get("*", []):
            try:
                await callback(channel, payload)
            except Exception:
                pass

    def subscribe(self, callback: EventCallback, channels: list[str] | None = None) -> None:
        """Subscribe a callback to one or more channels."""
        target_channels = channels or ["*"]
        for channel in target_channels:
            if channel not in self._subscribers:
                self._subscribers[channel] = []
            if callback not in self._subscribers[channel]:
                self._subscribers[channel].append(callback)

    def unsubscribe(self, callback: EventCallback, channels: list[str] | None = None) -> None:
        """Unsubscribe a callback from one or more channels."""
        target_channels = channels or ["*"]
        for channel in target_channels:
            if channel in self._subscribers:
                if callback in self._subscribers[channel]:
                    self._subscribers[channel].remove(callback)

    def unsubscribe_all(self, callback: EventCallback) -> None:
        """Unsubscribe a callback from all channels."""
        for subscribers in self._subscribers.values():
            if callback in subscribers:
                subscribers.remove(callback)


# Global event bus singleton
event_bus = EventBus()