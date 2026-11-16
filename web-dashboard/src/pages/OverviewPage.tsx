import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { KPICard } from '@/components/dashboard/KPICard';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { ResourceUsageDisplay } from '@/components/dashboard/ResourceUsage';
import { RecentIncidents } from '@/components/dashboard/RecentIncidents';
import { DatabaseStatus } from '@/components/dashboard/DatabaseStatus';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { PromoCard } from '@/components/dashboard/PromoCard';
import { mockChartData, mockResourceUsage, mockIncidents, mockActivityFeed } from '@/data/mockData';
import { api } from '@/services/api';

export function OverviewPage() {
  const { data: databases = [] } = useQuery({
    queryKey: ['databases'],
    queryFn: api.getDatabases,
  });

  // Compute UI fields from API data
  const databasesWithUI = databases.map(db => ({
    ...db,
    status: (db.last_test_status === 'success' ? 'healthy' : db.last_test_status === 'failed' ? 'critical' : 'healthy') as 'healthy' | 'warning' | 'critical' | 'offline',
    health: db.last_test_status === 'success' ? 95 : db.last_test_status === 'failed' ? 40 : 85,
    size: 'Unknown',
    lastChecked: db.last_tested_at ? new Date(db.last_tested_at).toLocaleString() : 'Never',
    tags: db.tags || [],
  }));

  const connectedCount = databasesWithUI.filter(db => db.is_active).length;
  const healthyCount = databasesWithUI.filter(db => db.status === 'healthy').length;
  const healthPercent = connectedCount > 0 ? Math.round((healthyCount / connectedCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-db-text">Overview</h1>
          <p className="text-db-text-secondary mt-1">Database health and performance at a glance</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-db-text-secondary">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-db-success animate-pulse" />
            Live
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <KPICard metric={{
          id: 'databases',
          label: 'Connected Databases',
          value: connectedCount,
          icon: 'Database',
          trend: 'stable',
          trendValue: '',
          color: 'bg-blue-500/20',
          glowColor: 'glow-blue',
        }} />
        <KPICard metric={{
          id: 'health',
          label: 'Database Health',
          value: `${healthPercent}%`,
          icon: 'HeartPulse',
          trend: healthPercent >= 90 ? 'up' : healthPercent >= 70 ? 'stable' : 'down',
          trendValue: healthPercent >= 90 ? 'Excellent' : healthPercent >= 70 ? 'Good' : 'Needs Attention',
          color: healthPercent >= 90 ? 'bg-green-500/20' : healthPercent >= 70 ? 'bg-amber-500/20' : 'bg-red-500/20',
          glowColor: healthPercent >= 90 ? 'glow-success' : healthPercent >= 70 ? 'glow-warning' : 'glow-critical',
        }} />
        <KPICard metric={{
          id: 'active',
          label: 'Active Connections',
          value: databasesWithUI.filter(db => db.status === 'healthy').length,
          icon: 'Activity',
          trend: 'stable',
          trendValue: '',
          color: 'bg-cyan-500/20',
          glowColor: 'glow-cyan',
        }} />
        <KPICard metric={{
          id: 'types',
          label: 'DB Types',
          value: new Set(databasesWithUI.map(db => db.type)).size,
          icon: 'Layers',
          trend: 'stable',
          trendValue: '',
          color: 'bg-purple-500/20',
          glowColor: 'glow-purple',
        }} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        <div className="lg:col-span-2">
          <PerformanceChart data={mockChartData} />
        </div>
        <div>
          <ResourceUsageDisplay usage={mockResourceUsage} />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        <RecentIncidents incidents={mockIncidents} />
        <DatabaseStatus databases={databasesWithUI} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        <ActivityFeed activities={mockActivityFeed} />
        <PromoCard />
      </motion.div>
    </div>
  );
}