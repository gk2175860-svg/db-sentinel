# DB Sentinel - Application Flow Document

## 1. Overview

This document describes the end-to-end user flows and system interactions in DB Sentinel. Each flow includes the user journey, API calls, backend processing, and UI states.

---

## 2. Core User Flows

### 2.1 Authentication Flow

#### 2.1.1 User Login
```
┌─────────┐     ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  User   │────►│  Login Page  │────►│  POST /auth/login│────►│  JWT Tokens  │
│ Browser │     │  (React)     │     │  Agent Engine    │     │  (Access +   │
└─────────┘     └──────────────┘     └──────────────────┘     │  Refresh)    │
                                                                 └──────┬───────┘
                                                                        │
                                                                        ▼
┌─────────┐     ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  User   │◄───│  Dashboard   │◄───│  Redirect + Store│◄───│  Tokens in   │
│ Browser │     │  (React)     │     │  Tokens          │     │  Memory/     │
└─────────┘     └──────────────┘     └──────────────────┘     │  Cookies     │
                                                                 └──────────────┘
```

**Steps**:
1. User navigates to `/login`
2. Enters email/password
3. Frontend calls `POST /api/v1/auth/login`
4. Backend validates credentials, generates JWT pair
5. Access token (15min) stored in memory, Refresh token (7d) in httpOnly cookie
6. Redirect to `/dashboard`
7. Subsequent requests include `Authorization: Bearer <access_token>`

#### 2.1.2 Token Refresh
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Automatic Token Refresh (Silent)                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Axios interceptor catches 401 on API call                          │
│  2. POST /api/v1/auth/refresh with refresh_token (cookie)              │
│  3. Backend validates, issues new access_token + rotates refresh       │
│  4. Retry original request with new token                              │
│  5. If refresh fails → logout, redirect to /login                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 2.1.3 Role-Based Access Control
```
Request → Authentication Middleware → Extract User → Load Roles/Permissions
                                              ↓
                              Check Permission for Resource/Action
                                              ↓
                                    Allow (200) or Deny (403)
```

---

### 2.2 Database Connection Management

#### 2.2.1 Add Database Connection
```
┌─────────┐     ┌──────────────────┐     ┌────────────────────┐     ┌────────────────┐
│  User   │────►│  Databases Page  │────►│  POST /databases   │────►│  Encrypt &     │
│ Browser │     │  [+ Add]         │     │  Agent Engine      │     │  Store Config  │
└─────────┘     └──────────────────┘     └────────────────────┘     └───────┬────────┘
                                                                           │
                                                                           ▼
┌─────────┐     ┌──────────────────┐     ┌────────────────────┐     ┌────────────────┐
│  User   │◄───│  Databases Page  │◄───│  GET /databases    │◄───│  List from DB  │
│ Browser │     │  (Updated)       │     │  Agent Engine      │     │  (Decrypted)   │
└─────────┘     └──────────────────┘     └────────────────────┘     └────────────────┘
```

**Form Fields**:
- Name, Type (PostgreSQL/MySQL/SQL Server/Oracle/SQLite)
- Host, Port, Database, Schema
- Username, Password (encrypted client-side preview)
- SSL Mode, Connection Options (JSON)
- Pool Config: Size, Overflow, Timeout, Recycle
- Tags, Description

#### 2.2.2 Test Connection
```
POST /api/v1/databases/{id}/test
    │
    ▼
Backend: Decrypt credentials → Create adapter → test_connection()
    │
    ├── Success: Update last_tested_at, last_test_status="success"
    └── Failure: Update last_test_status="failed", last_test_error
    │
    ▼
Response: { success: true/false, latency_ms: 45, version: "PostgreSQL 16.2" }
```

#### 2.2.3 Schema Synchronization
```
GET /api/v1/databases/{id}/schema (force_refresh=true)
    │
    ▼
1. Check cache (database_schemas table, checksum)
2. If stale/missing:
   a. Get adapter → introspect full schema
   b. Normalize to TableInfo/ColumnInfo models
   c. Compare with baseline → detect drift
   c. Store new schema snapshot (database_schemas)
   d. Create drift records (schema_drift) if changes
3. Return schema JSON + drift summary
```

---

### 2.3 Natural Language to SQL Generation

