# DB Sentinel Architecture Document

## 1. Executive Summary

DB Sentinel is an AI-powered database management agent built as a **modular monolith** with:
- **Python Agent Engine** (FastAPI + custom state-machine agents)
- **React Web Dashboard** (Vite + TypeScript + Tailwind + shadcn/ui)
- **Extensible Database Adapters** (plugin architecture)
- **Hybrid AI Provider** (Local Ollama + Cloud APIs)
- **Communication**: REST for commands, WebSocket for live updates, Background job queue for long-running tasks

---

## 2. High-Level Architecture

\+-----------------------------------------------------------------------------------+
|                            DB SENTINEL SYSTEM                                      |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +--------------+     +--------------+     +--------------+                      |
|  |   WEB UI     |<--->|  API GATEWAY |<--->|  AGENT ENGINE|                      |
|  |  (React)     |     |  (FastAPI)   |     |  (Python)    |                      |
|  +--------------+     +--------------+     +------+-------+                      |
|         ^                    |                    |                             |
|         |                    |                    v                             |
|         |         +------------+------------+  +--------------+                |
|         |         |   MESSAGE  |            |  |  JOB QUEUE   |                |
|         |         |    BUS     |            |  |  (Redis/RQ)  |                |
|         |         |(Redis Pub/)|            |  +--------------+                |
|         |         |    Sub)    |            |                                |
|         |         +-----+------+            |                                |
|         |               |                   |                                |
|         v               v                   v                                |
|  +-----------------------------------------------------------------------+    |
|  |                    DATABASE ADAPTERS (Plugins)                         |    |
|  |  +----------+ +----------+ +----------+ +----------+                  |    |
|  |  |PostgreSQL| |  MySQL   | |SQL Server| |  Oracle  |   ...           |    |
|  |  +----------+ +----------+ +----------+ +----------+                  |    |
|  +-----------------------------------------------------------------------+    |
|                                                                           |
|  +-----------------------------------------------------------------------+    |
|  |                    AI PROVIDER ABSTRACTION                            |    |
|  |  +----------+ +----------+ +----------+                                |    |
|  |  |  Ollama  | |  OpenAI  | |Anthropic |   ...                         |    |
|  |  | (Local)  | | (Cloud)  | | (Cloud)  |                                |    |
|  |  +----------+ +----------+ +----------+                                |    |
|  +-----------------------------------------------------------------------+    |
|                                                                           |
+-------------------------------------------------------------------------------+
\
---

## 3. Component Architecture

### 3.1 Agent Engine (Python/FastAPI)

**Location**: agent-engine/

\agent-engine/
├── app/
│   ├── main.py                 # FastAPI entry point
│   ├── config.py               # Settings management (Pydantic Settings)
│   ├── api/
│   │   ├── routes/
│   │   │   ├── agents.py       # Agent management endpoints
│   │   │   ├── tasks.py        # Task/job endpoints
│   │   │   ├── databases.py    # Database connection management
│   │   │   ├── websocket.py    # WebSocket for live updates
│   │   │   └── health.py       # Health checks
│   │   └── deps.py             # Dependency injection
│   ├── core/
│   │   ├── agent_base.py       # BaseAgent abstract class
│   │   ├── state_machine.py    # Custom state machine engine
│   │   ├── task_queue.py       # RQ/Redis queue integration
│   │   └── events.py           # Event bus for WebSocket
│   ├── agents/
│   │   ├── sql_generator.py    # Natural language to SQL
│   │   ├── query_optimizer.py  # Execution plan analysis
│   │   ├── schema_manager.py   # Migrations, drift detection
│   │   ├── monitor.py          # Performance monitoring
│   │   └── data_quality.py     # Profiling, validation
│   ├── adapters/
│   │   ├── base.py             # DatabaseAdapter abstract base
│   │   ├── registry.py         # Plugin registry
│   │   ├── postgresql.py
│   │   ├── mysql.py
│   │   ├── sqlserver.py
│   │   └── oracle.py
│   ├── ai/
│   │   ├── provider.py         # AIProvider abstract base
│   │   ├── ollama.py
│   │   ├── openai.py
│   │   ├── anthropic.py
│   │   └── router.py           # Smart routing (local vs cloud)
│   ├── models/
│   │   ├── database.py         # DB connection models
│   │   ├── task.py             # Task/job models
│   │   ├── agent.py            # Agent state models
│   │   └── websocket.py        # WS message models
│   └── services/
│       ├── connection_pool.py  # Pooled DB connections
│       ├── schema_introspect.py# Schema extraction
│       └── query_executor.py   # Safe query execution
├── tests/
├── pyproject.toml
├── Dockerfile
└── requirements.txt
\
**Key Design Decisions**:
- **Custom State Machine** over LangGraph for initial version - lighter, full control
- **Plugin-based adapters** - new databases via entry_points or dynamic import
- **Async-first** - FastAPI + asyncio + asyncpg/aiomysql
- **Dependency Injection** - FastAPI Depends for testability

