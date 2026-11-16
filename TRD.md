# DB Sentinel - Technical Requirements Document (TRD)

## 1. System Architecture Overview

### 1.1 Architectural Style
**Modular Monolith** with clear bounded contexts:
- **Agent Engine** (Python/FastAPI) - Core business logic, AI orchestration, database operations
- **Web Dashboard** (React/TypeScript) - User interface, real-time visualization
- **Shared Contracts** - OpenAPI spec, TypeScript/Python type definitions

### 1.2 Technology Stack

| Layer | Technology | Version | Justification |
|-------|------------|---------|---------------|
| **Runtime** | Python | 3.11+ | Async support, type hints, performance |
| **API Framework** | FastAPI | 0.110+ | Async, auto OpenAPI, dependency injection |
| **Validation** | Pydantic | 2.7+ | Runtime validation, settings management |
| **ORM** | SQLAlchemy | 2.0+ | Async ORM, mature ecosystem |
| **DB Drivers** | asyncpg, aiomysql, aiosqlite | Latest | Native async drivers |
| **Queue** | Redis + RQ | 5.0+ | Simple, reliable, Redis-backed |
| **Pub/Sub** | Redis Pub/Sub | 7+ | Lightweight real-time events |
| **Local LLM** | Ollama | Latest | Local inference, OpenAI-compatible API |
| **Frontend** | React | 18.2+ | Component model, ecosystem |
| **Language** | TypeScript | 5.3+ | Type safety, developer experience |
| **Build** | Vite | 5.0+ | Fast HMR, optimized builds |
| **Styling** | Tailwind CSS | 3.4+ | Utility-first, consistent design |
| **Components** | shadcn/ui | Latest | Accessible, customizable |
| **State** | Zustand | 4.4+ | Simple, React 18 compatible |
| **Server State** | TanStack Query | 5.17+ | Caching, invalidation, mutations |
| **SQL Editor** | Monaco Editor | 0.45+ | VS Code editor, IntelliSense |
| **Charts** | Recharts | 2.10+ | React-native, composable |
| **WebSocket** | Socket.io Client | 4.7+ | Auto-reconnect, rooms |
| **Metadata DB** | PostgreSQL | 16 | ACID, JSONB, mature |
| **Cache/Queue** | Redis | 7 | High performance, persistence |
| **Container** | Docker | 24+ | Standard deployment |
| **Orchestration** | Kubernetes | 1.28+ | Production scaling |

---

## 2. Component Specifications

### 2.1 Agent Engine (FastAPI)

#### 2.1.1 Module Structure
```
agent-engine/
├── app/
│   ├── main.py                 # FastAPI app factory, lifespan
│   ├── config.py               # Pydantic Settings (env-based)
│   ├── api/
│   │   ├── deps.py             # Dependency injection providers
│   │   └── routes/
│   │       ├── health.py       # /health, /ready endpoints
│   │       ├── databases.py    # CRUD database connections
│   │       ├── agents.py       # Agent registry, capabilities
│   │       ├── tasks.py        # Task submission, status, results
│   │       └── websocket.py    # WS endpoint, connection manager
│   ├── core/
│   │   ├── agent_base.py       # BaseAgent abstract class
│   │   ├── state_machine.py    # State machine engine
│   │   ├── task_queue.py       # RQ wrapper, job decorators
│   │   ├── events.py           # Event bus (Redis Pub/Sub)
│   │   └── security.py         # JWT, encryption, RBAC
│   ├── agents/
│   │   ├── sql_generator.py    # NL -> SQL agent
│   │   ├── query_optimizer.py  # EXPLAIN analysis agent
│   │   ├── schema_manager.py   # Introspection, drift, migrations
│   │   ├── monitor.py          # Metrics collection agent
│   │   └── data_quality.py     # Profiling, validation agent
│   ├── adapters/
│   │   ├── base.py             # DatabaseAdapter ABC
│   │   ├── registry.py         # Plugin registry, entry_points
│   │   ├── postgresql.py       # PostgreSQL implementation
│   │   ├── mysql.py            # MySQL/MariaDB implementation
│   │   ├── sqlserver.py        # SQL Server implementation
│   │   └── oracle.py           # Oracle implementation
│   ├── ai/
│   │   ├── provider.py         # AIProvider ABC
│   │   ├── ollama.py           # Ollama implementation
│   │   ├── openai.py           # OpenAI implementation
│   │   ├── anthropic.py        # Anthropic implementation
│   │   └── router.py           # Smart model routing
│   ├── models/
│   │   ├── database.py         # DatabaseConfig, Connection
│   │   ├── task.py             # Task, TaskStatus, Priority
│   │   ├── agent.py            # AgentDefinition, AgentState
│   │   └── websocket.py        # WS message models
│   └── services/
│       ├── connection_pool.py  # Pooled connections per DB
│       ├── schema_introspect.py # Schema extraction logic
│       └── query_executor.py   # Safe query execution
├── tests/
├── pyproject.toml
├── Dockerfile
└── requirements.txt
```

