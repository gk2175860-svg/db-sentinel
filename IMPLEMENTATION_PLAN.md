# DB Sentinel - Implementation Plan

## 1. Project Overview

### 1.1 Scope
Build DB Sentinel as a modular monolith with:
- **Agent Engine**: Python/FastAPI backend with AI orchestration
- **Web Dashboard**: React/TypeScript frontend with real-time updates
- **Infrastructure**: PostgreSQL, Redis, Ollama, Docker/Kubernetes

### 1.2 Methodology
- **Agile**: 2-week sprints, continuous delivery
- **Trunk-based development**: Short-lived feature branches
- **Definition of Done**: Code review + tests + docs + deployed to staging

### 1.3 Team Structure (Recommended)
| Role | Count | Responsibilities |
|------|-------|------------------|
| Backend Engineers | 2-3 | Agent engine, adapters, AI providers, API |
| Frontend Engineers | 2 | Dashboard, components, real-time UI |
| DevOps Engineer | 1 | CI/CD, Kubernetes, monitoring |
| QA Engineer | 1 | Test automation, E2E testing |
| Product Manager | 1 | Prioritization, user feedback |
| Tech Lead | 1 | Architecture, code reviews |

---

## 2. Phase Breakdown

### Phase 1: Foundation (Weeks 1-2) - "Skeleton"
**Goal**: Working development environment with core infrastructure

#### Sprint 1.1 (Week 1): Monorepo & Core Setup
| Task | Owner | Estimate | Dependencies | Deliverable |
|------|-------|----------|--------------|-------------|
| Initialize monorepo structure | BE | 4h | - | Folder structure, shared configs |
| Setup Python project (FastAPI, Poetry) | BE | 4h | Monorepo | `agent-engine/` with deps |
| Setup React project (Vite, TS, Tailwind) | FE | 4h | Monorepo | `web-dashboard/` with deps |
| Configure shared OpenAPI contract | BE/FE | 4h | Both projects | `shared/openapi.yaml` |
| Docker Compose for local dev | DevOps | 8h | - | `docker-compose.yml` |
| PostgreSQL + Redis + Ollama services | DevOps | 4h | Docker | Running services |
| Basic FastAPI app with health checks | BE | 4h | Python project | `/health`, `/ready` endpoints |
| Pydantic Settings configuration | BE | 4h | FastAPI app | `config.py` with env vars |
| Basic React app with routing | FE | 8h | React project | Pages: Dashboard, Settings |
| shadcn/ui component library setup | FE | 4h | React project | Button, Input, Card, Table |
| CI/CD pipeline (GitHub Actions) | DevOps | 8h | Repos | Lint, typecheck, test, build |

#### Sprint 1.2 (Week 2): Database Layer & Auth
| Task | Owner | Estimate | Dependencies | Deliverable |
|------|-------|----------|--------------|-------------|
| SQLAlchemy models (User, Role, Permission) | BE | 8h | FastAPI, DB | `models/user.py` |
| Alembic migration setup | BE | 4h | Models | Initial migration |
| JWT authentication (access + refresh) | BE | 8h | Models | `/auth/login`, `/auth/refresh` |
| RBAC middleware | BE | 8h | Auth | Permission checks |
| Password encryption (bcrypt) | BE | 2h | Auth | Secure password storage |
| Credential encryption service | BE | 4h | Config | AES-256-GCM encrypt/decrypt |
| Database connection CRUD API | BE | 8h | Auth, Encryption | POST/GET/PUT/DELETE `/databases` |
| Database connection test endpoint | BE | 4h | CRUD | POST `/databases/{id}/test` |
| React: Login page + protected routes | FE | 8h | API | Login form, token storage |
| React: Database list page | FE | 8h | API | Table with add/edit/delete |
| React: Add database modal | FE | 8h | API | Form with validation |

**Phase 1 Exit Criteria**:
- [ ] `docker-compose up` runs all services
- [ ] Can register/login via UI
- [ ] Can add/test PostgreSQL connection
- [ ] CI pipeline passes on main branch
- [ ] Code coverage > 60%

---

### Phase 2: Core Agents (Weeks 3-4) - "Brain"
**Goal**: Functional AI agents for SQL generation and query optimization

