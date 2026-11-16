import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { IconRenderer } from '@/components/dashboard/IconRenderer';
import * as Icons from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  userRole: string;
  action: string;
  actionType: 'create' | 'update' | 'delete' | 'execute' | 'approve' | 'deny' | 'login' | 'logout';
  database?: string;
  agent?: string;
  status: 'success' | 'failed' | 'pending';
  approvalRequired: boolean;
  approvedBy?: string;
  approvedAt?: string;
  details?: string;
}

const mockAuditLogs: AuditLog[] = [
  { id: 'audit-1', timestamp: '2024-01-15T14:45:23Z', user: 'alex.chen', userRole: 'Administrator', action: 'Created index idx_orders_user_created on orders table', actionType: 'execute', database: 'prod-primary', agent: 'Query Optimizer', status: 'success', approvalRequired: true, approvedBy: 'sarah.johnson', approvedAt: '2024-01-15T14:44:10Z', details: 'Migration applied successfully. Query latency reduced from 2,847ms to 142ms.' },
  { id: 'audit-2', timestamp: '2024-01-15T14:30:12Z', user: 'system', userRole: 'System', action: 'Agent run started: Query Optimizer investigation', actionType: 'execute', database: 'prod-primary', agent: 'Query Optimizer', status: 'success', approvalRequired: false },
  { id: 'audit-3', timestamp: '2024-01-15T13:15:45Z', user: 'alex.chen', userRole: 'Administrator', action: 'Approved index creation on orders table', actionType: 'approve', database: 'prod-primary', agent: 'Query Optimizer', status: 'success', approvalRequired: true, approvedBy: 'alex.chen', approvedAt: '2024-01-15T13:15:45Z' },
  { id: 'audit-4', timestamp: '2024-01-15T13:10:22Z', user: 'system', userRole: 'System', action: 'Agent run started: SQL Generator query optimization', actionType: 'execute', database: 'prod-primary', agent: 'SQL Generator', status: 'success', approvalRequired: false },
  { id: 'audit-5', timestamp: '2024-01-15T11:45:30Z', user: 'system', userRole: 'System', action: 'Agent run started: Monitor connection pool analysis', actionType: 'execute', database: 'analytics-replica', agent: 'Monitor', status: 'success', approvalRequired: false },
  { id: 'audit-6', timestamp: '2024-01-15T10:22:18Z', user: 'jane.smith', userRole: 'DBA', action: 'Updated database connection: analytics-replica', actionType: 'update', database: 'analytics-replica', status: 'success', approvalRequired: false },
  { id: 'audit-7', timestamp: '2024-01-15T09:30:05Z', user: 'system', userRole: 'System', action: 'Agent run started: Schema Manager drift detection', actionType: 'execute', database: 'prod-primary', agent: 'Schema Manager', status: 'success', approvalRequired: false },
  { id: 'audit-8', timestamp: '2024-01-15T08:15:40Z', user: 'mike.wilson', userRole: 'Developer', action: 'Login successful', actionType: 'login', status: 'success', approvalRequired: false },
  { id: 'audit-9', timestamp: '2024-01-15T07:45:22Z', user: 'system', userRole: 'System', action: 'Scheduled health check completed', actionType: 'execute', database: 'all', status: 'success', approvalRequired: false },
  { id: 'audit-10', timestamp: '2024-01-15T06:00:00Z', user: 'system', userRole: 'System', action: 'Backup verification completed', actionType: 'execute', database: 'prod-primary', status: 'success', approvalRequired: false },
  { id: 'audit-11', timestamp: '2024-01-14T22:30:15Z', user: 'sarah.johnson', userRole: 'Administrator', action: 'Denied index creation on users table', actionType: 'deny', database: 'prod-primary', agent: 'Query Optimizer', status: 'failed', approvalRequired: true, approvedBy: 'sarah.johnson', approvedAt: '2024-01-14T22:30:15Z', details: 'Insufficient evidence for index recommendation. Confidence below threshold.' },
  { id: 'audit-12', timestamp: '2024-01-14T20:15:30Z', user: 'alex.chen', userRole: 'Administrator', action: 'Created new database connection: cache-cluster', actionType: 'create', database: 'cache-cluster', status: 'success', approvalRequired: false },
  { id: 'audit-13', timestamp: '2024-01-14T18:45:00Z', user: 'system', userRole: 'System', action: 'Agent run failed: Data Quality profiler timeout', actionType: 'execute', database: 'doc-store', agent: 'Data Quality', status: 'failed', approvalRequired: false, details: 'Connection timeout after 300s. Retrying...' },
  { id: 'audit-14', timestamp: '2024-01-14T16:20:45Z', user: 'jane.smith', userRole: 'DBA', action: 'Updated SSL configuration for prod-primary', actionType: 'update', database: 'prod-primary', status: 'success', approvalRequired: false },
  { id: 'audit-15', timestamp: '2024-01-14T14:10:20Z', user: 'system', userRole: 'System', action: 'Agent run started: Data Quality column profiling', actionType: 'execute', database: 'doc-store', agent: 'Data Quality', status: 'success', approvalRequired: false },
];

