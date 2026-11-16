# DB Sentinel Core (Phases 1-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the DB Sentinel foundation (Phase 1) and core agent engine (Phase 2): FastAPI backend with JWT auth/RBAC, database connection management, adapter framework (PostgreSQL + SQLite), AI providers (Ollama + OpenAI) with smart router, async task queue with WebSocket progress, SQL Generator and Query Optimizer agents, and a React dashboard (Login, Databases, Agents, Tasks, Query Lab).

**Architecture:** Modular monolith per `ARCHITECTURE.md`. Python/FastAPI agent-engine with custom state-machine agents, plugin database adapters, pluggable AI providers, in-process task queue + event bus for dev (Redis later). React/Vite/TS dashboard consuming REST + WebSocket. Zero-infra dev: SQLite metadata DB fallback, no Redis/Ollama required to boot.

**Tech Stack:** Python 3.11, FastAPI, Pydantic v2 + pydantic-settings, SQLAlchemy 2.0 async (aiosqlite/asyncpg), httpx, PyJWT, bcrypt, cryptography (AES-256-GCM), sqlglot, pytest. React 18, TypeScript 5, Vite 5, Tailwind 3.4, Zustand, TanStack Query, Monaco (@monaco-editor/react), react-router-dom, shadcn-style hand-written UI components.

**Spec:** All docs in `C:\DB sentinel\`: `PRD.md`, `ARCHITECTURE.md`, `TRD.md`, `BACKEND_SCHEMA.md`, `APP_FLOW.md`, `UI_UX_DESIGN.md`, `IMPLEMENTATION_PLAN.md`.

## Global Constraints

- All API routes under prefix `/api/v1` (config `api_prefix`).
- Errors follow APP_FLOW §4.1 format: `{"error": {"code", "message", "details": [...]}}`.
- DB passwords never returned by any API; encrypted at rest with AES-256-GCM, key derived via PBKDF2-SHA256(ENCRYPTION_KEY, 16-byte random salt, 100_000 iterations) per APP_FLOW §5.1.
- JWT: HS256, access 60 min, refresh 7 days, claims `{sub, email, roles, type, iat, exp}` per TRD §4.2.
- Task statuses: `pending, queued, running, waiting_input, completed, failed, cancelled`; priorities: `low, normal, high, critical` (TRD §2.1.3).
- Agent types: `sql_generator, query_optimizer` this session (schema_manager/monitor/data_quality are Phase 3).
- Metadata DB portable: SQLAlchemy `sa.Uuid`, `sa.JSON` (with JSONB variant on postgres), `LargeBinary` for encrypted secrets. Default `sqlite+aiosqlite:///./db_sentinel.db`; PostgreSQL via `DATABASE_URL`.
- Read-only guard: query execution endpoint accepts only SELECT/WITH/EXPLAIN/SHOW statements; row limit 10,000; 30s timeout.
- App must boot and all tests pass with zero external services (no Postgres, Redis, Ollama, OpenAI).
- Python deps in `agent-engine/pyproject.toml`; frontend deps in `web-dashboard/package.json`.
- Alembic deferred to Phase 4 hardening (dev uses `create_all` + seed on startup) — deviation noted in README.
- Commits after every task, conventional commits (`feat:`, `test:`, `chore:`).

## Review Focus

1. **LLM output wrapping** — SQL returned inside markdown fences or with prose; `_extract_sql` must recover SQL from fenced, bare, and prose+SQL responses. Tested in Task 13.
2. **Dangerous SQL in Query Lab** — DROP/TRUNCATE/UPDATE submitted to execute endpoint must be rejected 400 `VALIDATION_ERROR`. Tested in Task 14.
3. **Invalid/expired JWT** — API returns 401 `UNAUTHENTICATED`; WS connection with bad token closes before subscribe. Tested in Tasks 4 and 10.
4. **Worker crash mid-task** — task ends `failed` with error stored, never stuck `running`. Tested in Task 9.
5. **Zero AI providers configured** — boot succeeds; `/ai/models` returns empty list; agent task fails with structured `AI_PROVIDER_ERROR`, not a crash. Tested in Task 14.

