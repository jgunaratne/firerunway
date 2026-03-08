'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import AnimatedNumber from '../shared/AnimatedNumber';
import { formatCurrency, calculateFIScore } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { useBrokerageData, clearBrokerageCache } from '@/lib/BrokerageDataContext';
import { useTheme } from '@/lib/ThemeProvider';
import { useAuth } from '@/lib/AuthProvider';
import { signOut } from '@/lib/firebase';
import { useNetWorth } from '@/hooks/useNetWorth';
import { Sun, Moon, Flame, LogOut } from 'lucide-react';

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const isOnboarding = pathname?.startsWith('/onboarding');
  const { profile, isLoading } = useUserData();
  const [refreshing, setRefreshing] = useState(false);
  const { theme, mounted, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { totalNetWorth, investable, rsuValue } = useNetWorth();
  const { forceRefresh: refreshHoldings } = useBrokerageData();
  const { refresh: refreshUserData } = useUserData();

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (isOnboarding) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    clearBrokerageCache();
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith('stock_price_cache_')) localStorage.removeItem(key);
      }
    } catch { /* SSR guard */ }
    await Promise.all([refreshHoldings(), refreshUserData()]);
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/sign-in');
  };

  const annualSpend = profile?.annual_spend || 0;
  const annualIncome = profile?.annual_income || 0;
  const fireNumber = profile?.fire_number || 0;

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

          {/* User avatar / sign-out */}
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-full overflow-hidden border-2 border-transparent hover:border-accent transition-all"
              >
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-accent flex items-center justify-center text-white text-sm font-bold">
                    {(user.displayName || user.email || '?')[0].toUpperCase()}
                  </div>
                )}
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-bg-card border border-border shadow-xl py-1 z-50">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-sm font-medium text-text-primary truncate">{user.displayName}</p>
                    <p className="text-xs text-text-secondary truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-red-400 hover:bg-bg-elevated transition-colors"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="text-sm text-text-secondary hover:text-accent transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
