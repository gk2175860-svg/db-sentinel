import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';

interface IconRendererProps {
  name: string;
  className?: string;
  fallback?: React.ComponentType<{ className?: string }>;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  // Activity icons
  investigation: Icons.Search,
  analysis: Icons.Zap,
  connection: Icons.Database,
  model: Icons.Bot,
  resolution: Icons.CheckCircle,
  // Severity icons
  critical: Icons.AlertCircle,
  warning: Icons.AlertTriangle,
  info: Icons.Info,
  resolved: Icons.CheckCircle,
  // Database type icons
  Database: Icons.Database,
  Cylinder: Icons.Cylinder,
  FileStack: Icons.FileStack,
  Zap: Icons.Zap,
  // Agent type icons
  Search: Icons.Search,
  Layers: Icons.Layers,
  Activity: Icons.Activity,
  // Action type icons
  Plus: Icons.Plus,
  Edit: Icons.Edit,
  Trash2: Icons.Trash2,
  Play: Icons.Play,
  CheckCircle: Icons.CheckCircle,
  XCircle: Icons.XCircle,
  LogIn: Icons.LogIn,
  LogOut: Icons.LogOut,
  Shield: Icons.Shield,
  Wifi: Icons.Wifi,
  RefreshCw: Icons.RefreshCw,
  FileSpreadsheet: Icons.FileSpreadsheet,
  FileJson: Icons.FileJson,
  FileText: Icons.FileText,
  MessageSquare: Icons.MessageSquare,
  AlertTriangle: Icons.AlertTriangle,
  BarChart3: Icons.BarChart3,
  GitBranch: Icons.GitBranch,
  Ticket: Icons.Ticket,
  Webhook: Icons.Webhook,
  ExternalLink: Icons.ExternalLink,
  Download: Icons.Download,
  Palette: Icons.Palette,
  Moon: Icons.Moon,
  Sun: Icons.Sun,
  Monitor: Icons.Monitor,
  Type: Icons.Type,
  Users: Icons.Users,
  UserX: Icons.UserX,
  Key: Icons.Key,
  Save: Icons.Save,
  Lock: Icons.Lock,
  Bell: Icons.Bell,
  Cpu: Icons.Cpu,
  HardDrive: Icons.HardDrive,
  Server: Icons.Server,
  Clock: Icons.Clock,
  Tag: Icons.Tag,
  Calendar: Icons.Calendar,
  Target: Icons.Target,
  Sparkles: Icons.Sparkles,
  Bot: Icons.Bot,
  HeartPulse: Icons.HeartPulse,
  LayoutDashboard: Icons.LayoutDashboard,
  Settings: Icons.Settings,
  Link2: Icons.Link2,
  HelpCircle: Icons.HelpCircle,
};

export function IconRenderer({ name, className, fallback = Icons.HelpCircle }: IconRendererProps) {
  const Icon = iconMap[name] || fallback;
  return <Icon className={cn('w-4 h-4', className)} />;
}

export function getIcon(name: string): React.ComponentType<{ className?: string }> {
  return iconMap[name] || Icons.HelpCircle;
}