---

### Task 1: Monorepo + backend skeleton + config + health

**Files:**
- Create: `C:\DB sentinel\.gitignore`, `C:\DB sentinel\README.md` (stub), `agent-engine/pyproject.toml`, `agent-engine/app/__init__.py`, `agent-engine/app/config.py`, `agent-engine/app/main.py`, `agent-engine/app/api/__init__.py`, `agent-engine/app/api/routes/__init__.py`, `agent-engine/app/api/routes/health.py`, `agent-engine/tests/test_health.py`
- Create: `shared/.gitkeep` (openapi.yaml deferred; FastAPI serves /api/v1/openapi.json)

**Interfaces:**
- Produces: `get_settings() -> Settings` (lru_cache); `create_app() -> FastAPI`; routes `GET /api/v1/health`, `GET /api/v1/health/ready`.
- `Settings` fields per ARCHITECTURE §11.2 incl. `database_url` default `sqlite+aiosqlite:///./db_sentinel.db`, `jwt_secret`, `encryption_key`, `seed_admin_email="admin@db-sentinel.local"`, `seed_admin_password`, `cors_origins=["http://localhost:3000","http://localhost:5173"]`.

- [ ] **Step 1: `git init` in `C:\DB sentinel`** (repo root holds docs + code); write `.gitignore` (Python venv/cache, node_modules, dist, .env, db_sentinel.db, __pycache__).
- [ ] **Step 2: Write failing test** `tests/test_health.py`: `create_app()` + httpx ASGI client → `GET /api/v1/health` == 200 `{"status": "ok"}`; `GET /api/v1/health/ready` == 200 with keys `{"status", "checks"}`.
- [ ] **Step 3: Run** `python -m pytest tests/test_health.py -v` in venv → FAIL (module not found).
- [ ] **Step 4: Implement** pyproject (deps: fastapi, uvicorn, pydantic, pydantic-settings, sqlalchemy, aiosqlite, asyncpg, httpx, pyjwt, bcrypt, cryptography, sqlglot, pytest, pytest-asyncio, ruff), `config.py` (pydantic-settings, env prefix none, `.env` file support), `main.py` (app factory, lifespan stub, CORS, exception handler emitting APP_FLOW §4.1 error format), `health.py` routes.
- [ ] **Step 5: Run tests** → PASS. `ruff check .` clean.
- [ ] **Step 6: Commit** `chore: backend skeleton, config, health endpoints`.

### Task 2: DB models + engine + init/seed

**Files:**
- Create: `app/db/base.py`, `app/db/session.py`, `app/db/init_db.py`, `app/models/__init__.py`, `app/models/user.py`, `app/models/database.py`, `app/models/task.py`, `app/models/agent.py`
- Test: `tests/test_db.py`

**Interfaces:**
- Consumes: `get_settings()` (database_url).
- Produces: `Base`, `UUIDMixin`, `TimestampMixin`; `User`, `Role`, `Permission` (+ assoc tables `user_roles`, `role_permissions`); `DatabaseRecord` (table `databases`: name, type, host, port, database_name, schema_name, username, password_encrypted LargeBinary, password_salt LargeBinary, connection_config JSON, pool_config JSON, tags JSON, description, is_active, last_tested_at, last_test_status, last_test_error, version, created_by FK users); `TaskRecord` (table `tasks`, fields per TRD Task incl. agent_type, database_id, status, priority, parameters, result, error, progress, current_step, steps_completed, total_steps, parent_task_id, worker_id, retries, max_retries=3, tags, queued_at, started_at, completed_at, created_by); `TaskLog`; `AgentRecord` (PK `agent_type` string, name, description, version, capabilities JSON, required_params JSON, optional_params JSON, is_enabled); `async_engine()`/`get_session_factory()`; `async init_db(session)` → create_all + seed.

