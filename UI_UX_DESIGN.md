# DB Sentinel - UI/UX Design Document

## 1. Design Principles

### 1.1 Core Principles
| Principle | Description |
|-----------|-------------|
| **Clarity over cleverness** | Prioritize readable, scannable interfaces |
| **Progressive disclosure** | Show essential info first, details on demand |
| **Real-time feedback** | Every action has immediate visual response |
| **Keyboard-first** | Power users navigate without mouse |
| **Context preservation** | State maintained across navigation |
| **Error prevention** | Validate early, confirm destructive actions |
| **Accessibility by default** | WCAG 2.1 AA compliance |

### 1.2 Design Tokens

#### Colors
```css
/* Light Theme */
--color-bg-primary: #ffffff;
--color-bg-secondary: #f8fafc;
--color-bg-tertiary: #f1f5f9;
--color-bg-code: #f6f8fa;
--color-text-primary: #0f172a;
--color-text-secondary: #475569;
--color-text-muted: #94a3b8;
--color-border: #e2e8f0;
--color-border-focus: #3b82f6;
--color-primary: #2563eb;
--color-primary-hover: #1d4ed8;
--color-primary-light: #dbeafe;
--color-success: #059669;
--color-success-light: #d1fae5;
--color-warning: #d97706;
--color-warning-light: #fef3c7;
--color-danger: #dc2626;
--color-danger-light: #fee2e2;

/* Dark Theme */
--color-bg-primary: #0f172a;
--color-bg-secondary: #1e293b;
--color-bg-tertiary: #334155;
--color-bg-code: #161b22;
--color-text-primary: #f8fafc;
--color-text-secondary: #cbd5e1;
--color-text-muted: #64748b;
--color-border: #334155;
--color-border-focus: #60a5fa;
--color-primary: #3b82f6;
--color-primary-hover: #60a5fa;
--color-primary-light: #1e3a5f;
--color-success: #10b981;
--color-success-light: #064e3b;
--color-warning: #f59e0b;
--color-warning-light: #78350f;
--color-danger: #ef4444;
--color-danger-light: #7f1d1d;
```

#### Typography
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */

--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

#### Spacing
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

#### Border Radius
```css
--radius-sm: 0.25rem;   /* 4px */
--radius-md: 0.375rem;  /* 6px */
--radius-lg: 0.5rem;    /* 8px */
--radius-xl: 0.75rem;   /* 12px */
--radius-full: 9999px;
```

#### Shadows
```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
```

---

## 2. Layout Structure

