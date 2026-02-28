'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { href: '/net-worth', icon: '📈', label: 'Net Worth' },
  { href: '/portfolio', icon: '🥧', label: 'Portfolio' },
  { href: '/real-estate', icon: '🏡', label: 'Real Estate' },
  { href: '/equity', icon: '💼', label: 'Equity / RSUs' },
  { href: '/fire-score', icon: '🔥', label: 'FIRE Score' },
  { href: '/monte-carlo', icon: '📊', label: 'Monte Carlo' },
  { href: '/portfolio?tab=accounts', icon: '🔗', label: 'Accounts' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isOnboarding = pathname?.startsWith('/onboarding');
  if (isOnboarding) return null;

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:flex fixed left-0 top-14 bottom-0 w-56 border-r border-border bg-bg-primary/50 backdrop-blur-sm flex-col py-4 px-3 z-40">
        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                    ? 'bg-accent/15 text-text-primary border border-accent/30'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5 border border-transparent'
                  }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Disclaimer */}
        <div className="mt-auto pt-4 border-t border-border">
          <p className="text-[10px] text-text-secondary/50 leading-relaxed px-2">
            FireRunway provides financial information for educational purposes only. Not investment advice.
          </p>
        </div>
      </nav>

      {/* Mobile bottom tabs */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-bg-primary/90 backdrop-blur-xl">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all ${isActive ? 'text-accent' : 'text-text-secondary'
                  }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          {/* More menu for remaining items */}
          <div className="flex flex-col items-center gap-0.5 px-2 py-1">
            <span className="text-lg">⋯</span>
            <span className="text-[10px] font-medium text-text-secondary">More</span>
          </div>
        </div>
      </nav>
    </>
  );
}
