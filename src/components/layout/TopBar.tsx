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
import { isDemoMode, disableDemoMode } from '@/lib/demo-data';
import { Sun, Moon, Flame, RefreshCw, LogOut } from 'lucide-react';

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
    const wasDemo = isDemoMode();
    try {
      localStorage.removeItem('user_data_cache');
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith('stock_price_cache_') || key.startsWith('brokerage_')) {
          localStorage.removeItem(key);
        }
      }
    } catch { /* SSR guard */ }
    clearBrokerageCache();
    disableDemoMode();
    if (wasDemo) {
      // Full reload to clear demo state from all providers
      window.location.href = '/';
      return;
    }
    await signOut();
    router.push('/');
  };

  const demoMode = typeof window !== 'undefined' && isDemoMode();

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
    <header className="h-16 border-b border-border bg-bg-surface flex items-center justify-between px-6 shrink-0 sticky top-0 z-50">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 w-64">
        <Flame className="w-5 h-5 text-accent-amber" />
        <span className="font-semibold tracking-tight">FireRunway</span>
      </Link>

      {/* Center stats */}
      <div className="hidden md:flex items-center gap-8">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">FI Score</span>
            <span className="font-semibold text-accent">
              <AnimatedNumber value={fiScore} />
            </span>
            {demoMode && (
              <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">Demo</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">Net Worth</span>
            <span className="font-semibold text-accent-green font-mono">
              <AnimatedNumber value={totalNetWorth} format={(n) => formatCurrency(n, true)} />
            </span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Right: Theme toggle + User */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="text-text-secondary hover:text-text-primary transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {mounted ? (theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />) : <Sun className="w-5 h-5" />}
        </button>

        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 rounded-full overflow-hidden bg-bg-elevated border border-border"
            >
              {user.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-secondary text-sm font-bold">
                  {(user.displayName || user.email || '?')[0].toUpperCase()}
                </div>
              )}
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-bg-surface border border-border shadow-xl py-1 z-50">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-medium text-text-primary truncate">{user.displayName}</p>
                  <p className="text-xs text-text-secondary truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-accent-red hover:bg-bg-elevated transition-colors"
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
    </header>
  );
}