### 2.1 Application Shell

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header (64px)                                                      │
│  ┌────────────────────┬──────────────────────────────────────────┐  │
│  │ Logo + Product     │ Search (Cmd+K) | Notifications | User   │  │
│  │ Name               │                                              │  │
│  └────────────────────┴──────────────────────────────────────────┘  │
├──────────────┬──────────────────────────────────────────────────────┤
│  Sidebar     │ Main Content Area                                    │
│  (280px)     │                                                      │
│  ┌────────┐  │  ┌──────────────────────────────────────────────┐   │
│  │ Nav    │  │  │ Page Header (Title + Actions)                │   │
│  │ Items  │  │  ├──────────────────────────────────────────────┤   │
│  │        │  │  │ Content Grid / Full Width                    │   │
│  │        │  │  │                                              │   │
│  └────────┘  │  │                                              │   │
│              │  │                                              │   │
└──────────────┴──────────────────────────────────────────────────────┘
```

### 2.2 Responsive Breakpoints
| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Sidebar collapses to drawer, stacked cards |
| Tablet | 640-1024px | Sidebar collapsible, 2-col grid |
| Desktop | 1024-1440px | Fixed sidebar, 3-col grid |
| Wide | > 1440px | Fixed sidebar, 4-col grid, max-width 1400px |

---

## 3. Page Designs

### 3.1 Dashboard (Home)

**Purpose**: Executive overview of database health and recent activity

```
┌─────────────────────────────────────────────────────────────────────┐
│ Dashboard                                              [Time Range]  │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│ │ Databases│ │ Active  │ │ Slow    │ │ Alerts  │ │ AI Cost │       │
│ │ 12      │ │ Tasks 3 │ │ Queries │ │ 2 WARN  │ │ $0.42   │       │
│ │         │ │         │ │ 7       │ │ 1 CRIT  │ │ / $10   │       │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ ┌─────────────────────────┐ │
│ │ Database Health Overview            │ │ Recent Activity         │ │
│ │ ┌─────────────────────────────────┐ │ │ • SQL generated 2m ago  │ │
│ │ │ [Sparkline: CPU, Memory, Conn] │ │ │ • Index created 15m ago │ │
│ │ └─────────────────────────────────┘ │ │ • Drift detected 1h ago │ │
│ │                                     │ │ • Alert: High CPU 3h ago│ │
│ └─────────────────────────────────────┘ └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Top Slow Queries (Last 24h)                                     │ │
│ │ ┌────┬──────────┬────────┬────────┬────────┬────────┬────────┐ │ │
│ │ │ #  │ Database │ Query  │ Avg ms │ Exec/s │ Trend  │ Action │ │ │
│ │ ├────┼──────────┼────────┼────────┼────────┼────────┼────────┤ │ │
│ │ │ 1  │ prod-pg  │ SELECT │ 2,847  │ 45.2   │ ↗ +12% │ [Opt]  │ │ │
│ │ │ 2  │ analytics│ JOIN   │ 1,923  │ 12.1   │ ↘ -5%  │ [Opt]  │ │ │
│ │ └────┴──────────┴────────┴────────┴────────┴────────┴────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Components**:
- **MetricCard**: Value, label, trend icon, sparkline (optional)
- **ChartWidget**: Recharts line/area chart with tooltip
- **ActivityFeed**: Timestamp, icon, message, link
- **SlowQueryTable**: Sortable, paginated, "Optimize" action button

---

### 3.2 Databases Page

**Purpose**: Manage database connections, view status, explore schemas