const actionTypeColors: Record<string, string> = {
  create: 'bg-db-success/20 text-db-success',
  update: 'bg-db-primary/20 text-db-primary',
  delete: 'bg-db-critical/20 text-db-critical',
  execute: 'bg-db-purple/20 text-db-purple',
  approve: 'bg-db-success/20 text-db-success',
  deny: 'bg-db-critical/20 text-db-critical',
  login: 'bg-db-cyan/20 text-db-cyan',
  logout: 'bg-db-text-secondary/20 text-db-text-secondary',
};

export function AuditPage() {
  const [logs] = useState<AuditLog[]>(mockAuditLogs);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'create' | 'update' | 'delete' | 'execute' | 'approve' | 'deny' | 'login' | 'logout'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('today');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.database?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (log.agent?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesAction = actionFilter === 'all' || log.actionType === actionFilter;
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    return matchesSearch && matchesAction && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const openDetail = (log: AuditLog) => {
    setSelectedLog(log);
  };

  const closeDetail = () => {
    setSelectedLog(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-db-text">Audit Logs</h1>
          <p className="text-db-text-secondary mt-1">Track all system actions, approvals, and agent activities</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-db-secondary rounded text-sm text-db-text-secondary">DEMO DATA</span>
        </div>
      </div>

      <div className="bg-db-card border border-db-secondary rounded-xl overflow-hidden">
        <div className="p-4 border-b border-db-secondary">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-db-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search audit logs..."
                className="w-full pl-10 pr-4 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text placeholder-db-text-secondary focus:border-db-primary focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value as typeof actionFilter)}
                className="px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text text-sm focus:border-db-primary focus:outline-none min-w-[140px]"
              >
                <option value="all">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="execute">Execute</option>
                <option value="approve">Approve</option>
                <option value="deny">Deny</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                className="px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text text-sm focus:border-db-primary focus:outline-none min-w-[120px]"
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value as typeof dateFilter)}
                className="px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text text-sm focus:border-db-primary focus:outline-none min-w-[120px]"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-db-secondary">
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Database</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Agent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Approval</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-db-text-secondary uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-db-secondary/50">
              {filteredLogs.map((log, index) => (
                <motion.tr
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-db-secondary/30 transition-colors cursor-pointer"
                  onClick={() => openDetail(log)}
                >
                  <td className="px-4 py-3 font-mono text-sm text-db-text-secondary whitespace-nowrap">{formatDate(log.timestamp)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-db-primary/20 flex items-center justify-center text-xs font-medium text-db-primary">
                        {log.user.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-db-text">{log.user}</p>
                        <p className="text-xs text-db-text-secondary">{log.userRole}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-db-text max-w-xs truncate">{log.action}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      actionTypeColors[log.actionType]
                    )}>
                      <IconRenderer name={log.actionType} className="w-3 h-3 mr-1" />
                      {log.actionType.charAt(0).toUpperCase() + log.actionType.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-db-text-secondary">{log.database || '-'}</td>
                  <td className="px-4 py-3 text-sm text-db-text-secondary">{log.agent || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      log.status === 'success' ? 'bg-db-success/20 text-db-success border border-db-success/30' :
                      log.status === 'failed' ? 'bg-db-critical/20 text-db-critical border border-db-critical/30' :
                      'bg-db-warning/20 text-db-warning border border-db-warning/30'
                    )}>
                      {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {log.approvalRequired ? (
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        log.approvedBy ? 'bg-db-success/20 text-db-success border border-db-success/30' : 'bg-db-warning/20 text-db-warning border border-db-warning/30'
                      )}>
                        {log.approvedBy ? `Approved by ${log.approvedBy}` : 'Pending'}
                      </span>
                    ) : (
                      <span className="text-xs text-db-text-secondary">Not required</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); openDetail(log); }}
                      className="px-3 py-1.5 text-sm font-medium text-db-primary hover:bg-db-primary/10 rounded-lg transition-colors"
                    >
                      View
                    </button>
                  </td>
                </motion.tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-db-text-secondary">
                    No audit logs found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={closeDetail}
          >
            <div className="fixed inset-0 bg-black/50" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-db-card border border-db-secondary rounded-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-db-secondary">
                <div>
                  <h2 className="text-lg font-medium text-db-text">Audit Log Details</h2>
                  <p className="text-sm text-db-text-secondary">{formatDate(selectedLog.timestamp)}</p>
                </div>
                <button
                  onClick={closeDetail}
                  className="p-1 text-db-text-secondary hover:text-db-text"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-db-secondary rounded-lg">
                    <p className="text-xs text-db-text-secondary mb-1">Action ID</p>
                    <p className="font-mono text-sm text-db-text">{selectedLog.id}</p>
                  </div>
                  <div className="p-4 bg-db-secondary rounded-lg">
                    <p className="text-xs text-db-text-secondary mb-1">Timestamp</p>
                    <p className="font-mono text-sm text-db-text">{formatDate(selectedLog.timestamp)}</p>
                  </div>
                  <div className="p-4 bg-db-secondary rounded-lg">
                    <p className="text-xs text-db-text-secondary mb-1">User</p>
                    <p className="text-sm font-medium text-db-text">{selectedLog.user}</p>
                  </div>
                  <div className="p-4 bg-db-secondary rounded-lg">
                    <p className="text-xs text-db-text-secondary mb-1">Role</p>
                    <p className="text-sm text-db-text-secondary">{selectedLog.userRole}</p>
                  </div>
                  <div className="p-4 bg-db-secondary rounded-lg">
                    <p className="text-xs text-db-text-secondary mb-1">Action Type</p>
                    <span className={cn(
                      'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                      actionTypeColors[selectedLog.actionType]
                    )}>
                      <IconRenderer name={selectedLog.actionType} className="w-3 h-3 mr-1" />
                      {selectedLog.actionType.charAt(0).toUpperCase() + selectedLog.actionType.slice(1)}
                    </span>
                  </div>
                  <div className="p-4 bg-db-secondary rounded-lg">
                    <p className="text-xs text-db-text-secondary mb-1">Status</p>
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      selectedLog.status === 'success' ? 'bg-db-success/20 text-db-success border border-db-success/30' :
                      selectedLog.status === 'failed' ? 'bg-db-critical/20 text-db-critical border border-db-critical/30' :
                      'bg-db-warning/20 text-db-warning border border-db-warning/30'
                    )}>
                      {selectedLog.status.charAt(0).toUpperCase() + selectedLog.status.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-db-secondary">
                  <h3 className="font-medium text-db-text mb-3">Action Description</h3>
                  <p className="text-db-text-secondary whitespace-pre-wrap">{selectedLog.action}</p>
                </div>

                {selectedLog.database && (
                  <div className="pt-4 border-t border-db-secondary">
                    <h3 className="font-medium text-db-text mb-3">Database</h3>
                    <p className="text-db-text-secondary">{selectedLog.database}</p>
                  </div>
                )}

                {selectedLog.agent && (
                  <div className="pt-4 border-t border-db-secondary">
                    <h3 className="font-medium text-db-text mb-3">Agent</h3>
                    <p className="text-db-text-secondary">{selectedLog.agent}</p>
                  </div>
                )}

                {selectedLog.approvalRequired && (
                  <div className="pt-4 border-t border-db-secondary bg-db-warning/10 border border-db-warning/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <IconRenderer name="Shield" className="w-5 h-5 text-db-warning" />
                      <h3 className="font-medium text-db-warning">Approval Required</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-db-text-secondary mb-1">Approval Status</p>
                        <p className={cn('font-medium', selectedLog.approvedBy ? 'text-db-success' : 'text-db-warning')}>
                          {selectedLog.approvedBy ? 'Approved' : 'Pending Approval'}
                        </p>
                      </div>
                      {selectedLog.approvedBy && (
                        <>
                          <div>
                            <p className="text-xs text-db-text-secondary mb-1">Approved By</p>
                            <p className="font-medium text-db-text">{selectedLog.approvedBy}</p>
                          </div>
                          <div>
                            <p className="text-xs text-db-text-secondary mb-1">Approved At</p>
                            <p className="font-mono text-sm text-db-text">{selectedLog.approvedAt ? formatDate(selectedLog.approvedAt) : '-'}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {selectedLog.details && (
                  <div className="pt-4 border-t border-db-secondary">
                    <h3 className="font-medium text-db-text mb-3">Additional Details</h3>
                    <p className="text-db-text-secondary bg-db-secondary p-4 rounded-lg">{selectedLog.details}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}