'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AnimatedNumber from '../shared/AnimatedNumber';
import { formatCurrency } from '@/lib/calculations';

export default function TopBar() {
  const pathname = usePathname();
  const isOnboarding = pathname?.startsWith('/onboarding');
  if (isOnboarding) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-bg-primary/80 backdrop-blur-xl">
      <div className="flex items-center justify-between h-full px-4 lg:px-6 max-w-[1400px] mx-auto">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl">🔥</span>
          <span className="font-display text-lg text-text-primary tracking-tight">FireRunway</span>
        </Link>

        {/* Center stats */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary uppercase tracking-wider">FI Score</span>
            <span className="number-display text-lg font-bold text-accent">
              <AnimatedNumber value={72} />
            </span>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary uppercase tracking-wider">Net Worth</span>
            <span className="number-display text-lg font-bold text-accent-green">
              <AnimatedNumber value={3960000} format={(n) => formatCurrency(n, true)} />
            </span>
          </div>
        </div>

        {/* User */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-sm font-semibold text-accent">
            A
          </div>
        </div>
      </div>
    </header>
  );
}
