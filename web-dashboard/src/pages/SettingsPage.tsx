import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { mockUser } from '@/data/mockData';
import * as Icons from 'lucide-react';

interface AIProvider {
  id: string;
  name: string;
  status: 'connected' | 'not-configured';
  endpoint?: string;
  apiKey?: string;
  defaultModel: string;
  models: string[];
  budget?: number;
  currentSpend?: number;
  enabled: boolean;
}

const settingsTabs = [
  { id: 'general', label: 'General', icon: Icons.Settings },
  { id: 'appearance', label: 'Appearance', icon: Icons.Palette },
  { id: 'ai-providers', label: 'AI Providers', icon: Icons.Cpu },
  { id: 'users-roles', label: 'Users & Roles', icon: Icons.Users },
  { id: 'audit-logs', label: 'Audit Logs', icon: Icons.FileText },
  { id: 'integrations', label: 'Integrations', icon: Icons.Link2 },
  { id: 'about', label: 'About', icon: Icons.Info },
];

const users = [
  { id: '1', name: 'Alex Chen', email: 'alex.chen@company.com', role: 'Administrator', status: 'active', lastActive: '2 min ago' },
  { id: '2', name: 'Sarah Johnson', email: 'sarah.johnson@company.com', role: 'Administrator', status: 'active', lastActive: '1 hour ago' },
  { id: '3', name: 'Jane Smith', email: 'jane.smith@company.com', role: 'DBA', status: 'active', lastActive: '3 hours ago' },
  { id: '4', name: 'Mike Wilson', email: 'mike.wilson@company.com', role: 'Developer', status: 'active', lastActive: '1 day ago' },
  { id: '5', name: 'Demo User', email: 'demo@company.com', role: 'Viewer', status: 'inactive', lastActive: 'Never' },
];

const roles = [
  { id: 'admin', name: 'Administrator', description: 'Full access to all features', permissions: ['all'], users: 2 },
  { id: 'dba', name: 'DBA', description: 'Database management and monitoring', permissions: ['databases', 'agents', 'incidents', 'audit'], users: 1 },
  { id: 'developer', name: 'Developer', description: 'Query lab and investigation access', permissions: ['investigation', 'query-lab', 'databases:read'], users: 1 },
  { id: 'viewer', name: 'Viewer', description: 'Read-only access to dashboards', permissions: ['overview:read', 'databases:read', 'incidents:read'], users: 1 },
];