#### 3.2.1 List View
```
┌─────────────────────────────────────────────────────────────────────┐
│ Databases                                    [+ Add Connection]     │
├─────────────────────────────────────────────────────────────────────┤
│ [Search...] [Filter: All/Active/Error] [Sort: Name/Status/Type]    │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ┌───┐ prod-primary          PostgreSQL 15.4    ● Connected     │ │
│ │ │   │ Production PostgreSQL                      1.2 TB        │ │
│ │ │   │ Tags: production, postgres        Last tested: 2m ago    │ │
│ │ │   │ [Test] [Schema] [Monitor] [⋮]                          │ │
│ │ ├───┼──────────────────────────────────────────────────────────┤ │
│ │ │ ┌───┐ analytics-replica     MySQL 8.0         ● Connected     │ │
│ │ │   │ Read replica for analytics              543 GB           │ │
│ │ │   │ Tags: replica, mysql              Last tested: 5m ago    │ │
│ │ │   │ [Test] [Schema] [Monitor] [⋮]                          │ │
│ │ ├───┼──────────────────────────────────────────────────────────┤ │
│ │ │ ┌───┐ legacy-sqlserver        SQL Server 2019  ○ Disconnected │ │
│ │ │   │ Legacy system                               89 GB        │ │
│ │ │   │ Tags: legacy, sqlserver             Last tested: 2d ago  │ │
│ │ │   │ [Test] [Schema] [Monitor] [⋮]                          │ │
│ │ └───┴──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3.2.2 Add/Edit Connection Modal
```
┌─────────────────────────────────────────────────────────────────────┐
│ Add Database Connection                                    [×]      │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─ Basic Configuration ─────────────────────────────────────────┐  │
│ │ Name *          [prod-primary____________________]            │  │
│ │ Type *          [PostgreSQL ▼]                                │  │
│ │ Host *          [db.prod.company.com____________]             │  │
│ │ Port *          [5432___]                                     │  │
│ │ Database *      [production____________________]              │  │
│ │ Schema          [public______________________]                │  │
│ ├─ Authentication ──────────────────────────────────────────────┤  │
│ │ Username *      [app_user______________________]              │  │
│ │ Password *      [••••••••••••••••]  [Show]                    │  │
│ ├─ SSL/TLS ─────────────────────────────────────────────────────┤  │
│ │ SSL Mode        [Require ▼]  [CA Cert] [Client Cert] [Key]    │  │
│ ├─ Connection Pool ─────────────────────────────────────────────┤  │
│ │ Pool Size       [5___]  Max Overflow [10__]  Timeout [30s]    │  │
│ ├─ Advanced ────────────────────────────────────────────────────┤  │
│ │ Options (JSON)  [ { "application_name": "db-sentinel" } ]     │  │
│ │ Tags            [production] [postgresql]  + Add tag          │  │
│ │ Description     [Primary production database...]              │  │
│ ├───────────────────────────────────────────────────────────────┤  │
│ │ [Test Connection]                    [Cancel] [Save]          │  │
│ └───────────────────────────────────────────────────────────────┘  │
```

#### 3.2.3 Schema Explorer (Side Panel / Full Page)
```
┌─────────────────────────────────────────────────────────────────────┐
│ Schema: prod-primary / public                    [Refresh] [Search] │
├─────────────────────────────────────────────────────────────────────┤
│ ▼ Tables (47)                                                       │
│   ▼ users                     [1.2M rows]  🔑 PK: id               │
│     ├── id (PK, UUID, NOT NULL)                                    │
│     ├── email (VARCHAR, UNIQUE, NOT NULL)                          │
│     ├── name (VARCHAR, NOT NULL)                                   │
│     ├── created_at (TIMESTAMPTZ, NOT NULL, DEFAULT now())          │
│     ├── updated_at (TIMESTAMPTZ, NOT NULL)                         │
│     └── deleted_at (TIMESTAMPTZ, NULL)                             │
│   ▼ orders                    [5.4M rows]  🔑 PK: id               │
│     ├── id (PK, UUID, NOT NULL)                                    │
│     ├── user_id (FK → users.id, NOT NULL)                          │
│     ├── status (VARCHAR, NOT NULL, DEFAULT 'pending')              │
│     ├── total_cents (INTEGER, NOT NULL)                            │
│     └── created_at (TIMESTAMPTZ, NOT NULL)                         │
│   ▶ order_items              [12.3M rows]                          │
│   ▶ products                 [8,234 rows]                          │
│ ▼ Views (3)                                                         │
│ ▼ Materialized Views (1)                                            │
│ ▼ Functions (12)                                                    │
├─────────────────────────────────────────────────────────────────────┤
│ [Context Menu on Table]                                             │
│ • View Sample Data (100 rows)                                       │
│ • Generate SELECT Query                                             │
│ • Explain Query                                                     │
│ • View Indexes                                                      │
│ • View Constraints                                                  │
│ • Copy Table Name                                                   │
│ • Copy Column Names                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Query Lab Page

**Purpose**: SQL editor with AI assistance, execution, and explanation

