"""In-process async task runner with lifecycle, retries, and cancellation."""
import asyncio
import logging
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.agent_base import BaseAgent, event_bus
from app.models.task import TaskLog, TaskRecord, TaskStatus

logger = logging.getLogger(__name__)


@dataclass
class WorkerInfo:
    """Information about a worker."""
    worker_id: str
    current_task_id: str | None = None
    started_at: float = field(default_factory=lambda: asyncio.get_event_loop().time())


class TaskRunner:
    """
    In-process async task runner.
    
    Manages a pool of workers that pick up tasks from the queue,
    execute them via agent factory, and handle retries/cancellation.
    """

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        agent_factory: Callable[[str], Awaitable[BaseAgent | None]],
        worker_concurrency: int = 2,
    ):
        self.session_factory = session_factory
        self.agent_factory = agent_factory
        self.worker_concurrency = worker_concurrency

        self._workers: list[WorkerInfo] = []
        self._worker_tasks: list[asyncio.Task] = []
        self._running = False
        self._shutdown_event = asyncio.Event()

    async def start(self) -> None:
        """Start the task runner with the configured number of workers."""
        if self._running:
            return

        self._running = True
        self._shutdown_event.clear()

        for i in range(self.worker_concurrency):
            worker_id = f"worker-{i}"
            worker = WorkerInfo(worker_id=worker_id)
            self._workers.append(worker)

            task = asyncio.create_task(self._worker_loop(worker))
            self._worker_tasks.append(task)

        logger.info(f"TaskRunner started with {self.worker_concurrency} workers")

    async def stop(self) -> None:
        """Stop the task runner gracefully."""
        if not self._running:
            return

        self._running = False
        self._shutdown_event.set()

        # Wait for all worker tasks to complete
        if self._worker_tasks:
            await asyncio.gather(*self._worker_tasks, return_exceptions=True)

        self._worker_tasks.clear()
        self._workers.clear()
        logger.info("TaskRunner stopped")

    async def submit(self, task_id: str) -> None:
        """
        Submit a task for execution.
        The task will be picked up by an available worker.
        """
        # Task is already in the database with status 'queued'
        # Workers will pick it up in their loop
        logger.debug(f"Task {task_id} submitted for execution")

    async def cancel(self, task_id: str) -> bool:
        """
        Cancel a task by ID.
        Returns True if task was found and cancelled, False otherwise.
        """
        task_uuid = uuid.UUID(task_id)
        async with self.session_factory() as session:
            task = await session.get(TaskRecord, task_uuid)
            if task is None:
                return False

            if task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
                return False

            # Update task status
            task.status = TaskStatus.CANCELLED
            task.error = "Cancelled by user"
            session.add(task)

            # Log the cancellation
            log = TaskLog(
                task_id=task.id,
                level="INFO",
                message="Task cancelled by user",
            )
            session.add(log)

            await session.commit()

            # Publish cancellation event
            await event_bus.publish(f"tasks:{task_id}", {
                "taskId": task_id,
                "status": "cancelled",
                "progress": 100,
            })

            logger.info(f"Task {task_id} cancelled")
            return True

    async def _worker_loop(self, worker: WorkerInfo) -> None:
        """Main worker loop - picks up and executes tasks."""
        while self._running:
            try:
                # Check for shutdown
                if self._shutdown_event.is_set():
                    break

                # Find a queued task
                task_id = await self._claim_next_task(worker)
                if task_id is None:
                    # No tasks available, wait a bit
                    await asyncio.sleep(1)
                    continue

                # Execute the task
                await self._execute_task(worker, task_id)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception(f"Worker {worker.worker_id} error: {e}")
                await asyncio.sleep(1)  # Prevent tight loop on error

    async def _claim_next_task(self, worker: WorkerInfo) -> str | None:
        """Claim the next available queued task."""
        async with self.session_factory() as session:
            # Find a queued task
            stmt = (
                select(TaskRecord)
                .where(TaskRecord.status == TaskStatus.QUEUED)
                .order_by(TaskRecord.queued_at)
                .limit(1)
            )
            task = await session.scalar(stmt)

            if task is None:
                return None

            # Update task status to RUNNING
            task.status = TaskStatus.RUNNING
            task.worker_id = worker.worker_id
            task.started_at = datetime.now(UTC)
            worker.current_task_id = str(task.id)

            session.add(task)

            # Log the start
            log = TaskLog(
                task_id=task.id,
                level="INFO",
                message=f"Task started by {worker.worker_id}",
            )
            session.add(log)

            await session.commit()

            # Publish task started event
            await event_bus.publish(f"tasks:{task.id}", {
                "taskId": str(task.id),
                "status": "running",
                "progress": 0,
                "currentStep": "initializing",
            })

            return str(task.id)

    async def _execute_task(self, worker: WorkerInfo, task_id: str) -> None:
        """Execute a single task."""
        task_uuid = uuid.UUID(task_id)
        async with self.session_factory() as session:
            task = await session.get(TaskRecord, task_uuid)
            if task is None:
                logger.warning(f"Task {task_id} not found")
                return

            # Get the agent
            agent = await self.agent_factory(task.agent_type)
            if agent is None:
                await self._fail_task(task.id, f"Unknown agent type: {task.agent_type}")
                return

            # Create progress callback
            async def progress_callback(progress: int, step: str, message: str):
                task.progress = progress
                task.current_step = step
                task.steps_completed += 1
                session.add(task)

                log = TaskLog(
                    task_id=task.id,
                    level="INFO",
                    message=message,
                )
                session.add(log)

                await session.commit()

                # Publish progress event
                await event_bus.publish(f"tasks:{task.id}", {
                    "taskId": str(task.id),
                    "status": "running",
                    "progress": progress,
                    "currentStep": step,
                    "message": message,
                })

            # Create agent context
            from app.core.agent_base import AgentContext
            context = AgentContext(
                task_id=task_id,
                database_id=str(task.database_id) if task.database_id else None,
                parameters=task.parameters,
                progress_callback=progress_callback,
            )

            task_uuid = task.id
            try:
                # Execute the agent
                result = await agent.run(context)

                # Update task as completed
                task.status = TaskStatus.COMPLETED
                task.result = result
                task.completed_at = datetime.now(UTC)
                task.progress = 100
                session.add(task)

                log = TaskLog(
                    task_id=task.id,
                    level="INFO",
                    message="Task completed successfully",
                )
                session.add(log)

                await session.commit()

                # Publish completion event
                await event_bus.publish(f"tasks:{task.id}", {
                    "taskId": str(task.id),
                    "status": "completed",
                    "progress": 100,
                    "result": result,
                })

                logger.info(f"Task {task_id} completed successfully")

            except Exception as e:
                await self._handle_task_failure(task_uuid, e)

            finally:
                worker.current_task_id = None

    async def _fail_task(self, task_id: uuid.UUID, error: str) -> None:
        """Mark a task as failed."""
        async with self.session_factory() as session:
            task = await session.get(TaskRecord, task_id)
            if task is None:
                return

            task.status = TaskStatus.FAILED
            task.error = error
            session.add(task)

            log = TaskLog(
                task_id=task.id,
                level="ERROR",
                message=error,
            )
            session.add(log)

            await session.commit()

            await event_bus.publish(f"tasks:{task.id}", {
                "taskId": str(task.id),
                "status": "failed",
                "progress": task.progress,
                "error": error,
            })

            logger.error(f"Task {task.id} failed: {error}")

    async def _handle_task_failure(self, task_id: uuid.UUID, error: Exception) -> None:
        """Handle task failure with retry logic."""
        async with self.session_factory() as session:
            task = await session.get(TaskRecord, task_id)
            if task is None:
                return

            task.retries += 1

            if task.retries < task.max_retries:
                # Requeue with exponential backoff
                task.status = TaskStatus.QUEUED
                task.error = f"Retry {task.retries}/{task.max_retries}: {error!s}"
                session.add(task)

                log = TaskLog(
                    task_id=task.id,
                    level="WARNING",
                    message=f"Task failed, retrying ({task.retries}/{task.max_retries}): {error}",
                )
                session.add(log)

                await session.commit()

                # Schedule retry with backoff
                backoff = 2 ** task.retries  # 2, 4, 8 seconds
                logger.info(f"Task {task.id} will retry in {backoff}s")
                await asyncio.sleep(backoff)

            else:
                # Max retries exceeded
                task.status = TaskStatus.FAILED
                task.error = f"Max retries exceeded: {error!s}"
                session.add(task)

                log = TaskLog(
                    task_id=task.id,
                    level="ERROR",
                    message=f"Task failed after {task.max_retries} retries: {error}",
                )
                session.add(log)

                await session.commit()

                await event_bus.publish(f"tasks:{task.id}", {
                    "taskId": str(task.id),
                    "status": "failed",
                    "progress": task.progress,
                    "error": str(error),
                })

                logger.error(f"Task {task.id} failed after {task.max_retries} retries: {error}")