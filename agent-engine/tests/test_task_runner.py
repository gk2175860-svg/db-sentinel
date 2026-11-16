"""Task runner tests (Task 9)."""
import asyncio
import uuid
from typing import Any

import pytest

from app.core.agent_base import AgentContext, BaseAgent, event_bus
from app.core.task_queue import TaskRunner
from app.models.task import TaskLog, TaskRecord, TaskStatus


class MockAgent(BaseAgent):
    """Mock agent for testing."""

    agent_type = "test_agent"
    name = "Test Agent"
    description = "Test agent"
    version = "1.0"
    capabilities = ["test"]
    required_params = ["param1"]
    optional_params = []

    def __init__(self, should_succeed: bool = True, result: dict | None = None, delay: float = 0):
        super().__init__()
        self._should_succeed = should_succeed
        self._result = result or {"output": "test result"}
        self._delay = delay
        self.execute_called = False

    async def _execute(self, context: AgentContext) -> dict[str, Any]:
        self.execute_called = True
        if self._delay:
            await asyncio.sleep(self._delay)
        if not self._should_succeed:
            raise ValueError("Agent execution failed")
        return self._result


class TestTaskRunner:
    """Tests for TaskRunner."""

    @pytest.fixture
    def session_factory(self, test_session_factory):
        """Use the test session factory."""
        return test_session_factory

    @pytest.fixture
    def agent_factory(self):
        """Create an agent factory that returns mock agents."""
        async def factory(agent_type: str):
            if agent_type == "test_agent":
                return MockAgent()
            elif agent_type == "failing_agent":
                return MockAgent(should_succeed=False)
            return None
        return factory

    @pytest.fixture
    def runner(self, session_factory, agent_factory):
        """Create a task runner."""
        return TaskRunner(session_factory, agent_factory, worker_concurrency=1)

    async def _create_task(self, session_factory, agent_type="test_agent", status=TaskStatus.QUEUED, max_retries=3, **kwargs):
        """Helper to create a task in the database."""
        from app.models.task import TaskRecord

        async with session_factory() as session:
            task = TaskRecord(
                agent_type=agent_type,
                parameters={"param1": "value"},
                status=status,
                max_retries=max_retries,
                **kwargs
            )
            session.add(task)
            await session.commit()
            return str(task.id)

    async def test_submit_and_complete(self, runner, session_factory):
        """Test submitting a task and it completing successfully."""
        # Create a queued task
        task_id = await self._create_task(session_factory)

        # Start runner
        await runner.start()

        # Submit task
        await runner.submit(task_id)

        # Wait for task to complete
        await asyncio.sleep(0.5)

        # Check task status
        async with session_factory() as session:
            task = await session.get(TaskRecord, uuid.UUID(task_id))
            assert task is not None
            assert task.status == TaskStatus.COMPLETED
            assert task.result == {"output": "test result"}
            assert task.progress == 100

        await runner.stop()

    async def test_task_failure_and_retry(self, runner, session_factory):
        """Test task failure triggers retry."""
        # Create a queued task with failing agent (max_retries=1 for fast test)
        task_id = await self._create_task(session_factory, agent_type="failing_agent", max_retries=1)

        # Start runner
        await runner.start()

        # Submit task
        await runner.submit(task_id)

        # Wait for retries
        await asyncio.sleep(3.0)

        # Check task status - should be failed after max retries
        async with session_factory() as session:
            task = await session.get(TaskRecord, uuid.UUID(task_id))
            assert task is not None
            assert task.status == TaskStatus.FAILED
            assert task.retries == 1  # max_retries

        await runner.stop()

    async def test_cancel_queued_task(self, runner, session_factory):
        """Test cancelling a queued task."""
        task_id = await self._create_task(session_factory)

        # Cancel before starting runner
        result = await runner.cancel(task_id)
        assert result is True

        async with session_factory() as session:
            task = await session.get(TaskRecord, uuid.UUID(task_id))
            assert task.status == TaskStatus.CANCELLED

    async def test_cancel_running_task(self, runner, session_factory):
        """Test cancelling a running task."""
        # Create task with slow agent
        async def slow_factory(agent_type):
            return MockAgent(delay=2.0)

        slow_runner = TaskRunner(session_factory, slow_factory, worker_concurrency=1)
        await slow_runner.start()

        task_id = await self._create_task(session_factory)
        await slow_runner.submit(task_id)

        # Give it time to start
        await asyncio.sleep(0.2)

        # Cancel the task
        result = await slow_runner.cancel(task_id)
        assert result is True

        async with session_factory() as session:
            task = await session.get(TaskRecord, uuid.UUID(task_id))
            assert task.status == TaskStatus.CANCELLED

        await slow_runner.stop()

    async def test_cancel_completed_task_returns_false(self, runner, session_factory):
        """Test cancelling an already completed task returns False."""
        task_id = await self._create_task(session_factory, status=TaskStatus.COMPLETED)

        result = await runner.cancel(task_id)
        assert result is False

    async def test_cancel_nonexistent_task_returns_false(self, runner):
        """Test cancelling a non-existent task returns False."""
        import uuid
        fake_id = str(uuid.uuid4())

        result = await runner.cancel(fake_id)
        assert result is False

    async def test_worker_concurrency(self, session_factory, agent_factory):
        """Test multiple workers can run concurrently."""
        runner = TaskRunner(session_factory, agent_factory, worker_concurrency=2)
        await runner.start()

        # Create multiple tasks
        task_ids = []
        for _ in range(4):
            task_id = await self._create_task(session_factory)
            task_ids.append(task_id)
            await runner.submit(task_id)

        # Wait for all to complete
        await asyncio.sleep(0.5)

        async with session_factory() as session:
            for task_id in task_ids:
                task = await session.get(TaskRecord, uuid.UUID(task_id))
                assert task.status == TaskStatus.COMPLETED

        await runner.stop()

    async def test_progress_events_published(self, runner, session_factory):
        """Test progress events are published during execution."""
        received_events = []

        async def callback(channel: str, payload: dict):
            received_events.append((channel, payload))

        event_bus.subscribe(callback, ["*"])

        task_id = await self._create_task(session_factory)
        await runner.start()
        await runner.submit(task_id)

        await asyncio.sleep(0.5)

        # Check events were published
        task_events = [e for e in received_events if e[0] == f"tasks:{task_id}"]
        assert len(task_events) > 0

        # Should have started, progress, and completed events
        statuses = [e[1].get("status") for e in task_events]
        assert "running" in statuses
        assert "completed" in statuses

        event_bus.unsubscribe_all(callback)
        await runner.stop()

    async def test_task_logs_created(self, runner, session_factory):
        """Test task logs are created during execution."""
        task_id = await self._create_task(session_factory)
        await runner.start()
        await runner.submit(task_id)

        await asyncio.sleep(0.5)

        async with session_factory() as session:
            from sqlalchemy import select
            logs = await session.scalars(
                select(TaskLog).where(TaskLog.task_id == uuid.UUID(task_id))
            )
            logs = list(logs)
            assert len(logs) >= 2  # start + complete
            assert any("started" in log.message.lower() for log in logs)
            assert any("completed" in log.message.lower() for log in logs)

        await runner.stop()

    async def test_unknown_agent_type_fails(self, runner, session_factory):
        """Test unknown agent type results in failure."""
        task_id = await self._create_task(session_factory, agent_type="unknown_agent")
        await runner.start()
        await runner.submit(task_id)

        await asyncio.sleep(0.5)

        async with session_factory() as session:
            task = await session.get(TaskRecord, uuid.UUID(task_id))
            assert task.status == TaskStatus.FAILED
            assert "Unknown agent type" in task.error

        await runner.stop()

    async def test_start_stop_idempotent(self, runner):
        """Test start/stop are idempotent."""
        await runner.start()
        await runner.start()  # Should not error
        await runner.stop()
        await runner.stop()  # Should not error