```
┌─────────────────────────────────────────────────────────────────────┐
│ Query Lab                              [Database: prod-primary ▼]   │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Toolbar: [Format] [Explain] [Execute ▼] [Save] [History] [AI]  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ ┌──────────────────┐  │
│ │                                          │ │ AI Assistant     │  │
│ │  1  SELECT u.name, COUNT(o.id) as orders │ │                  │  │
│ │  2  FROM users u                         │ │ "Show me users   │  │
│ │  3  LEFT JOIN orders o ON u.id = o.user_ │ │  with more than  │  │
│ │  4  WHERE u.created_at > '2024-01-01'    │ │  10 orders"      │  │
│ │  5  GROUP BY u.id, u.name                │ │                  │  │
│ │  6  HAVING COUNT(o.id) > 10              │ │ [Generate SQL]   │  │
│ │  7  ORDER BY orders DESC;                │ │                  │  │
│ │                                          │ │ [Explain Query]  │  │
│ │  █                                        │ │ [Optimize]       │  │
│ └──────────────────────────────────────────┘ └──────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Results (1,234 rows, 45ms)                    [Export ▼]        │ │
│ │ ┌────┬──────────────┬───────┬────────────────────────────────┐ │ │
│ │ │ #  │ name         │ orders│ ...                            │ │ │
│ │ ├────┼──────────────┼───────┼────────────────────────────────┤ │ │
│ │ │ 1  │ John Smith   │ 47    │                                │ │ │
│ │ │ 2  │ Jane Doe     │ 32    │                                │ │ │
│ │ │ 3  │ Bob Wilson   │ 28    │                                │ │ │
│ │ └────┴──────────────┴───────┴────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**SQLEditor Features**:
- **Monaco Editor** with SQL language support
- **IntelliSense**: Tables, columns, functions from active schema
- **Dialect awareness**: PostgreSQL/MySQL/SQL Server keywords
- **Format**: sql-formatter (Ctrl+Shift+F)
- **Multi-tab**: Tabbed queries with unsaved indicators
- **History**: Local storage + server-side query history

**AI Assistant Panel**:
- Collapsible sidebar (320px)
- Natural language input with examples
- Quick actions: Generate, Explain, Optimize, Fix
- Streaming response with cancel option
- Insert at cursor / Replace selection

**Results Table**:
- Virtual scrolling (10k+ rows)
- Column resizing, reordering, pinning
- Inline cell editing (optional)
- Export: CSV, JSON, Excel, Parquet
- Copy: Tab-separated, SQL INSERT statements

---

### 3.4 Explain Visualizer

```
┌─────────────────────────────────────────────────────────────────────┐
│ Execution Plan: Query #1247                    [Tree] [Graph] [Raw] │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ┌─────────────────────────────────────────────────────────────┐ │ │
│ │ │ ▼ Hash Join (cost=12450.00..12450.00 rows=5000)            │ │ │
│ │ │   ├── ▼ Seq Scan on orders (cost=0.00..8920.00 rows=50000) │ │ │
│ │ │   │     Filter: created_at > '2024-01-01'    ⚠️ Seq Scan   │ │ │
│ │ │   └── ▼ Hash                                                    │ │ │
│ │ │       └── ▼ Seq Scan on users (cost=0.00..2100.00 rows=10000)│ │ │
│ │ └─────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────┐ ┌─────────────────────────────────────┐ │
│ │ Plan Analysis           │ │ Recommendations                     │ │
│ │ • Total Cost: 12,450    │ │ 🔴 Missing index on orders          │ │
│ │ • Total Rows: 5,000     │ │    (created_at, user_id)           │ │
│ │ • Seq Scans: 2          │ │    Estimated improvement: 95%      │ │
│ │ • Hash Joins: 1         │ │ 🟡 Consider partitioning orders     │ │
│ │ • Memory: 45 MB         │ │    by created_at (monthly)         │ │
│ └─────────────────────────┘ └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Tree View**: Collapsible nodes, cost highlighting (red > 1000, yellow > 100)
**Graph View**: React-flow/D3 force-directed graph
**Raw JSON**: Syntax-highlighted, searchable

---

### 3.5 Agents Page

