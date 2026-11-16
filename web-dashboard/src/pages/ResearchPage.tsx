import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import * as Icons from 'lucide-react';

const modelComparisonData = [
  { model: 'GPT-4o', accuracy: 94, coverage: 91, verification: 96, unsafeRate: 2 },
  { model: 'Claude-3.5-Sonnet', accuracy: 92, coverage: 89, verification: 94, unsafeRate: 3 },
  { model: 'Llama-3.1-70B', accuracy: 88, coverage: 85, verification: 90, unsafeRate: 5 },
  { model: 'Llama-3.1-8B', accuracy: 82, coverage: 78, verification: 85, unsafeRate: 8 },
  { model: 'CodeLlama-13B', accuracy: 85, coverage: 82, verification: 88, unsafeRate: 6 },
];

const experimentHistory = [
  { id: 'exp-1', name: 'SQL Generation Accuracy v2.1', date: '2024-01-15', models: 'GPT-4o vs Llama-3.1-70B', status: 'completed', winner: 'GPT-4o', improvement: '+3.2%' },
  { id: 'exp-2', name: 'Index Recommendation Quality', date: '2024-01-14', models: 'Claude-3.5 vs CodeLlama', status: 'completed', winner: 'Claude-3.5', improvement: '+1.8%' },
  { id: 'exp-3', name: 'Schema Drift Detection', date: '2024-01-13', models: 'All models', status: 'running', winner: '-', improvement: '-' },
  { id: 'exp-4', name: 'Query Optimization Cost', date: '2024-01-12', models: 'GPT-4o vs Llama-3.1-8B', status: 'completed', winner: 'GPT-4o', improvement: '+5.1%' },
  { id: 'exp-5', name: 'Incident Diagnosis Speed', date: '2024-01-11', models: 'Claude-3.5 vs GPT-4o', status: 'completed', winner: 'Claude-3.5', improvement: '+2.4%' },
];

const accuracyTrendData = [
  { week: 'Week 1', gpt4o: 91, claude: 89, llama70b: 85, llama8b: 79 },
  { week: 'Week 2', gpt4o: 92, claude: 90, llama70b: 86, llama8b: 80 },
  { week: 'Week 3', gpt4o: 93, claude: 91, llama70b: 87, llama8b: 81 },
  { week: 'Week 4', gpt4o: 94, claude: 92, llama70b: 88, llama8b: 82 },
];

const costData = [
  { model: 'GPT-4o', cost: 124.50, requests: 2450, avgCost: 0.051 },
  { model: 'Claude-3.5', cost: 89.30, requests: 1890, avgCost: 0.047 },
  { model: 'Llama-3.1-70B', cost: 0, requests: 3200, avgCost: 0 },
  { model: 'Llama-3.1-8B', cost: 0, requests: 5100, avgCost: 0 },
  { model: 'CodeLlama-13B', cost: 0, requests: 1500, avgCost: 0 },
];

const COLORS = ['#078BFF', '#00D9FF', '#9255FF', '#FFB547', '#00D69A'];

