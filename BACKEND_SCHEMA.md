# DB Sentinel - Backend Schema Document

## 1. Overview

This document describes the database schema for the DB Sentinel metadata database (PostgreSQL). This database stores:
- Database connection configurations
- Task/job definitions and results
- Agent definitions and state
- User accounts and RBAC
- Audit logs
- Schema snapshots and drift records
- Monitoring metrics
- Data quality rules and results

**Database**: PostgreSQL 16+
**ORM**: SQLAlchemy 2.0+ (Async)
**Migration Tool**: Alembic

---

## 2. Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    users    │       │    roles    │       │ permissions │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)     │       │ id (PK)     │
│ email       │       │ name        │       │ name        │
│ password_hash│      │ description │       │ resource    │
│ full_name   │       │ is_system   │       │ action      │
│ is_active   │       │ created_at  │       │ created_at  │
│ is_superuser│       └──────┬──────┘       └─────────────┘
│ created_at  │              │
│ updated_at  │              │
└──────┬──────┘              │
       │                     │
       │              ┌──────┴──────┐
       │              │ user_roles  │
       │              ├─────────────┤
       │              │ user_id (FK)│
       │              │ role_id (FK)│
       │              └─────────────┘
       │
       │              ┌─────────────┐       ┌─────────────┐
       │              │  databases  │       │  tasks      │
       │              ├─────────────┤       ├─────────────┤
       └─────────────►│ id (PK)     │       │ id (PK)     │
                      │ name        │       │ agent_type  │
                      │ type        │       │ database_id │
                      │ host        │◄──────│ status      │
                      │ port        │       │ priority    │
                      │ database    │       │ parameters  │
                      │ username    │       │ result      │
                      │ password_enc│       │ error       │
                      │ schema_name │       │ progress    │
                      │ config_json │       │ created_at  │
                      │ pool_config │       │ started_at  │
                      │ is_active   │       │ completed_at│
                      │ created_by  │       │ retries     │
                      │ created_at  │       └──────┬──────┘
                      │ updated_at  │              │
                      └─────────────┘              │
                                                   │
                              ┌───────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
            ┌───────┴───────┐   ┌───────┴───────┐
            │ task_logs     │   │task_artifacts │
            ├───────────────┤   ├───────────────┤
            │ id (PK)       │   │ id (PK)       │
            │ task_id (FK)  │   │ task_id (FK)  │
            │ level         │   │ key           │
            │ message       │   │ value_json    │
            │ timestamp     │   │ created_at    │
            └───────────────┘   └───────────────┘
```

---

## 3. Table Definitions

### 3.1 Core Tables

#### 3.1.1 users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_superuser BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
```

#### 3.1.2 roles
```sql
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default roles
INSERT INTO roles (name, description, is_system) VALUES
('Admin', 'Full system access', true),
('DBA', 'Database administrator access', true),
('Developer', 'Developer access', true),
('Viewer', 'Read-only access', true);
```

#### 3.1.3 permissions
```sql
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,  -- e.g., "databases:create"
    resource VARCHAR(50) NOT NULL,       -- e.g., "databases"
    action VARCHAR(50) NOT NULL,         -- e.g., "create"
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Format: resource:action
-- Resources: databases, agents, tasks, ai_providers, users, settings, audit_logs
-- Actions: create, read, update, delete, execute, connect
```

#### 3.1.4 role_permissions
```sql
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);
```

#### 3.1.5 user_roles
```sql
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);
```

---

### 3.2 Database Management Tables

#### 3.2.1 databases
```sql
CREATE TABLE databases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,  -- postgresql, mysql, mariadb, sqlserver, oracle, sqlite
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL CHECK (port > 0 AND port <= 65535),
    database_name VARCHAR(255) NOT NULL,
    schema_name VARCHAR(255),
    username VARCHAR(255) NOT NULL,
    password_encrypted BYTEA NOT NULL,  -- AES-256-GCM encrypted
    password_salt BYTEA NOT NULL,       -- Salt for encryption
    connection_config JSONB NOT NULL DEFAULT '{}',  -- SSL, options, etc.
    pool_config JSONB NOT NULL DEFAULT '{"pool_size": 5, "max_overflow": 10, "pool_timeout": 30, "pool_recycle": 3600}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_tested_at TIMESTAMPTZ,
    last_test_status VARCHAR(20),  -- success, failed, timeout
    last_test_error TEXT,
    version VARCHAR(100),  -- Database server version
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_databases_type ON databases(type);
CREATE INDEX idx_databases_is_active ON databases(is_active);
CREATE INDEX idx_databases_created_by ON databases(created_by);
CREATE INDEX idx_databases_tags ON databases USING GIN(tags);
```