### 3.2 Web Dashboard (React/TypeScript)

**Location**: web-dashboard/

\web-dashboard/
├── src/
│   ├── main.tsx                # Entry point
│   ├── App.tsx                 # Root component + routing
│   ├── api/
│   │   ├── client.ts           # Axios/Fetch wrapper with interceptors
│   │   ├── websocket.ts        # WS connection manager
│   │   └── endpoints.ts        # API endpoint constants
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/             # Sidebar, Header, Footer
│   │   ├── dashboard/          # Dashboard widgets
│   │   ├── agents/             # Agent management UI
│   │   ├── databases/          # DB connection UI
│   │   ├── queries/            # SQL editor, results, explain
│   │   ├── monitoring/         # Real-time metrics charts
│   │   └── tasks/              # Job queue UI
│   ├── hooks/
│   │   ├── useWebSocket.ts     # WS subscription hook
│   │   ├── useAgent.ts         # Agent state management
│   │   └── useTask.ts          # Task polling hook
│   ├── stores/
│   │   ├── agentStore.ts       # Zustand store for agents
│   │   ├── dbStore.ts          # Database connections
│   │   └── uiStore.ts          # UI state (sidebar, modals)
│   ├── types/
│   │   ├── api.ts              # Shared API types (generated from OpenAPI)
│   │   └── websocket.ts        # WS message types
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Agents.tsx
│   │   ├── Databases.tsx
│   │   ├── QueryLab.tsx
│   │   ├── Monitoring.tsx
│   │   ├── SchemaManager.tsx
│   │   └── Settings.tsx
│   └── utils/
│       ├── formatters.ts       # SQL formatting, byte formatting
│       └── validators.ts       # Form validation
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── Dockerfile
└── .env.example
\
**Key Design Decisions**:
- **Zustand** for state - simpler than Redux, works well with React 18
- **React Query (TanStack Query)** - server state caching, invalidation
- **Monaco Editor** - SQL editing with intellisense
- **Recharts** - Metrics visualization
- **OpenAPI Type Generation** - openapi-typescript for type-safe API calls

### 3.3 Shared Contracts

**Location**: shared/

\shared/
├── openapi.yaml                # Single source of truth for API
├── types/
│   ├── database.ts             # Database connection configs
│   ├── agent.ts                # Agent definitions
│   ├── task.ts                 # Task definitions
│   └── websocket.ts            # WS event types
└── constants/
    ├── agent-types.ts          # Agent capability enums
    ├── task-status.ts          # Task status enums
    └── db-types.ts             # Supported database types
\
---

## 4. Communication Patterns

### 4.1 REST API (Command & Query)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/v1/health | Health check |
| POST | /api/v1/databases | Register database connection |
| GET | /api/v1/databases | List connections |
| GET | /api/v1/databases/{id} | Get connection details |
| DELETE | /api/v1/databases/{id} | Remove connection |
| POST | /api/v1/agents | Create agent instance |
| GET | /api/v1/agents | List agents |
| POST | /api/v1/agents/{id}/tasks | Submit task to agent |
| GET | /api/v1/tasks/{id} | Get task status/result |
| GET | /api/v1/tasks | List tasks (with filters) |
| POST | /api/v1/ai/complete | Direct AI completion (for testing) |

### 4.2 WebSocket (Real-time Updates)