- [ ] **Step 1: Failing test** `tests/test_db.py`: fresh SQLite → `init_db` → assert 4 roles (Admin, DBA, Developer, Viewer), permission rows exist, admin user with Developer+Admin role? (Admin role), agent rows `sql_generator` + `query_optimizer` exist with required_params from BACKEND_SCHEMA §3.3.1.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** models (enums as Python `str, enum.Enum` stored via `sa.Enum(native_enum=False)`), session module (async engine from settings, `async_sessionmaker`), seed function idempotent (SELECT before INSERT).
- [ ] **Step 4: Run** → PASS. Ruff clean.
- [ ] **Step 5: Commit** `feat: metadata models, engine, idempotent seed`.

### Task 3: Security core — bcrypt, JWT, AES-256-GCM encryption

**Files:**
- Create: `app/core/__init__.py`, `app/core/security.py`, `app/core/encryption.py`
- Test: `tests/test_security.py`, `tests/test_encryption.py`

**Interfaces:**
- Produces: `hash_password(str) -> str`, `verify_password(plain, hashed) -> bool`; `create_access_token(user: UserRecord) -> str`, `create_refresh_token(user) -> str`, `decode_token(token) -> dict` (raises `InvalidTokenError`); `CredentialEncryption(app_key: str)` with `encrypt_password(plaintext) -> tuple[bytes, bytes]` (ciphertext, salt) and `decrypt_password(ciphertext, salt) -> str`.

- [ ] **Step 1: Failing tests**: hash/verify roundtrip + wrong password False; access token decodes with `type="access"`, wrong type rejected; encryption roundtrip unique salts (two encrypts differ), tampered ciphertext raises.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (bcrypt lib; PyJWT; `cryptography` AESGCM + PBKDF2HMAC 100k).
- [ ] **Step 4: Run** → PASS. Commit `feat: security core (bcrypt, JWT, AES-GCM credential encryption)`.

### Task 4: Auth + RBAC API

**Files:**
- Create: `app/schemas/__init__.py`, `app/schemas/auth.py`, `app/api/deps.py`, `app/api/routes/auth.py`
- Modify: `app/main.py` (include router, init_db on lifespan), `tests/conftest.py` (app fixture with temp DB + seeded admin)
- Test: `tests/test_auth.py`

**Interfaces:**
- Produces: `POST /api/v1/auth/login` → `TokenPair {access_token, refresh_token, token_type="bearer", expires_in}`; `POST /api/v1/auth/refresh` (body refresh_token) → new pair; `GET /api/v1/auth/me` → `UserResponse {id, email, full_name, roles, is_active}`; `POST /api/v1/auth/register` (email, password, full_name; creates Developer) — allowed while `settings.allow_registration` true. Deps: `get_session`, `get_current_user`, `require_permission("resource:action")`.

- [ ] **Step 1: Failing tests**: login ok / wrong password 401 `UNAUTHENTICATED`; refresh returns new working access token; `/auth/me` with Bearer returns admin email; without token 401; `require_permission` lets Admin pass, blocks Developer from `users:read`? (per TRD §4.3 Developer has no Users access) → 403 `FORBIDDEN`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** deps + routes + conftest. **Step 4: Run** → PASS. Ruff clean.
- [ ] **Step 5: Commit** `feat: JWT auth API with RBAC dependencies`.

### Task 5: Database connection CRUD API + test endpoint

**Files:**
- Create: `app/schemas/database.py`, `app/api/routes/databases.py`, `app/models/database.py` (no change; already built)
- Test: `tests/test_databases_api.py`