#### 2.3.1 User Journey
```
┌─────────┐     ┌──────────────────┐     ┌─────────────────────────────────────┐
│  User   │────►│  Query Lab Page  │────►│  AI Assistant Panel                  │
│ Browser │     │  (Monaco Editor) │     │  [Natural Language Input]             │
└─────────┘     └──────────────────┘     └─────────────────────────────────────┘
                                                                      │
                                                                      ▼
┌─────────┐     ┌──────────────────┐     ┌─────────────────────────────────────┐
│  User   │◄───│  Query Lab       │◄───│  Streaming Response:                  │
│ Browser │     │  (SQL + Results) │     │  { sql: "...", explanation: "...",  │
└─────────┘     └──────────────────┘     │   confidence: 0.92 }                │
                                         └─────────────────────────────────────┘
```

#### 2.3.2 Backend Processing Flow
```
POST /api/v1/agents/sql_generator/tasks
    │
    ▼
1. Validate: agent_type exists, database_id valid, required params present
2. Create Task record (status=queued)
3. Enqueue in Redis/RQ (priority=normal)
4. Return { task_id, status: "queued" }
    │
    ▼
Worker picks task:
    │
    ▼
SQLGeneratorAgent.run(context):
    │
    ├── 1. Transition: INITIALIZING
    │     - Load database schema (cache or fresh)
    │     - Build prompt: system + schema + examples + user query
    │
    ├── 2. Transition: RUNNING
    │     - Call AI Router → select best model (local preferred)
    │     - Stream or single completion
    │
    ├── 3. Parse & Validate
    │     - Extract SQL from response
    │     - Validate against schema (tables/columns exist)
    │     - Check for dangerous operations (DROP, TRUNCATE)
    │
    ├── 4. Store Result
    │     - Task.result = { sql, explanation, confidence }
    │     - TaskArtifact: generated_sql, explanation
    │
    └── 5. Transition: COMPLETED
          - Emit WebSocket event: task_completed
```

#### 2.3.3 Prompt Engineering
```
System Prompt:
"You are an expert SQL developer. Generate valid {dialect} SQL for the given
natural language query. Use the provided schema context. Return only the SQL
query in a markdown code block, followed by a brief explanation."

Schema Context:
"Database: prod-primary (PostgreSQL 16)
Schema: public
Tables:
- users (id UUID PK, email VARCHAR UNIQUE, name VARCHAR, created_at TIMESTAMPTZ)
- orders (id UUID PK, user_id UUID FK→users.id, status VARCHAR, total_cents INT, created_at TIMESTAMPTZ)
- order_items (id UUID PK, order_id UUID FK→orders.id, product_id UUID, quantity INT, price_cents INT)"

User Query: "Show me all users who placed orders over $100 last month"

Expected Output:
```sql
SELECT DISTINCT u.id, u.email, u.name
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.total_cents > 10000
  AND o.created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
  AND o.created_at < DATE_TRUNC('month', CURRENT_DATE);
```

Explanation: "This query joins users with orders, filters for orders over $100 
(10000 cents) in the previous calendar month, and returns unique users."
```

---

### 2.4 Query Optimization Flow

#### 2.4.1 User Journey
```
┌─────────┐     ┌──────────────────┐     ┌─────────────────────────────────────┐
│  User   │────►│  Query Lab       │────►│  Paste SQL → Click "Optimize"        │
│ Browser │     │  (Monaco Editor) │     └─────────────────────────────────────┘
└─────────┘     └──────────────────┘                                    │
                                                                         ▼
┌─────────┐     ┌──────────────────┐     ┌─────────────────────────────────────┐
│  User   │◄───│  Explain Visualizer│◄───│  Optimization Results:               │
│ Browser │     │  (Tree + Graph)  │     │  - Original Plan                    │
└─────────┘     └──────────────────┘     │  - Issues Found                     │
                                         │  - Index Recommendations              │
                                         │  - Rewritten Queries                  │
                                         └─────────────────────────────────────┘
```