```
┌─────────────────────────────────────────────────────────────────────┐
│ Agents                                           [+ Create Custom]  │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ┌─────────────────────────────────────────────────────────────┐ │ │
│ │ │ SQL Generator                    ● Ready                     │ │ │
│ │ │ Convert natural language to SQL queries                     │ │ │
│ │ │ Capabilities: NL→SQL, Explanation, Refinement               │ │ │
│ │ │ Models: llama3.1:8b (local), gpt-4o (cloud)                 │ │ │
│ │ │ [Configure] [Test] [History] [⋮]                           │ │ │
│ │ ├─────────────────────────────────────────────────────────────┤ │ │
│ │ │ Query Optimizer                  ● Ready                     │ │ │
│ │ │ Analyze execution plans, suggest indexes                    │ │ │
│ │ │ Capabilities: EXPLAIN, Index suggestions, Rewrite          │ │ │
│ │ │ Models: llama3.1:8b (local), gpt-4o (cloud)                 │ │ │
│ │ │ [Configure] [Test] [History] [⋮]                           │ │ │
│ │ ├─────────────────────────────────────────────────────────────┤ │ │
│ │ │ Schema Manager                   ● Running (2)             │ │ │
│ │ │ Introspect, drift detection, migrations                     │ │ │
│ │ │ Capabilities: Introspect, Drift, Migration, ERD            │ │ │
│ │ │ [Configure] [Test] [History] [⋮]                           │ │ │
│ │ ├─────────────────────────────────────────────────────────────┤ │ │
│ │ │ Monitor                          ● Ready                     │ │ │
│ │ │ Real-time metrics, anomaly detection                        │ │ │
│ │ │ Capabilities: Metrics, Alerts, Slow queries                │ │ │
│ │ │ [Configure] [Test] [History] [⋮]                           │ │ │
│ │ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.6 Monitoring Page

```
┌─────────────────────────────────────────────────────────────────────┐
│ Monitoring                              [Last 1h ▼] [Live ●]        │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐ ┌─────────────────────┐ ┌────────────────┐ │
│ │ Connections         │ │ Query Latency (p95) │ │ Throughput     │ │
│ │ ┌─────────────────┐ │ │ ┌─────────────────┐ │ │ ┌────────────┐ │ │
│ │ │ 45/100  ●●●○○   │ │ │ │ 45ms  ────╮    │ │ │ │ 1,245 q/s  │ │
│ │ │                 │ │ │ │           ╰───╮ │ │ │ │            │ │ │
│ │ └─────────────────┘ │ │ └─────────────────┘ │ │ └────────────┘ │ │
│ └─────────────────────┘ └─────────────────────┘ └────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Database Metrics Grid                                           │ │
│ │ ┌──────────┬─────────┬─────────┬─────────┬─────────┬──────────┐ │ │
│ │ │ Database │ CPU %   │ Memory  │ Disk %  │ Cache % │ Status   │ │ │
│ │ ├──────────┼─────────┼─────────┼─────────┼─────────┼──────────┤ │ │
│ │ │ prod-pg  │ 23% ██  │ 2.1/8GB │ 45% ███ │ 98.2%   │ ● Healthy│ │ │
│ │ │ analytics│ 12% █   │ 1.4/4GB │ 67% ████│ 94.1%   │ ● Healthy│ │ │
│ │ │ legacy   │ -       │ -       │ -       │ -       │ ○ Down   │ │ │
│ │ └──────────┴─────────┴─────────┴─────────┴─────────┴──────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ ┌─────────────────────────┐ │
│ │ Active Alerts (3)                   │ │ Slow Queries (Top 10)   │ │
│ │ 🔴 Critical: prod-pg CPU > 90%      │ │ 1. SELECT * FROM... 2.8s│ │
│ │ 🟡 Warning: analytics disk 67%      │ │ 2. JOIN users... 1.9s   │ │
│ │ 🟡 Warning: legacy offline 2d       │ │ 3. UPDATE orders... 1.2s│ │
│ └─────────────────────────────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.7 Schema Manager Page