#### 3.2.2 database_schemas (Schema Snapshots)
```sql
CREATE TABLE database_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    schema_json JSONB NOT NULL,  -- Full schema representation
    tables_json JSONB NOT NULL,  -- Array of table definitions
    checksum VARCHAR(64) NOT NULL,  -- SHA256 of schema_json
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_database_schemas_database_id ON database_schemas(database_id);
CREATE INDEX idx_database_schemas_snapshot_at ON database_schemas(snapshot_at DESC);
CREATE UNIQUE INDEX idx_database_schemas_checksum ON database_schemas(database_id, checksum);
```

#### 3.2.3 schema_drift
```sql
CREATE TABLE schema_drift (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    baseline_schema_id UUID NOT NULL REFERENCES database_schemas(id),
    current_schema_id UUID NOT NULL REFERENCES database_schemas(id),
    drift_type VARCHAR(50) NOT NULL,  -- table_added, table_dropped, column_added, column_dropped, column_type_changed, index_added, index_dropped, constraint_added, constraint_dropped
    object_type VARCHAR(50) NOT NULL,  -- table, column, index, constraint
    object_name VARCHAR(255) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',  -- Specific change details
    severity VARCHAR(20) NOT NULL DEFAULT 'info',  -- info, warning, critical
    status VARCHAR(20) NOT NULL DEFAULT 'open',  -- open, acknowledged, resolved, ignored
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id)
);

CREATE INDEX idx_schema_drift_database_id ON schema_drift(database_id);
CREATE INDEX idx_schema_drift_status ON schema_drift(status);
CREATE INDEX idx_schema_drift_detected_at ON schema_drift(detected_at DESC);
```

#### 3.2.4 migrations
```sql
CREATE TABLE migrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    up_sql TEXT NOT NULL,
    down_sql TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, rolled_back
    execution_order INTEGER NOT NULL,
    executed_at TIMESTAMPTZ,
    executed_by UUID REFERENCES users(id),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_migrations_database_id ON migrations(database_id);
CREATE INDEX idx_migrations_status ON migrations(status);
```

---

### 3.3 Task & Agent Tables

#### 3.3.1 agents
```sql
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type VARCHAR(100) NOT NULL UNIQUE,  -- sql_generator, query_optimizer, schema_manager, monitor, data_quality
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    required_params JSONB NOT NULL DEFAULT '[]',
    optional_params JSONB NOT NULL DEFAULT '[]',
    config_schema JSONB NOT NULL DEFAULT '{}',  -- JSON Schema for agent config
    default_config JSONB NOT NULL DEFAULT '{}',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default agents
INSERT INTO agents (agent_type, name, description, capabilities, required_params, optional_params) VALUES
('sql_generator', 'SQL Generator', 'Convert natural language to SQL queries',
 ARRAY['nl_to_sql', 'sql_explanation', 'query_refinement'],
 '["natural_language_query", "database_id"]',
 '["schema_context", "dialect", "examples", "model"]'),
('query_optimizer', 'Query Optimizer', 'Analyze execution plans and suggest optimizations',
 ARRAY['explain_analysis', 'index_suggestions', 'query_rewrite'],
 '["query", "database_id"]',
 '["include_explain", "model"]'),
('schema_manager', 'Schema Manager', 'Schema introspection, drift detection, migrations',
 ARRAY['introspection', 'drift_detection', 'migration_generation', 'erd_generation'],
 '["database_id"]',
 '["baseline_schema_id", "include_views", "include_functions"]'),
('monitor', 'Monitor', 'Real-time metrics collection and anomaly detection',
 ARRAY['metrics_collection', 'anomaly_detection', 'slow_query_tracking'],
 '["database_id"]',
 '["interval_seconds", "metrics_config"]'),
('data_quality', 'Data Quality', 'Data profiling, validation, anomaly detection',
 ARRAY['profiling', 'validation', 'anomaly_detection', 'rule_suggestion'],
 '["database_id", "table_name"]',
 '["columns", "sample_size", "rules_config"]');
```

