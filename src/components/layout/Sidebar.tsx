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
      <nav className="hidden lg:flex fixed left-0 top-14 bottom-0 w-56 flex-col py-5 px-3 z-40"
        style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--overlay-separator)' }}
      >
        <div className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${isActive
                  ? 'text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
                style={!isActive ? { ['--hover-bg' as string]: 'var(--overlay-bg-secondary)' } : undefined}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--overlay-bg-secondary)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-xl bg-accent/10 border border-accent/20 shadow-glow-sm"
                  />
                )}
                <item.icon size={18} className={`relative z-10 ${isActive ? 'text-accent' : ''}`} />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Disclaimer */}
        <div className="mt-auto pt-4" style={{ borderTop: '1px solid var(--overlay-separator)' }}>
          <p className="text-sm text-text-secondary/40 leading-relaxed px-2">
            FireRunway provides financial information for educational purposes only. Not investment advice.
          </p>
        </div>
      </nav>

      {/* Mobile bottom tabs */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--overlay-separator)', backdropFilter: 'blur(20px)' }}
      >
        <div className="flex justify-around items-center h-16 px-1">
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-300 ${isActive ? 'text-accent' : 'text-text-secondary'
                  }`}
              >
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-xl bg-accent/8"
                  />
                )}
                <item.icon size={20} className="relative z-10" />
                <span className="relative z-10 text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
          {/* More menu for remaining items */}
          <div className="flex flex-col items-center gap-0.5 px-3 py-1.5">
            <MoreHorizontal size={20} className="text-text-secondary" />
            <span className="text-sm font-medium text-text-secondary">More</span>
          </div>
        </div>
      </nav>
    </>
  );
}