```
┌─────────────────────────────────────────────────────────────────────┐
│ Schema Manager                                    [Compare Environments] │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Drift Detection: prod-primary vs staging                        │ │
│ │ ┌─────────────────────────────────────────────────────────────┐ │ │
│ │ │ 🔴 Table Dropped: audit_logs (staging only)                 │ │ │
│ │ │ 🟡 Column Added: users.phone_number (prod only)             │ │ │
│ │ │ 🟡 Column Type Changed: orders.total_cents INT→BIGINT       │ │ │
│ │ │ 🟢 Index Added: idx_orders_user_status (both)               │ │ │
│ │ └─────────────────────────────────────────────────────────────┘ │ │
│ │ [Generate Migration] [Sync Staging→Prod] [View Full Diff]       │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Migration History                                               │ │
│ │ ┌────┬──────────────────┬──────────┬─────────┬────────┬────────┐│ │
│ │ │ #  │ Name             │ Database │ Author  │ Date   │ Status ││ │
│ │ ├────┼──────────────────┼──────────┼─────────┼────────┼────────┤│ │
│ │ │ 47 │ add_phone_idx    │ prod-pg  │ jane.d  │ 2h ago │ ✓ Done ││ │
│ │ │ 46 │ alter_total_type │ prod-pg  │ john.s  │ 1d ago │ ✓ Done ││ │
│ │ │ 45 │ create_audit     │ staging  │ jane.d  │ 3d ago │ ✓ Done ││ │
│ │ └────┴──────────────────┴──────────┴─────────┴────────┴────────┘│ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ERD Visualization                                               │ │
│ │ ┌─────────────────────────────────────────────────────────────┐ │ │
│ │ │  [users] ◄──┐                                               │ │ │
│ │ │       │     │                                               │ │ │
│ │ │       ▼     │                                               │ │ │
│ │ │  [orders] ──┼──► [order_items]                              │ │ │
│ │ │       │     │         │                                     │ │ │
│ │ │       ▼     │         ▼                                     │ │ │
│ │ │  [payments]   │       [products]                            │ │ │
│ │ │               │                                             │ │ │
│ │ │  [Zoom: 100%] [Fit] [Layout: Hierarchical] [Export PNG]    │ │ │
│ │ └─────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.8 Data Quality Page

```
┌─────────────────────────────────────────────────────────────────────┐
│ Data Quality                                      [Run Profile]     │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Table Profiler: prod-primary / public.orders                    │ │
│ │ ┌──────────────┬──────────┬──────────┬─────────┬──────────────┐ │ │
│ │ │ Column       │ Type     │ Null %   │ Distinct│ Stats        │ │ │
│ │ ├──────────────┼──────────┼──────────┼─────────┼──────────────┤ │ │
│ │ │ id           │ UUID     │ 0%       │ 5.4M    │ min/max      │ │ │
│ │ │ user_id      │ UUID     │ 0%       │ 120K    │ FK: users    │ │ │
│ │ │ status       │ VARCHAR  │ 0%       │ 5       │ pending: 45% │ │ │
│ │ │ total_cents  │ INT      │ 0%       │ 89K     │ μ=4523 σ=2100│ │ │
│ │ │ created_at   │ TIMESTAMPTZ│ 0%     │ 1.2M    │ 2024-01→now  │ │ │
│ │ │ email        │ VARCHAR  │ 2.3% ⚠️ │ 118K    │ format: 99%  │ │ │
│ │ │ phone        │ VARCHAR  │ 15.7% ⚠️│ 45K     │ format: 67%  │ │ │
│ │ └──────────────┴──────────┴──────────┴─────────┴──────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ ┌─────────────────────────┐ │
│ │ Validation Rules                    │ │ Anomalies Detected      │ │
│ │ • email: valid format (99% pass)    │ │ 🔴 order total > 1M: 3  │ │
│ │ • status: enum check (100% pass)    │ │ 🟡 phone format: 33%    │ │
│ │ • total_cents > 0 (99.9% pass)      │ │ 🟡 null email: 124K     │ │
│ │ • user_id: FK exists (100% pass)    │ │ 🟢 duplicate orders: 0  │ │
│ │ [Add Rule] [Run Validation]         │ │ [View Details]          │ │
│ └─────────────────────────────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.9 Settings Page