**Connection**: ws://host/api/v1/ws?token={jwt}

**Client to Server Messages**:
\\	ypescript
type ClientMessage =
  | { type: subscribe; channels: string[] }
  | { type: unsubscribe; channels: string[] }
  | { type: ping };
\
**Server to Client Messages**:
\\	ypescript
type ServerMessage =
  | { type: task_started; taskId: string; agentId: string }
  | { type: task_progress; taskId: string; progress: number; message: string }
  | { type: task_completed; taskId: string; result: TaskResult }
  | { type: task_failed; taskId: string; error: string }
  | { type: agent_status; agentId: string; status: AgentStatus }
  | { type: metric_update; databaseId: string; metrics: MetricSnapshot }
  | { type: alert; severity: info|warning|critical; message: string }
  | { type: pong };
\
**Channels**: tasks:{taskId}, agents:{agentId}, databases:{dbId}, global

### 4.3 Background Job Queue (Long-running Tasks)

**Technology**: Redis + RQ (Redis Queue) or BullMQ

**Job Types**:
- sql_generation - NL to SQL
- query_optimization - EXPLAIN analysis, index suggestions
- schema_introspection - Full schema extraction
- data_profiling - Column statistics, null rates, distributions
- migration_generation - Schema diff to migration SQL
- index_analysis - Missing/redundant index detection

**Job Payload**:
\\json
{
  job_type: query_optimization,
  database_id: prod-pg-01,
  parameters: {
    query: SELECT * FROM orders WHERE user_id = ?,
    include_explain: true
  },
  priority: normal,
  callback_url: http://dashboard/api/v1/webhooks/job-complete
}
\
---

## 5. Database Adapter Plugin System

### 5.1 Adapter Interface

\\python
# agent-engine/app/adapters/base.py
from abc import ABC, abstractmethod
from typing import Any, List, Dict, Optional
from dataclasses import dataclass

@dataclass
class ColumnInfo:
    name: str
    type: str
    nullable: bool
    default: Optional[str]
    is_primary_key: bool
    is_foreign_key: bool
    references: Optional[Dict[str, str]]

@dataclass
class TableInfo:
    name: str
    columns: List[ColumnInfo]
    indexes: List[Dict[str, Any]]
    row_count_estimate: Optional[int]

@dataclass
class QueryPlan:
    raw_plan: Any
    estimated_cost: float
    estimated_rows: int
    operations: List[Dict[str, Any]]

class DatabaseAdapter(ABC):
    Base class for all database adapters.
    dialect_name: str
    driver_name: str
    default_port: int

    @abstractmethod
    async def connect(self, config: DatabaseConfig) -> Any: ...
    @abstractmethod
    async def disconnect(self, connection: Any) -> None: ...
    @abstractmethod
    async def test_connection(self, config: DatabaseConfig) -> bool: ...
    @abstractmethod
    async def get_tables(self, connection: Any, schema: str = None) -> List[TableInfo]: ...
    @abstractmethod
    async def get_table_info(self, connection: Any, table: str, schema: str = None) -> TableInfo: ...
    @abstractmethod
    async def execute_query(self, connection: Any, query: str, params: tuple = None) -> QueryResult: ...
    @abstractmethod
    async def execute_command(self, connection: Any, command: str) -> CommandResult: ...
    @abstractmethod
    async def explain_query(self, connection: Any, query: str, params: tuple = None) -> QueryPlan: ...
    @abstractmethod
    async def get_indexes(self, connection: Any, table: str, schema: str = None) -> List[Dict]: ...
    @abstractmethod
    async def get_table_stats(self, connection: Any, table: str, schema: str = None) -> Dict: ...
    @abstractmethod
    def build_connection_string(self, config: DatabaseConfig) -> str: ...
    @abstractmethod
    def get_type_mapping(self) -> Dict[str, str]: ...

    async def get_slow_queries(self, connection: Any, limit: int = 100) -> List[Dict]:
        raise NotImplementedError
    async def get_active_sessions(self, connection: Any) -> List[Dict]:
        raise NotImplementedError
\
### 5.2 Plugin Registration

