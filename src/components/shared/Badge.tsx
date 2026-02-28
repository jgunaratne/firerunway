interface BadgeProps {
  status: 'green' | 'amber' | 'red' | 'info';
  children: React.ReactNode;
  className?: string;
}

const colors = {
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
  info: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
};

const icons = {
  green: '✅',
  amber: '⚠️',
  red: '🔴',
  info: 'ℹ️',
};

export default function Badge({ status, children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${colors[status]} ${className}`}>
      <span>{icons[status]}</span>
      {children}
    </span>
  );
}