**Interfaces:**
- Consumes: `CredentialEncryption` (Task 3), `get_current_user`/`require_permission` (Task 4), adapter registry (Task 6 — for `/test`); to avoid forward dependency, `/test` uses `get_adapter` and this task lands after Task 6.
- Produces: `POST /databases` (DatabaseCreate: name, type, host default "", port nullable, database, schema_, username, password, connection_options, tags, description, pool_config) → 201 `DatabaseOut` (no password fields); `GET /databases` (filter `active_only`); `GET /databases/{id}`; `PUT /databases/{id}` (password optional; omitted = unchanged); `DELETE /databases/{id}`; `POST /databases/{id}/test` → `TestResult {success, latency_ms, version?, error?}` — updates `last_tested_at/status/error` on record; port validation `gt=0, le=65535`; duplicate name → 409 `CONFLICT`.

- [ ] **Step 1: Failing tests**: create→stored encrypted (raw password absent from row, decrypt matches), list excludes password, update without password keeps original, delete works, duplicate name 409, port 70000 → 400, `/test` on a sqlite-type connection (file created on the fly) → success + latency, `/test` on bad postgres host → success=False with error.
- [ ] **Step 2-4:** run-fail → implement → pass.
- [ ] **Step 5: Commit** `feat: database connection CRUD + connectivity test API`.

### Task 6: Adapter framework + registry + SQLite adapter

**Files:**
- Create: `app/adapters/__init__.py`, `app/adapters/base.py`, `app/adapters/registry.py`, `app/adapters/sqlite.py`
- Test: `tests/test_adapters.py`

**Interfaces:**
- Produces: dataclasses `ColumnInfo(name, type, nullable, default, is_primary_key, is_foreign_key, references)`, `TableInfo(name, columns, indexes, row_count_estimate, schema_name)`, `QueryResult(columns, rows, row_count, execution_time_ms, truncated)`, `QueryPlan(raw, estimated_cost, estimated_rows, operations)`; `DatabaseAdapter` ABC per TRD §2.1.5 (class attrs `dialect_name`, `driver_name`, `default_port`); registry: `register_adapter(cls)`, `get_adapter(type)`, `list_adapters()`; `SQLiteAdapter(dialect_name="sqlite")` — connects via aiosqlite, `test_connection`, `get_tables`, `get_table_info`, `execute_query` (params `?`), `execute_command`, `explain_query` (`EXPLAIN QUERY PLAN`), `get_indexes`, `get_table_stats`, `build_connection_string` (file path), `get_type_mapping`.

- [ ] **Step 1: Failing tests**: registry register/get/unknown-raises; sqlite adapter against temp file DB with seeded table (id PK, name NOT NULL, created_at) → get_tables returns TableInfo with correct ColumnInfo flags; execute_query returns QueryResult rows; explain returns QueryPlan with operations.
- [ ] **Step 2-4:** run-fail → implement → pass. **Step 5: Commit** `feat: adapter framework, registry, SQLite adapter`.

### Task 7: PostgreSQL adapter (EXPLAIN parsing as pure functions)

**Files:**
- Create: `app/adapters/postgresql.py`
- Test: `tests/test_pg_adapter.py`

**Interfaces:**
- Consumes: adapter base (Task 6).
- Produces: `PostgreSQLAdapter(dialect_name="postgresql", driver_name="asyncpg", default_port=5432)` — introspection via `information_schema`/`pg_catalog`, `execute_query` with `$n` params, `explain_query` via `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`; pure helper `parse_pg_explain_json(json_list) -> QueryPlan` and `iter_plan_nodes(plan_dict)` (yields node dicts incl. `Node Type`, `Relation Name`, `Total Cost`, `Actual Rows`, `Filter`, `Index Cond`).
- [ ] **Step 1: Failing tests** (no live PG needed): `parse_pg_explain_json` on fixture (Hash Join over two Seq Scans) → estimated_cost/rows from root, operations include node types; connection string build; live tests marked `skipif` no `TEST_PG_DSN` env.
- [ ] **Step 2-4:** run-fail → implement → pass. **Step 5: Commit** `feat: PostgreSQL adapter with EXPLAIN JSON parsing`.

### Task 8: Agent base + state machine + event bus

**Files:**
- Create: `app/core/agent_base.py`, `app/core/events.py`
- Test: `tests/test_agent_base.py`, `tests/test_events.py`

