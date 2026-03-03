'use client';

import { useState, useEffect, useCallback } from 'react';

const CACHE_KEY = 'snaptrade_holdings';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedHoldings {
  positions: {
    ticker: string;
    name: string;
    shares: number;
    price: number;
    value: number;
    accountName: string;
    accountType: string;
  }[];
  totalInvestment: number;
  cachedAt: number;
}

/**
 * Clear the SnapTrade holdings cache from localStorage.
 * Can be called from anywhere (no hook required).
 */
export function clearHoldingsCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // SSR or localStorage unavailable — no-op
  }
}

/**
 * Shared hook for fetching and caching SnapTrade holdings in localStorage.
 * All tabs share the same cache so the API is only called once until TTL expires.
 */
export function useHoldingsCache(clerkId: string | null | undefined) {
  const [positions, setPositions] = useState<CachedHoldings['positions']>([]);
  const [totalInvestment, setTotalInvestment] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadFromCache = useCallback((): CachedHoldings | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached: CachedHoldings = JSON.parse(raw);
      if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      return cached;
    } catch {
      return null;
    }
  }, []);

  const fetchAndCache = useCallback(async (userId: string) => {
    const res = await fetch(`/api/snaptrade/holdings?clerkId=${userId}`);
    const data = await res.json();
    const cached: CachedHoldings = {
      positions: data.positions || [],
      totalInvestment: data.totalInvestment || 0,
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
    if (!clerkId) return;
    setLoading(true);
    try {
      const cached = await fetchAndCache(clerkId);
      setPositions(cached.positions);
      setTotalInvestment(cached.totalInvestment);
    } catch {
      console.error('Failed to refresh holdings');
    } finally {
      setLoading(false);
    }
  }, [clerkId, fetchAndCache]);

  /** Clear localStorage cache, then re-fetch fresh data from the API. */
  const forceRefresh = useCallback(async () => {
    clearHoldingsCache();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (!clerkId) return;

    // Try cache first
    const cached = loadFromCache();
    if (cached) {
      setPositions(cached.positions);
      setTotalInvestment(cached.totalInvestment);
      setLoading(false);
      return;
    }

    // Cache miss — fetch fresh
    (async () => {
      try {
        const fresh = await fetchAndCache(clerkId);
        setPositions(fresh.positions);
        setTotalInvestment(fresh.totalInvestment);
      } catch {
        console.error('Failed to fetch holdings');
      } finally {
        setLoading(false);
      }
    })();
  }, [clerkId, loadFromCache, fetchAndCache]);

  return { positions, totalInvestment, loading, refresh, forceRefresh };
}
