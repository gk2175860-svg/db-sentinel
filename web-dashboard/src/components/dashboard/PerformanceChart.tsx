import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { ChartDataPoint } from '@/types';

interface PerformanceChartProps {
  data: ChartDataPoint[];
}

const timeFilters = ['1H', '6H', '24H', '7D'] as const;
type TimeFilter = typeof timeFilters[number];

export function PerformanceChart({ data }: PerformanceChartProps) {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('24H');

  const filteredData = data; // In real app, filter based on activeFilter

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-db-card border border-db-secondary rounded-lg p-3 shadow-lg">
          <p className="text-xs text-db-text-secondary mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
              {entry.name}: {entry.value}ms
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-db-card border border-db-secondary rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-medium text-db-text">Query Performance</h3>
          <p className="text-xs text-db-text-secondary">Latency over time</p>
        </div>
        <div className="flex items-center gap-1">
          {timeFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-lg transition-all',
                activeFilter === filter
                  ? 'bg-db-primary text-db-text'
                  : 'text-db-text-secondary hover:text-db-text hover:bg-db-secondary'
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filteredData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              className="stroke-db-secondary/50" 
              vertical={false}
            />
            <XAxis
              dataKey="time"
              className="text-db-text-secondary"
              tick={{ fontSize: 11, fill: '#91A4C7' }}
              axisLine={{ stroke: '#0C1D3A' }}
              tickLine={false}
            />
            <YAxis
              className="text-db-text-secondary"
              tick={{ fontSize: 11, fill: '#91A4C7' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={customTooltip} />
            <Legend 
              wrapperStyle={{ paddingTop: 10 }} 
              formatter={(value) => [
                'Latency (ms)',
                'Throughput (q/s)',
                'Errors',
              ][value] || value}
            />
            <Line
              type="monotone"
              dataKey="latency"
              name="Latency"
              stroke="#078BFF"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: '#078BFF' }}
            />
            <Line
              type="monotone"
              dataKey="throughput"
              name="Throughput"
              stroke="#00D9FF"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: '#00D9FF' }}
              yAxisId="right"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-db-secondary">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-db-primary" />
            <span className="text-db-text-secondary">Latency</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-db-cyan" />
            <span className="text-db-text-secondary">Throughput</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-db-text-secondary">Peak Load</p>
          <p className="font-medium text-db-warning">89ms at 16:00</p>
        </div>
      </div>
    </div>
  );
}