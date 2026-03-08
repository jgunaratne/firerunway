'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, TrendingUp, PieChart, Home, Briefcase,
  Flame, BarChart3, FileText, DollarSign,
  ClipboardList, Link as LinkIcon, MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';

const navItems: { href: string; icon: LucideIcon; label: string }[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/net-worth', icon: TrendingUp, label: 'Net Worth' },
  { href: '/portfolio', icon: PieChart, label: 'Portfolio' },
  { href: '/real-estate', icon: Home, label: 'Real Estate' },
  { href: '/equity', icon: Briefcase, label: 'Equity / RSUs' },
  { href: '/fire-score', icon: Flame, label: 'FIRE Score' },
  { href: '/monte-carlo', icon: BarChart3, label: 'Monte Carlo' },
  { href: '/statements', icon: FileText, label: 'Statements' },
  { href: '/income-tax', icon: DollarSign, label: 'Income & Tax' },
  { href: '/spending-plan', icon: ClipboardList, label: 'Spending Plan' },
  { href: '/portfolio?tab=accounts', icon: LinkIcon, label: 'Accounts' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isOnboarding = pathname?.startsWith('/onboarding');
  if (isOnboarding) return null;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border bg-bg-surface flex-col overflow-y-auto shrink-0">
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && !item.href.includes('?') && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${isActive
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                  }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-6 text-xs text-text-secondary leading-relaxed">
          FireRunway provides financial information for educational purposes only. Not investment advice.
        </div>
      </aside>

      {/* Mobile bottom tabs */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-surface border-t border-border">
        <div className="flex justify-around items-center h-16 px-1">
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md text-xs transition-colors ${isActive ? 'text-accent' : 'text-text-secondary'
                  }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
          <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-text-secondary">
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-xs font-medium">More</span>
          </div>
        </div>
      </nav>
    </>
  );
}