#### 3.3.2 tasks
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type VARCHAR(100) NOT NULL REFERENCES agents(agent_type),
    database_id UUID REFERENCES databases(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, queued, running, waiting_input, completed, failed, cancelled
    priority VARCHAR(10) NOT NULL DEFAULT 'normal',  -- low, normal, high, critical
    parameters JSONB NOT NULL DEFAULT '{}',
    result JSONB,
    error TEXT,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    current_step VARCHAR(255),
    steps_completed TEXT[] NOT NULL DEFAULT '{}',
    total_steps INTEGER,
    parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    worker_id VARCHAR(255),
    retries INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    tags TEXT[] NOT NULL DEFAULT '{}',
    queued_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_agent_type ON tasks(agent_type);
CREATE INDEX idx_tasks_database_id ON tasks(database_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_worker_id ON tasks(worker_id);

-- Composite indexes for common queries
CREATE INDEX idx_tasks_status_priority_created ON tasks(status, priority DESC, created_at);
CREATE INDEX idx_tasks_database_status ON tasks(database_id, status);
```

#### 3.3.3 task_logs
```sql
CREATE TABLE task_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    level VARCHAR(10) NOT NULL,  -- debug, info, warning, error, critical
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX idx_task_logs_timestamp ON task_logs(timestamp DESC);
```

#### 3.3.4 task_artifacts
```sql
CREATE TABLE task_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,  -- e.g., "generated_sql", "explain_plan", "drift_report"
    value_json JSONB NOT NULL,
    mime_type VARCHAR(100),  -- application/json, text/sql, text/plain
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_artifacts_task_id ON task_artifacts(task_id);
CREATE UNIQUE INDEX idx_task_artifacts_task_key ON task_artifacts(task_id, key);
```

---

### 3.4 Monitoring Tables

#### 3.4.1 metrics_snapshots
```sql
CREATE TABLE metrics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    metrics JSONB NOT NULL,  -- Structured metrics
    collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Metrics JSON structure:
-- {
--   "connections": {"active": 45, "idle": 10, "max": 100, "waiting": 0},
--   "latency": {"p50": 2.3, "p95": 45.2, "p99": 120.5},
--   "throughput": {"tps": 1245, "qps": 3421},
--   "cache": {"hit_ratio": 0.982, "buffers": {"shared_hit": 123456, "shared_read": 1234}},
--   "storage": {"database_size_bytes": 1234567890, "table_sizes": {...}},
--   "locks": {"deadlocks": 0, "lock_waits": 5, "longest_lock_ms": 150},
--   "replication": {"lag_bytes": 0, "lag_seconds": 0},
--   "custom": {}
-- }

CREATE INDEX idx_metrics_snapshots_database_id ON metrics_snapshots(database_id);
CREATE INDEX idx_metrics_snapshots_collected_at ON metrics_snapshots(collected_at DESC);

-- Partition by time for performance (optional)
-- CREATE TABLE metrics_snapshots_2024_01 PARTITION OF metrics_snapshots
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

#### 3.4.2 alerts
```sql
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id UUID REFERENCES databases(id) ON DELETE SET NULL,
    rule_name VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL,  -- info, warning, critical
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metric_name VARCHAR(100),
    metric_value NUMERIC,
    threshold_value NUMERIC,
    status VARCHAR(20) NOT NULL DEFAULT 'firing',  -- firing, acknowledged, resolved
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    fired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_database_id ON alerts(database_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_fired_at ON alerts(fired_at DESC);
```

#### 3.4.3 alert_rules
```sql
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    database_id UUID REFERENCES databases(id) ON DELETE CASCADE,  -- NULL = global
    metric_name VARCHAR(100) NOT NULL,
    condition VARCHAR(20) NOT NULL,  -- gt, gte, lt, lte, eq, neq, change_pct
    threshold NUMERIC NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    evaluation_interval_seconds INTEGER NOT NULL DEFAULT 60,
    for_duration_seconds INTEGER NOT NULL DEFAULT 0,  -- Must persist for N seconds
    enabled BOOLEAN NOT NULL DEFAULT true,
    notification_channels JSONB DEFAULT '[]',  -- ["slack", "email", "pagerduty"]
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_rules_database_id ON alert_rules(database_id);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
```

---

### 3.5 Data Quality Tables

#### 3.5.1 data_quality_rules
```sql
CREATE TABLE data_quality_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255),
    rule_type VARCHAR(50) NOT NULL,  -- not_null, unique, range, regex, enum, custom_sql, fk_exists
    rule_config JSONB NOT NULL DEFAULT '{}',  -- Rule-specific config
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',  -- info, warning, critical
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rule config examples:
-- not_null: {}
-- unique: {}
-- range: {"min": 0, "max": 1000000}
-- regex: {"pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"}
-- enum: {"values": ["pending", "completed", "cancelled"]}
-- custom_sql: {"sql": "SELECT COUNT(*) FROM orders WHERE total_cents < 0"}
-- fk_exists: {"referenced_table": "users", "referenced_column": "id"}

CREATE INDEX idx_dq_rules_database_table ON data_quality_rules(database_id, table_name);
CREATE INDEX idx_dq_rules_enabled ON data_quality_rules(enabled);
```

#### 3.5.2 data_quality_runs
```sql
CREATE TABLE data_quality_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    table_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed
    rules_evaluated INTEGER NOT NULL DEFAULT 0,
    rules_passed INTEGER NOT NULL DEFAULT 0,
    rules_failed INTEGER NOT NULL DEFAULT 0,
    rows_sampled BIGINT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dq_runs_database_table ON data_quality_runs(database_id, table_name);
CREATE INDEX idx_dq_runs_status ON data_quality_runs(status);
CREATE INDEX idx_dq_runs_created_at ON data_quality_runs(created_at DESC);
```

#### 3.5.3 data_quality_results
```sql
CREATE TABLE data_quality_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES data_quality_runs(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES data_quality_rules(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,  -- passed, failed, error
    rows_evaluated BIGINT NOT NULL DEFAULT 0,
    rows_failed BIGINT NOT NULL DEFAULT 0,
    failure_rate NUMERIC(5,4),  -- 0.0000 to 1.0000
    sample_values JSONB,  -- Sample of failing values
    details JSONB DEFAULT '{}',
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dq_results_run_id ON data_quality_results(run_id);
CREATE INDEX idx_dq_results_rule_id ON data_quality_results(rule_id);
CREATE INDEX idx_dq_results_status ON data_quality_results(status);
```

#### 3.5.4 table_profiles
```sql
CREATE TABLE table_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    schema_name VARCHAR(255) NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    row_count BIGINT,
    size_bytes BIGINT,
    profile_json JSONB NOT NULL,  -- Full column profiles
    profiled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profile JSON structure per column:
-- {
--   "column_name": "email",
--   "data_type": "varchar",
--   "nullable": true,
--   "null_count": 124500,
--   "null_percentage": 2.3,
--   "distinct_count": 118000,
--   "distinct_percentage": 97.7,
--   "min_value": "a@b.co",
--   "max_value": "zzz@example.org",
--   "avg_length": 24.5,
--   "top_values": [{"value": "gmail.com", "count": 45000}, ...],
--   "format_checks": {"email": 0.99, "url": 0.01},
--   "statistics": {"mean": null, "stddev": null, "percentiles": {}}
-- }

CREATE INDEX idx_table_profiles_database_table ON table_profiles(database_id, schema_name, table_name);
CREATE INDEX idx_table_profiles_profiled_at ON table_profiles(profiled_at DESC);
CREATE UNIQUE INDEX idx_table_profiles_unique ON table_profiles(database_id, schema_name, table_name, profiled_at);
```

---

### 3.6 AI & Cost Tracking Tables

#### 3.6.1 ai_provider_configs
```sql
CREATE TABLE ai_provider_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    provider_type VARCHAR(50) NOT NULL,  -- ollama, openai, anthropic
    config JSONB NOT NULL DEFAULT '{}',  -- base_url, api_key_encrypted, etc.
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    priority INTEGER NOT NULL DEFAULT 100,  -- Lower = higher priority
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Config examples:
-- ollama: {"base_url": "http://ollama:11434", "default_model": "llama3.1:8b"}
-- openai: {"api_key_encrypted": "...", "api_key_salt": "...", "default_model": "gpt-4o", "organization": "org-xxx"}
-- anthropic: {"api_key_encrypted": "...", "api_key_salt": "...", "default_model": "claude-3-5-sonnet"}
```

#### 3.6.2 ai_models
```sql
CREATE TABLE ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_config_id UUID NOT NULL REFERENCES ai_provider_configs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    capabilities TEXT[] NOT NULL DEFAULT '{}',  -- chat, completion, embedding, function_calling, vision
    context_window INTEGER NOT NULL,
    max_output_tokens INTEGER NOT NULL,
    cost_per_1k_input_tokens NUMERIC(10,6) DEFAULT 0,
    cost_per_1k_output_tokens NUMERIC(10,6) DEFAULT 0,
    is_local BOOLEAN NOT NULL DEFAULT false,
    is_available BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ai_models_provider_name ON ai_models(provider_config_id, name);
```

#### 3.6.3 ai_usage
```sql
CREATE TABLE ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_config_id UUID NOT NULL REFERENCES ai_provider_configs(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    operation VARCHAR(50) NOT NULL,  -- chat_completion, embedding
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
    duration_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_provider_model ON ai_usage(provider_config_id, model_id);
CREATE INDEX idx_ai_usage_task_id ON ai_usage(task_id);
CREATE INDEX idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX idx_ai_usage_created_at ON ai_usage(created_at DESC);

-- Daily cost aggregation view
CREATE VIEW daily_ai_costs AS
SELECT 
    DATE(created_at) as date,
    provider_config_id,
    model_id,
    SUM(estimated_cost_usd) as total_cost,
    SUM(total_tokens) as total_tokens,
    COUNT(*) as request_count
FROM ai_usage
WHERE success = true
GROUP BY DATE(created_at), provider_config_id, model_id;
```

---

### 3.7 Audit & Security Tables

#### 3.7.1 audit_logs
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,  -- e.g., "database.create", "task.execute", "credential.rotate"
    resource_type VARCHAR(50) NOT NULL,  -- database, task, agent, user, ai_provider, settings
    resource_id UUID,
    resource_name VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    result VARCHAR(20) NOT NULL,  -- success, failure
    error_message TEXT
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_result ON audit_logs(result);

-- Partition by month for retention
-- CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

#### 3.7.2 api_keys (for programmatic access)
```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,  -- bcrypt hash
    key_prefix VARCHAR(20) NOT NULL,  -- First 8 chars for identification
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permissions JSONB NOT NULL DEFAULT '[]',  -- Scoped permissions
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);
```

---

### 3.8 Configuration Tables

#### 3.8.1 system_settings
```sql
CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_sensitive BOOLEAN NOT NULL DEFAULT false,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Example settings:
-- "general": {"app_name": "DB Sentinel", "maintenance_mode": false}
-- "security": {"session_timeout_minutes": 60, "max_login_attempts": 5, "password_min_length": 12}
-- "ai": {"default_provider": "ollama", "prefer_local": true, "daily_cost_limit_usd": 10.0}
-- "monitoring": {"default_interval_seconds": 30, "retention_days": 30}
-- "queue": {"default_timeout_seconds": 300, "max_retries": 3}
```

---

## 4. SQLAlchemy Models

### 4.1 Model Base
```python
# app/models/base.py
from sqlalchemy.orm import DeclarativeBase, declared_attr
from sqlalchemy import DateTime, func
from uuid import uuid4
import uuid

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class UUIDMixin:
    @declared_attr
    def id(cls):
        return Column(
            UUID(as_uuid=True),
            primary_key=True,
            default=uuid4,
            nullable=False
        )
```

### 4.2 Database Model
```python
# app/models/database.py
from sqlalchemy import Column, String, Integer, Text, Boolean, JSON, ForeignKey, Index, ARRAY
from sqlalchemy.dialects.postgresql import UUID, BYTEA, INET, JSONB, ARRAY as PG_ARRAY, TIMESTAMPTZ
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin, UUIDMixin
import enum

class DatabaseType(str, enum.Enum):
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    MARIADB = "mariadb"
    SQLSERVER = "sqlserver"
    ORACLE = "oracle"
    SQLITE = "sqlite"

class Database(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "databases"
    
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # DatabaseType
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False)
    database_name = Column(String(255), nullable=False)
    schema_name = Column(String(255), nullable=True)
    username = Column(String(255), nullable=False)
    password_encrypted = Column(BYTEA, nullable=False)
    password_salt = Column(BYTEA, nullable=False)
    connection_config = Column(JSONB, nullable=False, default=dict)
    pool_config = Column(JSONB, nullable=False, default=dict)
    tags = Column(PG_ARRAY(Text), nullable=False, default=list)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    last_tested_at = Column(TIMESTAMPTZ, nullable=True)
    last_test_status = Column(String(20), nullable=True)
    last_test_error = Column(Text, nullable=True)
    version = Column(String(100), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Relationships
    creator = relationship("User", back_populates="databases")
    tasks = relationship("Task", back_populates="database")
    schema_snapshots = relationship("DatabaseSchema", back_populates="database", cascade="all, delete-orphan")
    drift_records = relationship("SchemaDrift", back_populates="database", cascade="all, delete-orphan")
    migrations = relationship("Migration", back_populates="database", cascade="all, delete-orphan")
    metrics = relationship("MetricsSnapshot", back_populates="database", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="database")
    alert_rules = relationship("AlertRule", back_populates="database")
    dq_rules = relationship("DataQualityRule", back_populates="database", cascade="all, delete-orphan")
    dq_runs = relationship("DataQualityRun", back_populates="database", cascade="all, delete-orphan")
    table_profiles = relationship("TableProfile", back_populates="database", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_databases_type", "type"),
        Index("idx_databases_is_active", "is_active"),
        Index("idx_databases_created_by", "created_by"),
        Index("idx_databases_tags", "tags", postgresql_using="gin"),
    )
```

### 4.3 Task Model
```python
# app/models/task.py
from sqlalchemy import Column, String, Integer, Text, Boolean, JSON, ForeignKey, Index, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMPTZ, ARRAY as PG_ARRAY, JSONB
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin, UUIDMixin
import enum

class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    WAITING_INPUT = "waiting_input"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class TaskPriority(str, enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"

class Task(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tasks"
    
    agent_type = Column(String(100), ForeignKey("agents.agent_type"), nullable=False)
    database_id = Column(UUID(as_uuid=True), ForeignKey("databases.id", ondelete="SET NULL"), nullable=True)
    status = Column(SQLEnum(TaskStatus), nullable=False, default=TaskStatus.PENDING)
    priority = Column(SQLEnum(TaskPriority), nullable=False, default=TaskPriority.NORMAL)
    parameters = Column(JSONB, nullable=False, default=dict)
    result = Column(JSONB, nullable=True)
    error = Column(Text, nullable=True)
    progress = Column(Integer, nullable=False, default=0)
    current_step = Column(String(255), nullable=True)
    steps_completed = Column(PG_ARRAY(Text), nullable=False, default=list)
    total_steps = Column(Integer, nullable=True)
    parent_task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    worker_id = Column(String(255), nullable=True)
    retries = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=3)
    tags = Column(PG_ARRAY(Text), nullable=False, default=list)
    queued_at = Column(TIMESTAMPTZ, nullable=True)
    started_at = Column(TIMESTAMPTZ, nullable=True)
    completed_at = Column(TIMESTAMPTZ, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    agent = relationship("Agent", back_populates="tasks")
    database = relationship("Database", back_populates="tasks")
    created_by_user = relationship("User", back_populates="tasks")
    parent_task = relationship("Task", remote_side="Task.id", back_populates="subtasks")
    subtasks = relationship("Task", back_populates="parent_task")
    logs = relationship("TaskLog", back_populates="task", cascade="all, delete-orphan", order_by="TaskLog.timestamp")
    artifacts = relationship("TaskArtifact", back_populates="task", cascade="all, delete-orphan")
    ai_usage = relationship("AIUsage", back_populates="task")
    
    __table_args__ = (
        Index("idx_tasks_agent_type", "agent_type"),
        Index("idx_tasks_database_id", "database_id"),
        Index("idx_tasks_status", "status"),
        Index("idx_tasks_priority", "priority"),
        Index("idx_tasks_created_by", "created_by"),
        Index("idx_tasks_parent_task_id", "parent_task_id"),
        Index("idx_tasks_created_at", "created_at"),
        Index("idx_tasks_worker_id", "worker_id"),
        Index("idx_tasks_status_priority_created", "status", "priority", "created_at"),
        Index("idx_tasks_database_status", "database_id", "status"),
    )
```

---

## 5. Migration Strategy

### 5.1 Alembic Configuration
```ini
# alembic.ini
[alembic]
script_location = migrations
prepend_sys_path = .
version_path_separator = os
sqlalchemy.url = postgresql+asyncpg://user:pass@localhost/db_sentinel

[post_write_hooks]
hooks = black, ruff
black.type = console_scripts
black.entrypoint = black
black.options = -q REVISION_SCRIPT_FILENAME
ruff.type = console_scripts
ruff.entrypoint = ruff
ruff.options = check --fix REVISION_SCRIPT_FILENAME
```

### 5.2 Migration Naming Convention
```
migrations/
├── versions/
│   ├── 0001_initial_schema.py
│   ├── 0002_add_database_tables.py
│   ├── 0003_add_task_tables.py
│   ├── 0004_add_monitoring_tables.py
│   ├── 0005_add_data_quality_tables.py
│   ├── 0006_add_ai_tracking_tables.py
│   ├── 0007_add_audit_logs.py
│   └── 0008_add_api_keys.py
```

### 5.3 Migration Template
```python
# migrations/versions/0001_initial_schema.py
"""Initial schema

Revision ID: 0001
Revises: 
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Enable UUID extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    
    # Create enum types
    op.execute("CREATE TYPE databasetype AS ENUM ('postgresql', 'mysql', 'mariadb', 'sqlserver', 'oracle', 'sqlite')")
    op.execute("CREATE TYPE taskstatus AS ENUM ('pending', 'queued', 'running', 'waiting_input', 'completed', 'failed', 'cancelled')")
    op.execute("CREATE TYPE taskpriority AS ENUM ('low', 'normal', 'high', 'critical')")
    op.execute("CREATE TYPE alertseverity AS ENUM ('info', 'warning', 'critical')")
    op.execute("CREATE TYPE alertstatus AS ENUM ('firing', 'acknowledged', 'resolved')")
    op.execute("CREATE TYPE driftstatus AS ENUM ('open', 'acknowledged', 'resolved', 'ignored')")
    
    # Create tables (users, roles, permissions, etc.)
    # ... table creation statements
    
    # Create default roles
    op.execute("""
        INSERT INTO roles (name, description, is_system) VALUES
        ('Admin', 'Full system access', true),
        ('DBA', 'Database administrator access', true),
        ('Developer', 'Developer access', true),
        ('Viewer', 'Read-only access', true)
    """)

def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('audit_logs')
    # ...
    
    # Drop enum types
    op.execute('DROP TYPE IF EXISTS databasetype')
    op.execute('DROP TYPE IF EXISTS taskstatus')
    op.execute('DROP TYPE IF EXISTS taskpriority')
    op.execute('DROP TYPE IF EXISTS alertseverity')
    op.execute('DROP TYPE IF EXISTS alertstatus')
    op.execute('DROP TYPE IF EXISTS driftstatus')
```

---

## 6. Indexing Strategy

### 6.1 Index Categories

| Category | Tables | Purpose |
|----------|--------|---------|
| **Primary Keys** | All | Unique identification |
| **Foreign Keys** | All relationships | Join performance, FK constraint |
| **Status Filters** | tasks, alerts, migrations, dq_runs | Filter by status |
| **Time Series** | metrics_snapshots, audit_logs, task_logs | Time-range queries |
| **Tenant/Resource** | tasks, drift, alerts | Database-scoped queries |
| **Full-text Search** | audit_logs (details), databases (description) | Search |
| **JSONB** | databases (config), tasks (parameters/result) | JSON queries |
| **Array/GIN** | databases (tags), tasks (tags) | Array containment |

### 6.2 Critical Composite Indexes
```sql
-- Task dashboard queries
CREATE INDEX idx_tasks_dashboard ON tasks(status, priority DESC, created_at) 
WHERE status IN ('pending', 'queued', 'running');

-- Task history by user
CREATE INDEX idx_tasks_user_history ON tasks(created_by, created_at DESC) 
WHERE created_by IS NOT NULL;

-- Metrics time-series
CREATE INDEX idx_metrics_ts ON metrics_snapshots(database_id, collected_at DESC);

-- Audit log queries
CREATE INDEX idx_audit_user_action_time ON audit_logs(user_id, action, timestamp DESC);
CREATE INDEX idx_audit_resource_time ON audit_logs(resource_type, resource_id, timestamp DESC);

-- Schema drift tracking
CREATE INDEX idx_drift_db_status_time ON schema_drift(database_id, status, detected_at DESC);
```

---

## 7. Partitioning Strategy

### 7.1 Time-Based Partitioning
```sql
-- Metrics snapshots: Monthly partitions
CREATE TABLE metrics_snapshots (
    id UUID NOT NULL,
    database_id UUID NOT NULL,
    metrics JSONB NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (collected_at);

CREATE TABLE metrics_snapshots_2024_01 PARTITION OF metrics_snapshots
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE metrics_snapshots_2024_02 PARTITION OF metrics_snapshots
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- ... auto-create via pg_partman or cron job

-- Audit logs: Monthly partitions
CREATE TABLE audit_logs (
    id UUID NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- ... other columns
) PARTITION BY RANGE (timestamp);
```

### 7.2 Retention Policy
| Table | Retention | Archive Strategy |
|-------|-----------|------------------|
| metrics_snapshots | 90 days | Drop old partitions |
| audit_logs | 365 days | Drop old partitions, export to S3 |
| task_logs | 30 days | Drop old partitions |
| ai_usage | 365 days | Aggregate to daily, drop detail |
| data_quality_results | 90 days | Drop old partitions |

---

## 8. Security Considerations

### 8.1 Column-Level Encryption
```python
# app/services/encryption.py
from cryptography.fernet import Fernet
import base64

class CredentialEncryption:
    def __init__(self, key: bytes):
        self.fernet = Fernet(key)
    
    def encrypt(self, plaintext: str) -> tuple[bytes, bytes]:
        salt = secrets.token_bytes(16)
        ciphertext = self.fernet.encrypt(plaintext.encode())
        return ciphertext, salt
    
    def decrypt(self, ciphertext: bytes, salt: bytes) -> str:
        return self.fernet.decrypt(ciphertext).decode()
```

### 8.2 Row-Level Security (Optional)
```sql
-- Enable RLS on sensitive tables
ALTER TABLE databases ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see databases they created or have explicit access to
CREATE POLICY database_access ON databases
    FOR ALL TO application_role
    USING (
        created_by = current_user_id() 
        OR EXISTS (
            SELECT 1 FROM database_access_control 
            WHERE database_id = databases.id 
            AND user_id = current_user_id()
        )
        OR current_user_is_admin()
    );
```

---

## 9. Performance Optimization

### 9.1 Connection Pooling
```python
# app/services/connection_pool.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.pool import NullPool

engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=30,
    pool_timeout=30,
    pool_recycle=3600,
    pool_pre_ping=True,
    echo=False
)

# For background workers - no pooling
worker_engine = create_async_engine(
    DATABASE_URL,
    poolclass=NullPool
)
```

### 9.2 Query Optimization
- Use `selectinload` for collections, `joinedload` for single relationships
- Paginate with keyset pagination for large datasets
- Use CTEs for complex aggregations
- Materialized views for expensive dashboard queries

### 9.3 Caching Strategy
| Data | Cache TTL | Invalidation |
|------|-----------|--------------|
| Database schema | 1 hour | On schema change |
| User permissions | 15 min | On role change |
| AI model list | 1 hour | On provider config change |
| Dashboard metrics | 30 sec | Real-time WS updates |

---

## 10. Backup & Recovery

### 10.1 Backup Commands
```bash
# Full backup with PGBackRest
pgbackrest --stanza=db-sentinel backup --type=full

# Incremental backup
pgbackrest --stanza=db-sentinel backup --type=incr

# Point-in-time recovery
pgbackrest --stanza=db-sentinel restore --target-time="2024-01-15 10:30:00"
```

### 10.2 Recovery Testing
- Monthly restore test to staging
- Verify schema integrity
- Verify application connectivity
- Document RTO/RPO actuals

---

## 11. Appendix

### 11.1 Complete DDL Script
See `migrations/versions/0001_initial_schema.py` for complete DDL.

### 11.2 Naming Conventions
| Object | Convention |
|--------|------------|
| Tables | snake_case, plural (databases, tasks) |
| Columns | snake_case (created_at, database_id) |
| Primary Keys | id (UUID) |
| Foreign Keys | {table}_id (database_id) |
| Indexes | idx_{table}_{columns} |
| Unique Constraints | uq_{table}_{columns} |
| Check Constraints | ck_{table}_{condition} |
| Sequences | {table}_{column}_seq |
| Enums | {name}type (databasetype, taskstatus) |

### 11.3 Related Documents
- Architecture: `ARCHITECTURE.md`
- TRD: `TRD.md`
- PRD: `PRD.md`
- Implementation Plan: `IMPLEMENTATION_PLAN.md`