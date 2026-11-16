import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Incident } from '@/types';
import { severityColors } from '@/data/mockData';
import { IconRenderer } from './IconRenderer';

interface RecentIncidentsProps {
  incidents: Incident[];
}

export function RecentIncidents({ incidents }: RecentIncidentsProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="bg-db-card border border-db-secondary rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-medium text-db-text">Recent Incidents</h3>
          <p className="text-xs text-db-text-secondary">Active and recent alerts</p>
        </div>
        <button className="text-sm text-db-primary hover:text-db-cyan font-medium">
          View all
        </button>
      </div>

      <div className="space-y-3">
        {incidents.map((incident, index) => (
          <motion.div
            key={incident.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              'p-4 rounded-lg border transition-all hover:border-db-primary/50',
              severityColors[incident.severity]
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'p-1.5 rounded',
                severityColors[incident.severity].replace('bg-', 'bg-').replace('text-', 'text-').replace('border-', 'border-')
              )}>
                <IconRenderer name={incident.severity} className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-medium text-db-text truncate">{incident.title}</h4>
                  <span className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded-full',
                    severityColors[incident.status] || severityColors[incident.severity]
                  )}>
                    {incident.status.charAt(0).toUpperCase() + incident.status.slice(1).replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-db-text-secondary mt-1 line-clamp-1">{incident.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-db-text-secondary">
                  <span className="flex items-center gap-1">
                    <IconRenderer name="Database" className="w-3 h-3" />
                    {incident.databaseName}
                  </span>
                  <span className="flex items-center gap-1">
                    <IconRenderer name="Clock" className="w-3 h-3" />
                    {formatTime(incident.detectedAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <IconRenderer name="Tag" className="w-3 h-3" />
                    {incident.tags.slice(0, 2).join(', ')}
                    {incident.tags.length > 2 && ` +${incident.tags.length - 2}`}
                  </span>
                </div>
              </div>
              <button className="px-3 py-1.5 text-xs font-medium text-db-primary hover:bg-db-primary/10 rounded-lg transition-colors flex-shrink-0">
                Investigate
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}