**Interfaces:**
- Produces: `AgentState` enum, `AgentContext` dataclass, `BaseAgent` per ARCHITECTURE §7.1 — `run(context) -> dict`, abstract `_execute(context)`, `_transition(state)`, `on_event/emit`, plus `report_progress(progress: int, step: str, message: str)` that publishes `task_progress` on event bus and updates TaskRecord via injected `progress_cb`. Transitions per TRD §2.1.4 table; illegal transition raises. `EventBus`: `async publish(channel: str, payload: dict)`, `subscribe(callback)`, `unsubscribe(callback)`; channel pattern `tasks:{id}`, `global`; module singleton `event_bus`.

- [ ] **Step 1: Failing tests**: happy-path run transitions IDLE→INITIALIZING→RUNNING→COMPLETED and returns result; `_execute` raising → state FAILED; illegal transition raises `InvalidTransition`; event bus: publish on channel A not seen by subscriber filtered to channel B.
- [ ] **Step 2-4:** run-fail → implement → pass. **Step 5: Commit** `feat: agent state machine and event bus`.

### Task 9: Task runner (in-process queue, lifecycle, retries, cancel)

**Files:**
- Create: `app/core/task_queue.py`
- Test: `tests/test_task_runner.py`

**Interfaces:**
- Consumes: TaskRecord (Task 2), BaseAgent (Task 8), event_bus (Task 8), agent registry (Task 13 — injected as callable `agent_factory(agent_type) -> BaseAgent` to break the cycle).
- Produces: `TaskRunner(session_factory, agent_factory)` with `async start(workers=settings.worker_concurrency)`, `async stop()`, `async submit(task_id)`, `async cancel(task_id)`; on pickup: status queued→running (worker_id, started_at), progress writes (progress, current_step, steps_completed), success → completed + result + completed_at, exception → retries+1 with exponential backoff requeue while `retries < max_retries` else failed + error; cancel of queued/running → cancelled.

- [ ] **Step 1: Failing tests**: submit with fake agent → completed, result stored, `task_started`/`task_completed` events seen; failing agent (max_retries=1) → failed with error; cancel queued task → cancelled; crash marks failed (simulate agent raising).
- [ ] **Step 2-4:** run-fail → implement → pass. **Step 5: Commit** `feat: in-process async task runner with retries and cancellation`.

### Task 10: WebSocket endpoint + connection manager

**Files:**
- Create: `app/api/routes/websocket.py`, `app/schemas/websocket.py`
- Test: `tests/test_websocket.py`

**Interfaces:**
- Consumes: `decode_token` (Task 3), `event_bus` (Task 8).
- Produces: `WS /api/v1/ws?token={jwt}` — on connect validate token else close(code=4401); send `{type: "connected", connectionId}`; client messages `subscribe/unsubscribe/ping` per TRD §2.3.2 (channels list); server relays event_bus payloads matching subscribed channels; `pong`; ConnectionManager: `connect`, `disconnect`, `broadcast(channel, payload)`; wiring: event_bus subscriber → manager.broadcast.

- [ ] **Step 1: Failing tests** (fastapi TestClient websocket): valid token → `connected`; invalid token → connection closed; subscribe `tasks:abc` then `event_bus.publish("tasks:abc", ...)` → message received; publish on unsubscribed channel → not received; ping→pong.
- [ ] **Step 2-4:** run-fail → implement → pass. **Step 5: Commit** `feat: WebSocket live updates endpoint`.

### Task 11: AI providers + smart router

**Files:**
- Create: `app/ai/__init__.py`, `app/ai/provider.py`, `app/ai/ollama.py`, `app/ai/openai.py`, `app/ai/router.py`
- Test: `tests/test_ai.py`