\\python
# agent-engine/app/adapters/registry.py
from typing import Dict, Type
from .base import DatabaseAdapter

_ADAPTER_REGISTRY: Dict[str, Type[DatabaseAdapter]] = {}

def register_adapter(adapter_class: Type[DatabaseAdapter]) -> None:
    _ADAPTER_REGISTRY[adapter_class.dialect_name] = adapter_class

def get_adapter(dialect: str) -> Type[DatabaseAdapter]:
    if dialect not in _ADAPTER_REGISTRY:
        raise ValueError(fNo adapter registered for dialect: {dialect})
    return _ADAPTER_REGISTRY[dialect]

def list_adapters() -> Dict[str, Type[DatabaseAdapter]]:
    return _ADAPTER_REGISTRY.copy()

def load_entry_point_adapters() -> None:
    import importlib.metadata
    for entry_point in importlib.metadata.entry_points(group=db_sentinel.adapters):
        register_adapter(entry_point.load())
\
Adding a new database via pyproject.toml:
\\	oml
[project.entry-points.db_sentinel.adapters]
postgresql = app.adapters.postgresql:PostgreSQLAdapter
mysql = app.adapters.mysql:MySQLAdapter
sqlserver = app.adapters.sqlserver:SQLServerAdapter
\
---

## 6. AI Provider Abstraction

### 6.1 Provider Interface

\\python
# agent-engine/app/ai/provider.py
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, AsyncIterator
from dataclasses import dataclass
from enum import Enum

class ModelCapability(Enum):
    CHAT = chat
    COMPLETION = completion
    EMBEDDING = embedding
    FUNCTION_CALLING = function_calling
    VISION = vision

@dataclass
class ModelInfo:
    name: str
    provider: str
    capabilities: List[ModelCapability]
    context_window: int
    max_output_tokens: int
    cost_per_1k_input: float = 0.0
    cost_per_1k_output: float = 0.0
    is_local: bool = False

@dataclass
class ChatMessage:
    role: str
    content: str
    tool_calls: Optional[List[Dict]] = None
    tool_call_id: Optional[str] = None

@dataclass
class CompletionResponse:
    content: str
    model: str
    usage: Dict[str, int]
    finish_reason: str
    tool_calls: Optional[List[Dict]] = None

class AIProvider(ABC):
    provider_name: str

    @abstractmethod
    async def list_models(self) -> List[ModelInfo]: ...

    @abstractmethod
    async def chat_completion(
        self, messages: List[ChatMessage], model: str,
        temperature: float = 0.1, max_tokens: Optional[int] = None,
        tools: Optional[List[Dict]] = None, stream: bool = False
    ) -> CompletionResponse | AsyncIterator[CompletionResponse]: ...

    @abstractmethod
    async def embeddings(self, texts: List[str], model: str) -> List[List[float]]: ...

    @abstractmethod
    async def health_check(self) -> bool: ...
\
### 6.2 Smart Router

\\python
# agent-engine/app/ai/router.py
from typing import Optional
from .provider import AIProvider, ModelInfo, ModelCapability

class AIRouter:
    def __init__(self, providers: Dict[str, AIProvider]):
        self.providers = providers
        self._model_cache: Dict[str, ModelInfo] = {}

    async def get_best_model(
        self, capability: ModelCapability, prefer_local: bool = False,
        max_cost_per_1k: Optional[float] = None, min_context_window: int = 4096
    ) -> tuple[AIProvider, str]:
        candidates = []
        for provider_name, provider in self.providers.items():
            models = await provider.list_models()
            for model in models:
                if capability not in model.capabilities: continue
                if model.context_window < min_context_window: continue
                if max_cost_per_1k and model.cost_per_1k_input > max_cost_per_1k: continue
                if prefer_local and not model.is_local: continue
                candidates.append((provider, model))
        if not candidates:
            raise ValueError(fNo model found for capability: {capability})
        candidates.sort(key=lambda x: (not x[1].is_local, x[1].cost_per_1k_input, -x[1].context_window))
        return candidates[0][0], candidates[0][1].name

    async def chat_completion(self, *args, **kwargs) -> CompletionResponse:
        provider, model = await self.get_best_model(
            ModelCapability.CHAT, prefer_local=kwargs.pop(prefer_local, False)
        )
        return await provider.chat_completion(*args, model=model, **kwargs)
