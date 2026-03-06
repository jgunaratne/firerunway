import { CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface BadgeProps {
  status: 'green' | 'amber' | 'red' | 'info';
  children: React.ReactNode;
  className?: string;
}

const colors = {
  green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-glow-green/30',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-glow-amber/30',
  red: 'bg-red-500/10 text-red-400 border-red-500/20 shadow-glow-red/30',
  info: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-glow-sm',
};

const icons = {
  green: CheckCircle2,
  amber: AlertTriangle,
  red: AlertCircle,
  info: Info,
};

export default function Badge({ status, children, className = '' }: BadgeProps) {
  const Icon = icons[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all duration-300 ${colors[status]} ${className}`}>
      <Icon size={14} />
      {children}
    </span>
  );
}