#### 2.1.2 API Endpoints

**Database Management**
```
POST   /api/v1/databases              # Create connection
GET    /api/v1/databases              # List connections
GET    /api/v1/databases/{id}         # Get connection
PUT    /api/v1/databases/{id}         # Update connection
DELETE /api/v1/databases/{id}         # Delete connection
POST   /api/v1/databases/{id}/test    # Test connectivity
GET    /api/v1/databases/{id}/schema  # Get schema (cached)
POST   /api/v1/databases/{id}/sync    # Force schema refresh
```

**Agent Management**
```
GET    /api/v1/agents                 # List available agents
GET    /api/v1/agents/{type}          # Get agent definition
POST   /api/v1/agents/{type}/tasks    # Submit task to agent
```

**Task Management**
```
POST   /api/v1/tasks                  # Submit generic task
GET    /api/v1/tasks                  # List tasks (filter, paginate)
GET    /api/v1/tasks/{id}             # Get task status/result
DELETE /api/v1/tasks/{id}             # Cancel task
GET    /api/v1/tasks/{id}/logs        # Get task logs
```

**AI Completion (Testing)**
```
POST   /api/v1/ai/complete            # Direct completion
POST   /api/v1/ai/embeddings          # Generate embeddings
GET    /api/v1/ai/models              # List available models
```

**WebSocket**
```
WS     /api/v1/ws?token={jwt}         # Real-time updates
```

#### 2.1.3 Data Models (Pydantic)

**DatabaseConfig**
```python
class DatabaseConfig(BaseModel):
    id: Optional[str] = Field(default_factory=uuid7)
    name: str = Field(min_length=1, max_length=100)
    type: DatabaseType  # POSTGRESQL, MYSQL, MARIADB, SQLSERVER, ORACLE, SQLITE
    host: str
    port: int = Field(gt=0, le=65535)
    database: str
    username: str
    password: SecretStr
    schema: Optional[str] = None
    ssl_mode: Optional[SSLMode] = None
    connection_options: Dict[str, Any] = {}
    pool_size: int = Field(default=5, ge=1, le=50)
    max_overflow: int = Field(default=10, ge=0, le=100)
    pool_timeout: int = Field(default=30, ge=1, le=300)
    pool_recycle: int = Field(default=3600, ge=300, le=86400)
    tags: List[str] = []
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
```

**Task**
```python
class Task(BaseModel):
    id: str = Field(default_factory=uuid7)
    agent_type: str
    database_id: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    priority: TaskPriority = TaskPriority.NORMAL
    parameters: Dict[str, Any] = {}
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    progress: int = Field(default=0, ge=0, le=100)
    current_step: Optional[str] = None
    steps_completed: List[str] = []
    total_steps: Optional[int] = None
    created_at: datetime = Field(default_factory=utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    queued_at: Optional[datetime] = None
    worker_id: Optional[str] = None
    retries: int = 0
    max_retries: int = 3
    tags: List[str] = []
    parent_task_id: Optional[str] = None
```

#### 2.1.4 State Machine Specification

**Agent States**
```
IDLE -> INITIALIZING -> RUNNING -> COMPLETED
                    -> WAITING_INPUT -> RUNNING
                    -> FAILED
                    -> CANCELLED
```

**State Transitions**
| From | To | Trigger | Action |
|------|-----|---------|--------|
| IDLE | INITIALIZING | run() called | Validate params, acquire resources |
| INITIALIZING | RUNNING | Setup complete | Begin execution |
| RUNNING | WAITING_INPUT | Need user input | Emit event, pause |
| WAITING_INPUT | RUNNING | Input received | Resume execution |
| RUNNING | COMPLETED | Success | Store result, emit event |
| RUNNING | FAILED | Exception | Store error, emit event |
| ANY | CANCELLED | Cancel signal | Cleanup, emit event |
| FAILED | RUNNING | Retry (retries < max) | Reset state, retry |

#### 2.1.5 Database Adapter Interface