\
---

## 7. Agent State Machine

### 7.1 Base Agent

\\python
# agent-engine/app/core/agent_base.py
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, Optional
from dataclasses import dataclass, field
from datetime import datetime

class AgentState(Enum):
    IDLE = idle
    INITIALIZING = initializing
    RUNNING = running
    WAITING_INPUT = waiting_input
    COMPLETED = completed
    FAILED = failed
    CANCELLED = cancelled

class AgentEvent(Enum):
    START = start
    PROGRESS = progress
    COMPLETE = complete
    ERROR = error
    CANCEL = cancel
    RETRY = retry

@dataclass
class AgentContext:
    task_id: str
    agent_id: str
    database_id: Optional[str] = None
    parameters: Dict[str, Any] = field(default_factory=dict)
    artifacts: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

class BaseAgent(ABC):
    agent_type: str
    name: str
    description: str
    version: str = 1.0.0
    capabilities: List[str] = []
    required_params: List[str] = []
    optional_params: List[str] = []

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.state = AgentState.IDLE
        self.context: Optional[AgentContext] = None
        self._event_handlers: Dict[AgentEvent, List[callable]] = {}

    async def run(self, context: AgentContext) -> Dict[str, Any]:
        self.context = context
        await self._transition(AgentState.INITIALIZING)
        try:
            await self._transition(AgentState.RUNNING)
            result = await self._execute(context)
            await self._transition(AgentState.COMPLETED)
            return result
        except Exception as e:
            await self._transition(AgentState.FAILED, error=str(e))
            raise

    @abstractmethod
    async def _execute(self, context: AgentContext) -> Dict[str, Any]: ...

    async def _transition(self, new_state: AgentState, **kwargs):
        old_state = self.state
        self.state = new_state
        self.context.updated_at = datetime.utcnow()
        event = AgentEvent.COMPLETE if new_state == AgentState.COMPLETED else \
                AgentEvent.ERROR if new_state == AgentState.FAILED else \
                AgentEvent.PROGRESS
        await self._emit_event(event, old_state=old_state, new_state=new_state, **kwargs)

    def on_event(self, event: AgentEvent, handler: callable):
        if event not in self._event_handlers:
            self._event_handlers[event] = []
        self._event_handlers[event].append(handler)

    async def _emit_event(self, event: AgentEvent, **data):
        for handler in self._event_handlers.get(event, []):
            await handler(self.context, data)
        from app.core.events import event_bus
        await event_bus.publish(fagent.{self.context.task_id}, {
            type: event.value, agent_type: self.agent_type,
            task_id: self.context.task_id, **data
        })
\
### 7.2 SQL Generator Agent

\\python
class SQLGeneratorAgent(BaseAgent):
    agent_type = sql_generator
    name = SQL Generator
    description = Convert natural language to SQL queries
    capabilities = [nl_to_sql, sql_explanation, query_refinement]
    required_params = [natural_language_query, database_id]
    optional_params = [schema_context, dialect, examples]

    async def _execute(self, context: AgentContext) -> Dict[str, Any]:
        schema = await self._get_schema_context(context)
        prompt = self._build_prompt(context.parameters[natural_language_query], schema)
        response = await self.ai.chat_completion(
            messages=[{role: user, content: prompt}],
            model=context.parameters.get(model), temperature=0.1
        )
        sql = self._extract_sql(response.content)
        await self._validate_sql(sql, context.database_id)
        return {
            sql: sql,
            explanation: self._generate_explanation(sql, schema),
            confidence: self._calculate_confidence(response)
        }
\
---

## 8. Data Models

### 8.1 Database Connection

\\python
# agent-engine/app/models/database.py
from pydantic import BaseModel, Field, SecretStr
from typing import Optional, Dict, Any, List
from enum import Enum
from datetime import datetime

class DatabaseType(str, Enum):
    POSTGRESQL = postgresql
    MYSQL = mysql
    MARIADB = mariadb
    SQLSERVER = sqlserver
    ORACLE = oracle
    SQLITE = sqlite

