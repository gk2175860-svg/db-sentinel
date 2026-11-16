import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { mockNavItems } from '@/data/mockData';
import * as Icons from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard: Icons.LayoutDashboard,
  Database: Icons.Database,
  Search: Icons.Search,
  AlertTriangle: Icons.AlertTriangle,
  Bot: Icons.Bot,
  BarChart3: Icons.BarChart3,
  FileText: Icons.FileText,
  Settings: Icons.Settings,
  Shield: Icons.Shield,
  ChevronRight: Icons.ChevronRight,
  User: Icons.User,
  ChevronDown: Icons.ChevronDown,
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-db-sidebar border-r border-db-secondary flex flex-col',
          'lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-4 border-b border-db-secondary">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-db-primary/20 flex items-center justify-center">
                <Icons.Shield className="w-6 h-6 text-db-primary" />
              </div>
              <span className="text-xl font-bold text-db-text">DB Sentinel</span>
            </div>
            <button
              className="lg:hidden p-1 text-db-text-secondary hover:text-db-text"
              onClick={onClose}
            >
              <Icons.X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {mockNavItems.map((item) => {
              const Icon = iconMap[item.icon] || Icons.Database;
              const isActive = location.pathname === item.path || 
                (item.path !== '/' && location.pathname.startsWith(item.path));
              
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive: active }) => cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    'relative overflow-hidden',
                    active
                      ? 'bg-db-primary/10 text-db-primary border border-db-primary/30'
                      : 'text-db-text-secondary hover:text-db-text hover:bg-db-secondary',
                  )}
                  style={({ isActive: active }) => ({
                    boxShadow: active ? '0 0 20px rgba(7, 139, 255, 0.15)' : 'none',
                  })}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-db-primary/20 text-db-primary rounded-full">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="absolute left-0 top-0 bottom-0 w-1 bg-db-primary"
                    />
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-3 border-t border-db-secondary">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-db-primary/20 flex items-center justify-center">
                <Icons.User className="w-4 h-4 text-db-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-db-text truncate">{mockUser.name}</p>
                <p className="text-xs text-db-text-secondary truncate">{mockUser.role}</p>
              </div>
            </div>
            <div className="px-3 py-2 text-xs text-db-text-secondary flex items-center justify-between">
              <span>Version 1.0.0</span>
              <Icons.ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

import { mockUser } from '@/data/mockData';