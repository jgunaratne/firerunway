'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import dynamic from 'next/dynamic';

// Only load Clerk components when configured
const ClerkButtons = dynamic(() =>
  import('@clerk/nextjs').then(mod => {
    const { UserButton, SignedIn } = mod;
    return { default: () => <SignedIn><UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: 'w-8 h-8' } }} /></SignedIn> };
  }), { ssr: false, loading: () => null }
);
import AnimatedNumber from '../shared/AnimatedNumber';
import { formatCurrency, calculateFIScore } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { useBrokerageData, clearBrokerageCache } from '@/lib/BrokerageDataContext';
import { useStockPrice } from '@/hooks/useStockPrice';
import { useTheme } from '@/lib/ThemeProvider';
import { Sun, Moon, Flame } from 'lucide-react';

export default function TopBar() {
  const pathname = usePathname();
  const isOnboarding = pathname?.startsWith('/onboarding');
  const { profile, rsuGrants, realEstate, isLoading, refresh: refreshUserData } = useUserData();
  const { totalInvestment, forceRefresh: refreshHoldings } = useBrokerageData();
  const [refreshing, setRefreshing] = useState(false);
  const ticker = rsuGrants[0]?.company_ticker || 'AMZN';
  const stockPrice = useStockPrice(ticker);
  const { theme, mounted, toggleTheme } = useTheme();

  if (isOnboarding) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    // Clear all localStorage caches
    clearBrokerageCache();
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith('stock_price_cache_')) localStorage.removeItem(key);
      }
    } catch { /* SSR guard */ }
    // Re-fetch fresh data
    await Promise.all([refreshHoldings(), refreshUserData()]);
    setRefreshing(false);
  };

  // Derive FI Score + Net Worth from context + SnapTrade
  const annualSpend = profile?.annual_spend || 0;
  const annualIncome = profile?.annual_income || 0;
  const fireNumber = profile?.fire_number || 0;
  const rsuValue = rsuGrants.reduce((sum, g) => sum + g.vested_shares * stockPrice, 0);
  const realEstateEquity = realEstate.reduce((sum, p) => sum + (p.current_value - p.mortgage_balance), 0);
  const investable = totalInvestment > 0 ? totalInvestment : rsuValue;
  const totalNetWorth = investable + realEstateEquity;

  const rawFiScore = isLoading ? 0 : calculateFIScore({
    currentInvestableAssets: investable,
    fireNumber,
    liquidAssets: investable,
    annualSpend,
    employerStockValue: rsuValue,
    totalNetWorth,
    isEmployed: true,
    annualIncome,
  }).total;
  const fiScore = Number.isFinite(rawFiScore) ? rawFiScore : 0;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b" style={{ background: 'var(--bg-primary)', borderColor: 'var(--overlay-separator)', backdropFilter: 'blur(20px)' }}>
      {/* Subtle gradient border effect */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />

      <div className="flex items-center justify-between h-full px-4 lg:px-6 max-w-[1400px] mx-auto relative">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <Flame size={24} className="text-accent-amber group-hover:drop-shadow-[0_0_8px_var(--accent-amber)] transition-all duration-300" />
          <span className="font-display text-lg text-text-primary tracking-tight">FireRunway</span>
        </Link>

        {/* Center stats */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <span className="text-sm text-text-secondary font-medium">FI Score</span>
            <span className="number-display text-lg font-bold text-accent glow-text">
              <AnimatedNumber value={fiScore} />
            </span>
          </div>

          <div className="w-px h-5" style={{ background: 'var(--overlay-border)' }} />

          <div className="flex items-center gap-2.5">
            <span className="text-sm text-text-secondary font-medium">Net Worth</span>
            <span className="number-display text-lg font-bold text-accent-green glow-text-green">
              <AnimatedNumber value={totalNetWorth} format={(n) => formatCurrency(n, true)} />
            </span>
          </div>

          <div className="w-px h-5" style={{ background: 'var(--overlay-border)' }} />

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh all data"
            className="p-1.5 rounded-lg text-text-secondary hover:text-accent transition-all duration-300 disabled:opacity-50"
            style={{ ['--tw-bg-opacity' as string]: 0 }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={refreshing ? 'animate-spin' : ''}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          </button>
        </div>

        {/* Theme Toggle + User */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-text-secondary hover:text-accent transition-all duration-300"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {mounted ? (theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />) : <Sun size={18} />}
          </button>
          <ClerkButtons />
        </div>
      </div>
    </header>
  );
}
