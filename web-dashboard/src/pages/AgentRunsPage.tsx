import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { AgentRun } from '@/types';
import { mockAgentRuns, statusColors } from '@/data/mockData';
import { IconRenderer } from '@/components/dashboard/IconRenderer';

export function AgentRunsPage() {
  const [runs] = useState<AgentRun[]>(mockAgentRuns);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'completed' | 'failed' | 'cancelled'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'investigation' | 'optimization' | 'schema' | 'monitoring'>('all');
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);

  const filteredRuns = runs.filter(run => {
    const matchesSearch = run.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (run.databaseName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === 'all' || run.status === statusFilter;
    const matchesType = typeFilter === 'all' || run.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (startedAt: string, completedAt?: string) => {
    if (!completedAt) return 'Running...';
    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    const diff = end - start;
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const openDetail = (run: AgentRun) => {
    setSelectedRun(run);
  };

  const closeDetail = () => {
    setSelectedRun(null);
  };

  const getTypeColor = (type: AgentRun['type']) => {
    switch (type) {
      case 'investigation': return 'text-db-primary bg-db-primary/20';
      case 'optimization': return 'text-db-warning bg-db-warning/20';
      case 'schema': return 'text-db-purple bg-db-purple/20';
      case 'monitoring': return 'text-db-cyan bg-db-cyan/20';
      default: return 'text-db-text-secondary bg-db-secondary';
    }
  };

  const getTypeIconName = (type: AgentRun['type']) => {
    switch (type) {
      case 'investigation': return 'Search';
      case 'optimization': return 'Zap';
      case 'schema': return 'Layers';
      case 'monitoring': return 'Activity';
      default: return 'Bot';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-db-text">Agent Runs</h1>
          <p className="text-db-text-secondary mt-1">Monitor AI agent execution history and status</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-db-secondary rounded text-sm text-db-text-secondary">DEMO DATA</span>
        </div>
      </div>

      <div className="bg-db-card border border-db-secondary rounded-xl overflow-hidden">
        <div className="p-4 border-b border-db-secondary">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <IconRenderer name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-db-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search agent runs..."
                className="w-full pl-10 pr-4 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text placeholder-db-text-secondary focus:border-db-primary focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                className="px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text text-sm focus:border-db-primary focus:outline-none min-w-[140px]"
              >
                <option value="all">All Status</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
                className="px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text text-sm focus:border-db-primary focus:outline-none min-w-[140px]"
              >
                <option value="all">All Types</option>
                <option value="investigation">Investigation</option>
                <option value="optimization">Optimization</option>
                <option value="schema">Schema</option>
                <option value="monitoring">Monitoring</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-db-secondary">
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Agent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Database</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Started</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Confidence</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-db-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-db-secondary/50">
              {filteredRuns.map((run) => (
                <motion.tr
                  key={run.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-db-secondary/30 transition-colors cursor-pointer"
                  onClick={() => openDetail(run)}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-lg', getTypeColor(run.type))}>
                        <IconRenderer name={getTypeIconName(run.type)} className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-db-text">{run.agentName}</p>
                        <p className="text-xs text-db-text-secondary truncate max-w-xs">{run.summary}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="capitalize text-sm text-db-text-secondary">{run.type}</span>
                  </td>
                  <td className="px-4 py-4 text-sm text-db-text-secondary">{run.databaseName || 'N/A'}</td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                      statusColors[run.status]
                    )}>
                      {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-db-text-secondary">{formatDate(run.startedAt)}</td>
                  <td className="px-4 py-4 text-sm font-mono text-db-text">
                    {run.duration || formatDuration(run.startedAt, run.completedAt)}
                  </td>
                  <td className="px-4 py-4">
                    {run.confidence !== undefined && (
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-db-secondary/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-db-primary rounded-full transition-all duration-500"
                            style={{ width: `${run.confidence}%` }}
                          />
                        </div>
                        <span className={cn('text-xs font-medium', run.confidence > 90 ? 'text-db-success' : run.confidence > 70 ? 'text-db-warning' : 'text-db-critical')}>
                          {run.confidence}%
                        </span>
                      </div>
                    )}
                    {run.confidence === undefined && (
                      <span className="text-xs text-db-text-secondary">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); openDetail(run); }}
                      className="px-3 py-1.5 text-sm font-medium text-db-primary hover:bg-db-primary/10 rounded-lg transition-colors"
                    >
                      View Details
                    </button>
                  </td>
                </motion.tr>
              ))}
              {filteredRuns.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-db-text-secondary">
                    No agent runs found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedRun && (
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
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-db-card border border-db-secondary rounded-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-db-secondary">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', getTypeColor(selectedRun.type))}>
                    <IconRenderer name={getTypeIconName(selectedRun.type)} className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-db-text">{selectedRun.agentName}</h2>
                    <p className="text-sm text-db-text-secondary">{selectedRun.type.charAt(0).toUpperCase() + selectedRun.type.slice(1)} • {selectedRun.databaseName || 'No database'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'px-2 py-1 rounded-full text-xs font-medium',
                    statusColors[selectedRun.status]
                  )}>
                    {selectedRun.status.charAt(0).toUpperCase() + selectedRun.status.slice(1)}
                  </span>
                  <button
                    onClick={closeDetail}
                    className="p-1 text-db-text-secondary hover:text-db-text"
                  >
                    <IconRenderer name="X" className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-db-secondary rounded-lg">
                    <p className="text-xs text-db-text-secondary">Started</p>
                    <p className="font-medium text-db-text">{formatDate(selectedRun.startedAt)}</p>
                  </div>
                  <div className="p-4 bg-db-secondary rounded-lg">
                    <p className="text-xs text-db-text-secondary">Completed</p>
                    <p className="font-medium text-db-text">{selectedRun.completedAt ? formatDate(selectedRun.completedAt) : 'Running...'}</p>
                  </div>
                  <div className="p-4 bg-db-secondary rounded-lg">
                    <p className="text-xs text-db-text-secondary">Duration</p>
                    <p className="font-medium text-db-text font-mono">{selectedRun.duration || formatDuration(selectedRun.startedAt, selectedRun.completedAt)}</p>
                  </div>
                  <div className="p-4 bg-db-secondary rounded-lg">
                    <p className="text-xs text-db-text-secondary">Confidence</p>
                    <p className="font-medium text-db-text">{selectedRun.confidence !== undefined ? `${selectedRun.confidence}%` : 'N/A'}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-db-secondary">
                  <h3 className="font-medium text-db-text mb-3">Summary</h3>
                  <p className="text-db-text-secondary whitespace-pre-wrap">{selectedRun.summary}</p>
                </div>

                <div className="pt-4 border-t border-db-secondary">
                  <h3 className="font-medium text-db-text mb-3">Tools Used</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedRun.toolsUsed.map((tool, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="px-3 py-1 bg-db-primary/20 text-db-primary rounded-full text-sm font-medium"
                      >
                        {tool}
                      </motion.span>
                    ))}
                  </div>
                </div>

{selectedRun.status === 'completed' && selectedRun.confidence && selectedRun.confidence > 80 && (
                  <div className="pt-4 border-t border-db-secondary bg-db-success/10 border border-db-success/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <IconRenderer name="Shield" className="w-5 h-5 text-db-success" />
                      <h3 className="font-medium text-db-success">Independent Recovery Verification</h3>
                    </div>
                    <p className="text-sm text-db-text-secondary">This agent run has high confidence ({'>'}80%). After remediation, the system will automatically verify:</p>
                    <ul className="space-y-1 mt-2 text-sm text-db-text-secondary">
                      <li className="flex items-center gap-2"><IconRenderer name="Check" className="w-4 h-4 text-db-success" /> Before/after metrics comparison</li>
                      <li className="flex items-center gap-2"><IconRenderer name="Check" className="w-4 h-4 text-db-success" /> Recovery status confirmation</li>
                      <li className="flex items-center gap-2"><IconRenderer name="Check" className="w-4 h-4 text-db-success" /> Remaining issues detection</li>
                      <li className="flex items-center gap-2"><IconRenderer name="Check" className="w-4 h-4 text-db-success" /> Regression detection</li>
                    </ul>
                  </div>
                )}

                {selectedRun.result && (
                  <div className="pt-4 border-t border-db-secondary">
                    <h3 className="font-medium text-db-text mb-3">Result Details</h3>
                    <pre className="bg-db-secondary p-4 rounded-lg text-xs text-db-text-secondary overflow-x-auto font-mono max-h-64">
                      {JSON.stringify(selectedRun.result, null, 2)}
                    </pre>
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