```python
class DatabaseAdapter(ABC):
    dialect_name: str          # "postgresql", "mysql", etc.
    driver_name: str           # "asyncpg", "aiomysql", etc.
    default_port: int
    
    @abstractmethod
    async def connect(self, config: DatabaseConfig) -> Any
    @abstractmethod
    async def disconnect(self, connection: Any) -> None
    @abstractmethod
    async def test_connection(self, config: DatabaseConfig) -> bool
    @abstractmethod
    async def get_tables(self, conn: Any, schema: str = None) -> List[TableInfo]
    @abstractmethod
    async def get_table_info(self, conn: Any, table: str, schema: str = None) -> TableInfo
    @abstractmethod
    async def execute_query(self, conn: Any, query: str, params: tuple = None) -> QueryResult
    @abstractmethod
    async def execute_command(self, conn: Any, command: str) -> CommandResult
    @abstractmethod
    async def explain_query(self, conn: Any, query: str, params: tuple = None) -> QueryPlan
    @abstractmethod
    async def get_indexes(self, conn: Any, table: str, schema: str = None) -> List[Dict]
    @abstractmethod
    async def get_table_stats(self, conn: Any, table: str, schema: str = None) -> Dict
    @abstractmethod
    def build_connection_string(self, config: DatabaseConfig) -> str
    @abstractmethod
    def get_type_mapping(self) -> Dict[str, str]
    
    # Optional
    async def get_slow_queries(self, conn: Any, limit: int = 100) -> List[Dict]
    async def get_active_sessions(self, conn: Any) -> List[Dict]
```

**Plugin Registration** via `pyproject.toml`:
```toml
[project.entry-points."db_sentinel.adapters"]
postgresql = "app.adapters.postgresql:PostgreSQLAdapter"
mysql = "app.adapters.mysql:MySQLAdapter"
sqlserver = "app.adapters.sqlserver:SQLServerAdapter"
oracle = "app.adapters.oracle:OracleAdapter"
```

#### 2.1.6 AI Provider Interface

```python
class AIProvider(ABC):
    provider_name: str
    
    @abstractmethod
    async def list_models(self) -> List[ModelInfo]
    @abstractmethod
    async def chat_completion(
        self,
        messages: List[ChatMessage],
        model: str,
        temperature: float = 0.1,
        max_tokens: Optional[int] = None,
        tools: Optional[List[Dict]] = None,
        stream: bool = False
    ) -> CompletionResponse | AsyncIterator[CompletionResponse]
    @abstractmethod
    async def embeddings(self, texts: List[str], model: str) -> List[List[float]]
    @abstractmethod
    async def health_check(self) -> bool
```

**ModelInfo**
```python
class ModelInfo(BaseModel):
    name: str
    provider: str
    capabilities: List[ModelCapability]  # CHAT, COMPLETION, EMBEDDING, FUNCTION_CALLING, VISION
    context_window: int
    max_output_tokens: int
    cost_per_1k_input: float = 0.0
    cost_per_1k_output: float = 0.0
    is_local: bool = False
```

**Smart Router Logic**
1. Filter models by required capability
2. Filter by context window requirement
3. Filter by cost budget
4. Prefer local if `prefer_local=True`
5. Sort by: (not local, cost, -context_window)
6. Return best match

---

### 2.2 Web Dashboard (React/TypeScript)

