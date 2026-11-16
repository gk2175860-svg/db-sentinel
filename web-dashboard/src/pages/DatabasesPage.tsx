import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import type { Database } from '@/types';
import { statusColors, databaseTypeIcons } from '@/data/mockData';
import { IconRenderer } from '@/components/dashboard/IconRenderer';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter } from '@/components/ui/card';

const dbTypeOptions = [
  { value: 'postgresql', label: 'PostgreSQL', icon: 'Database' },
  { value: 'mysql', label: 'MySQL', icon: 'Cylinder' },
  { value: 'sqlite', label: 'SQLite', icon: 'FileStack' },
  { value: 'sqlserver', label: 'SQL Server', icon: 'Server' },
  { value: 'oracle', label: 'Oracle', icon: 'Database' },
];

export function DatabasesPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingDb, setEditingDb] = useState<Database | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database_name: '',
    schema_name: 'public',
    username: '',
    password: '',
    ssl_mode: 'require',
    tags: '' as string,
    description: '',
    connection_options: {},
    pool_config: {},
  });
  const [activeTab, setActiveTab] = useState<'list' | 'health' | 'schema'>('list');
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  // Fetch databases
  const { data: databases = [], isLoading, error } = useQuery({
    queryKey: ['databases'],
    queryFn: api.getDatabases,
  });

  // Create database mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => api.createDatabase(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] });
      setShowModal(false);
      setEditingDb(null);
    },
    onError: (error: any) => {
      console.error('Create failed:', error);
      alert(error.response?.data?.error?.message || 'Failed to create database');
    },
  });

  // Update database mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateDatabase(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] });
      setShowModal(false);
      setEditingDb(null);
    },
    onError: (error: any) => {
      console.error('Update failed:', error);
      alert(error.response?.data?.error?.message || 'Failed to update database');
    },
  });

  // Delete database mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDatabase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] });
    },
    onError: (error: any) => {
      console.error('Delete failed:', error);
      alert(error.response?.data?.error?.message || 'Failed to delete database');
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: (id: string) => api.testDatabaseConnection(id),
    onSuccess: (data, id) => {
      setTestResults(prev => ({
        ...prev,
        [id]: { success: data.success, error: data.error }
      }));
      queryClient.invalidateQueries({ queryKey: ['databases'] });
    },
    onError: (error: any, id) => {
      setTestResults(prev => ({
        ...prev,
        [id]: { success: false, error: error.response?.data?.error?.message || 'Test failed' }
      }));
    },
    onSettled: () => {
      setTestingId(null);
    },
  });

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowModal(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const openCreateModal = () => {
    setEditingDb(null);
    setFormData({
      name: '',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database_name: '',
      schema_name: 'public',
      username: '',
      password: '',
      ssl_mode: 'require',
      tags: '',
      description: '',
      connection_options: {},
      pool_config: {},
    });
    setShowModal(true);
  };

  const openEditModal = (db: Database) => {
    setEditingDb(db);
    setFormData({
      name: db.name,
      type: db.type,
      host: db.host,
      port: db.port || 5432,
      database_name: db.database_name,
      schema_name: db.schema_name || 'public',
      username: db.username || '',
      password: '',
      ssl_mode: 'require',
      tags: db.tags.join(', '),
      description: db.description || '',
      connection_options: db.connection_config || {},
      pool_config: db.pool_config || {},
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      type: formData.type,
      host: formData.host,
      port: formData.port,
      database_name: formData.database_name,
      schema_name: formData.schema_name,
      username: formData.username,
      password: formData.password || undefined,
      ssl_mode: formData.ssl_mode,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      description: formData.description,
      connection_options: formData.connection_options,
      pool_config: formData.pool_config,
    };

    if (editingDb) {
      updateMutation.mutate({ id: editingDb.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleTestConnection = (id: string) => {
    setTestingId(id);
    testMutation.mutate(id);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this database connection?')) {
      deleteMutation.mutate(id);
    }
  };

  // Compute UI fields from API data
  const databasesWithUI = databases.map(db => ({
    ...db,
    status: (db.last_test_status === 'success' ? 'healthy' : db.last_test_status === 'failed' ? 'critical' : 'healthy') as 'healthy' | 'warning' | 'critical' | 'offline',
    health: db.last_test_status === 'success' ? 95 : db.last_test_status === 'failed' ? 40 : 85,
    size: 'Unknown',
    lastChecked: db.last_tested_at ? new Date(db.last_tested_at).toLocaleString() : 'Never',
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-db-text">Databases</h1>
          <p className="text-db-text-secondary mt-1">Manage your database connections</p>
        </div>
        <Button onClick={openCreateModal} className="flex items-center gap-2">
          <IconRenderer name="Plus" className="w-4 h-4" />
          Add Database
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-db-secondary">
          <nav className="flex gap-1 p-1" aria-label="Database tabs">
            {[
              { id: 'list', label: 'Connections', icon: 'Database' },
              { id: 'health', label: 'Health', icon: 'HeartPulse' },
              { id: 'schema', label: 'Schema', icon: 'Layers' },
            ].map((tab) => {
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
                  <IconRenderer name={tab.icon} className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-db-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-db-critical">
              <IconRenderer name="AlertCircle" className="w-12 h-12 mx-auto mb-4" />
              <p>Failed to load databases</p>
            </div>
          ) : activeTab === 'list' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-db-secondary">
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Database</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Host</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Health</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Size</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Last Checked</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-db-text-secondary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-db-secondary/50">
                  {databasesWithUI.map((db) => (
                    <motion.tr
                      key={db.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-db-secondary/30 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'p-2 rounded-lg',
                            `bg-${db.type === 'postgresql' ? 'blue' : db.type === 'mysql' ? 'cyan' : db.type === 'sqlite' ? 'green' : db.type === 'sqlserver' ? 'blue' : 'amber'}-500/20`,
                            `text-${db.type === 'postgresql' ? 'blue' : db.type === 'mysql' ? 'cyan' : db.type === 'sqlite' ? 'green' : db.type === 'sqlserver' ? 'blue' : 'amber'}-400`
                          )}>
                            <IconRenderer name={databaseTypeIcons[db.type] || 'Database'} className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-db-text">{db.name}</p>
                            <p className="text-xs text-db-text-secondary">{db.tags.slice(0, 2).join(', ')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="capitalize text-sm text-db-text-secondary">{db.type}</span>
                      </td>
                      <td className="px-4 py-4 text-sm text-db-text-secondary font-mono">{db.host}:{db.port}</td>
                      <td className="px-4 py-4">
                        <span className={cn(
                          'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                          statusColors[db.status]
                        )}>
                          {db.status.charAt(0).toUpperCase() + db.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
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
                      </td>
                      <td className="px-4 py-4 text-sm text-db-text-secondary">{db.size}</td>
                      <td className="px-4 py-4 text-sm text-db-text-secondary">{db.lastChecked}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleTestConnection(db.id)}
                            disabled={testingId === db.id || testMutation.isPending}
                            title="Test connection"
                          >
                            {testingId === db.id ? (
                              <IconRenderer name="Loader2" className="w-4 h-4 animate-spin text-db-primary" />
                            ) : (
                              <IconRenderer name="Play" className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(db)}
                            title="Edit"
                          >
                            <IconRenderer name="Edit" className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(db.id)}
                            className="text-db-text-secondary hover:text-db-critical hover:bg-db-critical/10"
                            title="Delete"
                          >
                            <IconRenderer name="Trash2" className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                  {databasesWithUI.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-db-text-secondary">
                        <IconRenderer name="Database" className="w-12 h-12 mx-auto mb-4 text-db-text-secondary/50" />
                        <p className="text-lg">No databases connected</p>
                        <p className="text-sm">Click "Add Database" to get started</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'health' && (
            <div className="space-y-4">
              {databasesWithUI.map((db) => (
                <motion.div
                  key={db.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-lg border border-db-secondary bg-db-secondary/30"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        `bg-${db.type === 'postgresql' ? 'blue' : db.type === 'mysql' ? 'cyan' : db.type === 'sqlite' ? 'green' : db.type === 'sqlserver' ? 'blue' : 'amber'}-500/20`,
                        `text-${db.type === 'postgresql' ? 'blue' : db.type === 'mysql' ? 'cyan' : db.type === 'sqlite' ? 'green' : db.type === 'sqlserver' ? 'blue' : 'amber'}-400`
                      )}>
                        <IconRenderer name={databaseTypeIcons[db.type] || 'Database'} className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-db-text">{db.name}</h4>
                        <p className="text-sm text-db-text-secondary">{db.host}:{db.port} • {db.type}</p>
                      </div>
                    </div>
                    <span className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium',
                      statusColors[db.status]
                    )}>
                      {db.status.charAt(0).toUpperCase() + db.status.slice(1)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-db-card rounded-lg">
                      <p className="text-2xl font-bold text-db-text">{db.health}%</p>
                      <p className="text-xs text-db-text-secondary">Health Score</p>
                    </div>
                    <div className="p-3 bg-db-card rounded-lg">
                      <p className="text-2xl font-bold text-db-text">N/A</p>
                      <p className="text-xs text-db-text-secondary">Avg Latency</p>
                    </div>
                    <div className="p-3 bg-db-card rounded-lg">
                      <p className="text-2xl font-bold text-db-text">N/A</p>
                      <p className="text-xs text-db-text-secondary">Connections</p>
                    </div>
                    <div className="p-3 bg-db-card rounded-lg">
                      <p className="text-2xl font-bold text-db-text">N/A</p>
                      <p className="text-xs text-db-text-secondary">Active Alerts</p>
                    </div>
                  </div>
                </motion.div>
              ))}
              {databasesWithUI.length === 0 && (
                <div className="text-center py-12 text-db-text-secondary">
                  <IconRenderer name="HeartPulse" className="w-12 h-12 mx-auto mb-4 text-db-text-secondary/50" />
                  <p>No databases to monitor</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="text-center py-12 text-db-text-secondary">
              <IconRenderer name="Layers" className="w-12 h-12 mx-auto mb-4 text-db-text-secondary/50" />
              <h3 className="text-lg font-medium text-db-text mb-2">Schema Explorer</h3>
              <p>Select a database from the Connections tab to explore its schema</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <div className="fixed inset-0 bg-black/50" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-db-card border border-db-secondary rounded-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-db-secondary">
                <h2 className="text-lg font-medium text-db-text">
                  {editingDb ? 'Edit Database' : 'Add Database Connection'}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowModal(false)}>
                  <IconRenderer name="X" className="w-5 h-5" />
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div className="border-b border-db-secondary pb-4">
                  <h3 className="text-sm font-medium text-db-text-secondary mb-3 flex items-center gap-2">
                    <IconRenderer name="Settings" className="w-4 h-4" />
                    Basic Configuration
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="My Production DB"
                        required
                        disabled={createMutation.isPending || updateMutation.isPending}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="type">Type *</Label>
                      <Select
                        value={formData.type}
                        onValueChange={value => setFormData({ ...formData, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dbTypeOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="host">Host *</Label>
                      <Input
                        id="host"
                        value={formData.host}
                        onChange={e => setFormData({ ...formData, host: e.target.value })}
                        placeholder="db.example.com"
                        required
                        disabled={createMutation.isPending || updateMutation.isPending}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="port">Port *</Label>
                      <Input
                        id="port"
                        type="number"
                        value={formData.port}
                        onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) })}
                        placeholder="5432"
                        required
                        disabled={createMutation.isPending || updateMutation.isPending}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="database_name">Database Name *</Label>
                      <Input
                        id="database_name"
                        value={formData.database_name}
                        onChange={e => setFormData({ ...formData, database_name: e.target.value })}
                        placeholder="my_database"
                        required
                        disabled={createMutation.isPending || updateMutation.isPending}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="schema_name">Schema</Label>
                      <Input
                        id="schema_name"
                        value={formData.schema_name}
                        onChange={e => setFormData({ ...formData, schema_name: e.target.value })}
                        placeholder="public"
                        disabled={createMutation.isPending || updateMutation.isPending}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-b border-db-secondary pb-4">
                  <h3 className="text-sm font-medium text-db-text-secondary mb-3 flex items-center gap-2">
                    <IconRenderer name="Shield" className="w-4 h-4" />
                    Authentication
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="username">Username *</Label>
                      <Input
                        id="username"
                        value={formData.username}
                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                        placeholder="postgres"
                        required
                        disabled={createMutation.isPending || updateMutation.isPending}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        placeholder={editingDb ? "Leave blank to keep current" : "Enter password"}
                        required={!editingDb}
                        disabled={createMutation.isPending || updateMutation.isPending}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-b border-db-secondary pb-4">
                  <h3 className="text-sm font-medium text-db-text-secondary mb-3 flex items-center gap-2">
                    <IconRenderer name="Lock" className="w-4 h-4" />
                    SSL / TLS
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="ssl_mode">SSL Mode</Label>
                      <Select
                        value={formData.ssl_mode}
                        onValueChange={value => setFormData({ ...formData, ssl_mode: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="require">Require</SelectItem>
                          <SelectItem value="verify-ca">Verify CA</SelectItem>
                          <SelectItem value="verify-full">Verify Full</SelectItem>
                          <SelectItem value="disable">Disable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ca_cert">CA Certificate</Label>
                      <Input
                        id="ca_cert"
                        type="file"
                        accept=".pem,.crt"
                        className="w-full px-3 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-db-primary/20 file:text-db-primary"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-db-text-secondary mb-3 flex items-center gap-2">
                    <IconRenderer name="Tag" className="w-4 h-4" />
                    Tags & Description
                  </h3>
                  <div className="space-y-1">
                    <Label htmlFor="tags">Tags (comma separated)</Label>
                    <Input
                      id="tags"
                      value={formData.tags}
                      onChange={e => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="production, postgresql, primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Primary production database for user data"
                      rows={3}
                    />
                  </div>
                </div>

                <CardFooter className="flex justify-end gap-3 pt-4 border-t border-db-secondary">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    <IconRenderer name="Save" className="w-4 h-4" />
                    {editingDb ? 'Update' : 'Create'}
                  </Button>
                </CardFooter>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {Object.entries(testResults).map(([id, result]) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              'fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm animate-slide-in',
              result.success ? 'bg-db-success/20 text-db-success border border-db-success/30' : 'bg-db-critical/20 text-db-critical border border-db-critical/30'
            )}
          >
            <div className="flex items-center gap-2">
              {result.success ? (
                <IconRenderer name="CheckCircle" className="w-4 h-4" />
              ) : (
                <IconRenderer name="AlertCircle" className="w-4 h-4" />
              )}
              {result.success ? 'Connection successful!' : `Connection failed: ${result.error}`}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}