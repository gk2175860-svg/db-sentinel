import { cn } from '@/lib/utils';
import type { ResourceUsage } from '@/types';
import * as Icons from 'lucide-react';

interface CircularProgressProps {
  value: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  subLabel?: string;
}

function CircularProgress({ value, label, icon: Icon, color, subLabel }: CircularProgressProps) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-28 h-28" style={{ filter: `drop-shadow(0 0 12px ${color.replace('bg-', '').replace('/20', '')}80)` }}>
        <svg className="w-full h-full transform -rotate-90">
          <circle
            className="text-db-secondary"
            strokeWidth="4"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={64}
            cy={64}
          />
          <circle
            className={cn('transition-all duration-1000', color)}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            fill="transparent"
            r={radius}
            cx={64}
            cy={64}
            style={{ filter: `drop-shadow(0 0 8px ${color.replace('bg-', '').replace('/20', '')})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-8 h-8" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-db-text">{value}%</p>
        <p className="text-sm text-db-text-secondary">{label}</p>
        {subLabel && <p className="text-xs text-db-text-secondary/70">{subLabel}</p>}
      </div>
    </div>
  );
}

export function ResourceUsageDisplay({ usage }: { usage: ResourceUsage }) {
  return (
    <div className="bg-db-card border border-db-secondary rounded-xl p-5">
      <div className="mb-5">
        <h3 className="font-medium text-db-text">Resource Usage</h3>
        <p className="text-xs text-db-text-secondary">Current system utilization</p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <CircularProgress
          value={usage.cpu}
          label="CPU"
          icon={Icons.Cpu}
          color="text-db-primary"
          subLabel={`${usage.cpu > 80 ? 'High' : usage.cpu > 60 ? 'Moderate' : 'Normal'}`}
        />
        <CircularProgress
          value={usage.memory}
          label="Memory"
          icon={Icons.HardDrive}
          color="text-db-cyan"
          subLabel={`${usage.memory > 80 ? 'High' : usage.memory > 60 ? 'Moderate' : 'Normal'}`}
        />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="p-3 bg-db-secondary rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-db-text-secondary">Disk</span>
            <span className="text-sm font-medium text-db-text">{usage.disk}%</span>
          </div>
          <div className="h-2 bg-db-secondary/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-db-purple rounded-full transition-all duration-500"
              style={{ width: `${usage.disk}%` }}
            />
          </div>
        </div>
        <div className="p-3 bg-db-secondary rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-db-text-secondary">Network</span>
            <span className="text-sm font-medium text-db-text">{usage.network}%</span>
          </div>
          <div className="h-2 bg-db-secondary/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-db-success rounded-full transition-all duration-500"
              style={{ width: `${usage.network}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}