#### Sprint 2.1 (Week 3): Agent Framework & SQL Generator
| Task | Owner | Estimate | Dependencies | Deliverable |
|------|-------|----------|--------------|-------------|
| BaseAgent abstract class + state machine | BE | 8h | Core | `core/agent_base.py` |
| Task queue with Redis/RQ | BE | 8h | Redis | `core/task_queue.py` |
| Event bus (Redis Pub/Sub) | BE | 4h | Redis | `core/events.py` |
| WebSocket endpoint + connection manager | BE | 8h | FastAPI | `/ws` with subscribe/publish |
| AI Provider abstract base | BE | 4h | Core | `ai/provider.py` |
| Ollama provider implementation | BE | 8h | Provider base | `ai/ollama.py` |
| OpenAI provider implementation | BE | 8h | Provider base | `ai/openai.py` |
| Smart AI Router | BE | 8h | Providers | `ai/router.py` |
| Database adapter base class | BE | 8h | Core | `adapters/base.py` |
| PostgreSQL adapter implementation | BE | 16h | Adapter base | `adapters/postgresql.py` |
| Adapter registry with entry_points | BE | 4h | Adapter base | `adapters/registry.py` |
| SQL Generator Agent | BE | 16h | Agent base, AI, Adapter | `agents/sql_generator.py` |
| Schema introspection service | BE | 8h | Adapter | `services/schema_introspect.py` |
| NL→SQL prompt engineering | BE | 8h | SQL Generator | Optimized prompts |

#### Sprint 2.2 (Week 4): Query Optimizer & Agent API
| Task | Owner | Estimate | Dependencies | Deliverable |
|------|-------|----------|--------------|-------------|
| Query Optimizer Agent | BE | 16h | Agent base, Adapter | `agents/query_optimizer.py` |
| EXPLAIN plan parsing (PG, MySQL) | BE | 8h | Adapter | Structured plan models |
| Index recommendation logic | BE | 8h | Optimizer | Missing/redundant index detection |
| Agent registry API | BE | 4h | Agents | GET `/agents`, GET `/agents/{type}` |
| Task submission API | BE | 8h | Task queue | POST `/agents/{type}/tasks` |
| Task status/result API | BE | 4h | Task queue | GET `/tasks/{id}` |
| Task cancellation | BE | 4h | Task queue | DELETE `/tasks/{id}` |
| WebSocket task progress events | BE | 4h | Event bus | Real-time progress updates |
| React: Agent management page | FE | 8h | API | List agents, configurations |
| React: Task monitor page | FE | 8h | API, WS | Real-time task list with progress |
| React: Query Lab - SQL Editor | FE | 16h | Monaco Editor | Monaco with SQL support |
| React: Query Lab - Execute/Explain | FE | 8h | API | Execute button, results table |
| React: Query Lab - AI Assistant panel | FE | 16h | API, WS | NL input, streaming response |

**Phase 2 Exit Criteria**:
- [ ] Can generate SQL from natural language
- [ ] Can optimize a query with index suggestions
- [ ] Tasks run asynchronously with WebSocket progress
- [ ] Query Lab executes SQL and shows results
- [ ] AI panel generates SQL from NL
- [ ] Code coverage > 70%

---

### Phase 3: Dashboard Integration (Weeks 5-6) - "Body"
**Goal**: Full-featured dashboard with all core pages

#### Sprint 3.1 (Week 5): Schema Management & Monitoring
| Task | Owner | Estimate | Dependencies | Deliverable |
|------|-------|----------|--------------|-------------|
| Schema Manager Agent | BE | 16h | Agent base, Adapter | `agents/schema_manager.py` |
| Schema introspection (full) | BE | 8h | Adapter | Tables, columns, indexes, FKs |
| Schema drift detection | BE | 8h | Schema snapshots | Diff algorithm |
| Migration generation (up/down) | BE | 8h | Drift | SQL migration scripts |
| ERD data extraction | BE | 4h | Schema | Nodes/edges for visualization |
| Schema API endpoints | BE | 4h | Agent | GET `/databases/{id}/schema`, drift, migrations |
| Schema Manager page (React) | FE | 16h | API | Drift view, migration history |
| ERD Visualization component | FE | 16h | React-flow | Interactive diagram |
| Monitor Agent | BE | 16h | Agent base, Adapter | `agents/monitor.py` |
| Metrics collection queries | BE | 8h | Adapter | PG stats, MySQL performance_schema |
| Anomaly detection (threshold) | BE | 8h | Metrics | Configurable thresholds |
| Slow query tracking | BE | 8h | Adapter | pg_stat_statements, sys schema |
| Monitoring API endpoints | BE | 4h | Agent | GET metrics, alerts |
| Monitoring Dashboard (React) | FE | 16h | API, WS, Recharts | Real-time charts, alerts panel |