```
┌─────────────────────────────────────────────────────────────────────┐
│ Settings                                                            │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌────────────────────────────────────────────┐ │
│ │ General          │ │                                              │ │
│ │ Appearance       │ │  [Content Area]                             │ │
│ │ AI Providers     │ │                                              │ │
│ │ Users & Roles    │ │                                              │ │
│ │ Audit Logs       │ │                                              │ │
│ │ Integrations     │ │                                              │ │
│ │ About            │ │                                              │ │
│ └──────────────────┘ └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

#### AI Providers Tab
```
┌─────────────────────────────────────────────────────────────────────┐
│ AI Providers                                                        │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Ollama (Local)                          Status: ● Connected    │ │
│ │ Endpoint: [http://ollama:11434______________________] [Test]   │ │
│ │ Default Model: [llama3.1:8b ▼]  Available: 3 models [Refresh]  │ │
│ │ Models: llama3.1:8b ●  codellama:13b ●  mistral:7b ○           │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ OpenAI (Cloud)                          Status: ● Connected    │ │
│ │ API Key: [••••••••••••••••••••••••••••••••••••] [Test]        │ │
│ │ Default Model: [gpt-4o ▼]  Budget: $50/month  Current: $12.34  │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ Anthropic (Cloud)                       Status: ○ Not Config   │ │
│ │ API Key: [__________________________________________] [Test]   │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ Routing Preferences                                               │ │
│ │ Default Provider: [Ollama (Local) ▼]                             │ │
│ │ Prefer Local: [●]  Cost Limit/Day: [$10.00]                    │ │
│ │ Fallback to Cloud: [●]  on local failure                        │ │
│ └─────────────────────────────────────────────────────────────────┘ │
```

---

## 4. Component Library (shadcn/ui Based)

### 4.1 Core Components
| Component | Variants | States |
|-----------|----------|--------|
| Button | default, destructive, outline, secondary, ghost, link | default, hover, active, disabled, loading |
| Input | default, error, success | default, focus, disabled |
| Textarea | default | default, focus, disabled |
| Select | default, multi | default, open, disabled |
| Checkbox | default | checked, unchecked, indeterminate |
| RadioGroup | default | selected, unselected |
| Switch | default | checked, unchecked |
| Label | default | - |
| Card | default, bordered | - |
| Table | default, striped, hover | sorting, loading, empty |
| Tabs | default, underline | active, inactive |
| Dialog | default, alert, confirm | open, closed |
| Sheet | default, side | open, closed |
| DropdownMenu | default | open, closed |
| Tooltip | default, side | visible, hidden |
| Toast | default, success, error, warning | visible |
| Badge | default, secondary, destructive, outline | - |
| Avatar | default, image, fallback | - |
| Separator | horizontal, vertical | - |
| ScrollArea | default | - |
| ResizablePanel | default | dragging |
| Command | default (Cmd+K palette) | open, closed |

### 4.2 Data Display Components
| Component | Description |
|-----------|-------------|
| MetricCard | Value, label, trend, sparkline |
| StatCard | Large number, label, description |
| ProgressBar | Linear, circular, indeterminate |
| ChartContainer | Recharts wrapper with responsive |
| DataTable | Sortable, filterable, paginated, virtualized |
| TreeView | Expandable, searchable, context menu |
| CodeBlock | Syntax highlighted, copy button |
| JsonViewer | Collapsible, searchable, copy path |

### 4.3 Navigation Components
| Component | Description |
|-----------|-------------|
| Sidebar | Collapsible, nested groups, badges |
| Breadcrumbs | Clickable, truncation |
| Pagination | Page numbers, page size, total |
| Breadcrumb | Current path |

---

## 5. Interaction Patterns

### 5.1 Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Command palette (search, actions) |
| `Cmd+/` | Focus search |
| `Ctrl+Enter` | Execute query (in Query Lab) |
| `Ctrl+Shift+E` | Explain query |
| `Ctrl+Shift+F` | Format SQL |
| `Esc` | Close modal, cancel, dismiss toast |
| `Tab` / `Shift+Tab` | Navigate focusable elements |
| `Arrow keys` | Navigate menus, tables, trees |
| `Space` / `Enter` | Activate button, toggle checkbox |

### 5.2 Loading States
| Scenario | Pattern |
|----------|---------|
| Page load | Skeleton screens (cards, tables) |
| Data fetch | Spinner in container, maintain layout |
| AI generation | Streaming tokens, progress indicator |
| Task execution | Progress bar with step labels |
| Schema refresh | Inline spinner on refresh button |

### 5.3 Empty States
| Context | Message | Action |
|---------|---------|--------|
| No databases | "No connections yet" | [Add Connection] |
| No tasks | "No tasks in queue" | - |
| No query results | "Query returned 0 rows" | - |
| No schema | "Schema not loaded" | [Refresh Schema] |
| Search no results | "No matches for '...'" | Clear search |

### 5.4 Error Handling
| Error Type | Display | Recovery |
|------------|---------|----------|
| Validation | Inline field error | Fix field |
| API error | Toast + inline (if form) | Retry button |
| Network | Toast + offline banner | Auto-retry |
| Permission | Modal + redirect | Contact admin |
| AI failure | Panel error + fallback | Try different model |

---

## 6. Accessibility (WCAG 2.1 AA)

### 6.1 Requirements
- **Color contrast**: 4.5:1 (text), 3:1 (UI components)
- **Focus indicators**: Visible, 2px solid, offset 2px
- **Keyboard navigation**: All interactive elements reachable
- **Screen readers**: Semantic HTML, ARIA labels, live regions
- **Motion**: Respect `prefers-reduced-motion`
- **Zoom**: Functional at 200% zoom

### 6.2 Implementation
```tsx
// Focus visible
*:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

// Live region for toasts
<div aria-live="polite" aria-atomic="true" class="toast-container" />

// Reduced motion
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. Responsive Behavior

### 7.1 Sidebar
- **Desktop (≥1024px)**: Fixed 280px, collapsible to 72px (icons only)
- **Tablet (640-1024px)**: Collapsible drawer, overlay
- **Mobile (<640px)**: Full-screen drawer

### 7.2 Tables
- **Desktop**: Full columns, horizontal scroll if needed
- **Tablet**: Priority columns visible, others in expandable row
- **Mobile**: Card-based layout per row

### 7.3 Query Lab
- **Desktop**: Split view (Editor + AI Panel)
- **Tablet**: Tabs (Editor / AI / Results)
- **Mobile**: Stacked, full-width tabs

### 7.4 Dashboard Grid
| Breakpoint | Columns | Card Min Width |
|------------|---------|----------------|
| Mobile | 1 | 100% |
| Tablet | 2 | 300px |
| Desktop | 3 | 280px |
| Wide | 4 | 280px |

---

## 8. Theming

### 8.1 Theme Switching
- **System**: Follows OS preference
- **Light**: Explicit light
- **Dark**: Explicit dark
- Persisted in localStorage, synced across tabs

### 8.2 CSS Variables Approach
```css
:root {
  /* Light tokens */
}
[data-theme="dark"] {
  /* Dark tokens */
}
```

---

## 9. Animation & Transitions

### 9.1 Timing
| Type | Duration | Easing |
|------|----------|--------|
| Micro (hover, focus) | 100ms | ease-out |
| Panel (sidebar, modal) | 200ms | ease-out |
| Page transition | 150ms | ease-in-out |
| Toast | 300ms | ease-out |

### 9.2 Reduced Motion
All animations disabled when `prefers-reduced-motion: reduce`

---

## 10. Internationalization (Future)

### 10.1 Structure
```
locales/
├── en.json
├── es.json
├── fr.json
├── de.json
├── ja.json
└── zh.json
```

### 10.2 Keys Format
```json
{
  "dashboard": {
    "title": "Dashboard",
    "metrics": {
      "databases": "Databases",
      "activeTasks": "Active Tasks"
    }
  },
  "queryLab": {
    "execute": "Execute",
    "explain": "Explain",
    "aiAssistant": "AI Assistant"
  }
}
```

---

## 11. Design Handoff

### 11.1 Figma File Structure
- **Foundations**: Colors, Typography, Spacing, Shadows
- **Components**: All shadcn/ui components + custom
- **Pages**: Dashboard, Databases, QueryLab, Monitoring, SchemaManager, DataQuality, Settings
- **States**: Empty, Loading, Error, Success
- **Responsive**: Mobile, Tablet, Desktop, Wide

### 11.2 Developer Handoff Checklist
- [ ] Design tokens exported as CSS variables
- [ ] Component props documented (Storybook)
- [ ] Responsive breakpoints defined
- [ ] Accessibility annotations
- [ ] Interaction specifications
- [ ] Asset exports (SVG icons, illustrations)

---

## 12. Appendix

### 12.1 Icon Library
- **Source**: Lucide React (consistent, tree-shakeable)
- **Size**: 16px (inline), 20px (buttons), 24px (headers)

### 12.2 Illustration Style
- **Empty states**: Minimal line drawings
- **Onboarding**: Step-by-step diagrams
- **Error pages**: Friendly, helpful

### 12.3 Related Documents
- Architecture: `ARCHITECTURE.md`
- TRD: `TRD.md`
- PRD: `PRD.md`
- Backend Schema: `BACKEND_SCHEMA.md`