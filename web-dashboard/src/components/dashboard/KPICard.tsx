import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { KPIMetric } from '@/types';
import * as Icons from 'lucide-react';

interface KPICardProps {
  metric: KPIMetric;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Database: Icons.Database,
  HeartPulse: Icons.HeartPulse,
  AlertTriangle: Icons.AlertTriangle,
  Clock: Icons.Clock,
};

export function KPICard({ metric }: KPICardProps) {
  const Icon = iconMap[metric.icon] || Icons.Database;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'relative p-5 rounded-xl bg-db-card border border-db-secondary',
        'overflow-hidden transition-all duration-300 hover:border-db-primary/50',
        metric.glowColor
      )}
      whileHover={{ y: -2, boxShadow: '0 10px 30px -10px rgba(7, 139, 255, 0.2)' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-db-primary/5 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
      
      <div className="relative flex items-start justify-between">
        <div className={cn('p-2 rounded-lg', metric.color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-1 text-xs">
          {metric.trend === 'up' && <Icons.TrendingUp className="w-3 h-3 text-db-success" />}
          {metric.trend === 'down' && <Icons.TrendingDown className="w-3 h-3 text-db-critical" />}
          {metric.trend === 'stable' && <Icons.Minus className="w-3 h-3 text-db-text-secondary" />}
          <span className={cn(
            'font-medium',
            metric.trend === 'up' && 'text-db-success',
            metric.trend === 'down' && 'text-db-critical',
            metric.trend === 'stable' && 'text-db-text-secondary'
          )}>
            {metric.trendValue}
          </span>
        </div>
      </div>

      <div className="mt-4 relative">
        <p className="text-3xl font-bold text-db-text">{metric.value}</p>
        <p className="text-sm text-db-text-secondary mt-1">{metric.label}</p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-db-primary/50 to-db-cyan/50 opacity-0 hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}