#### 2.4.2 Backend Processing
```
POST /api/v1/agents/query_optimizer/tasks
    │
    ▼
QueryOptimizerAgent.run():
    │
    ├── 1. Get adapter for database
    ├── 2. Execute EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    │     - PostgreSQL: EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON, SETTINGS)
    │     - MySQL: EXPLAIN FORMAT=JSON
    │     - SQL Server: SET STATISTICS XML ON
    │
    ├── 3. Parse Plan → QueryPlan model
    │     - Extract: cost, rows, operations, node types
    │
    ├── 4. Analyze Issues
    │     - Sequential scans on large tables (>10k rows)
    │     - High cost nodes (>1000)
    │     - Missing indexes (filter conditions without indexes)
    │     - Expensive sorts/hashes
    │     - Nested loops with high row counts
    │
    ├── 5. Generate Recommendations
    │     - Missing indexes: CREATE INDEX ON table(col1, col2)
    │     - Redundant indexes: DROP INDEX idx_x
    │     - Partitioning suggestions
    │     - Configuration tuning
    │
    ├── 6. (Optional) AI Rewrite
    │     - Prompt: "Optimize this query for {dialect}"
    │     - Return alternative formulations
    │
    └── 7. Store Result
          {
            original_plan: {...},
            issues: [...],
            index_recommendations: [...],
            rewritten_queries: [...],
            estimated_improvement: "95%"
          }
```

---

### 2.5 Schema Management Flow

#### 2.5.1 Drift Detection
```
Scheduled Job (Daily) / Manual Trigger
    │
    ▼
For each active database:
    │
    ├── 1. Get current schema via adapter
    ├── 2. Get latest baseline snapshot (database_schemas)
    ├── 3. Compare:
    │     - Tables: added, dropped, renamed
    │     - Columns: added, dropped, type changed, nullable changed
    │     - Indexes: added, dropped, definition changed
    │     - Constraints: added, dropped
    │
    ├── 4. For each change:
    │     - Create schema_drift record
    │     - severity: table_dropped=critical, column_type_changed=warning, index_added=info
    │
    ├── 5. If drift found:
    │     - Create alert (warning/critical)
    │     - Emit WebSocket: drift_detected
    │
    └── 6. Store new baseline snapshot
```

#### 2.5.2 Migration Generation
```
User clicks "Generate Migration" on drift record(s)
    │
    ▼
POST /api/v1/databases/{id}/migrations
    │
    ▼
SchemaManagerAgent.generate_migration():
    │
    ├── 1. Collect selected drift records
    ├── 2. Order by dependency (tables before indexes, FKs last)
    ├── 3. Generate UP SQL:
    │     - CREATE TABLE, ALTER TABLE ADD COLUMN
    │     - ALTER COLUMN TYPE (with USING clause)
    │     - CREATE INDEX CONCURRENTLY
    │     - ALTER TABLE ADD CONSTRAINT
    │
    ├── 4. Generate DOWN SQL (reverse order)
    │     - DROP INDEX, DROP CONSTRAINT
    │     - ALTER TABLE DROP COLUMN
    │     - DROP TABLE
    │
    ├── 5. Validate: dry-run on staging (optional)
    ├── 6. Store Migration record (status=pending)
    │
    └── 7. Return migration SQL for review
```

---

### 2.6 Monitoring & Alerting Flow

#### 2.6.1 Metrics Collection
```
Background Job (every 30s, configurable)
    │
    ▼
MonitorAgent.run() for each database:
    │
    ├── 1. Get adapter
    ├── 2. Execute monitoring queries:
    │     - PostgreSQL: pg_stat_database, pg_stat_statements, pg_locks
    │     - MySQL: performance_schema, sys.schema_table_statistics
    │     - SQL Server: sys.dm_exec_query_stats, sys.dm_os_wait_stats
    │
    ├── 3. Normalize to MetricsSnapshot JSON
    ├── 4. Store in metrics_snapshots table
    ├── 5. Check alert rules:
    │     - For each enabled rule for this database:
    │       - Evaluate condition (metric > threshold for duration)
    │       - If firing and not already firing → create alert
    │       - If resolved → update alert status
    │
    ├── 6. Emit WebSocket: metric_update { databaseId, metrics }
    │
    └── 7. Cleanup old snapshots (retention policy)
```

#### 2.6.2 Alert Processing
```
Alert Created (firing):
    │
    ├── 1. Store in alerts table
    ├── 2. Emit WebSocket: alert { severity, title, message }
    ├── 3. Check notification channels:
    │     - Slack webhook
    │     - Email (SendGrid/SMTP)
    │     - PagerDuty API
    │     - Custom webhook
    │
    └── 4. Send notifications (async, retry on failure)

Alert Acknowledged:
    │
    ├── 1. Update alert: status=acknowledged, acknowledged_by, acknowledged_at
    ├── 2. Emit WebSocket: alert_acknowledged
    └── 3. Stop escalation

Alert Resolved (auto or manual):
    │
    ├── 1. Update alert: status=resolved, resolved_at
    ├── 2. Emit WebSocket: alert_resolved
    └── 3. Record MTTR
```

---

