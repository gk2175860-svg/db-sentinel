import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Icons, IconRenderer } from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
  is_active: boolean;
  last_login_at: string | null;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

export function UsersManagementPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    roles: [] as string[],
    is_active: true,
  });
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);

  // Fetch users
  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['users', page, pageSize, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('page_size', pageSize.toString());
      if (search) params.append('search', search);
      const response = await api.get(`/users?${params.toString()}`);
      return response.data as PaginatedResponse<User>;
    },
  });

  // Fetch roles
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.get('/users/roles');
      return response.data as { id: string; name: string }[];
    },
  });

  useEffect(() => {
    if (rolesData) {
      setAvailableRoles(rolesData.map(r => r.name));
    }
  }, [rolesData]);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
      setEditingUser(null);
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
      setEditingUser(null);
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || 'Failed to update user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || 'Failed to delete user');
    },
  });

  const passwordMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.post(`/users/${id}/password`, data),
    onSuccess: () => {
      alert('Password changed successfully');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || 'Failed to change password');
    },
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      full_name: '',
      password: '',
      roles: [],
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name || '',
      password: '',
      roles: user.roles,
      is_active: user.is_active,
    });
    setShowModal(true);
  };

  const openPasswordModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: '',
      password: '',
      roles: [],
      is_active: true,
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      email: formData.email,
      full_name: formData.full_name || undefined,
      password: formData.password || undefined,
      roles: formData.roles,
      is_active: formData.is_active,
    };

    if (editingUser) {
      if (editingUser.email === 'admin@db-sentinel.io') {
        alert('Cannot modify the admin user');
        return;
      }
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      deleteMutation.mutate(id);
    }
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      passwordMutation.mutate({
        id: editingUser.id,
        data: { current_password: '', new_password: formData.password },
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-red-500/20 text-red-400';
      case 'DBA': return 'bg-blue-500/20 text-blue-400';
      case 'Developer': return 'bg-green-500/20 text-green-400';
      case 'Viewer': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-purple-500/20 text-purple-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-db-text">User Management</h1>
          <p className="text-db-text-secondary mt-1">Manage user accounts, roles, and permissions</p>
        </div>
        <Button onClick={openCreateModal} className="flex items-center gap-2">
          <IconRenderer name="Plus" className="w-4 h-4" />
          Add User
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-db-secondary">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <IconRenderer name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-db-text-secondary" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search users..."
                className="w-full pl-10 pr-4 py-2 bg-db-secondary border border-db-secondary rounded-lg text-db-text placeholder-db-text-secondary focus:border-db-primary focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="pageSize" className="text-sm text-db-text-secondary">Rows per page:</Label>
              <Select value={pageSize.toString()} onValueChange={v => { setPageSize(parseInt(v)); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map(size => (
                    <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-db-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-db-critical">
              <IconRenderer name="AlertCircle" className="w-12 h-12 mx-auto mb-4" />
              <p>Failed to load users</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-db-secondary">
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Roles</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-db-text-secondary uppercase tracking-wider">Last Login</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-db-text-secondary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-db-secondary/50">
                  {usersData?.data.map((user) => (
                    <tr key={user.id} className="hover:bg-db-secondary/30 transition-colors">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-db-text">{user.email}</p>
                          {user.full_name && <p className="text-xs text-db-text-secondary">{user.full_name}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map(role => (
                            <Badge key={role} variant="secondary" className={getRoleBadgeColor(role)}>
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={user.is_active ? 'default' : 'secondary'} className={user.is_active ? 'bg-db-success/20 text-db-success' : 'bg-db-text-secondary/20 text-db-text-secondary'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-sm text-db-text-secondary">
                        {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(user)}
                            title="Edit"
                          >
                            <IconRenderer name="Edit" className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openPasswordModal(user)}
                            title="Change Password"
                            className="text-db-primary hover:bg-db-primary/10"
                          >
                            <IconRenderer name="Key" className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(user.id)}
                            className="text-db-critical hover:bg-db-critical/10"
                            title="Delete"
                          >
                            <IconRenderer name="Trash2" className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {usersData?.data.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-db-text-secondary">
                        <IconRenderer name="Users" className="w-12 h-12 mx-auto mb-4 text-db-text-secondary/50" />
                        <p className="text-lg">No users found</p>
                        <p className="text-sm">Click "Add User" to create a new user</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {(usersData && usersData.total > pageSize) && (
            <div className="px-4 py-4 border-t border-db-secondary">
              <Pagination
                currentPage={page}
                totalPages={Math.ceil((usersData?.total || 0) / pageSize)}
                onPageChange={setPage}
                className="justify-center"
              />
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
              className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-db-card border border-db-secondary rounded-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-db-secondary">
                <h2 className="text-lg font-medium text-db-text">
                  {editingUser ? 'Edit User' : 'Add User'}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => { setShowModal(false); setEditingUser(null); }}>
                  <IconRenderer name="X" className="w-5 h-5" />
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@example.com"
                    required
                    disabled={!!editingUser}
                  />
                </div>

                {!editingUser && (
                  <div className="space-y-1">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter password"
                      required
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Roles</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableRoles.map(role => (
                      <label key={role} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.roles.includes(role)}
                          onChange={e => setFormData({
                            ...formData,
                            roles: e.target.checked
                              ? [...formData.roles, role]
                              : formData.roles.filter(r => r !== role)
                          })}
                          className="w-4 h-4 rounded border-db-secondary bg-db-secondary text-db-primary focus:ring-db-primary"
                        />
                        <span className="text-sm text-db-text">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-db-secondary bg-db-secondary text-db-primary focus:ring-db-primary"
                  />
                  <Label htmlFor="is_active" className="text-sm text-db-text">Active</Label>
                </div>

                <CardFooter className="flex justify-end gap-3 pt-4 border-t border-db-secondary">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowModal(false); setEditingUser(null); }}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    <IconRenderer name="Save" className="w-4 h-4" />
                    {editingUser ? 'Update' : 'Create'}
                  </Button>
                </CardFooter>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}