#### 2.2.1 Project Structure
```
web-dashboard/
├── src/
│   ├── main.tsx                    # Entry, providers
│   ├── App.tsx                     # Routes, layout
│   ├── api/
│   │   ├── client.ts               # Axios instance + interceptors
│   │   ├── websocket.ts            # WS connection manager
│   │   └── endpoints.ts            # API endpoint constants
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx         # Navigation
│   │   │   ├── Header.tsx          # User menu, notifications
│   │   │   └── Footer.tsx
│   │   ├── dashboard/
│   │   │   ├── MetricCard.tsx      # KPI display
│   │   │   ├── ChartWidget.tsx     # Recharts wrapper
│   │   │   └── ActivityFeed.tsx    # Recent tasks/alerts
│   │   ├── agents/
│   │   │   ├── AgentCard.tsx       # Agent status
│   │   │   └── AgentDetail.tsx     # Agent config, history
│   │   ├── databases/
│   │   │   ├── DatabaseCard.tsx    # Connection status
│   │   │   ├── DatabaseForm.tsx    # Add/edit connection
│   │   │   └── SchemaExplorer.tsx  # Tree view
│   │   ├── queries/
│   │   │   ├── SQLEditor.tsx       # Monaco wrapper
│   │   │   ├── QueryResults.tsx    # Table, pagination, export
│   │   │   ├── ExplainVisualizer.tsx # Plan tree/graph
│   │   │   └── QueryHistory.tsx    # Previous queries
│   │   ├── monitoring/
│   │   │   ├── MetricsDashboard.tsx # Real-time charts
│   │   │   ├── AlertPanel.tsx      # Active alerts
│   │   │   └── SlowQueryList.tsx   # Top slow queries
│   │   └── tasks/
│   │       ├── TaskList.tsx        # Filterable table
│   │       ├── TaskDetail.tsx      # Progress, logs, result
│   │       └── TaskProgress.tsx    # Progress bar component
│   ├── hooks/
│   │   ├── useWebSocket.ts         # WS subscription
│   │   ├── useAgent.ts             # Agent state
│   │   ├── useTask.ts              # Task polling
│   │   └── useDebounce.ts          # Debounce utility
│   ├── stores/
│   │   ├── agentStore.ts           # Agent registry
│   │   ├── dbStore.ts              # Database connections
│   │   ├── uiStore.ts              # Sidebar, modals, theme
│   │   └── notificationStore.ts    # Toast notifications
│   ├── types/
│   │   ├── api.ts                  # Generated from OpenAPI
│   │   └── websocket.ts            # WS message types
│   ├── pages/
│   │   ├── Dashboard.tsx           # Overview
│   │   ├── Databases.tsx           # Connection management
│   │   ├── QueryLab.tsx            # SQL editor + results
│   │   ├── Agents.tsx              # Agent management
│   │   ├── Monitoring.tsx          # Metrics, alerts
│   │   ├── SchemaManager.tsx       # Drift, migrations, ERD
│   │   ├── DataQuality.tsx         # Profiling, validation
│   │   └── Settings.tsx            # Config, users, AI providers
│   └── utils/
│       ├── formatters.ts           # SQL, bytes, duration
│       └── validators.ts           # Form validation
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── Dockerfile
└── .env.example
```

#### 2.2.2 Key Components Specification

**SQLEditor (Monaco)**
- Language: SQL (dialect-aware)
- Autocomplete: Tables, columns, functions from schema
- Themes: vs-dark, vs-light
- Minimap: Enabled
- Format on save: sql-formatter
- Keybindings: Ctrl+Enter (execute), Ctrl+Shift+E (explain)

**ExplainVisualizer**
- Input: JSON execution plan
- Views: Tree (collapsible), Graph (D3/React-flow), Text (raw)
- Highlights: Sequential scans, high cost nodes, missing indexes
- Tooltips: Cost, rows, width, operator details

**MetricsDashboard (Recharts)**
- Real-time: WebSocket updates
- Charts: Line (latency, throughput), Area (connections), Bar (slow queries)
- Time ranges: 1h, 6h, 24h, 7d, 30d
- Refresh: 5s interval (WebSocket preferred)

**SchemaExplorer**
- Tree view: Database -> Schema -> Tables -> Columns
- Icons: Table, View, Materialized View, Column (PK, FK, Nullable)
- Context menu: View data, Explain, Generate SQL, Copy name
- Search: Filter by name

#### 2.2.3 State Management (Zustand)

**dbStore**
```typescript
interface DBStore {
  connections: DatabaseConnection[];
  activeConnectionId: string | null;
  schemaCache: Map<string, Schema>;
  fetchConnections: () => Promise<void>;
  addConnection: (config: DatabaseConfig) => Promise<void>;
  testConnection: (id: string) => Promise<boolean>;
  setActiveConnection: (id: string) => void;
  getSchema: (dbId: string) => Promise<Schema>;
}
```

**agentStore**
```typescript
interface AgentStore {
  agents: AgentDefinition[];
  activeTasks: Map<string, Task>;
  registerAgent: (agent: AgentDefinition) => void;
  submitTask: (agentType: string, params: any) => Promise<string>;
  updateTaskProgress: (taskId: string, progress: TaskProgress) => void;
}
```

**uiStore**
```typescript
interface UIStore {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  activeModal: ModalType | null;
  notifications: Notification[];
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
  openModal: (modal: ModalType) => void;
  addNotification: (notification: Notification) => void;
}
```

---

### 2.3 Shared Contracts

#### 2.3.1 OpenAPI Specification
Single source of truth at `shared/openapi.yaml`:
- Generates TypeScript types: `openapi-typescript shared/openapi.yaml -o src/types/api.ts`
- Generates Python models: `datamodel-codegen --input shared/openapi.yaml --output app/models/api.py`

#### 2.3.2 WebSocket Protocol

**Connection**: `wss://host/api/v1/ws?token={jwt}`

