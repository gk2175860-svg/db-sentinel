import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Incident } from '@/types';
import { mockIncidents, severityColors } from '@/data/mockData';
import * as Icons from 'lucide-react';

export function IncidentsPage() {
  const [incidents] = useState<Incident[]>(mockIncidents);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info' | 'resolved'>('all');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'timeline' | 'analysis' | 'remediation'>('timeline');

  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch = incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.databaseName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || incident.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const incidentTimelines: Record<string, Array<{ time: string; event: string; agent?: string; type: 'info' | 'action' | 'evidence' | 'resolution' }>> = {
    'inc-1': [
      { time: '14:32', event: 'CPU usage exceeded 90% threshold', type: 'info' },
      { time: '14:33', event: 'Alert triggered: High CPU on prod-primary', type: 'info' },
      { time: '14:34', event: 'Query Optimizer agent started investigation', type: 'action', agent: 'Query Optimizer' },
      { time: '14:35', event: 'Evidence: Sequential scan on orders table (5.4M rows)', type: 'evidence', agent: 'Query Optimizer' },
      { time: '14:36', event: 'Evidence: Missing index on orders(user_id, created_at)', type: 'evidence', agent: 'Query Optimizer' },
      { time: '14:37', event: 'Hypothesis confirmed: Missing composite index (94% confidence)', type: 'evidence', agent: 'Query Optimizer' },
      { time: '14:38', event: 'Recommendation: Create index idx_orders_user_created', type: 'action', agent: 'Query Optimizer' },
    ],
    'inc-2': [
      { time: '13:15', event: 'Slow query detected on orders table', type: 'info' },
      { time: '13:16', event: 'SQL Generator agent started analysis', type: 'action', agent: 'SQL Generator' },
      { time: '13:17', event: 'Generated optimized query with CTE', type: 'action', agent: 'SQL Generator' },
      { time: '13:18', event: 'Incident diagnosed and indexed', type: 'resolution', agent: 'SQL Generator' },
    ],
  };

  const incidentAnalysis: Record<string, { rootCause: string; evidence: string[]; recommendations: string[]; confidence: number }> = {
    'inc-1': {
      rootCause: 'Missing composite index on orders(user_id, created_at) causing sequential scans on 5.4M row table',
      evidence: [
        'EXPLAIN ANALYZE shows sequential scan on orders table',
        'pg_stat_statements shows 2,847ms average query time',
        'No index exists on user_id or created_at columns',
        'Connection pool at 87/100 due to long-running queries',
      ],
      recommendations: [
        'Create index: CREATE INDEX idx_orders_user_created ON orders(user_id, created_at)',
        'Consider partitioning orders table by created_at (monthly)',
        'Add query timeout to prevent long-running queries',
      ],
      confidence: 94,
    },
    'inc-2': {
      rootCause: 'Inefficient JOIN between users and orders tables without proper indexing',
      evidence: [
        'JOIN query taking 1,923ms average',
        'Missing index on orders.user_id foreign key',
      ],
      recommendations: [
        'Create index on orders.user_id',
        'Consider denormalization for frequently accessed data',
      ],
      confidence: 91,
    },
  };

  const openDetail = (incident: Incident) => {
    setSelectedIncident(incident);
    setActiveDetailTab('timeline');
  };

  const closeDetail = () => {
    setSelectedIncident(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-db-text">Incidents</h1>
          <p className="text-db-text-secondary mt-1">Monitor and resolve database incidents</p>
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
                placeholder="Search incidents..."
                className="w-full pl-10 pr-4 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text placeholder-db-text-secondary focus:border-db-primary focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'critical', 'warning', 'info', 'resolved'].map((severity) => (
                <button
                  key={severity}
                  onClick={() => setSeverityFilter(severity as typeof severityFilter)}
                  className={cn(
                    'px-3 py-2 text-sm font-medium rounded-lg transition-all',
                    severityFilter === severity
                      ? severity === 'critical' ? 'bg-db-critical/20 text-db-critical border border-db-critical/30' :
                        severity === 'warning' ? 'bg-db-warning/20 text-db-warning border border-db-warning/30' :
                        severity === 'info' ? 'bg-db-primary/20 text-db-primary border border-db-primary/30' :
                        'bg-db-success/20 text-db-success border border-db-success/30'
                      : 'text-db-text-secondary hover:text-db-text hover:bg-db-secondary'
                  )}
                >
                  {severity.charAt(0).toUpperCase() + severity.slice(1)}
                  {severity !== 'all' && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-db-secondary rounded">
                      {incidents.filter(i => i.severity === severity).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-db-secondary">
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Incident</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Database</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Detected</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Agent</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-db-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-db-secondary/50">
              {filteredIncidents.map((incident) => (
                <motion.tr
                  key={incident.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-db-secondary/30 transition-colors cursor-pointer"
                  onClick={() => openDetail(incident)}
                >
                  <td className="px-4 py-4">
                    <p className="font-medium text-db-text truncate max-w-xs">{incident.title}</p>
                    <p className="text-xs text-db-text-secondary truncate max-w-xs">{incident.description}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                      severityColors[incident.severity]
                    )}>
                      {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-db-text-secondary">{incident.databaseName}</td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      severityColors[incident.status] || severityColors[incident.severity]
                    )}>
                      {incident.status.charAt(0).toUpperCase() + incident.status.slice(1).replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-db-text-secondary">{formatDate(incident.detectedAt)}</td>
                  <td className="px-4 py-4 text-sm text-db-text-secondary">
                    {incident.assignedAgent || '-'}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); openDetail(incident); }}
                      className="px-3 py-1.5 text-sm font-medium text-db-primary hover:bg-db-primary/10 rounded-lg transition-colors"
                    >
                      View Details
                    </button>
                  </td>
                </motion.tr>
              ))}
              {filteredIncidents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-db-text-secondary">
                    No incidents found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedIncident && (
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
                <div>
                  <h2 className="text-lg font-medium text-db-text">{selectedIncident.title}</h2>
                  <p className="text-sm text-db-text-secondary">{selectedIncident.databaseName} • {formatDate(selectedIncident.detectedAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'px-2 py-1 rounded-full text-xs font-medium',
                    severityColors[selectedIncident.severity]
                  )}>
                    {selectedIncident.severity.charAt(0).toUpperCase() + selectedIncident.severity.slice(1)}
                  </span>
                  <button
                    onClick={closeDetail}
                    className="p-1 text-db-text-secondary hover:text-db-text"
                  >
                    <Icons.X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="border-b border-db-secondary">
                <nav className="flex gap-1 p-1" aria-label="Incident detail tabs">
                  {[
                    { id: 'timeline', label: 'Timeline', icon: Icons.Activity },
                    { id: 'analysis', label: 'Root Cause Analysis', icon: Icons.Search },
                    { id: 'remediation', label: 'Remediation', icon: Icons.Wrench },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveDetailTab(tab.id as typeof activeDetailTab)}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                          activeDetailTab === tab.id
                            ? 'bg-db-primary/10 text-db-primary border border-db-primary/30'
                            : 'text-db-text-secondary hover:text-db-text hover:bg-db-secondary'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="p-4">
                {activeDetailTab === 'timeline' && (
                  <div className="space-y-4">
                    {incidentTimelines[selectedIncident.id]?.map((event, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-4 p-3 rounded-lg bg-db-secondary/50 relative"
                      >
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                          event.type === 'info' ? 'bg-db-primary/20 text-db-primary' :
                          event.type === 'action' ? 'bg-db-purple/20 text-db-purple' :
                          event.type === 'evidence' ? 'bg-db-cyan/20 text-db-cyan' :
                          'bg-db-success/20 text-db-success'
                        )}>
                          {event.type === 'info' && <Icons.Info className="w-4 h-4" />}
                          {event.type === 'action' && <Icons.Zap className="w-4 h-4" />}
                          {event.type === 'evidence' && <Icons.FileText className="w-4 h-4" />}
                          {event.type === 'resolution' && <Icons.CheckCircle className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-db-text">{event.event}</p>
                            <span className="text-xs text-db-text-secondary">{event.time}</span>
                          </div>
                          {event.agent && (
                            <p className="text-xs text-db-text-secondary flex items-center gap-1 mt-0.5">
                              <Icons.Bot className="w-3 h-3" />
                              {event.agent}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {activeDetailTab === 'analysis' && (
                  <div className="space-y-4">
                    {incidentAnalysis[selectedIncident.id] && (
                      <div>
                        <h3 className="font-medium text-db-text mb-2">Root Cause</h3>
                        <p className="text-db-text-secondary bg-db-secondary p-4 rounded-lg">{incidentAnalysis[selectedIncident.id].rootCause}</p>
                      </div>
                    )}
                    <div>
                      <h3 className="font-medium text-db-text mb-2">Supporting Evidence</h3>
                      <div className="space-y-2">
                        {incidentAnalysis[selectedIncident.id]?.evidence.map((evidence, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-3 rounded-lg bg-db-success/10 border border-db-success/30 text-sm text-db-text"
                          >
                            {evidence}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium text-db-text mb-2 flex items-center justify-between">
                        Confidence Score
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded-full',
                          incidentAnalysis[selectedIncident.id]!.confidence > 90 ? 'bg-db-success/20 text-db-success' :
                          incidentAnalysis[selectedIncident.id]!.confidence > 70 ? 'bg-db-warning/20 text-db-warning' : 'bg-db-critical/20 text-db-critical'
                        )}>
                          {incidentAnalysis[selectedIncident.id]!.confidence}%
                        </span>
                      </h3>
                      <div className="h-2 bg-db-secondary/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-db-primary rounded-full transition-all duration-500"
                          style={{ width: `${incidentAnalysis[selectedIncident.id]!.confidence}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeDetailTab === 'remediation' && (
                  <div className="space-y-4">
                    <div className="bg-db-critical/10 border border-db-critical/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icons.AlertTriangle className="w-5 h-5 text-db-critical" />
                        <h3 className="font-medium text-db-critical">Risk-Aware Action Gate</h3>
                      </div>
                      <p className="text-sm text-db-text-secondary mb-4">Review the following before executing remediation:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-db-text-secondary mb-1">Risk Level</p>
                          <p className="font-medium text-db-warning">Medium</p>
                        </div>
                        <div>
                          <p className="text-xs text-db-text-secondary mb-1">Potential Impact</p>
                          <p className="font-medium text-db-text">Query performance improvement</p>
                        </div>
                        <div>
                          <p className="text-xs text-db-text-secondary mb-1">Reversibility</p>
                          <p className="font-medium text-db-success">Reversible (DROP INDEX)</p>
                        </div>
                        <div>
                          <p className="text-xs text-db-text-secondary mb-1">Required Permissions</p>
                          <p className="font-medium text-db-text">CREATE INDEX</p>
                        </div>
                      </div>
                      <button className="w-full px-4 py-2 bg-db-primary text-db-text rounded-lg font-medium hover:bg-db-primary/90 transition-colors flex items-center justify-center gap-2">
                        <Icons.Shield className="w-4 h-4" />
                        Approve & Execute Remediation
                      </button>
                    </div>

                    <div>
                      <h3 className="font-medium text-db-text mb-2">Recommended Actions</h3>
                      <div className="space-y-2">
                        {incidentAnalysis[selectedIncident.id]?.recommendations.map((rec, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-3 rounded-lg bg-db-secondary border border-db-secondary flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-db-primary/20 flex items-center justify-center text-db-primary">
                                <Icons.Check className="w-4 h-4" />
                              </div>
                              <code className="text-sm text-db-text font-mono">{rec}</code>
                            </div>
                            <button className="px-3 py-1.5 text-sm font-medium text-db-primary hover:bg-db-primary/10 rounded-lg transition-colors">
                              Execute
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-db-secondary">
                      <h3 className="font-medium text-db-text mb-2">Independent Recovery Verification</h3>
                      <p className="text-sm text-db-text-secondary mb-3">After remediation, the system will verify:</p>
                      <ul className="space-y-2 text-sm text-db-text-secondary">
                        <li className="flex items-center gap-2"><Icons.Check className="w-4 h-4 text-db-success" /> Before/after latency comparison</li>
                        <li className="flex items-center gap-2"><Icons.Check className="w-4 h-4 text-db-success" /> CPU usage normalization</li>
                        <li className="flex items-center gap-2"><Icons.Check className="w-4 h-4 text-db-success" /> Connection pool health</li>
                        <li className="flex items-center gap-2"><Icons.Check className="w-4 h-4 text-db-success" /> Regression detection</li>
                      </ul>
                    </div>
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