### 2.7 Data Quality Flow

#### 2.7.1 Table Profiling
```
POST /api/v1/agents/data_quality/tasks (profile action)
    │
    ▼
DataQualityAgent.run(action="profile"):
    │
    ├── 1. Get adapter
    ├── 2. For each column in table:
    │     - Basic: null_count, distinct_count, min, max
    │     - Numeric: mean, stddev, percentiles (25, 50, 75, 95, 99)
    │     - String: avg_length, min_length, max_length, format checks
    │     - Date: min_date, max_date, range
    │     - Sample: top 10 values with counts
    │
    ├── 3. Statistical analysis:
    │     - Outlier detection (IQR method, z-score)
    │     - Distribution analysis (uniform, normal, skewed)
    │     - Correlation with other columns (sample)
    │
    ├── 4. Store table_profiles record
    ├── 5. Return profile summary
    │
    └── 6. Emit WebSocket: profiling_complete
```

#### 2.7.2 Validation Rules
```
User creates rule: "email column must be valid format"
    │
    ▼
POST /api/v1/data-quality/rules
    │
    ▼
Store in data_quality_rules table

Run Validation:
POST /api/v1/agents/data_quality/tasks (validate action)
    │
    ▼
DataQualityAgent.run(action="validate"):
    │
    ├── 1. Get enabled rules for table
    ├── 2. For each rule:
    │     - not_null: COUNT(*) WHERE col IS NULL
    │     - unique: COUNT(*) - COUNT(DISTINCT col)
    │     - range: COUNT(*) WHERE col < min OR col > max
    │     - regex: COUNT(*) WHERE col !~ pattern
    │     - enum: COUNT(*) WHERE col NOT IN (values)
    │     - custom_sql: Execute provided SQL
    │
    ├── 3. Store data_quality_runs + data_quality_results
    ├── 4. For failures:
    │     - Sample failing rows (LIMIT 100)
    │     - Store in results.sample_values
    │
    └── 5. Emit WebSocket: validation_complete
```

---

### 2.8 Task Execution & WebSocket Flow

#### 2.8.1 Complete Task Lifecycle
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        TASK LIFECYCLE WITH WEBSOCKET                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  CLIENT                                          SERVER                          │
│  ──────                                          ──────                          │
│                                                                                 │
│  1. POST /agents/sql_generator/tasks                                        │
│     ──────────────────────────────────────────►                                │
│                                                                                 │
│  2. ◄──────────────────────────────────────────  { task_id, status: "queued" } │
│                                                                                 │
│  3. WS Connect: wss://host/api/v1/ws?token=...                                 │
│     ──────────────────────────────────────────►                                │
│                                                                                 │
│  4. WS Subscribe: { type: "subscribe", channels: ["tasks:task_id"] }           │
│     ──────────────────────────────────────────►                                │
│                                                                                 │
│  5. ◄──────────────────────────────────────────  { type: "connected" }         │
│                                                                                 │
│  6. Worker picks task → Agent.run()                                           │
│                                                                                 │
│  7. ◄──────────────────────────────────────────  { type: "task_started",       │
│                                                      taskId, agentId }         │
│                                                                                 │
│  8. ◄──────────────────────────────────────────  { type: "task_progress",      │
│                                                      taskId, progress: 25,      │
│                                                      step: "loading_schema",    │
│                                                      message: "Loading schema"  │
│                                                    }                            │
│                                                                                 │
│  9. ◄──────────────────────────────────────────  { type: "task_progress",      │
│                                                      taskId, progress: 60,      │
│                                                      step: "ai_generation",     │
│                                                      message: "Generating SQL"  │
│                                                    }                            │
│                                                                                 │
│  10. ◄────────────────────────────────────────── { type: "task_completed",     │
│                                                      taskId, result: {...} }    │
│                                                                                 │
│  11. GET /api/v1/tasks/{task_id} (fetch full result)                           │
│     ──────────────────────────────────────────►                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 2.8.2 WebSocket Message Types
```
Client → Server:
  - { type: "subscribe", channels: ["tasks:abc", "databases:xyz", "global"] }
  - { type: "unsubscribe", channels: ["tasks:abc"] }
  - { type: "ping" }
  - { type: "task_cancel", taskId: "..." }

Server → Client:
  - { type: "connected", connectionId: "..." }
  - { type: "task_started", taskId, agentId, timestamp }
  - { type: "task_progress", taskId, progress, step, message, timestamp }
  - { type: "task_completed", taskId, result, timestamp }
  - { type: "task_failed", taskId, error, timestamp }
  - { type: "agent_status", agentId, status, timestamp }
  - { type: "metric_update", databaseId, metrics, timestamp }
  - { type: "alert", severity, title, message, timestamp }
  - { type: "pong" }
```