class DatabaseConfig(BaseModel):
    id: Optional[str] = None
    name: str
    type: DatabaseType
    host: str
    port: int
    database: str
    username: str
    password: SecretStr
    schema: Optional[str] = None
    ssl_mode: Optional[str] = None
    connection_options: Dict[str, Any] = Field(default_factory=dict)
    pool_size: int = 5
    max_overflow: int = 10
    pool_timeout: int = 30
    pool_recycle: int = 3600
    tags: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class DatabaseConnection(BaseModel):
    config: DatabaseConfig
    status: str
    last_tested: Optional[datetime] = None
    version: Optional[str] = None
    stats: Dict[str, Any] = Field(default_factory=dict)
\
### 8.2 Task/Job Model

\\python
# agent-engine/app/models/task.py
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from enum import Enum
from datetime import datetime
from uuid import uuid4

class TaskStatus(str, Enum):
    PENDING = pending
    QUEUED = queued
    RUNNING = running
    COMPLETED = completed
    FAILED = failed
    CANCELLED = cancelled

class TaskPriority(str, Enum):
    LOW = low
    NORMAL = normal
    HIGH = high
    CRITICAL = critical

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    agent_type: str
    database_id: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    priority: TaskPriority = TaskPriority.NORMAL
    parameters: Dict[str, Any] = Field(default_factory=dict)
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    progress: int = 0
    current_step: Optional[str] = None
    steps_completed: List[str] = Field(default_factory=list)
    total_steps: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    queued_at: Optional[datetime] = None
    worker_id: Optional[str] = None
    retries: int = 0
    max_retries: int = 3
    tags: List[str] = Field(default_factory=list)
    parent_task_id: Optional[str] = None
\
---

## 9. Security & Authentication

### 9.1 Authentication Flow

\+---------+     +----------------+     +----------------+
|  User   |---->|  Web Dashboard |---->|  Auth Service  |
| Browser |     |   (React)      |     |  (Keycloak/    |
+---------+     +----------------+     |   Auth0/       |
                                       |   Custom JWT)  |
                                       +-------+--------+
                                               | JWT Token
                                               v
+---------+     +----------------+     +----------------+
|  User   |<----|  Web Dashboard |<----|  Agent Engine  |
| Browser |     |   (React)      |     |  (FastAPI)     |
+---------+     +----------------+     +----------------+
       ^                                    |
       |           WebSocket                | JWT in query param
       +------------------------------------+
\
### 9.2 Authorization (RBAC)

| Role | Databases | Agents | Tasks | Settings | Users |
|------|-----------|--------|-------|----------|-------|
| Admin | CRUD | CRUD | CRUD | CRUD | CRUD |
| DBA | CRUD | Read/Execute | CRUD | Read | Read |
| Developer | Read/Connect | Read/Execute | Create/Read | Read | - |
| Viewer | Read | Read | Read | - | - |

### 9.3 Database Credentials

- **Never stored in plaintext** - encrypted at rest using Fernet/AES-GCM
- **Key management**: Environment variable ENCRYPTION_KEY or HashiCorp Vault integration
- **Rotation**: Support for credential rotation without downtime
- **Audit logging**: All credential access logged

---

## 10. Deployment Architecture

### 10.1 Development (Docker Compose)

\\yaml
version: 3.8

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: db_sentinel
      POSTGRES_USER: sentinel
      POSTGRES_PASSWORD: 
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports: [5432:5432]
    healthcheck:
      test: [CMD-SHELL, pg_isready -U sentinel]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports: [6379:6379]
    healthcheck:
      test: [CMD, redis-cli, ping]
      interval: 10s
      timeout: 5s
      retries: 5

  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama
    ports: [11434:11434]
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  agent-engine:
    build:
      context: ./agent-engine
      dockerfile: Dockerfile.dev
    ports: [8000:8000]
    environment:
      - DATABASE_URL=postgresql+asyncpg://sentinel:@postgres:5432/db_sentinel
      - REDIS_URL=redis://redis:6379/0
      - OLLAMA_BASE_URL=http://ollama:11434
      - JWT_SECRET=
      - ENCRYPTION_KEY=
      - LOG_LEVEL=DEBUG
    volumes:
      - ./agent-engine:/app
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      ollama:
        condition: service_started

  web-dashboard:
    build:
      context: ./web-dashboard
      dockerfile: Dockerfile.dev
    ports: [3000:3000]
    environment:
      - VITE_API_URL=http://localhost:8000
      - VITE_WS_URL=ws://localhost:8000
    volumes:
      - ./web-dashboard:/app
      - /app/node_modules
    depends_on:
      - agent-engine

