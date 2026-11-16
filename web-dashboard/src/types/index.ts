export interface Database {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver' | 'oracle';
  host: string;
  port: number;
  database_name: string;
  schema_name?: string;
  username?: string;
  connection_config?: Record<string, unknown>;
  pool_config?: Record<string, unknown>;
  tags: string[];
  description?: string;
  is_active: boolean;
  last_tested_at?: string;
  last_test_status?: 'success' | 'failed';
  last_test_error?: string;
  version?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // UI computed fields
  status?: 'healthy' | 'warning' | 'critical' | 'offline';
  health?: number;
  size?: string;
  lastChecked?: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info' | 'resolved';
  description: string;
  databaseId: string;
  databaseName: string;
  detectedAt: string;
  status: 'investigating' | 'diagnosed' | 'resolving' | 'resolved';
  assignedAgent?: string;
  tags: string[];
}

export interface Task {
  id: string;
  agent_type: string;
  database_id?: string;
  status: 'queued' | 'running' | 'waiting_input' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  parameters: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  progress: number;
  current_step?: string;
  steps_completed: number;
  retries: number;
  max_retries: number;
  queued_at: string;
  started_at?: string;
  completed_at?: string;
  worker_id?: string;
  created_at: string;
  updated_at: string;
}

export interface KPIMetric {
  id: string;
  label: string;
  value: string | number;
  icon: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: string;
  color: string;
  glowColor: string;
}

export interface ChartDataPoint {
  time: string;
  latency: number;
  throughput?: number;
  errors?: number;
}

export interface ActivityFeedItem {
  id: string;
  type: 'investigation' | 'analysis' | 'connection' | 'model' | 'resolution';
  title: string;
  description: string;
  timestamp: string;
  agent?: string;
  database?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  type?: 'text' | 'command' | 'result' | 'thinking';
  metadata?: {
    command?: string;
    database?: string;
    confidence?: number;
  };
}

export interface SuggestedCommand {
  id: string;
  label: string;
  command: string;
  icon: string;
  description: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

export interface AgentRun {
  id: string;
  agentName: string;
  type: string;
  status: 'queued' | 'running' | 'waiting_input' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  duration?: string;
  databaseId?: string;
  databaseName?: string;
  summary: string;
  toolsUsed: string[];
  confidence: number;
  result?: Record<string, unknown>;
}