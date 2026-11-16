import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { mockUser } from '@/data/mockData';
import * as Icons from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <header className="h-16 bg-db-card/80 backdrop-blur-sm border-b border-db-secondary sticky top-0 z-30">
      <div className="flex items-center justify-between h-full px-4 lg:px-8">
        <div className="flex items-center gap-4 lg:gap-6">
          <button
            className="lg:hidden p-2 rounded-lg text-db-text-secondary hover:text-db-text hover:bg-db-secondary"
            onClick={onMenuClick}
          >
            <Icons.Menu className="w-5 h-5" />
          </button>

          <div className="hidden md:block">
            <p className="text-sm font-medium text-db-text">Welcome back, {mockUser.name.split(' ')[0]}</p>
            <p className="text-xs text-db-text-secondary">{formatDate(time)}</p>
          </div>

          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-db-secondary border border-db-secondary">
            <Icons.Wifi className="w-4 h-4 text-db-success" />
            <span className="text-sm font-medium text-db-success">System Online</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={notificationsRef}>
            <button
              className="relative p-2 rounded-lg text-db-text-secondary hover:text-db-text hover:bg-db-secondary transition-colors"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <Icons.Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-db-critical rounded-full" />
            </button>

            {notificationsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full mt-2 w-80 bg-db-card border border-db-secondary rounded-xl shadow-lg overflow-hidden"
              >
                <div className="p-3 border-b border-db-secondary flex items-center justify-between">
                  <h3 className="text-sm font-medium text-db-text">Notifications</h3>
                  <button className="text-xs text-db-text-secondary hover:text-db-primary">Mark all read</button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <div className="p-3 text-center text-sm text-db-text-secondary">
                    No new notifications
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <button
            className="hidden sm:flex p-2 rounded-lg text-db-text-secondary hover:text-db-text hover:bg-db-secondary transition-colors"
          >
            <Icons.Moon className="w-5 h-5" />
          </button>

          <div className="relative" ref={userMenuRef}>
            <button
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-db-secondary transition-colors"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <div className="w-8 h-8 rounded-full bg-db-primary/20 flex items-center justify-center">
                <span className="text-sm font-medium text-db-primary">
                  {mockUser.name.charAt(0)}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-db-text">{mockUser.name}</p>
                <p className="text-xs text-db-text-secondary">{mockUser.role}</p>
              </div>
              <Icons.ChevronDown className="w-4 h-4 text-db-text-secondary hidden md:block" />
            </button>

            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full mt-2 w-48 bg-db-card border border-db-secondary rounded-xl shadow-lg overflow-hidden"
              >
                <div className="p-3 border-b border-db-secondary">
                  <p className="text-sm font-medium text-db-text">{mockUser.name}</p>
                  <p className="text-xs text-db-text-secondary">{mockUser.email}</p>
                </div>
                <button className="w-full px-3 py-2 text-left text-sm text-db-text-secondary hover:text-db-text hover:bg-db-secondary flex items-center gap-2">
                  <Icons.User className="w-4 h-4" />
                  Profile
                </button>
                <button className="w-full px-3 py-2 text-left text-sm text-db-text-secondary hover:text-db-text hover:bg-db-secondary flex items-center gap-2">
                  <Icons.Settings className="w-4 h-4" />
                  Settings
                </button>
                <hr className="border-db-secondary mx-2" />
                <button className="w-full px-3 py-2 text-left text-sm text-db-critical hover:bg-db-secondary flex items-center gap-2">
                  <Icons.LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}