class TestTaskRunnerEdgeCases:
    """Edge case tests for TaskRunner."""

    @pytest.fixture
    def session_factory(self, test_session_factory):
        return test_session_factory

    async def test_agent_exception_marks_failed(self, session_factory):
        """Test agent raising exception marks task as failed."""
        async def failing_factory(agent_type):
            agent = MockAgent(should_succeed=False)
            return agent

        runner = TaskRunner(session_factory, failing_factory, worker_concurrency=1)
        await runner.start()

        task_id = await self._create_task(session_factory, agent_type="test_agent", max_retries=1)
        await runner.submit(task_id)

        await asyncio.sleep(3.0)

        async with session_factory() as session:
            task = await session.get(TaskRecord, uuid.UUID(task_id))
            assert task.status == TaskStatus.FAILED
            assert "Agent execution failed" in task.error

        await runner.stop()

    async def test_max_retries_configurable(self, session_factory):
        """Test max_retries is respected."""
        async def failing_factory(agent_type):
            return MockAgent(should_succeed=False)

        runner = TaskRunner(session_factory, failing_factory, worker_concurrency=1)
        await runner.start()

        async with session_factory() as session:
            task = TaskRecord(
                agent_type="test_agent",
                parameters={"param1": "value"},
                status=TaskStatus.QUEUED,
                max_retries=1,  # Only 1 retry
            )
            session.add(task)
            await session.commit()
            task_id = str(task.id)

        await runner.submit(task_id)
        await asyncio.sleep(1.0)

        async with session_factory() as session:
            task = await session.get(TaskRecord, uuid.UUID(task_id))
            assert task.status == TaskStatus.FAILED
            assert task.retries == 1  # max_retries was 1

        await runner.stop()

    async def _create_task(self, session_factory, agent_type="test_agent", status=TaskStatus.QUEUED, max_retries=3, **kwargs):
        """Helper to create a task in the database."""
        async with session_factory() as session:
            task = TaskRecord(
                agent_type=agent_type,
                parameters={"param1": "value"},
                status=status,
                max_retries=max_retries,
                **kwargs
            )
            session.add(task)
            await session.commit()
            return str(task.id)