---

### 2.9 Settings & Configuration Flows

#### 2.9.1 AI Provider Configuration
```
Settings Page → AI Providers Tab
    │
    ├── Ollama:
    │     - Endpoint URL (test connection)
    │     - Auto-discover models
    │     - Set default model
    │
    ├── OpenAI:
    │     - API Key (encrypted storage)
    │     - Organization ID
    │     - Default model, budget limit
    │
    ├── Anthropic:
    │     - API Key (encrypted storage)
    │     - Default model
    │
    └── Routing:
          - Default provider
          - Prefer local (privacy)
          - Daily cost limit
          - Fallback on failure
```

#### 2.9.2 User Management (Admin)
```
Settings → Users & Roles
    │
    ├── List users with roles
    ├── Invite user (email + role)
    ├── Edit user roles
    ├── Deactivate user
    └── View audit log for user
```

---

## 3. System Integration Flows

### 3.1 External AI Provider Calls

#### 3.1.1 Ollama (Local)
```
Agent → AI Router → OllamaProvider
    │
    ├── POST http://ollama:11434/api/chat
    │     Body: { model, messages, stream, options }
    │
    ├── Stream: Read chunked response
    │     Each chunk: { message: { content: "token" }, done: false }
    │
    └── Final: { message: { content: "full" }, done: true, eval_count: 150 }
```

#### 3.1.2 OpenAI (Cloud)
```
Agent → AI Router → OpenAIProvider
    │
    ├── POST https://api.openai.com/v1/chat/completions
    │     Headers: Authorization: Bearer sk-..., Content-Type: application/json
    │     Body: { model, messages, temperature, max_tokens, stream }
    │
    ├── Stream: Server-Sent Events (SSE)
    │     data: { choices: [{ delta: { content: "token" } }] }
    │
    └── Usage: { prompt_tokens, completion_tokens, total_tokens }
```

#### 3.1.3 Anthropic (Cloud)
```
Agent → AI Router → AnthropicProvider
    │
    ├── POST https://api.anthropic.com/v1/messages
    │     Headers: x-api-key: sk-ant-..., anthropic-version: 2023-06-01
    │     Body: { model, messages, max_tokens, stream }
    │
    ├── Stream: SSE with content_block_delta events
    │
    └── Usage: { input_tokens, output_tokens }
```

### 3.2 Target Database Operations

#### 3.2.1 Read Query Execution
```
Agent → Adapter → execute_query(sql, params)
    │
    ├── 1. Get connection from pool
    ├── 2. Execute with timeout (30s default)
    ├── 3. Fetch rows (limit 10000 for safety)
    ├── 4. Convert to QueryResult:
    │     { columns: [...], rows: [...], row_count: 42, execution_time_ms: 15 }
    ├── 5. Return to pool
    │
    └── Error handling: Timeout → retry, Connection error → reconnect
```

#### 3.2.2 EXPLAIN Plan
```
Agent → Adapter → explain_query(sql, params)
    │
    ├── 1. Build EXPLAIN command per dialect
    ├── 2. Execute
    ├── 3. Parse JSON output to QueryPlan:
    │     { total_cost, total_rows, operations: [...] }
    │
    └── 4. Return structured plan for analysis
```

---

## 4. Error Handling Flows

### 4.1 API Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid database configuration",
    "details": [
      { "field": "port", "message": "Must be between 1 and 65535" },
      { "field": "password", "message": "Password is required" }
    ],
    "request_id": "req_abc123"
  }
}
```

### 4.2 Common Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Request body invalid |
| UNAUTHENTICATED | 401 | Missing/invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Duplicate resource |
| DATABASE_ERROR | 500 | Target DB connection failed |
| AI_PROVIDER_ERROR | 502 | AI service unavailable |
| TASK_FAILED | 500 | Agent execution failed |
| RATE_LIMITED | 429 | Too many requests |

### 4.3 Task Failure Recovery
```
Task Fails:
    │
    ├── 1. Store error in Task.error
    ├── 2. Check retries < max_retries
    ├── 3. If yes: Re-queue with retries+1, exponential backoff
    ├── 4. If no: Status=FAILED, emit task_failed
    │
    └── 5. User can manually retry from UI
