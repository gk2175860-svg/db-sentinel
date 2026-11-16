import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ActivityFeedItem } from '@/types';
import { IconRenderer } from './IconRenderer';
import * as Icons from 'lucide-react';

interface ActivityFeedProps {
  activities: ActivityFeedItem[];
}

const activityColors = {
  investigation: 'text-db-primary bg-db-primary/20',
  analysis: 'text-db-cyan bg-db-cyan/20',
  connection: 'text-db-success bg-db-success/20',
  model: 'text-db-purple bg-db-purple/20',
  resolution: 'text-db-success bg-db-success/20',
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const formatTime = (timeString: string) => {
    if (timeString.includes('ago')) return timeString;
    const date = new Date(timeString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${diffHours}h ago`;
  };

  return (
    <div className="bg-db-card border border-db-secondary rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-medium text-db-text">Live Activity Feed</h3>
          <p className="text-xs text-db-text-secondary">Real-time agent and system events</p>
        </div>
        <button className="text-sm text-db-primary hover:text-db-cyan font-medium">
          View all
        </button>
      </div>

      <div className="space-y-3">
        {activities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-db-secondary/50 transition-colors"
          >
            <div className={cn(
              'p-2 rounded-lg flex-shrink-0',
              activityColors[activity.type as keyof typeof activityColors]
            )}>
              <IconRenderer name={activity.type} className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-db-text">{activity.title}</h4>
                <span className="text-xs text-db-text-secondary whitespace-nowrap">
                  {formatTime(activity.timestamp)}
                </span>
              </div>
              <p className="text-sm text-db-text-secondary mt-0.5">{activity.description}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-db-text-secondary">
                {activity.agent && (
                  <span className="flex items-center gap-1">
                    <Icons.Bot className="w-3 h-3" />
                    {activity.agent}
                  </span>
                )}
                {activity.database && (
                  <span className="flex items-center gap-1">
                    <Icons.Database className="w-3 h-3" />
                    {activity.database}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}