const initialAIProviders: AIProvider[] = [
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    status: 'connected',
    endpoint: 'http://ollama:11434',
    defaultModel: 'llama3.1:8b',
    models: ['llama3.1:8b', 'codellama:13b', 'mistral:7b'],
    enabled: true,
  },
  {
    id: 'openai',
    name: 'OpenAI (Cloud)',
    status: 'connected',
    apiKey: 'sk-••••••••••••••••••••••••••••••••••',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    budget: 50,
    currentSpend: 12.34,
    enabled: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Cloud)',
    status: 'not-configured',
    apiKey: '',
    defaultModel: 'claude-3.5-sonnet',
    models: ['claude-3.5-sonnet', 'claude-3-haiku', 'claude-3-opus'],
    budget: 50,
    currentSpend: 0,
    enabled: false,
  },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'ai-providers' | 'users-roles' | 'audit-logs' | 'integrations' | 'about'>('general');
  const [profile, setProfile] = useState({ fullName: mockUser.name, email: mockUser.email, currentPassword: '', newPassword: '', confirmPassword: '' });
  const [notifications, setNotifications] = useState({ slowQuery: true, schemaDrift: true, backupFail: false, agentRuns: true, securityAlerts: true });
  const [routingPrefs, setRoutingPrefs] = useState({ defaultProvider: 'ollama', preferLocal: true, costLimit: 10, fallbackToCloud: true });
  const [aiProviders, setAIProviders] = useState<AIProvider[]>(initialAIProviders);

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    // In real app, call API
    alert('Profile saved successfully!');
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.newPassword !== profile.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    // In real app, call API
    alert('Password changed successfully!');
    setProfile(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
  };

  const testAIProvider = (providerId: string) => {
    alert(`Testing connection to ${providerId}... (simulated)`);
  };

  const refreshModels = (providerId: string) => {
    alert(`Refreshing models for ${providerId}... (simulated)`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-db-text">Settings</h1>
          <p className="text-db-text-secondary mt-1">Manage your account and application preferences</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-db-secondary rounded text-sm text-db-text-secondary">DEMO DATA</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <div className="bg-db-card border border-db-secondary rounded-xl overflow-hidden sticky top-24 h-fit">
            <nav className="p-2" aria-label="Settings navigation">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left',
                      activeTab === tab.id
                        ? 'bg-db-primary/10 text-db-primary border border-db-primary/30'
                        : 'text-db-text-secondary hover:text-db-text hover:bg-db-secondary'
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-db-secondary">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-db-primary/20 flex items-center justify-center">
                  <span className="text-sm font-medium text-db-primary">{mockUser.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-db-text truncate">{mockUser.name}</p>
                  <p className="text-xs text-db-text-secondary truncate">{mockUser.email}</p>
                </div>
              </div>
              <p className="text-xs text-db-text-secondary mt-3 text-center">Version 1.0.0 (Build 2024.01.15)</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {activeTab === 'general' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-db-card border border-db-secondary rounded-xl p-5">
                <h2 className="text-lg font-medium text-db-text mb-4 flex items-center gap-2">
                  <Icons.User className="w-5 h-5 text-db-primary" />
                  Profile
                </h2>
                <form onSubmit={handleProfileSave} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm text-db-text-secondary">Full Name</label>
                      <input
                        type="text"
                        value={profile.fullName}
                        onChange={e => setProfile({ ...profile, fullName: e.target.value })}
                        className="w-full px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text placeholder-db-text-secondary focus:border-db-primary focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm text-db-text-secondary">Email</label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={e => setProfile({ ...profile, email: e.target.value })}
                        className="w-full px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text placeholder-db-text-secondary focus:border-db-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-db-secondary">
                    <button type="submit" className="px-4 py-2 bg-db-primary text-db-text rounded-lg font-medium hover:bg-db-primary/90 transition-colors flex items-center gap-2">
                      <Icons.Save className="w-4 h-4" />
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-db-card border border-db-secondary rounded-xl p-5">
                <h2 className="text-lg font-medium text-db-text mb-4 flex items-center gap-2">
                  <Icons.Lock className="w-5 h-5 text-db-primary" />
                  Change Password
                </h2>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm text-db-text-secondary">Current Password</label>
                      <input
                        type="password"
                        value={profile.currentPassword}
                        onChange={e => setProfile({ ...profile, currentPassword: e.target.value })}
                        className="w-full px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text placeholder-db-text-secondary focus:border-db-primary focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm text-db-text-secondary">New Password</label>
                      <input
                        type="password"
                        value={profile.newPassword}
                        onChange={e => setProfile({ ...profile, newPassword: e.target.value })}
                        className="w-full px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text placeholder-db-text-secondary focus:border-db-primary focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm text-db-text-secondary">Confirm New Password</label>
                      <input
                        type="password"
                        value={profile.confirmPassword}
                        onChange={e => setProfile({ ...profile, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text placeholder-db-text-secondary focus:border-db-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-db-secondary">
                    <button type="submit" className="px-4 py-2 bg-db-primary text-db-text rounded-lg font-medium hover:bg-db-primary/90 transition-colors flex items-center gap-2">
                      <Icons.Key className="w-4 h-4" />
                      Update Password
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-db-card border border-db-secondary rounded-xl p-5">
                <h2 className="text-lg font-medium text-db-text mb-4 flex items-center gap-2">
                  <Icons.Bell className="w-5 h-5 text-db-primary" />
                  Notification Preferences
                </h2>
                <div className="space-y-3">
                  {Object.entries(notifications).map(([key, value]) => {
                    const labels: Record<string, string> = {
                      slowQuery: 'Slow query alerts',
                      schemaDrift: 'Schema drift notifications',
                      backupFail: 'Backup failure alerts',
                      agentRuns: 'Agent run completions',
                      securityAlerts: 'Security alerts',
                    };
                    return (
                      <label key={key} className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm text-db-text">{labels[key]}</span>
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={e => setNotifications({ ...notifications, [key]: e.target.checked })}
                          className="w-5 h-5 rounded border-db-secondary bg-db-secondary text-db-primary focus:ring-db-primary"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'appearance' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-db-card border border-db-secondary rounded-xl p-5">
                <h2 className="text-lg font-medium text-db-text mb-4 flex items-center gap-2">
                  <Icons.Palette className="w-5 h-5 text-db-primary" />
                  Theme
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 'dark', label: 'Dark', icon: Icons.Moon, desc: 'Dark navy theme with neon accents' },
                    { id: 'light', label: 'Light', icon: Icons.Sun, desc: 'Clean light theme (coming soon)' },
                    { id: 'system', label: 'System', icon: Icons.Monitor, desc: 'Follow system preference' },
                  ].map((theme) => (
                    <button
                      key={theme.id}
                      className={cn(
                        'p-4 rounded-lg border-2 text-left transition-all',
                        theme.id === 'dark'
                          ? 'border-db-primary bg-db-primary/10'
                          : 'border-db-secondary hover:border-db-primary/50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg', theme.id === 'dark' ? 'bg-db-primary/20 text-db-primary' : 'bg-db-secondary text-db-text-secondary')}>
                          <theme.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-db-text">{theme.label}</p>
                          <p className="text-xs text-db-text-secondary">{theme.desc}</p>
                        </div>
                      </div>
                      {theme.id === 'dark' && (
                        <Icons.Check className="w-5 h-5 text-db-primary ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-db-card border border-db-secondary rounded-xl p-5">
                <h2 className="text-lg font-medium text-db-text mb-4 flex items-center gap-2">
                  <Icons.Type className="w-5 h-5 text-db-primary" />
                  Density
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 'comfortable', label: 'Comfortable', desc: 'Default spacing' },
                    { id: 'compact', label: 'Compact', desc: 'Reduced spacing' },
                    { id: 'spacious', label: 'Spacious', desc: 'Increased spacing' },
                  ].map((density) => (
                    <button
                      key={density.id}
                      className={cn(
                        'p-4 rounded-lg border-2 text-left transition-all',
                        density.id === 'comfortable'
                          ? 'border-db-primary bg-db-primary/10'
                          : 'border-db-secondary hover:border-db-primary/50'
                      )}
                    >
                      <div>
                        <p className="font-medium text-db-text">{density.label}</p>
                        <p className="text-xs text-db-text-secondary">{density.desc}</p>
                      </div>
                      {density.id === 'comfortable' && (
                        <Icons.Check className="w-5 h-5 text-db-primary ml-auto mt-4" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'ai-providers' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-db-card border border-db-secondary rounded-xl p-5">
                <h2 className="text-lg font-medium text-db-text mb-4 flex items-center gap-2">
                  <Icons.Cpu className="w-5 h-5 text-db-primary" />
                  AI Providers
                </h2>
                <p className="text-sm text-db-text-secondary mb-4">Configure AI providers for SQL generation, optimization, and investigation</p>
                <div className="space-y-4">
                  {aiProviders.map((provider) => (
                    <div key={provider.id} className="p-4 rounded-lg border border-db-secondary bg-db-secondary/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn('p-2 rounded-lg', provider.status === 'connected' ? 'bg-db-success/20 text-db-success' : 'bg-db-text-secondary/20 text-db-text-secondary')}>
                            <Icons.Cpu className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-medium text-db-text">{provider.name}</h3>
                            <p className="text-sm text-db-text-secondary">
                              {provider.status === 'connected' && <Icons.Wifi className="w-3 h-3 inline text-db-success mr-1" />}
                              {provider.status === 'connected' ? 'Connected' : 'Not configured'}
                            </p>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={provider.enabled}
                            onChange={e => {
                              setAIProviders(prev => prev.map(p => p.id === provider.id ? { ...p, enabled: e.target.checked } : p));
                            }}
                            className="w-5 h-5 rounded border-db-secondary bg-db-secondary text-db-primary focus:ring-db-primary"
                          />
                          <span className="text-sm text-db-text-secondary">Enabled</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-sm text-db-text-secondary">Default Model</label>
                          <select
                            value={provider.defaultModel}
                            onChange={e => {
                              setAIProviders(prev => prev.map(p => p.id === provider.id ? { ...p, defaultModel: e.target.value } : p));
                            }}
                            className="w-full px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text focus:border-db-primary focus:outline-none"
                          >
                            {provider.models.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        {provider.id === 'ollama' && (
                          <div className="space-y-1">
                            <label className="text-sm text-db-text-secondary">Endpoint</label>
                            <input
                              type="text"
                              value={provider.endpoint}
                              onChange={e => {
                                setAIProviders(prev => prev.map(p => p.id === provider.id ? { ...p, endpoint: e.target.value } : p));
                              }}
                              className="w-full px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text placeholder-db-text-secondary focus:border-db-primary focus:outline-none"
                            />
                          </div>
                        )}
                        {provider.id !== 'ollama' && (
                          <div className="space-y-1">
                            <label className="text-sm text-db-text-secondary">API Key</label>
                            <input
                              type="password"
                              value={provider.apiKey}
                              onChange={e => {
                                setAIProviders(prev => prev.map(p => p.id === provider.id ? { ...p, apiKey: e.target.value } : p));
                              }}
                              className="w-full px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text placeholder-db-text-secondary focus:border-db-primary focus:outline-none"
                            />
                          </div>
                        )}
                        <div className="space-y-1">
                          <label className="text-sm text-db-text-secondary">Monthly Budget</label>
                          <input
                            type="number"
                            value={provider.budget}
                            onChange={e => {
                              setAIProviders(prev => prev.map(p => p.id === provider.id ? { ...p, budget: parseFloat(e.target.value) } : p));
                            }}
                            className="w-full px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text focus:border-db-primary focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm text-db-text-secondary">Current Spend</label>
                          <div className="px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text">
                            ${provider.currentSpend.toFixed(2)} / $${provider.budget}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => testAIProvider(provider.id)}
                          className="px-4 py-2 bg-db-primary text-db-text rounded-lg font-medium hover:bg-db-primary/90 transition-colors flex items-center gap-2"
                        >
                          <Icons.Wifi className="w-4 h-4" />
                          Test Connection
                        </button>
                        <button
                          onClick={() => refreshModels(provider.id)}
                          className="px-4 py-2 bg-db-secondary border border-db-secondary text-db-text rounded-lg font-medium hover:bg-db-primary/10 hover:border-db-primary/50 transition-colors flex items-center gap-2"
                        >
                          <Icons.RefreshCw className="w-4 h-4" />
                          Refresh Models
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-db-card border border-db-secondary rounded-xl p-5">
                <h2 className="text-lg font-medium text-db-text mb-4 flex items-center gap-2">
                  <Icons.GitBranch className="w-5 h-5 text-db-primary" />
                  Routing Preferences
                </h2>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm text-db-text-secondary">Default Provider</label>
                    <select
                      value={routingPrefs.defaultProvider}
                      onChange={e => setRoutingPrefs({ ...routingPrefs, defaultProvider: e.target.value })}
                      className="w-full md:w-64 px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text focus:border-db-primary focus:outline-none"
                    >
                      <option value="ollama">Ollama (Local)</option>
                      <option value="openai">OpenAI (Cloud)</option>
                      <option value="anthropic">Anthropic (Cloud)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={routingPrefs.preferLocal}
                        onChange={e => setRoutingPrefs({ ...routingPrefs, preferLocal: e.target.checked })}
                        className="w-5 h-5 rounded border-db-secondary bg-db-secondary text-db-primary focus:ring-db-primary"
                      />
                      <span className="text-sm text-db-text">Prefer local models when available</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={routingPrefs.fallbackToCloud}
                        onChange={e => setRoutingPrefs({ ...routingPrefs, fallbackToCloud: e.target.checked })}
                        className="w-5 h-5 rounded border-db-secondary bg-db-secondary text-db-primary focus:ring-db-primary"
                      />
                      <span className="text-sm text-db-text">Fallback to cloud on local failure</span>
                    </label>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-db-text-secondary">Daily Cost Limit</label>
                    <div className="flex items-center gap-2">
                      <span className="text-db-text-secondary">$</span>
                      <input
                        type="number"
                        value={routingPrefs.costLimit}
                        onChange={e => setRoutingPrefs({ ...routingPrefs, costLimit: parseFloat(e.target.value) })}
                        className="w-32 px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text focus:border-db-primary focus:outline-none"
                      />
                      <span className="text-db-text-secondary">per day</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'users-roles' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-db-card border border-db-secondary rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-db-text flex items-center gap-2">
                    <Icons.Users className="w-5 h-5 text-db-primary" />
                    Users
                  </h2>
                  <button className="px-4 py-2 bg-db-primary text-db-text rounded-lg font-medium hover:bg-db-primary/90 transition-colors flex items-center gap-2">
                    <Icons.Plus className="w-4 h-4" />
                    Invite User
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-db-secondary">
                        <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Last Active</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-db-text-secondary uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-db-secondary/50">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-db-secondary/30">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-db-primary/20 flex items-center justify-center text-sm font-medium text-db-primary">
                                {user.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-db-text">{user.name}</p>
                                <p className="text-xs text-db-text-secondary">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-db-primary/20 text-db-primary border border-db-primary/30">
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                              user.status === 'active' ? 'bg-db-success/20 text-db-success border border-db-success/30' : 'bg-db-text-secondary/20 text-db-text-secondary border border-db-text-secondary/30'
                            )}>
                              <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', user.status === 'active' ? 'bg-db-success' : 'bg-db-text-secondary')} />
                              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-db-text-secondary">{user.lastActive}</td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button className="p-2 rounded-lg text-db-text-secondary hover:text-db-text hover:bg-db-secondary transition-colors" title="Edit">
                                <Icons.Edit className="w-4 h-4" />
                              </button>
                              <button className="p-2 rounded-lg text-db-text-secondary hover:text-db-critical hover:bg-db-critical/10 transition-colors" title="Remove">
                                <Icons.UserX className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-db-card border border-db-secondary rounded-xl p-5">
                <h2 className="text-lg font-medium text-db-text mb-4 flex items-center gap-2">
                  <Icons.Shield className="w-5 h-5 text-db-primary" />
                  Roles & Permissions
                </h2>
                <div className="space-y-4">
                  {roles.map((role) => (
                    <div key={role.id} className="p-4 rounded-lg border border-db-secondary bg-db-secondary/30">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-db-text">{role.name}</h3>
                          <p className="text-sm text-db-text-secondary">{role.description}</p>
                        </div>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-db-primary/20 text-db-primary border border-db-primary/30">
                          {role.users} user(s)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {role.permissions.map((perm) => (
                          <span key={perm} className="px-2 py-1 text-xs font-medium bg-db-secondary border border-db-secondary rounded text-db-text-secondary">
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'audit-logs' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-db-card border border-db-secondary rounded-xl p-5">
                <h2 className="text-lg font-medium text-db-text mb-4 flex items-center gap-2">
                  <Icons.FileText className="w-5 h-5 text-db-primary" />
                  Audit Log Retention
                </h2>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm text-db-text-secondary">Retention Period</label>
                    <select className="w-full md:w-64 px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text focus:border-db-primary focus:outline-none">
                      <option value="30">30 days</option>
                      <option value="90" selected>90 days</option>
                      <option value="180">180 days</option>
                      <option value="365">1 year</option>
                      <option value="forever">Forever</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-db-text-secondary">Archive Location</label>
                    <input type="text" value="s3://db-sentinel-audit-logs" className="w-full md:w-96 px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text focus:border-db-primary focus:outline-none" />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked className="w-5 h-5 rounded border-db-secondary bg-db-secondary text-db-primary focus:ring-db-primary" />
                      <span className="text-sm text-db-text">Encrypt archived logs</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked className="w-5 h-5 rounded border-db-secondary bg-db-secondary text-db-primary focus:ring-db-primary" />
                      <span className="text-sm text-db-text">Compress archives</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-db-card border border-db-secondary rounded-xl p-5">
                <h2 className="text-lg font-medium text-db-text mb-4 flex items-center gap-2">
                  <Icons.Download className="w-5 h-5 text-db-primary" />
                  Export Audit Logs
                </h2>
                <div className="flex flex-wrap gap-3">
                  <button className="px-4 py-2 bg-db-secondary border border-db-secondary text-db-text rounded-lg font-medium hover:bg-db-primary/10 hover:border-db-primary/50 transition-colors flex items-center gap-2">
                    <Icons.FileSpreadsheet className="w-4 h-4" />
                    Export CSV
                  </button>
                  <button className="px-4 py-2 bg-db-secondary border border-db-secondary text-db-text rounded-lg font-medium hover:bg-db-primary/10 hover:border-db-primary/50 transition-colors flex items-center gap-2">
                    <Icons.FileJson className="w-4 h-4" />
                    Export JSON
                  </button>
                  <button className="px-4 py-2 bg-db-secondary border border-db-secondary text-db-text rounded-lg font-medium hover:bg-db-primary/10 hover:border-db-primary/50 transition-colors flex items-center gap-2">
                    <Icons.FileText className="w-4 h-4" />
                    Generate Report
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'integrations' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-db-card border border-db-secondary rounded-xl p-5">
                <h2 className="text-lg font-medium text-db-text mb-4 flex items-center gap-2">
                  <Icons.Link2 className="w-5 h-5 text-db-primary" />
                  Third-Party Integrations
                </h2>
                <div className="space-y-4">
                  {[
                    { name: 'Slack', desc: 'Send alerts and notifications to Slack channels', icon: Icons.MessageSquare, configured: true },
                    { name: 'PagerDuty', desc: 'Escalate critical incidents to PagerDuty', icon: Icons.AlertTriangle, configured: false },
                    { name: 'Datadog', desc: 'Sync metrics and dashboards with Datadog', icon: Icons.BarChart3, configured: false },
                    { name: 'GitHub', desc: 'Create issues and PRs for schema migrations', icon: Icons.GitBranch, configured: true },
                    { name: 'Jira', desc: 'Link incidents to Jira tickets', icon: Icons.Ticket, configured: false },
                  ].map((integration) => (
                    <div key={integration.name} className="flex items-center justify-between p-4 rounded-lg border border-db-secondary bg-db-secondary/30">
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg', integration.configured ? 'bg-db-success/20 text-db-success' : 'bg-db-text-secondary/20 text-db-text-secondary')}>
                          <integration.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-medium text-db-text">{integration.name}</h3>
                          <p className="text-sm text-db-text-secondary">{integration.desc}</p>
                        </div>
                      </div>
                      <button className={cn(
                        'px-4 py-2 rounded-lg font-medium transition-colors',
                        integration.configured
                          ? 'bg-db-secondary border border-db-secondary text-db-text hover:bg-db-primary/10'
                          : 'bg-db-primary text-db-text hover:bg-db-primary/90'
                      )}>
                        {integration.configured ? 'Configured' : 'Connect'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-db-card border border-db-secondary rounded-xl p-5">
                <h2 className="text-lg font-medium text-db-text mb-4 flex items-center gap-2">
                  <Icons.Webhook className="w-5 h-5 text-db-primary" />
                  Webhooks
                </h2>
                <p className="text-sm text-db-text-secondary mb-4">Configure webhook endpoints for real-time event notifications</p>
                <button className="px-4 py-2 bg-db-primary text-db-text rounded-lg font-medium hover:bg-db-primary/90 transition-colors flex items-center gap-2">
                  <Icons.Plus className="w-4 h-4" />
                  Add Webhook
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'about' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-db-card border border-db-secondary rounded-xl p-5 text-center">
                <div className="w-20 h-20 rounded-2xl bg-db-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Icons.Shield className="w-10 h-10 text-db-primary" />
                </div>
                <h2 className="text-2xl font-bold text-db-text mb-2">DB Sentinel</h2>
                <p className="text-db-text-secondary mb-4">AI-Powered Database Management and Intelligence Platform</p>
                <div className="flex items-center justify-center gap-6 text-sm text-db-text-secondary">
                  <span>Version 1.0.0</span>
                  <span>Build 2024.01.15</span>
                  <span>MIT License</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-db-card border border-db-secondary rounded-xl p-5">
                  <h3 className="font-medium text-db-text mb-4 flex items-center gap-2">
                    <Icons.Info className="w-5 h-5 text-db-primary" />
                    System Information
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-db-text-secondary">Frontend</span>
                      <span className="font-medium text-db-text">React 18 + TypeScript + Vite</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-db-text-secondary">Backend</span>
                      <span className="font-medium text-db-text">FastAPI + Python 3.11</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-db-text-secondary">Database</span>
                      <span className="font-medium text-db-text">PostgreSQL 16</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-db-text-secondary">Cache/Queue</span>
                      <span className="font-medium text-db-text">Redis 7</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-db-text-secondary">Local LLM</span>
                      <span className="font-medium text-db-text">Ollama</span>
                    </div>
                  </div>
                </div>

                <div className="bg-db-card border border-db-secondary rounded-xl p-5">
                  <h3 className="font-medium text-db-text mb-4 flex items-center gap-2">
                    <Icons.ExternalLink className="w-5 h-5 text-db-primary" />
                    Links
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Documentation', href: '#' },
                      { label: 'API Reference', href: '#' },
                      { label: 'GitHub Repository', href: '#' },
                      { label: 'Report Issue', href: '#' },
                      { label: 'Changelog', href: '#' },
                    ].map((link) => (
                      <a key={link.label} href={link.href} className="flex items-center justify-between text-sm text-db-text-secondary hover:text-db-primary transition-colors">
                        <span>{link.label}</span>
                        <Icons.ExternalLink className="w-4 h-4" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}