volumes:
  postgres_data:
  redis_data:
  ollama_data:
\
### 10.2 Production (Kubernetes)

\+------------------------------------------------------------------+
|                    KUBERNETES CLUSTER                             |
+------------------------------------------------------------------+
|                                                                  |
|  +--------------+    +----------------+    +----------------+    |
|  |   Ingress    |--->|  Web Dashboard |    |  Agent Engine  |    |
|  |  (NGINX/     |    |  Deployment    |    |  Deployment    |    |
|  |   Traefik)   |    |  (3 replicas)  |    |  (3 replicas)  |    |
|  +--------------+    +----------------+    +------+---------+    |
|         |                                        |              |
|         v                                        v              |
|  +------------------------------------------------------------------+   |
|  |              Internal Services (ClusterIP)                       |   |
|  |  +----------+  +----------+  +----------+                       |   |
|  |  |PostgreSQL|  |  Redis   |  |  Ollama  |  (GPU nodes)        |   |
|  |  |(Stateful)|  |(Stateful)|  |Deployment|                     |   |
|  |  +----------+  +----------+  +----------+                       |   |
|  +------------------------------------------------------------------+   |
|                                                                  |
+------------------------------------------------------------------+
\
**Key Production Considerations**:
- **PostgreSQL**: Cloud-managed (RDS, Cloud SQL) or Patroni for HA
- **Redis**: Cluster mode for HA, persistence enabled
- **Ollama**: Dedicated GPU node pool, model pre-loading
- **Secrets**: External secrets operator (Vault, AWS Secrets Manager)
- **Monitoring**: Prometheus + Grafana + Loki for logs
- **TLS**: cert-manager with Let's Encrypt

---

## 11. Configuration Management

### 11.1 Environment Variables

\\ash
APP_NAME=db-sentinel
APP_ENV=development
LOG_LEVEL=INFO
API_PREFIX=/api/v1

DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/db_sentinel
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

REDIS_URL=redis://localhost:6379/0
REDIS_MAX_CONNECTIONS=50

JWT_SECRET=your-super-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

ENCRYPTION_KEY=32-byte-base64-encoded-key

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=llama3.1:8b

AI_DEFAULT_PROVIDER=ollama
AI_PREFER_LOCAL=true
AI_COST_LIMIT_PER_DAY=10.00

TASK_QUEUE_DEFAULT_TIMEOUT=300
TASK_QUEUE_MAX_RETRIES=3
WORKER_CONCURRENCY=4

WS_HEARTBEAT_INTERVAL=30
WS_MAX_CONNECTIONS=1000

ENABLE_METRICS=true
METRICS_PORT=9090
SENTRY_DSN=
\
### 11.2 Pydantic Settings