export function ResearchPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'experiments' | 'costs'>('overview');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-db-text">Research & Evaluation</h1>
          <p className="text-db-text-secondary mt-1">Model performance, experiment tracking, and evaluation metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-db-secondary rounded text-sm text-db-text-secondary">DEMO DATA</span>
        </div>
      </div>

      <div className="border-b border-db-secondary">
        <nav className="flex gap-1 p-1" aria-label="Research tabs">
          {[
            { id: 'overview', label: 'Overview', icon: Icons.BarChart3 },
            { id: 'models', label: 'Model Comparison', icon: Icons.Cpu },
            { id: 'experiments', label: 'Experiments', icon: Icons.FlaskConical },
            { id: 'costs', label: 'Cost Analysis', icon: Icons.DollarSign },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  activeTab === tab.id
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

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Diagnosis Accuracy', value: '91.2%', trend: '+2.1%', color: 'bg-db-primary/20', icon: Icons.Target },
              { label: 'Evidence Coverage', value: '87.5%', trend: '+1.8%', color: 'bg-db-cyan/20', icon: Icons.FileText },
              { label: 'Verification Success', value: '93.8%', trend: '+0.9%', color: 'bg-db-success/20', icon: Icons.CheckCircle },
              { label: 'Unsafe Action Rate', value: '3.2%', trend: '-1.1%', color: 'bg-db-warning/20', icon: Icons.Shield },
            ].map((metric, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-5 rounded-xl bg-db-card border border-db-secondary"
              >
                <div className="flex items-center justify-between">
                  <div className={cn('p-2 rounded-lg', metric.color)}>
                    <metric.icon className="w-5 h-5 text-db-primary" />
                  </div>
                  <span className="text-xs font-medium text-db-success">{metric.trend}</span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-db-text">{metric.value}</p>
                  <p className="text-sm text-db-text-secondary mt-1">{metric.label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-db-card border border-db-secondary rounded-xl p-5"
            >
              <h3 className="font-medium text-db-text mb-4">Accuracy Trend (4 Weeks)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={accuracyTrendData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-db-secondary/50" vertical={false} />
                    <XAxis dataKey="week" className="text-db-text-secondary" tick={{ fontSize: 11, fill: '#91A4C7' }} axisLine={{ stroke: '#0C1D3A' }} tickLine={false} />
                    <YAxis className="text-db-text-secondary" tick={{ fontSize: 11, fill: '#91A4C7' }} axisLine={false} tickLine={false} domain={[70, 100]} />
                    <Tooltip />
                    <Legend wrapperStyle={{ paddingTop: 10 }} />
                    <Line type="monotone" dataKey="gpt4o" name="GPT-4o" stroke="#078BFF" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="claude" name="Claude-3.5" stroke="#00D9FF" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="llama70b" name="Llama-3.1-70B" stroke="#9255FF" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="llama8b" name="Llama-3.1-8B" stroke="#FFB547" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-db-card border border-db-secondary rounded-xl p-5"
            >
              <h3 className="font-medium text-db-text mb-4">Metric Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Diagnosis Accuracy', value: 91.2 },
                        { name: 'Evidence Coverage', value: 87.5 },
                        { name: 'Verification Success', value: 93.8 },
                        { name: 'Safe Actions', value: 96.8 },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      labelLine={false}
                    >
                      {COLORS.map((color, i) => <Cell key={`cell-${i}`} fill={color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {activeTab === 'models' && (
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-db-card border border-db-secondary rounded-xl overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-db-secondary">
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Model</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Diagnosis Accuracy</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Evidence Coverage</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Verification Success</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Unsafe Action Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-db-secondary/50">
                  {modelComparisonData.map((model, i) => (
                    <motion.tr
                      key={model.model}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-db-secondary/30"
                    >
                      <td className="px-4 py-4 font-medium text-db-text">{model.model}</td>
                      <td className="px-4 py-4 text-sm text-db-text-secondary">
                        {model.model.includes('GPT') ? 'OpenAI' : model.model.includes('Claude') ? 'Anthropic' : 'Local (Ollama)'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-db-secondary/50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-db-primary rounded-full transition-all duration-500"
                              style={{ width: `${model.accuracy}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-db-text">{model.accuracy}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-db-secondary/50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-db-cyan rounded-full transition-all duration-500"
                              style={{ width: `${model.coverage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-db-text">{model.coverage}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-db-secondary/50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-db-success rounded-full transition-all duration-500"
                              style={{ width: `${model.verification}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-db-text">{model.verification}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-db-secondary/50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-db-critical rounded-full transition-all duration-500"
                              style={{ width: `${model.unsafeRate * 10}%` }}
                            />
                          </div>
                          <span className={cn('text-sm font-medium', model.unsafeRate < 4 ? 'text-db-success' : model.unsafeRate < 7 ? 'text-db-warning' : 'text-db-critical')}>
                            {model.unsafeRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-db-success/20 text-db-success border border-db-success/30">
                          Active
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-db-card border border-db-secondary rounded-xl p-5"
          >
            <h3 className="font-medium text-db-text mb-4">Accuracy Comparison</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelComparisonData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-db-secondary/50" horizontal={false} />
                  <XAxis type="number" className="text-db-text-secondary" tick={{ fontSize: 11, fill: '#91A4C7' }} axisLine={{ stroke: '#0C1D3A' }} tickLine={false} domain={[0, 100]} />
                  <YAxis type="category" dataKey="model" className="text-db-text-secondary" tick={{ fontSize: 11, fill: '#91A4C7' }} axisLine={false} tickLine={false} width={140} />
                  <Tooltip />
                  <Legend wrapperStyle={{ paddingTop: 10 }} />
                  <Bar dataKey="accuracy" name="Diagnosis Accuracy" fill="#078BFF" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="coverage" name="Evidence Coverage" fill="#00D9FF" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="verification" name="Verification Success" fill="#00D69A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      )}

      {activeTab === 'experiments' && (
        <div className="space-y-4">
          {experimentHistory.map((exp, i) => (
            <motion.div
              key={exp.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-db-card border border-db-secondary rounded-xl p-4 hover:border-db-primary/50 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h4 className="font-medium text-db-text">{exp.name}</h4>
                  <p className="text-sm text-db-text-secondary mt-1">{exp.date} • {exp.models}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium',
                    exp.status === 'completed' ? 'bg-db-success/20 text-db-success border border-db-success/30' :
                    exp.status === 'running' ? 'bg-db-primary/20 text-db-primary border border-db-primary/30 animate-pulse' :
                    'bg-db-warning/20 text-db-warning border border-db-warning/30'
                  )}>
                    {exp.status.charAt(0).toUpperCase() + exp.status.slice(1)}
                  </span>
                  {exp.status === 'completed' && (
                    <div className="text-right">
                      <p className="text-xs text-db-text-secondary">Winner</p>
                      <p className="font-medium text-db-primary">{exp.winner}</p>
                      <p className="text-xs text-db-success">{exp.improvement} improvement</p>
                    </div>
                  )}
                  <button className="px-3 py-1.5 text-sm font-medium text-db-primary hover:bg-db-primary/10 rounded-lg transition-colors">
                    View Details
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {activeTab === 'costs' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Spend (Month)', value: '$213.80', trend: '+12%', color: 'bg-db-primary/20', icon: Icons.DollarSign },
              { label: 'Total Requests', value: '14,140', trend: '+8%', color: 'bg-db-cyan/20', icon: Icons.Activity },
              { label: 'Avg Cost/Request', value: '$0.015', trend: '+2%', color: 'bg-db-warning/20', icon: Icons.TrendingUp },
              { label: 'Local Model Usage', value: '69%', trend: '+5%', color: 'bg-db-success/20', icon: Icons.Cpu },
            ].map((metric, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-5 rounded-xl bg-db-card border border-db-secondary"
              >
                <div className="flex items-center justify-between">
                  <div className={cn('p-2 rounded-lg', metric.color)}>
                    <metric.icon className="w-5 h-5 text-db-primary" />
                  </div>
                  <span className="text-xs font-medium text-db-success">{metric.trend}</span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-db-text">{metric.value}</p>
                  <p className="text-sm text-db-text-secondary mt-1">{metric.label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-db-card border border-db-secondary rounded-xl overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-db-secondary">
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Model</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Monthly Cost</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Requests</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Avg Cost/Request</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Budget Usage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-db-secondary/50">
                  {costData.map((model, i) => (
                    <motion.tr
                      key={model.model}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <td className="px-4 py-4 font-medium text-db-text">{model.model}</td>
                      <td className="px-4 py-4 text-sm text-db-text-secondary">
                        {model.model.includes('GPT') ? 'OpenAI' : model.model.includes('Claude') ? 'Anthropic' : 'Local (Ollama)'}
                      </td>
                      <td className="px-4 py-4 font-mono text-db-text">${model.cost.toFixed(2)}</td>
                      <td className="px-4 py-4 text-sm text-db-text-secondary">{model.requests.toLocaleString()}</td>
                      <td className="px-4 py-4 font-mono text-db-text">${model.avgCost.toFixed(4)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-db-secondary/50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-db-primary rounded-full transition-all duration-500"
                              style={{ width: `${model.cost > 0 ? (model.cost / 500) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-db-text">
                            {model.cost > 0 ? `${((model.cost / 500) * 100).toFixed(1)}%` : 'Free'}
                          </span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-db-card border border-db-secondary rounded-xl p-5"
          >
            <h3 className="font-medium text-db-text mb-4">Cost Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costData.filter(d => d.cost > 0).map((d, i) => ({ name: d.model, value: d.cost, color: COLORS[i] }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    labelLine={false}
                  >
                    {costData.filter(d => d.cost > 0).map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';