#### Sprint 3.2 (Week 6): Data Quality & Polish
| Task | Owner | Estimate | Dependencies | Deliverable |
|------|-------|----------|--------------|-------------|
| Data Quality Agent | BE | 16h | Agent base, Adapter | `agents/data_quality.py` |
| Column profiling queries | BE | 8h | Adapter | Null%, distinct, stats, top values |
| Validation rules engine | BE | 8h | DQ Agent | Not null, unique, range, regex, enum |
| Anomaly detection (statistical) | BE | 8h | DQ Agent | Outlier detection |
| Data Quality API | BE | 4h | Agent | Profile, validate, rules CRUD |
| Data Quality page (React) | FE | 16h | API | Profiler, rules, anomalies |
| Query Lab: Explain Visualizer | FE | 16h | React-flow | Tree + Graph view |
| Query Lab: Results export | FE | 8h | Table | CSV, JSON, Excel, Parquet |
| Query Lab: History panel | FE | 8h | API | Previous queries with re-run |
| Settings page (React) | FE | 16h | API | AI providers, users, integrations |
| AI Provider management UI | FE | 8h | Settings | Ollama/OpenAI/Anthropic config |
| User management UI (Admin) | FE | 8h | Settings | Users, roles, permissions |
| Dark/Light theme | FE | 4h | Tailwind | Theme toggle, persistence |
| Responsive layout fixes | FE | 8h | All pages | Mobile/tablet/desktop |

**Phase 3 Exit Criteria**:
- [ ] Schema drift detection works
- [ ] Migration generation produces valid SQL
- [ ] Monitoring shows real-time metrics
- [ ] Data quality profiling runs successfully
- [ ] All dashboard pages functional
- [ ] Code coverage > 75%

---

### Phase 4: Advanced Features (Weeks 7-8) - "Polish"
**Goal**: Multi-database support, advanced AI, production hardening

#### Sprint 4.1 (Week 7): Multi-DB & Advanced AI
| Task | Owner | Estimate | Dependencies | Deliverable |
|------|-------|----------|--------------|-------------|
| MySQL/MariaDB adapter | BE | 16h | Adapter base | `adapters/mysql.py` |
| SQL Server adapter | BE | 16h | Adapter base | `adapters/sqlserver.py` |
| Oracle adapter | BE | 8h | Adapter base | `adapters/oracle.py` |
| Adapter test suite | BE | 8h | All adapters | Testcontainers for each DB |
| Anthropic provider | BE | 8h | Provider base | `ai/anthropic.py` |
| AI cost tracking & budgets | BE | 8h | AI Router | Daily limits, alerts |
| Model fallback logic | BE | 4h | AI Router | Cloud fallback on local failure |
| Streaming AI responses | BE | 8h | Providers | Token-by-token WS updates |
| Function calling support | BE | 8h | Providers | Structured outputs |
| Embeddings for semantic search | BE | 8h | Providers | Schema search, doc retrieval |

#### Sprint 4.2 (Week 8): Production Hardening
| Task | Owner | Estimate | Dependencies | Deliverable |
|------|-------|----------|--------------|-------------|
| Comprehensive unit tests | BE/FE | 24h | All code | Coverage > 85% |
| Integration tests (API) | BE | 16h | API | TestClient + testcontainers |
| E2E tests (Playwright) | QA | 16h | UI | Critical user flows |
| Performance tests (k6) | DevOps | 8h | K8s | Load/stress/soak tests |
| Security audit | DevOps | 8h | Code | SAST, dependency scan |
| Kubernetes manifests | DevOps | 16h | Docker | Helm charts / Kustomize |
| Helm chart with values | DevOps | 8h | K8s | `helm install db-sentinel` |
| Observability stack | DevOps | 16h | K8s | Prometheus, Grafana, Loki, Tempo |
| Alerting rules | DevOps | 8h | Observability | PagerDuty/Slack/Email |
| Runbook documentation | DevOps | 8h | Ops | Incident response guides |
| Backup/restore procedures | DevOps | 4h | PostgreSQL | Tested restore |
| Load testing report | DevOps | 4h | k6 | Performance benchmarks |