\\python
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List
from functools import lru_cache

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=.env,
        env_file_encoding=utf-8,
        case_sensitive=False,
        extra=ignore
    )
    app_name: str = db-sentinel
    app_env: str = development
    log_level: str = INFO
    api_prefix: str = /api/v1
    database_url: str
    database_pool_size: int = 10
    database_max_overflow: int = 20
    redis_url: str
    redis_max_connections: int = 50
    jwt_secret: str
    jwt_algorithm: str = HS256
    jwt_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    encryption_key: str
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    ollama_base_url: str = http://localhost:11434
    ollama_default_model: str = llama3.1:8b
    ai_default_provider: str = ollama
    ai_prefer_local: bool = True
    ai_cost_limit_per_day: float = 10.0
    task_queue_default_timeout: int = 300
    task_queue_max_retries: int = 3
    worker_concurrency: int = 4
    ws_heartbeat_interval: int = 30
    ws_max_connections: int = 1000
    enable_metrics: bool = True
    metrics_port: int = 9090
    sentry_dsn: Optional[str] = None
    cors_origins: List[str] = [http://localhost:3000]
    cors_allow_credentials: bool = True

@lru_cache
def get_settings() -> Settings:
    return Settings()
\
---

## 12. Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Agent Engine** | Python | 3.11+ | Core runtime |
| | FastAPI | 0.110+ | Async REST API |
| | Pydantic | 2.7+ | Validation & Settings |
| | SQLAlchemy | 2.0+ | ORM for metadata DB |
| | asyncpg/aiomysql | Latest | Async DB drivers |
| | Redis/RQ | 5.0+ | Job queue |
| | Pydantic-AI | 0.3+ | Structured AI outputs |
| **Web Dashboard** | React | 18.2+ | UI framework |
| | TypeScript | 5.3+ | Type safety |
| | Vite | 5.0+ | Build tool |
| | Tailwind CSS | 3.4+ | Styling |
| | shadcn/ui | Latest | Component library |
| | Zustand | 4.4+ | State management |
| | TanStack Query | 5.17+ | Server state |
| | Monaco Editor | 0.45+ | SQL editor |
| | Recharts | 2.10+ | Charts |
| | Socket.io Client | 4.7+ | WebSocket |
| **Infrastructure** | PostgreSQL | 16 | Metadata storage |
| | Redis | 7 | Queue, cache, pub/sub |
| | Ollama | Latest | Local LLM |
| | Docker | 24+ | Containerization |
| | Kubernetes | 1.28+ | Orchestration (prod) |

---

## 13. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Monorepo setup with shared configs
- [ ] Agent Engine: FastAPI skeleton + config + health checks
- [ ] Database adapter base class + PostgreSQL adapter
- [ ] AI Provider base + Ollama + OpenAI implementations
- [ ] Basic task queue with Redis/RQ
- [ ] WebSocket event bus

### Phase 2: Core Agents (Week 3-4)
- [ ] SQL Generator Agent (NL to SQL)
- [ ] Query Optimizer Agent (EXPLAIN analysis)
- [ ] Schema Introspection Agent
- [ ] Database connection management API
- [ ] Web Dashboard: Project setup + routing + layout

### Phase 3: Dashboard Integration (Week 5-6)
- [ ] Database connection UI (add/test/list)
- [ ] Agent management UI
- [ ] Query Lab (SQL editor + results + explain)
- [ ] Real-time task monitoring via WebSocket
- [ ] Authentication integration

### Phase 4: Advanced Features (Week 7-8)
- [ ] Data Quality Agent (profiling, validation)
- [ ] Schema Manager (migrations, drift detection)
- [ ] Monitoring Dashboard (metrics, alerts)
- [ ] MySQL/SQL Server adapters
- [ ] AI Router with cost optimization

### Phase 5: Production Hardening (Week 9-10)
- [ ] Comprehensive testing (unit, integration, e2e)
- [ ] Observability (metrics, logging, tracing)
- [ ] Security audit (auth, encryption, RBAC)
- [ ] Performance optimization
- [ ] Documentation & deployment guides

---

## 14. Open Questions / Decisions Needed

1. **Metadata Database**: Use PostgreSQL for agent engine metadata, or SQLite for simplicity in dev?
2. **Multi-tenancy**: Single-tenant per deployment, or multi-tenant with workspace isolation?
3. **Model Fine-tuning**: Plan for custom model fine-tuning on SQL generation?
4. **Audit Logging**: Level of detail required for compliance?
5. **Backup/Restore**: Strategy for metadata DB and configuration?
6. **Plugin Distribution**: How to distribute community database adapters?

---

## 15. Appendix: API Specification (OpenAPI)

The complete OpenAPI spec will be maintained at shared/openapi.yaml and used to generate:
- TypeScript types for web dashboard
- Python models for agent engine
- API documentation (Swagger UI / Redoc)

Key endpoints will follow REST conventions with consistent error format:
\\json
{
  error: {
    code: VALIDATION_ERROR,
    message: Invalid database configuration,
    details: [
      {field: port, message: Must be between 1 and 65535}
    ]
  }
}
\