**Client Messages**
```typescript
type ClientMessage =
  | { type: 'subscribe'; channels: string[] }
  | { type: 'unsubscribe'; channels: string[] }
  | { type: 'ping' }
  | { type: 'task_cancel'; taskId: string };
```

**Server Messages**
```typescript
type ServerMessage =
  | { type: 'connected'; connectionId: string }
  | { type: 'task_started'; taskId: string; agentId: string; timestamp: string }
  | { type: 'task_progress'; taskId: string; progress: number; step: string; message: string }
  | { type: 'task_completed'; taskId: string; result: TaskResult; timestamp: string }
  | { type: 'task_failed'; taskId: string; error: string; timestamp: string }
  | { type: 'agent_status'; agentId: string; status: AgentStatus; timestamp: string }
  | { type: 'metric_update'; databaseId: string; metrics: MetricSnapshot; timestamp: string }
  | { type: 'alert'; severity: 'info' | 'warning' | 'critical'; title: string; message: string; timestamp: string }
  | { type: 'pong' };
```

**Channels**: `tasks:{taskId}`, `agents:{agentId}`, `databases:{dbId}`, `global`, `alerts`

---

## 3. Infrastructure Requirements

### 3.1 Development Environment (Docker Compose)

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: db_sentinel
      POSTGRES_USER: sentinel
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes: [postgres_data:/var/lib/postgresql/data]
    ports: ["5432:5432"]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U sentinel"], interval: 10s }

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes: [redis_data:/data]
    ports: ["6379:6379"]
    healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: 10s }

  ollama:
    image: ollama/ollama:latest
    volumes: [ollama_data:/root/.ollama]
    ports: ["11434:11434"]
    deploy:
      resources:
        reservations:
          devices: [{ driver: nvidia, count: 1, capabilities: [gpu] }]

  agent-engine:
    build: { context: ./agent-engine, dockerfile: Dockerfile.dev }
    ports: ["8000:8000"]
    environment:
      - DATABASE_URL=postgresql+asyncpg://sentinel:${POSTGRES_PASSWORD}@postgres:5432/db_sentinel
      - REDIS_URL=redis://redis:6379/0
      - OLLAMA_BASE_URL=http://ollama:11434
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - LOG_LEVEL=DEBUG
    volumes: [./agent-engine:/app]
    depends_on: { postgres: { condition: service_healthy }, redis: { condition: service_healthy } }

  web-dashboard:
    build: { context: ./web-dashboard, dockerfile: Dockerfile.dev }
    ports: ["3000:3000"]
    environment:
      - VITE_API_URL=http://localhost:8000
      - VITE_WS_URL=ws://localhost:8000
    volumes: [./web-dashboard:/app, /app/node_modules]
    depends_on: [agent-engine]