**Phase 4 Exit Criteria**:
- [ ] All 4 database adapters working
- [ ] All 3 AI providers working with routing
- [ ] Kubernetes deployment successful
- [ ] Observability stack operational
- [ ] Security scan passes
- [ ] Performance targets met
- [ ] Code coverage > 85%

---

### Phase 5: Launch Preparation (Weeks 9-10) - "Launch"
**Goal**: Documentation, beta testing, release

#### Sprint 5.1 (Week 9): Documentation & Beta
| Task | Owner | Estimate | Dependencies | Deliverable |
|------|-------|----------|--------------|-------------|
| User guide documentation | PM/Tech | 16h | Features | Getting started, tutorials |
| API reference (auto-generated) | BE | 4h | OpenAPI | Swagger UI / Redoc |
| Architecture decision records | Tech Lead | 8h | Decisions | `docs/adr/*.md` |
| Admin guide | DevOps | 8h | K8s | Deployment, scaling, backup |
| Developer guide | BE/FE | 8h | Code | Contributing, plugins |
| Beta tester onboarding | PM | 8h | Release | 5-10 beta users |
| Beta feedback collection | PM | 8h | Beta | Issues, improvements |
| Bug fixes from beta | All | 16h | Feedback | Resolved critical issues |

#### Sprint 5.2 (Week 10): Release
| Task | Owner | Estimate | Dependencies | Deliverable |
|------|-------|----------|--------------|-------------|
| Release candidate build | DevOps | 4h | CI/CD | Tagged Docker images |
| Security scan final | DevOps | 2h | RC | Clean scan |
| Performance baseline final | DevOps | 2h | RC | Benchmarks |
| Release notes | PM | 4h | All | CHANGELOG.md |
| Docker Hub / GHCR publish | DevOps | 2h | RC | Public images |
| Helm chart publish | DevOps | 2h | RC | Chart repository |
| Website/landing page | PM/FE | 8h | - | db-sentinel.io |
| Launch announcement | PM | 4h | All | Blog, Twitter, HN |
| Post-launch monitoring | DevOps | Ongoing | Launch | 24/7 for 1 week |

**Phase 5 Exit Criteria**:
- [ ] Documentation complete
- [ ] Beta feedback incorporated
- [ ] Release artifacts published
- [ ] Launch successful
- [ ] Monitoring stable

---

## 3. Detailed Task Estimates Summary

| Phase | Backend (h) | Frontend (h) | DevOps (h) | QA (h) | PM (h) | Total (h) |
|-------|-------------|--------------|------------|--------|--------|-----------|
| Phase 1 | 56 | 48 | 24 | 0 | 0 | 128 |
| Phase 2 | 112 | 56 | 0 | 0 | 0 | 168 |
| Phase 3 | 88 | 88 | 0 | 0 | 0 | 176 |
| Phase 4 | 104 | 0 | 80 | 16 | 0 | 200 |
| Phase 5 | 8 | 8 | 32 | 0 | 56 | 108 |
| **Total** | **368** | **200** | **136** | **16** | **56** | **778** |

---

## 4. Risk Register

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| AI hallucination in SQL | High | High | Schema grounding, validation, confidence scoring | BE |
| Cloud AI cost overruns | Medium | High | Budget limits, local-first, caching | BE/DevOps |
| Database adapter bugs | Medium | High | Testcontainers per adapter, CI | BE |
| WebSocket scaling issues | Medium | Medium | Load test early, connection pooling | BE/DevOps |
| Ollama GPU availability | Medium | Medium | CPU fallback, cloud AI backup | DevOps |
| Schema drift false positives | Medium | Medium | Careful diff algorithm, review UI | BE |
| Frontend performance | Low | Medium | Virtualization, code splitting | FE |
| Security vulnerabilities | Low | Critical | SAST, dependency scanning, audits | DevOps |
| Team velocity variance | Medium | Medium | Buffer in estimates, regular retrospectives | PM |
| Integration complexity | Medium | High | Early integration tests, contract testing | BE/FE |

