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
import { Sun, Moon, Flame, RefreshCw, LogOut, Settings, Users } from 'lucide-react';

function formatRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const isOnboarding = pathname?.startsWith('/onboarding');
  const { profile, isLoading } = useUserData();
  const [refreshing, setRefreshing] = useState(false);
  const { theme, mounted, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { totalNetWorth, investable, rsuValue } = useNetWorth();
  const { forceRefresh: refreshHoldings, lastRefreshedAt: brokerageRefreshed } = useBrokerageData();
  const { refresh: refreshUserData, lastRefreshedAt: userDataRefreshed } = useUserData();
  const lastRefreshed = brokerageRefreshed || userDataRefreshed
    ? Math.max(brokerageRefreshed || 0, userDataRefreshed || 0)
    : null;
  // Re-render periodically to update relative time display
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastRefreshed) return;
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, [lastRefreshed]);
  const [demoMode, setDemoMode] = useState(false);
  const [householdSharing, setHouseholdSharing] = useState(true);
  useEffect(() => {
    setDemoMode(isDemoMode());
    try {
      setHouseholdSharing(localStorage.getItem('firerunway-household-sharing') !== 'off');
    } catch { /* SSR guard */ }
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettingsMenu(false);
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
      window.location.href = '/';
      return;
    }
    await signOut();
    router.push('/');
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

  const isDark = mounted && theme === 'dark';

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
          <div className="flex items-center gap-1.5 relative group">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-text-secondary hover:text-text-primary transition-colors"
              title="Refresh all data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {lastRefreshed && (
              <span className="text-[11px] text-text-secondary/60 font-mono tabular-nums">
                {formatRelativeTime(lastRefreshed)}
              </span>
            )}
            {/* Hover tooltip with details */}
            {lastRefreshed && (
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                <div className="bg-bg-surface border border-border rounded-lg shadow-xl px-3 py-2 whitespace-nowrap text-xs">
                  <p className="text-text-secondary mb-1 font-medium">Last refreshed</p>
                  {brokerageRefreshed && (
                    <p className="text-text-secondary">
                      <span className="text-text-primary">Portfolio:</span> {new Date(brokerageRefreshed).toLocaleTimeString()}
                    </p>
                  )}
                  {userDataRefreshed && (
                    <p className="text-text-secondary">
                      <span className="text-text-primary">Profile:</span> {new Date(userDataRefreshed).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Settings gear + User */}
      <div className="flex items-center gap-4">
        {/* Settings gear */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            className={`p-1.5 rounded-lg transition-all duration-200 ${
              showSettingsMenu
                ? 'text-text-primary bg-bg-elevated'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
            }`}
            title="Settings"
            id="settings-gear-button"
          >
            <Settings className={`w-5 h-5 transition-transform duration-300 ${showSettingsMenu ? 'rotate-90' : ''}`} />
          </button>

          {showSettingsMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-bg-surface border border-border shadow-xl py-2 z-50"
              style={{ backdropFilter: 'blur(20px)' }}
              id="settings-dropdown"
            >
              {/* Appearance section */}
              <div className="px-3 pt-1 pb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary opacity-60">
                  Appearance
                </span>
              </div>
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                id="theme-toggle-button"
              >
                <span className="flex items-center gap-2.5">
                  {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  <span>{isDark ? 'Dark mode' : 'Light mode'}</span>
                </span>
                {/* Toggle switch */}
                <div
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                    isDark ? 'bg-accent' : 'bg-border'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      isDark ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </button>

              {/* Divider */}
              <div className="my-1.5 border-t border-border" />

              {/* Household section */}
              <div className="px-3 pt-1 pb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary opacity-60">
                  Household
                </span>
              </div>
              <button
                onClick={() => {
                  const next = !householdSharing;
                  setHouseholdSharing(next);
                  try {
                    localStorage.setItem('firerunway-household-sharing', next ? 'on' : 'off');
                    window.dispatchEvent(new StorageEvent('storage', {
                      key: 'firerunway-household-sharing',
                      newValue: next ? 'on' : 'off',
                    }));
                  } catch { /* SSR guard */ }
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                id="household-sharing-toggle"
              >
                <span className="flex items-center gap-2.5">
                  <Users className="w-4 h-4" />
                  <span>Share with partner</span>
                </span>
                {/* Toggle switch */}
                <div
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                    householdSharing ? 'bg-accent' : 'bg-border'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      householdSharing ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </button>
            </div>
          )}
        </div>

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

