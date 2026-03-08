'use client';

import { useState, useEffect, useCallback } from 'react';
import { maskAccountNumber } from '@/lib/mask-utils';

const CACHE_KEY = 'snaptrade_brokerage_data';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface BrokerageAccount {
  id: string;
  name: string;
  number: string;
  institution_name: string;
  type: string;
  balance: number;
  meta?: Record<string, unknown>;
}

export interface BrokeragePosition {
  ticker: string;
  name: string;
  shares: number;
  price: number;
  value: number;
  accountId: string;
  accountName: string;
  accountType: string;
  institutionName: string;
}

interface CachedBrokerageData {
  accounts: BrokerageAccount[];
  positions: BrokeragePosition[];
  totalInvestment: number;
  cachedAt: number;
}

/**
 * Clear the brokerage data cache from localStorage.
 * Can be called from anywhere (no hook required).
 */
export function clearBrokerageCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // SSR or localStorage unavailable — no-op
  }
}

// Re-export old name for backwards compat (TopBar, etc.)
export const clearHoldingsCache = clearBrokerageCache;

/**
 * Unified hook for all brokerage data: accounts, balances, holdings.
 * Fetches both /api/snaptrade/accounts and /api/snaptrade/holdings in parallel,
 * merges them into a single cached data structure in localStorage.
 * All pages share the same cache so APIs are only called once per TTL window.
 */
export function useBrokerageData(uid: string | null | undefined) {
  const [accounts, setAccounts] = useState<BrokerageAccount[]>([]);
  const [positions, setPositions] = useState<BrokeragePosition[]>([]);
  const [totalInvestment, setTotalInvestment] = useState(0);
  const [loading, setLoading] = useState(true);

  const applyCache = useCallback((cached: CachedBrokerageData) => {
    setAccounts(cached.accounts);
    setPositions(cached.positions);
    setTotalInvestment(cached.totalInvestment);
  }, []);

  const loadFromCache = useCallback((): CachedBrokerageData | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached: CachedBrokerageData = JSON.parse(raw);
      if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      return cached;
    } catch {
      return null;
    }
  }, []);

  const fetchAndCache = useCallback(async (userId: string): Promise<CachedBrokerageData> => {
    // Fetch accounts and holdings in parallel
    const [acctRes, holdRes] = await Promise.all([
      fetch(`/api/snaptrade/accounts?uid=${userId}`),
      fetch(`/api/snaptrade/holdings?uid=${userId}`),
    ]);

    const acctData = await acctRes.json();
    const holdData = await holdRes.json();

    // Build account list with balances
    const rawAccounts = acctData.accounts || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brokerageAccounts: BrokerageAccount[] = rawAccounts.map((a: any) => ({
      id: a.id || '',
      name: a.name || '',
      number: maskAccountNumber(a.number || ''),
      institution_name: a.institution_name || a.name || 'Unknown',
      type: a.meta?.type || a.type || '',
      balance: a.balance?.total?.amount ?? 0,
      meta: a.meta,
    }));

    // Build positions with institution name from accounts or from holdings data
    const holdPositions: BrokeragePosition[] = (holdData.positions || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => ({
        ticker: p.ticker || 'N/A',
        name: p.name || p.ticker || '',
        shares: p.shares || 0,
        price: p.price || 0,
        value: p.value || 0,
        accountId: p.accountId || '',
        accountName: p.accountName || '',
        accountType: p.accountType || '',
        institutionName: p.institutionName || p.accountName || 'Unknown',
      })
    );

    const cached: CachedBrokerageData = {
      accounts: brokerageAccounts,
      positions: holdPositions,
      totalInvestment: holdData.totalInvestment || 0,
      cachedAt: Date.now(),
    };

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    } catch {
      // localStorage full — no-op
    }

    return cached;
  }, []);

  const refresh = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const cached = await fetchAndCache(uid);
      applyCache(cached);
    } catch {
      console.error('Failed to refresh brokerage data');
    } finally {
      setLoading(false);
    }
  }, [uid, fetchAndCache, applyCache]);

  /** Clear localStorage cache, then re-fetch fresh data from the APIs. */
  const forceRefresh = useCallback(async () => {
    clearBrokerageCache();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (!uid) return;

    // Try cache first
    const cached = loadFromCache();
    if (cached) {
      applyCache(cached);
      setLoading(false);
      return;
    }

    // Cache miss — fetch fresh
    (async () => {
      try {
        const fresh = await fetchAndCache(uid);
        applyCache(fresh);
      } catch {
        console.error('Failed to fetch brokerage data');
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, loadFromCache, fetchAndCache, applyCache]);

  return { accounts, positions, totalInvestment, loading, refresh, forceRefresh };
}

/**
 * Backwards-compatible hook alias.
 * Returns the same shape as the old useHoldingsCache for existing consumers.
 */
export function useHoldingsCache(uid: string | null | undefined) {
  const { positions, totalInvestment, loading, refresh, forceRefresh } = useBrokerageData(uid);
  return { positions, totalInvestment, loading, refresh, forceRefresh };
}
