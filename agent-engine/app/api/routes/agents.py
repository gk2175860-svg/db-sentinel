"""Agent management and task execution API routes."""
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.api.deps import get_session, require_permission
from app.agents import create_agent, get_agent_class, list_agents
from app.core.task_queue import TaskRunner
from app.models import TaskRecord, TaskStatus, User
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/agents", tags=["agents"])


from app.models import TaskPriority

# Request/Response models
class TaskSubmitRequest(BaseModel):
    database_id: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    priority: TaskPriority = TaskPriority.NORMAL


class TaskSubmitResponse(BaseModel):
    task_id: str
    status: str
    message: str


class TaskStatusResponse(BaseModel):
    task_id: str
    agent_type: str
    database_id: str | None
    status: str
    progress: int
    current_step: str | None
    result: dict[str, Any] | None
    error: str | None
    created_at: str
    started_at: str | None
    completed_at: str | None


class AgentInfo(BaseModel):
    agent_type: str
    name: str
    description: str
    version: str
    capabilities: list[str]
    required_params: list[str]
    optional_params: list[str]


def get_task_runner(request: Request) -> TaskRunner:
    """Get task runner from app state."""
    return request.app.state.task_runner


@router.get("", response_model=list[AgentInfo])
async def list_agents_endpoint(
    current_user: User = Depends(require_permission("agents:read")),
) -> list[AgentInfo]:
    """List all available agents."""
    agents = list_agents()
    return [AgentInfo(**agent) for agent in agents]


@router.get("/tasks", response_model=list[TaskStatusResponse])
async def list_tasks(
    status: str | None = None,
    limit: int = 100,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("agents:read")),
) -> list[TaskStatusResponse]:
    """List all tasks with optional status filter."""
    from sqlalchemy import select, desc
    stmt = select(TaskRecord).order_by(desc(TaskRecord.created_at)).limit(limit)
    if status:
        stmt = stmt.where(TaskRecord.status == TaskStatus(status))
    result = await session.execute(stmt)
    tasks = result.scalars().all()

    return [
        TaskStatusResponse(
            task_id=str(task.id),
            agent_type=task.agent_type,
            database_id=str(task.database_id) if task.database_id else None,
            status=task.status.value,
            progress=task.progress,
            current_step=task.current_step,
            result=task.result,
            error=task.error,
            created_at=task.created_at.isoformat() if task.created_at else None,
            started_at=task.started_at.isoformat() if task.started_at else None,
            completed_at=task.completed_at.isoformat() if task.completed_at else None,
        )
        for task in tasks
    ]


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("agents:read")),
) -> TaskStatusResponse:
    """Get task status and result."""
    task = await session.get(TaskRecord, uuid.UUID(task_id))
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    return TaskStatusResponse(
        task_id=str(task.id),
        agent_type=task.agent_type,
        database_id=str(task.database_id) if task.database_id else None,
        status=task.status.value,
        progress=task.progress,
        current_step=task.current_step,
        result=task.result,
        error=task.error,
        created_at=task.created_at.isoformat() if task.created_at else None,
        started_at=task.started_at.isoformat() if task.started_at else None,
        completed_at=task.completed_at.isoformat() if task.completed_at else None,
    )


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_task(
    task_id: str,
    current_user: User = Depends(require_permission("agents:execute")),
    runner: TaskRunner = Depends(get_task_runner),
) -> None:
    """Cancel a running task."""
    success = await runner.cancel(task_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or cannot be cancelled",
        )


@router.post("/tasks/{task_id}/retry", response_model=TaskSubmitResponse)
async def retry_task(
    task_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("agents:execute")),
    runner: TaskRunner = Depends(get_task_runner),
) -> TaskSubmitResponse:
    """Retry a failed task."""
    task = await session.get(TaskRecord, uuid.UUID(task_id))
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    if task.status not in (TaskStatus.FAILED, TaskStatus.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only retry failed or cancelled tasks",
        )

    # Reset task for retry
    task.status = TaskStatus.QUEUED
    task.error = None
    task.progress = 0
    task.current_step = None
    task.result = None
    session.add(task)
    await session.commit()

    # Submit to task runner
    await runner.submit(str(task.id))

    return TaskSubmitResponse(
        task_id=str(task.id),
        status="queued",
        message="Task queued for retry",
    )


@router.get("/{agent_type}", response_model=AgentInfo)
async def get_agent(
    agent_type: str,
    current_user: User = Depends(require_permission("agents:read")),
) -> AgentInfo:
    """Get agent details by type."""
    agent_class = get_agent_class(agent_type)
    if not agent_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent type '{agent_type}' not found",
        )
    return AgentInfo(
        agent_type=agent_class.agent_type,
        name=agent_class.name,
        description=agent_class.description,
        version=agent_class.version,
        capabilities=agent_class.capabilities,
        required_params=agent_class.required_params,
        optional_params=agent_class.optional_params,
    )


@router.post("/{agent_type}/tasks", response_model=TaskSubmitResponse, status_code=status.HTTP_202_ACCEPTED)
async def submit_task(
    agent_type: str,
    request: TaskSubmitRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("agents:execute")),
    runner: TaskRunner = Depends(get_task_runner),
) -> TaskSubmitResponse:
    """Submit a task for execution."""
    # Validate agent exists
    agent_class = get_agent_class(agent_type)
    if not agent_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent type '{agent_type}' not found",
        )

    # Validate required parameters
    for param in agent_class.required_params:
        if param not in request.parameters:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required parameter: {param}",
            )

    # Create task record
    task = TaskRecord(
        agent_type=agent_type,
        database_id=uuid.UUID(request.database_id) if request.database_id else None,
        parameters=request.parameters,
        status=TaskStatus.QUEUED,
        priority=request.priority,
        max_retries=3,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)

    # Submit to task runner
    await runner.submit(str(task.id))

    return TaskSubmitResponse(
        task_id=str(task.id),
        status="queued",
        message="Task queued for execution",
    )


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("agents:read")),
) -> TaskStatusResponse:
    """Get task status and result."""
    task = await session.get(TaskRecord, uuid.UUID(task_id))
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    return TaskStatusResponse(
        task_id=str(task.id),
        agent_type=task.agent_type,
        database_id=str(task.database_id) if task.database_id else None,
        status=task.status.value,
        progress=task.progress,
        current_step=task.current_step,
        result=task.result,
        error=task.error,
        created_at=task.created_at.isoformat() if task.created_at else None,
        started_at=task.started_at.isoformat() if task.started_at else None,
        completed_at=task.completed_at.isoformat() if task.completed_at else None,
    )


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_task(
    task_id: str,
    current_user: User = Depends(require_permission("agents:execute")),
    runner: TaskRunner = Depends(get_task_runner),
) -> None:
    """Cancel a running task."""
    success = await runner.cancel(task_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or cannot be cancelled",
        )


@router.post("/tasks/{task_id}/retry", response_model=TaskSubmitResponse)
async def retry_task(
    task_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("agents:execute")),
    runner: TaskRunner = Depends(get_task_runner),
) -> TaskSubmitResponse:
    """Retry a failed task."""
    task = await session.get(TaskRecord, uuid.UUID(task_id))
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    if task.status not in (TaskStatus.FAILED, TaskStatus.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only retry failed or cancelled tasks",
        )

    # Reset task for retry
    task.status = TaskStatus.QUEUED
    task.error = None
    task.progress = 0
    task.current_step = None
    task.result = None
    session.add(task)
    await session.commit()

    # Submit to task runner
    await runner.submit(str(task.id))

    return TaskSubmitResponse(
        task_id=str(task.id),
        status="queued",
        message="Task queued for retry",
    )