**Interfaces:**
- Produces: `ModelCapability`, `ModelInfo`, `ChatMessage`, `CompletionResponse`, `AIProvider` ABC per TRD §2.1.6; `OllamaProvider(base_url, default_model)` — `list_models` via `GET /api/tags`, `chat_completion` via `POST /api/chat`, `health_check`; `OpenAIProvider(api_key, default_model)` — `GET /v1/models`, `POST /v1/chat/completions`; both via httpx with 30s timeout. `AIRouter(providers: dict[str, AIProvider])` per ARCHITECTURE §6.2: `get_best_model(capability, prefer_local, max_cost_per_1k, min_context_window) -> (provider, model_name)` sorted by `(not is_local, cost, -context_window)`; `chat_completion(messages, **kw)` convenience; empty provider dict → `AIProviderError` on use, never on construction; app boots building providers only when configured (ollama if base_url set, openai if api key set).

- [ ] **Step 1: Failing tests** using `httpx.MockTransport`: ollama list_models parses `/api/tags` fixture; chat_completion returns content; openai chat completion parses usage; router prefers local, falls back to cloud when `prefer_local` and no local healthy, filters by cost/context; zero providers → `AIProviderError`.
- [ ] **Step 2-4:** run-fail → implement → pass. **Step 5: Commit** `feat: AI providers (Ollama, OpenAI) and smart router`.

### Task 12: Schema introspection service + schema endpoint

**Files:**
- Create: `app/services/__init__.py`, `app/services/schema_introspect.py`, `app/models/schema_snapshot.py` (DatabaseSchemaRecord per BACKEND_SCHEMA §3.2.2)
- Modify: `app/api/routes/databases.py` (add `GET /databases/{id}/schema?refresh=bool`)
- Test: `tests/test_schema_service.py`

**Interfaces:**
- Produces: `async get_connection(db_record) -> (adapter, connection)` (decrypts password; per-call connect, close in finally); `async introspect(session, db_record, refresh=False) -> dict` `{database_id, schema: [...TableInfo as dicts...], snapshot_at}` — cached on DatabaseSchemaRecord (checksum = sha256 of JSON, skip re-store when unchanged); `build_schema_context_text(schema_dict) -> str` (compact prompt text: per table `table (col type [PK] [FK→ref], ...)` — format from APP_FLOW §2.3.3).

- [ ] **Step 1: Failing tests**: sqlite temp DB with 2 tables + FK → introspect returns both with columns; second call without refresh reuses snapshot (no new row); refresh with no changes does not duplicate snapshot; `build_schema_context_text` contains table, column, PK/FK markers.
- [ ] **Step 2-4:** run-fail → implement → pass. **Step 5: Commit** `feat: schema introspection service with snapshot cache`.

### Task 13: SQL Generator + Query Optimizer agents

**Files:**
- Create: `app/agents/__init__.py` (AGENTS registry dict), `app/agents/sql_generator.py`, `app/agents/query_optimizer.py`
- Test: `tests/test_agents.py`