```

### 4.4 Database Connection Failure
```
Connection Test / Query Fails:
    │
    ├── 1. Catch exception
    ├── 2. Update database: last_test_status="failed", last_test_error
    ├── 3. If pool exhausted: recreate pool
    ├── 4. If credentials invalid: mark database inactive
    │
    └── 5. Return user-friendly error message
```

---

## 5. Security Flows

### 5.1 Credential Encryption
```
Save Database:
    │
    ├── 1. Generate random 16-byte salt
    ├── 2. Derive key: PBKDF2(ENCRYPTION_KEY, salt, 100000)
    ├── 3. Encrypt: AES-256-GCM(password, key, nonce)
    ├── 4. Store: password_encrypted, password_salt
    │
    ▼
Retrieve for Connection:
    │
    ├── 1. Fetch encrypted password + salt
    ├── 2. Derive key: PBKDF2(ENCRYPTION_KEY, salt, 100000)
    ├── 3. Decrypt: AES-256-GCM
    ├── 4. Use for connection (never logged)
    │
    ▼
Key Rotation:
    │
    ├── 1. Generate new ENCRYPTION_KEY
    ├── 2. Re-encrypt all passwords (background job)
    ├── 3. Atomic swap
    └── 4. Zero-downtime rotation
```

### 5.2 Audit Logging
```
Sensitive Action (e.g., database.create, credential.rotate):
    │
    ├── 1. Middleware captures: user, action, resource, details
    ├── 2. Create AuditLog record:
    │     { timestamp, user_id, action, resource_type, resource_id,
    │       details, ip, user_agent, result, error }
    ├── 3. Async write (non-blocking)
    │
    └── 4. Immutable: append-only, no UPDATE/DELETE
```

---

## 6. Deployment Flows

### 6.1 Development (Docker Compose)
```
docker-compose up -d
    │
    ├── 1. Start: postgres, redis, ollama
    ├── 2. Wait for health checks
    ├── 3. Build agent-engine, web-dashboard
    ├── 4. Run migrations (alembic upgrade head)
    ├── 5. Seed default agents, roles
    ├── 6. Start services
    │
    └── 7. Ready: UI at localhost:3000, API at localhost:8000
```

### 6.2 Production (Kubernetes)
```
helm upgrade --install db-sentinel ./helm
    │
    ├── 1. Apply ConfigMaps, Secrets
    ├── 2. Deploy PostgreSQL (StatefulSet) + PVC
    ├── 3. Deploy Redis (StatefulSet) + PVC
    ├── 4. Deploy Ollama (Deployment + GPU)
    ├── 5. Run migration Job (initContainer)
    ├── 6. Deploy agent-engine (Deployment, HPA)
    ├── 7. Deploy web-dashboard (Deployment, HPA)
    ├── 8. Configure Ingress (TLS, paths)
    ├── 9. Wait for readiness probes
    │
    └── 10. Verify: health checks, smoke tests
```

---

## 7. Appendix

### 7.1 API Endpoint Summary
| Category | Endpoints |
|----------|-----------|
| Auth | POST /auth/login, POST /auth/refresh, POST /auth/logout |
| Databases | CRUD /databases, POST /databases/{id}/test, GET /databases/{id}/schema |
| Agents | GET /agents, GET /agents/{type}, POST /agents/{type}/tasks |
| Tasks | GET /tasks, GET /tasks/{id}, DELETE /tasks/{id}, GET /tasks/{id}/logs |
| AI | POST /ai/complete, POST /ai/embeddings, GET /ai/models |
| Monitoring | GET /metrics/{databaseId}, GET /alerts, CRUD /alert-rules |
| Data Quality | CRUD /dq-rules, POST /dq/profile, POST /dq/validate |
| Settings | GET/PUT /settings, CRUD /users, GET /audit-logs |

### 7.2 WebSocket Channels
| Channel Pattern | Purpose |
|-----------------|---------|
| tasks:{taskId} | Individual task progress |
| agents:{agentId} | Agent status changes |
| databases:{dbId} | Database metrics, alerts |
| global | System-wide notifications |
| alerts | All alert events |

### 7.3 Related Documents
- Architecture: `ARCHITECTURE.md`
- TRD: `TRD.md`
- UI/UX Design: `UI_UX_DESIGN.md`
- Backend Schema: `BACKEND_SCHEMA.md`
- Implementation Plan: `IMPLEMENTATION_PLAN.md`