---

## 5. Dependencies & Prerequisites

### 5.1 External Dependencies
| Dependency | Version | Purpose |
|------------|---------|---------|
| Python | 3.11+ | Backend runtime |
| Node.js | 20+ | Frontend build |
| PostgreSQL | 16 | Metadata DB |
| Redis | 7 | Queue, cache, pub/sub |
| Ollama | Latest | Local LLM |
| Docker | 24+ | Containerization |
| Kubernetes | 1.28+ | Production orchestration |

### 5.2 Internal Dependencies
```
Phase 1 → Phase 2 (Core infra needed for agents)
Phase 2 → Phase 3 (Agents needed for dashboard features)
Phase 3 → Phase 4 (Dashboard needed for advanced features)
Phase 4 → Phase 5 (Hardening needed for launch)
```

---

## 6. Quality Gates

### 6.1 Code Quality
| Gate | Tool | Threshold |
|------|------|-----------|
| Python Lint | Ruff | 0 errors |
| Python Types | mypy | 0 errors (strict) |
| Python Format | Black | 0 changes |
| Python Tests | pytest | >85% coverage |
| TypeScript Lint | ESLint | 0 errors |
| TypeScript Types | tsc | 0 errors |
| TypeScript Format | Prettier | 0 changes |
| TypeScript Tests | Vitest | >80% coverage |
| Security Scan | Trivy/Bandit | 0 critical/high |

### 6.2 CI Pipeline Stages
```yaml
stages:
  - lint: [ruff, eslint, prettier-check]
  - typecheck: [mypy, tsc]
  - test: [pytest, vitest, playwright]
  - build: [docker-build, docker-push]
  - scan: [trivy, bandit, npm-audit]
  - deploy-staging: [helm-upgrade]
  - e2e-staging: [playwright]
  - deploy-prod: [manual-approval, helm-upgrade]
```

---

## 7. Definition of Done

### 7.1 Per Task
- [ ] Code implemented per requirements
- [ ] Unit tests written and passing
- [ ] Integration tests (if API)
- [ ] Code reviewed and approved (2 reviewers)
- [ ] Documentation updated
- [ ] No lint/type errors
- [ ] Deployed to staging

### 7.2 Per Sprint
- [ ] All sprint tasks Done
- [ ] Sprint demo to stakeholders
- [ ] Retrospective completed
- [ ] Metrics updated (velocity, quality)
- [ ] Backlog groomed for next sprint

### 7.3 Per Release
- [ ] All quality gates pass
- [ ] E2E tests pass on staging
- [ ] Performance benchmarks met
- [ ] Security scan clean
- [ ] Documentation complete
- [ ] Runbooks updated
- [ ] Rollback plan documented

---

## 8. Milestones

| Milestone | Target Date | Criteria |
|-----------|-------------|----------|
| M1: Dev Environment Ready | End of Week 2 | Docker Compose up, auth works |
| M2: First AI Agent Works | End of Week 4 | NL→SQL generates valid SQL |
| M3: Dashboard Functional | End of Week 6 | All core pages working |
| M4: Multi-DB + K8s Ready | End of Week 8 | Helm deploy works, 4 DBs supported |
| M5: Release Candidate | End of Week 9 | All tests pass, docs complete |
| M6: v1.0 Launch | End of Week 10 | Public release, monitoring stable |

---

## 8. Appendix

### 8.1 Sprint Template
```markdown
## Sprint N.M Goals
- Goal 1
- Goal 2

## Sprint Backlog
| Task | Owner | Estimate | Status |
|------|-------|----------|--------|
| Task 1 | @user | 8h | ✅ Done |

## Sprint Review
- Demo: [link]
- Metrics: Velocity X, Coverage Y%
- Retrospective: [notes]
```

### 8.2 Related Documents
- PRD: `PRD.md`
- Architecture: `ARCHITECTURE.md`
- TRD: `TRD.md`
- UI/UX Design: `UI_UX_DESIGN.md`
- Backend Schema: `BACKEND_SCHEMA.md`
- App Flow: `APP_FLOW.md`