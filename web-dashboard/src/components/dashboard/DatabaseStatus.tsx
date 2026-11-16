import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Database } from '@/types';
import { statusColors, databaseTypeIcons } from '@/data/mockData';
import { IconRenderer } from './IconRenderer';

interface DatabaseStatusProps {
  databases: Database[];
}

export function DatabaseStatus({ databases }: DatabaseStatusProps) {
  return (
    <div className="bg-db-card border border-db-secondary rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-medium text-db-text">Database Status</h3>
          <p className="text-xs text-db-text-secondary">Connected databases overview</p>
        </div>
        <button className="text-sm text-db-primary hover:text-db-cyan font-medium">
          View all
        </button>
      </div>

      <div className="space-y-3">
        {databases.map((db, index) => (
          <motion.div
            key={db.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-4 p-3 rounded-lg hover:bg-db-secondary/50 transition-colors"
          >
            <div className={cn(
              'p-2 rounded-lg',
              `bg-${db.type === 'postgresql' ? 'blue' : db.type === 'mysql' ? 'cyan' : db.type === 'sqlite' ? 'green' : db.type === 'sqlserver' ? 'blue' : 'amber'}-500/20`,
              `text-${db.type === 'postgresql' ? 'blue' : db.type === 'mysql' ? 'cyan' : db.type === 'sqlite' ? 'green' : db.type === 'sqlserver' ? 'blue' : 'amber'}-400`
            )}>
              <IconRenderer name={databaseTypeIcons[db.type] || 'Database'} className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-db-text truncate">{db.name}</h4>
                <span className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-full',
                  statusColors[db.status]
                )}>
                  {db.status.charAt(0).toUpperCase() + db.status.slice(1)}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-db-text-secondary">
                <span className="flex items-center gap-1">
                  <IconRenderer name="Server" className="w-3 h-3" />
                  {db.type.toUpperCase()}
                </span>
                <span className="flex items-center gap-1">
                  <IconRenderer name="HardDrive" className="w-3 h-3" />
                  {db.size}
                </span>
                <span className="flex items-center gap-1">
                  <IconRenderer name="Activity" className="w-3 h-3" />
                  {db.health}% health
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-db-secondary/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${db.health}%`,
                    backgroundColor: db.health > 90 ? '#00D69A' : db.health > 70 ? '#FFB547' : '#FF405A'
                  }}
                />
              </div>
              <span className={cn('text-xs font-medium', db.health > 90 ? 'text-db-success' : db.health > 70 ? 'text-db-warning' : 'text-db-critical')}>
                {db.health}%
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}