**Interfaces:**
- Consumes: BaseAgent (8), introspection (12), AIRouter (11), adapter registry (6/7).
- Produces: `SQLGeneratorAgent` (agent_type `sql_generator`, required_params `["natural_language_query", "database_id"]`) — `_execute`: introspect → `build_schema_context_text` → system prompt per APP_FLOW §2.3.3 → router.chat_completion → `_extract_sql` (handles ```sql fenced / bare / prose) → `_validate_sql` via sqlglot parse + referenced tables exist in schema → result `{sql, explanation, confidence}`; `QueryOptimizerAgent` (agent_type `query_optimizer`, required `["query", "database_id"]`) — `_execute`: adapter.explain_query → walk `iter_plan_nodes` → issues: Seq Scan with row_count_estimate > 10_000, node cost > 1000, explicit sort on large rows → `index_recommendations` `["CREATE INDEX ..."]` built from Filter/Index Cond relation+columns; result `{original_plan, issues, index_recommendations, rewritten_queries: [], estimated_improvement}`. Agent classes registered in `app/agents/__init__.py::AGENTS` dict + agent API factory `build_agent(agent_type, router)`.

- [ ] **Step 1: Failing tests**: `_extract_sql` — fenced / bare-with-prose / plain → returns SQL only; `_validate_sql` — unknown table → `SQLValidationError`; valid query passes; optimizer on PG EXPLAIN fixture (seq scan 50k rows) → issue flagged + `CREATE INDEX` recommendation mentions the table; both agents run end-to-end against sqlite DB with stub AI provider returning fixed SQL (fake router object).
- [ ] **Step 2-4:** run-fail → implement → pass. **Step 5: Commit** `feat: SQL Generator and Query Optimizer agents`.

### Task 14: Agent/task/query APIs — full vertical slice

**Files:**
- Create: `app/schemas/task.py`, `app/schemas/agent.py`, `app/api/routes/agents.py`, `app/api/routes/tasks.py`, `app/api/routes/ai.py`, `app/services/query_executor.py`
- Modify: `app/main.py` (routers, TaskRunner startup with agent factory from Task 13, seed agents on startup)
- Test: `tests/test_tasks_api.py`, `tests/test_query_executor.py`

**Interfaces:**
- Produces: `GET /agents` (from AGENTS registry definitions), `GET /agents/{type}`, `POST /agents/{type}/tasks` (validate required params present → create TaskRecord queued → runner.submit → 202 `{task_id, status}`); `GET /tasks?status=&agent_type=&database_id=&limit=&offset=`, `GET /tasks/{id}` (full incl. result), `DELETE /tasks/{id}` (cancel), `GET /tasks/{id}/logs`; `POST /databases/{id}/query` `{query}` → read-only guarded `QueryResult` (Task 14 uses `query_executor.is_read_only`; only SELECT/WITH/EXPLAIN/SHOW; 400 `VALIDATION_ERROR` otherwise); `POST /databases/{id}/explain`; `GET /ai/models`, `POST /ai/complete` (router passthrough, `AI_PROVIDER_ERROR` 502 when no providers).
- [ ] **Step 1: Failing tests**: submit `sql_generator` task (sqlite db registered; fake AI provider injected into app state) → poll `GET /tasks/{id}` → completed, result has non-empty `sql`; progress events observed; missing param → 400; unknown agent type → 404; cancel → cancelled; execute endpoint: `SELECT 1` ok, `DROP TABLE x` → 400; `GET /ai/models` with no providers → 200 empty list; `POST /ai/complete` no providers → 502 structured error.
- [ ] **Step 2-4:** run-fail → implement → pass. **Step 5: Commit** `feat: agent, task, AI, and query execution APIs (vertical slice)`.

### Task 15: Frontend scaffold — Vite/React/TS, auth, layout, API client

**Files:**
- Create: `web-dashboard/package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css` (tokens per UI_UX §1.2), `src/api/client.ts`, `src/api/endpoints.ts`, `src/api/websocket.ts`, `src/stores/authStore.ts`, `src/types/api.ts` (hand-written), `src/components/ui/{button,input,label,card,badge}.tsx`, `src/components/layout/{Sidebar,Header}.tsx`, `src/pages/Login.tsx`, `src/pages/Dashboard.tsx` (stub), `.env.example`

**Interfaces:**
- Produces: `apiFetch` wrapper with Bearer injection + 401→refresh→retry→logout flow (tokens in localStorage per docs' "Memory/Cookies" — localStorage chosen, noted); `WebSocketManager` class (connect(token), subscribe(channels, cb), auto-reconnect); `authStore` (Zustand: user, tokens, login(), logout(), hydrate()); routes: `/login`, protected shell `/`, `/databases`, `/query-lab`, `/agents`, `/tasks`, `/settings`.

- [ ] **Step 1: Scaffold** via npm (vite react-ts template), add deps (react-router-dom, zustand, @tanstack/react-query, tailwindcss@3.4, postcss, autoprefixer, lucide-react, clsx, tailwind-merge, class-variance-authority, @monaco-editor/react, recharts, sonner).
- [ ] **Step 2: Implement** files above; `npm run build` must pass (tsc + vite).
- [ ] **Step 3: Smoke test:** with backend running, load `/login`, login as seeded admin, land on Dashboard stub. Fix until true.
- [ ] **Step 4: Commit** `feat: frontend scaffold with auth flow and app shell`.

### Task 16: Frontend feature pages

**Files:**
- Create: `src/pages/Databases.tsx`, `src/pages/QueryLab.tsx`, `src/pages/Agents.tsx`, `src/pages/Tasks.tsx`, `src/pages/Settings.tsx` (stub), `src/components/databases/DatabaseForm.tsx`, `src/components/databases/DatabaseCard.tsx`, `src/components/queries/{SQLEditor,ResultsTable,AiAssistantPanel}.tsx`, `src/components/tasks/TaskProgress.tsx`, `src/hooks/useWebSocket.ts`

**Interfaces:**
- Consumes: backend APIs from Tasks 5/12/14; WS protocol from Task 10.
- Produces: Databases page (list cards with status + Test/Add via dialog form per UI_UX §3.2); Query Lab (database selector, Monaco SQL editor with Ctrl+Enter execute, results table, AI assistant panel: NL input → task submit → WS progress → result SQL inserted into editor; Execute/Explain buttons); Agents page (cards from `GET /agents` with required params); Tasks page (filterable list, live progress bars via `useWebSocket` on `tasks:*` + `global`); Dashboard (metric cards: databases count, active tasks, recent tasks list).

- [ ] **Step 1: Implement** pages/components with TanStack Query + WS hook.
- [ ] **Step 2: Verify** `npm run build` passes.
- [ ] **Step 3: Smoke:** run backend (with sqlite demo DB seeded via script + a stub AI provider env) + frontend; login → add sqlite connection → Query Lab: type `SELECT` → results render; AI panel submits task (fails gracefully w/o AI but shows error state per Review Focus 5). Fix until true.
- [ ] **Step 4: Commit** `feat: dashboard feature pages (databases, query lab, agents, tasks)`.

### Task 17: Docker Compose, env templates, README, final E2E verification

**Files:**
- Create: `docker-compose.yml`, `agent-engine/Dockerfile`, `web-dashboard/Dockerfile`, `agent-engine/.env.example`, `web-dashboard/.env.example`, `scripts/seed_demo.py` (sqlite demo DB with users/orders tables), full `README.md`
- Modify: `README.md` (setup, run, test, architecture summary, deviations: Alembic deferred, in-process queue fallback, localStorage tokens)

**Interfaces:**
- docker-compose per ARCHITECTURE §10.1 (postgres, redis, ollama optional-gpu, agent-engine, web-dashboard) — used only when Docker is present; local dev needs nothing.
- [ ] **Step 1: Write** compose + Dockerfiles + env examples + seed script + README.
- [ ] **Step 2: Full backend suite** `python -m pytest -v` → all PASS; `ruff check .` clean; frontend `npm run build` clean.
- [ ] **Step 3: E2E:** start backend + frontend, run `seed_demo.py`, browser-automation check: login → databases → query lab execute → results visible. 
- [ ] **Step 4: Commit** `chore: docker compose, env templates, README, demo seed`.

---

## Self-Review Notes

- Spec coverage: PRD MVP scope (PG adapter ✓ sqlite bonus, Ollama+OpenAI ✓, NL→SQL ✓, EXPLAIN+index suggestions ✓, connection mgmt ✓, dashboard+Query Lab ✓, JWT+RBAC ✓, compose ✓). MySQL/SQLServer/Anthropic/monitoring/schema-drift/DQ = Phase 3+, intentionally out.
- Type consistency: `DatabaseRecord` vs pydantic `DatabaseCreate/Out`; runner `agent_factory` matches `build_agent(agent_type, router)`; WS payload keys match TRD §2.3.2 (`taskId` camelCase in WS only, REST snake_case).
- Proportion: plan states signatures/decisions; bodies left to implementers per TDD steps.