volumes: { postgres_data:, redis_data:, ollama_data: }
```

### 3.2 Production Environment (Kubernetes)

**Namespace**: `db-sentinel`

**Deployments**
| Component | Replicas | Resources | Autoscaling |
|-----------|----------|-----------|-------------|
| agent-engine | 3 | 1CPU/2Gi (req), 2CPU/4Gi (lim) | HPA: CPU>70%, max 10 |
| web-dashboard | 3 | 500m/512Mi (req), 1CPU/1Gi (lim) | HPA: CPU>70%, max 10 |
| ollama | 1-2 (GPU) | 4CPU/16Gi + 1x GPU | Manual |

**StatefulSets**
| Component | Storage | Backup |
|-----------|---------|--------|
| postgresql | 100Gi SSD (PVC) | Daily PGBackRest to S3 |
| redis | 10Gi SSD (PVC) | RDB snapshots hourly |

**Ingress**
- TLS: cert-manager (Let's Encrypt)
- Path routing: `/api/*` -> agent-engine, `/*` -> web-dashboard
- WebSocket passthrough enabled

**ConfigMaps/Secrets**
- `db-sentinel-config`: Non-sensitive config
- `db-sentinel-secrets`: JWT_SECRET, ENCRYPTION_KEY, API keys, DB passwords

### 3.3 Network Requirements

| Connection | Protocol | Port | Encryption |
|------------|----------|------|------------|
| Client -> Dashboard | HTTPS | 443 | TLS 1.3 |
| Dashboard -> Agent Engine | HTTPS/WSS | 443 (internal) | mTLS (optional) |
| Agent Engine -> PostgreSQL | PostgreSQL | 5432 | TLS |
| Agent Engine -> Redis | Redis | 6379 | TLS (optional) |
| Agent Engine -> Ollama | HTTP | 11434 | Internal network |
| Agent Engine -> Target DBs | Various | Various | TLS/SSL |
| Agent Engine -> OpenAI/Anthropic | HTTPS | 443 | TLS 1.3 |

---

## 4. Security Specifications

### 4.1 Authentication Flow
```
1. User submits credentials -> /api/v1/auth/login
2. Server validates -> Returns access_token (JWT, 1h) + refresh_token (JWT, 7d)
3. Client stores tokens -> Access in memory, Refresh in httpOnly cookie
4. Requests include: Authorization: Bearer <access_token>
5. Access token expired -> POST /api/v1/auth/refresh with refresh_token
6. New access_token issued, refresh_token rotated
```

### 4.2 JWT Claims
```json
{
  "sub": "user_id",
  "email": "user@company.com",
  "roles": ["DBA", "Developer"],
  "permissions": ["databases:read", "tasks:create"],
  "iat": 1234567890,
  "exp": 1234571490,
  "type": "access"
}
```

### 4.3 RBAC Permission Matrix

| Resource | Admin | DBA | Developer | Viewer |
|----------|-------|-----|-----------|--------|
| Databases (CRUD) | ✅ | ✅ | R/C* | R |
| Agents (Execute) | ✅ | ✅ | ✅ | R |
| Tasks (All) | ✅ | ✅ | C/R | R |
| AI Providers | ✅ | R | - | - |
| Users | ✅ | R | - | - |
| Settings | ✅ | R | - | - |
| Audit Logs | ✅ | R | - | - |

*C = Create/Connect only

### 4.4 Credential Encryption
- **Algorithm**: AES-256-GCM (Fernet compatible)
- **Key**: 32-byte from `ENCRYPTION_KEY` env (base64)
- **Rotation**: Re-encrypt on key change (background job)
- **Storage**: Encrypted `password` field in metadata DB

### 4.5 Audit Logging
```python
class AuditLog(BaseModel):
    id: str
    timestamp: datetime
    user_id: str
    action: str  # "database.create", "task.execute", "credential.rotate"
    resource_type: str
    resource_id: str
    details: Dict[str, Any]
    ip_address: str
    user_agent: str
    result: "success" | "failure"
    error_message: Optional[str]
```

---

## 5. Data Flow Specifications

### 5.1 SQL Generation Flow
```
1. User submits NL query + database_id via POST /api/v1/agents/sql_generator/tasks
2. Task queued in Redis (priority: normal)
3. Worker picks task -> SQLGeneratorAgent.run()
4. Agent fetches schema (cached or fresh)
5. Agent builds prompt: system + schema + examples + user query
6. Agent calls AI Router -> selects best model
6. AI Provider returns completion
7. Agent extracts SQL, validates against schema
8. Agent stores result: { sql, explanation, confidence }
9. Task marked COMPLETED -> WebSocket event to client
10. Client receives result via WS subscription
```

### 5.2 Query Optimization Flow
```
1. User submits SQL + database_id via Query Lab
2. Task queued -> QueryOptimizerAgent.run()
3. Agent gets adapter for database
4. Agent executes EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
5. Agent parses plan -> identifies issues:
   - Sequential scans on large tables
   - Missing indexes (high cost, filter conditions)
   - Redundant indexes
   - Suboptimal join order
6. Agent calls AI for rewrite suggestions (optional)
7. Result: { original_plan, issues, index_recommendations, rewritten_queries }
```

### 5.3 Schema Introspection Flow
```
1. Trigger: Manual sync, scheduled (daily), or drift detection
2. Agent gets adapter -> executes introspection queries
3. Results normalized to TableInfo/ColumnInfo models
4. Compared with cached schema (if exists)
5. Drift detected: { added_tables, dropped_tables, altered_columns, ... }
6. If drift: Create drift record, emit alert
7. Cache updated with new schema + timestamp
```

### 5.4 Real-time Monitoring Flow
```
1. MonitorAgent scheduled every 30s (configurable)
2. For each active database:
   a. Get adapter -> execute monitoring queries
   b. Collect: connections, latency, cache_hit, tps, deadlocks, locks
   c. Store in Redis time-series (or metadata DB)
   d. Check thresholds -> generate alerts if needed
   e. Emit metric_update via WebSocket
3. Dashboard receives WS -> updates charts in real-time
```

---

## 6. Integration Specifications

### 6.1 External AI Providers

**Ollama (Local)**
- Endpoint: `http://ollama:11434` (configurable)
- Models: Auto-discovered via `/api/tags`
- Default: `llama3.1:8b`, `codellama:13b`
- Health: `/api/tags` returns 200

**OpenAI**
- Endpoint: `https://api.openai.com/v1`
- Auth: Bearer token (OPENAI_API_KEY)
- Models: gpt-4o, gpt-4o-mini, gpt-3.5-turbo
- Features: Function calling, streaming

**Anthropic**
- Endpoint: `https://api.anthropic.com/v1`
- Auth: x-api-key (ANTHROPIC_API_KEY)
- Models: claude-3-5-sonnet, claude-3-haiku
- Features: Streaming, large context

### 6.2 Target Database Integration

**PostgreSQL** (asyncpg)
- Queries: information_schema, pg_catalog
- EXPLAIN: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON, SETTINGS)`
- Stats: pg_stat_statements, pg_stat_database
- Types: Full PostgreSQL type system mapping

**MySQL/MariaDB** (aiomysql)
- Queries: information_schema
- EXPLAIN: `EXPLAIN FORMAT=JSON` (MySQL 8.0+)
- Stats: performance_schema, sys schema
- Types: MySQL type mapping

**SQL Server** (aioodbc/pyodbc)
- Queries: INFORMATION_SCHEMA, sys.*
- EXPLAIN: SET STATISTICS XML ON / Query Store
- Stats: sys.dm_exec_query_stats, Query Store
- Types: T-SQL type mapping

**Oracle** (oracledb)
- Queries: ALL_TABLES, ALL_TAB_COLUMNS, USER_INDEXES
- EXPLAIN: EXPLAIN PLAN + DBMS_XPLAN
- Stats: V$SQL, AWR (if licensed)
- Types: Oracle type mapping

---

## 7. Performance Requirements

### 7.1 Response Time Targets

| Operation | p50 | p95 | p99 |
|-----------|-----|-----|-----|
| Health check | < 10ms | < 50ms | < 100ms |
| List databases | < 50ms | < 100ms | < 200ms |
| Schema fetch (cached) | < 20ms | < 50ms | < 100ms |
| Schema fetch (fresh, 100 tables) | < 5s | < 15s | < 30s |
| SQL generation (local) | < 2s | < 5s | < 10s |
| SQL generation (cloud) | < 1s | < 3s | < 5s |
| Query optimization | < 3s | < 10s | < 20s |
| Task submission | < 50ms | < 100ms | < 200ms |
| WebSocket message | < 10ms | < 50ms | < 100ms |

### 7.2 Throughput Targets
- Concurrent API requests: 500 req/s
- Concurrent WebSocket connections: 1000
- Task queue processing: 100 tasks/min
- Schema introspection: 10 concurrent

### 7.3 Resource Limits
- Agent Engine memory: < 2Gi per replica
- Web Dashboard memory: < 512Mi per replica
- Redis memory: < 2Gi (LRU eviction)
- PostgreSQL: < 4Gi shared_buffers

---

## 8. Observability Requirements

### 8.1 Metrics (Prometheus)

**Application Metrics**
```
http_requests_total{method, path, status}
http_request_duration_seconds{method, path}
websocket_connections_active
task_queue_depth
task_duration_seconds{agent_type, status}
ai_completion_duration_seconds{provider, model}
ai_tokens_total{provider, model, type}
database_connection_pool{database_id, state}
schema_cache_hits_total{database_id}
```

**Business Metrics**
```
sql_generation_accuracy{database_type}
query_optimization_savings_percent
drift_detections_total
data_quality_violations_total{rule_type}
active_users_daily
```

### 8.2 Logging (Structured JSON)
```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "level": "INFO",
  "logger": "app.agents.sql_generator",
  "message": "SQL generation completed",
  "task_id": "tsk_abc123",
  "agent_type": "sql_generator",
  "database_id": "db_prod_01",
  "duration_ms": 1250,
  "model": "llama3.1:8b",
  "tokens": { "prompt": 2450, "completion": 180 },
  "confidence": 0.92
}
```

### 8.3 Distributed Tracing (OpenTelemetry)
- Trace: HTTP request -> Task queue -> Agent execution -> AI call -> DB query
- Span attributes: task_id, agent_type, database_id, model, tokens
- Exporters: OTLP to Jaeger/Tempo

### 8.4 Alerting Rules
| Alert | Condition | Severity | Notification |
|-------|-----------|----------|--------------|
| HighTaskQueueDepth | queue_depth > 100 for 5m | warning | Slack, Email |
| TaskFailureRate | failure_rate > 10% for 10m | critical | PagerDuty |
| DatabaseUnreachable | connection_test_failed > 3 | critical | PagerDuty |
| HighAICost | daily_cost > budget * 0.8 | warning | Email |
| DiskSpaceLow | postgres_disk > 80% | warning | Slack |
| OllamaUnhealthy | health_check_failed > 3 | warning | Slack |

---

## 9. Testing Requirements

### 9.1 Unit Tests (Target: >80% coverage)
- Agent state machine transitions
- Adapter interface compliance
- AI provider routing logic
- Schema comparison/drift detection
- Query plan parsing
- Credential encryption/decryption
- RBAC permission checks

### 9.2 Integration Tests
- Full API endpoint testing (TestClient)
- Database adapter against test containers
- AI provider mock responses
- WebSocket connection lifecycle
- Task queue processing
- Authentication flows

### 9.3 End-to-End Tests (Playwright)
- User login -> add database -> generate SQL -> execute -> view results
- Query optimization workflow
- Schema drift detection
- Monitoring dashboard real-time updates
- Multi-user RBAC scenarios

### 9.4 Performance Tests (k6)
- Load test: 100 VUs, 10 min
- Stress test: Ramp to 500 VUs
- Soak test: 50 VUs, 1 hour
- Spike test: Sudden 10x load

---

## 10. Deployment Requirements

### 10.1 Container Images
| Image | Base | Size Target |
|-------|------|-------------|
| agent-engine | python:3.11-slim | < 500MB |
| web-dashboard | node:20-alpine | < 200MB |
| ollama | ollama/ollama | ~4GB (with models) |

### 10.2 Health Checks
```python
# Agent Engine
GET /api/v1/health          # Liveness (process alive)
GET /api/v1/health/ready    # Readiness (DB, Redis, Ollama reachable)

# Web Dashboard
GET /health                 # Static file serving
```

### 10.3 Rollout Strategy
- **Agent Engine**: Rolling update (maxSurge=1, maxUnavailable=0)
- **Web Dashboard**: Rolling update (maxSurge=1, maxUnavailable=0)
- **Database migrations**: Pre-deployment job (init container)
- **Config changes**: Reload via SIGHUP or configmap reload

---

## 11. Disaster Recovery

### 11.1 Backup Strategy
| Data | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| Metadata DB | Daily | 30 days | PGBackRest to S3 |
| Redis | Hourly RDB | 7 days | Redis snapshots |
| Config/Secrets | On change | Forever | GitOps (SealedSecrets) |
| Ollama models | N/A | N/A | Re-pull from registry |

### 11.2 Recovery Procedures
- **Metadata DB**: Restore latest PGBackRest backup -> verify migrations
- **Redis**: Flush -> rebuild from metadata DB (schema cache, queue)
- **Full cluster**: GitOps repo -> ArgoCD sync -> verify health checks

### 11.3 RTO/RPO Targets
| Scenario | RTO | RPO |
|----------|-----|-----|
| Single pod failure | < 30s | 0 |
| Node failure | < 2min | 0 |
| Database corruption | < 30min | < 1hr |
| Region outage | < 4hr | < 1hr |

---

## 12. Compliance & Standards

### 12.1 Code Standards
- **Python**: Ruff (lint), Black (format), mypy (type check), pytest (test)
- **TypeScript**: ESLint, Prettier, tsc --noEmit, Vitest (test)
- **Commits**: Conventional Commits
- **Branching**: Trunk-based, short-lived feature branches

### 12.2 Security Standards
- OWASP Top 10 mitigation
- Dependency scanning: `pip-audit`, `npm audit`, `trivy`
- SAST: `bandit` (Python), `semgrep` (multi-language)
- Container scanning: `trivy` on CI

### 12.3 Documentation Standards
- API: OpenAPI 3.1 (source of truth)
- Architecture: ADRs in `docs/adr/`
- Runbooks: `docs/runbooks/`
- Changelog: Keep a Changelog format

---

## 13. Appendix

### 13.1 Environment Variables Reference
See `agent-engine/.env.example` and `web-dashboard/.env.example`

### 13.2 Database Schema (Metadata)
See `BACKEND_SCHEMA.md`

### 13.3 API Reference
See `shared/openapi.yaml` (generated from code)

### 13.4 Related Documents
- PRD: `PRD.md`
- Architecture: `ARCHITECTURE.md`
- UI/UX Design: `UI_UX_DESIGN.md`
- Backend Schema: `BACKEND_SCHEMA.md`
- Implementation Plan: `IMPLEMENTATION_PLAN.md`
- App Flow: `APP_FLOW.md`