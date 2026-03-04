'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const CACHE_KEY = 'snaptrade_brokerage_data';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Types ──────────────────────────────────────────────────────────

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

interface BrokerageDataContextType {
  accounts: BrokerageAccount[];
  positions: BrokeragePosition[];
  totalInvestment: number;
  loading: boolean;
  refresh: () => Promise<void>;
  forceRefresh: () => Promise<void>;
}

// ─── Context ────────────────────────────────────────────────────────

const BrokerageDataContext = createContext<BrokerageDataContextType>({
  accounts: [],
  positions: [],
  totalInvestment: 0,
  loading: true,
  refresh: () => Promise.resolve(),
  forceRefresh: () => Promise.resolve(),
});

export function useBrokerageData() {
  return useContext(BrokerageDataContext);
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

// Re-export old name for backwards compat
export const clearHoldingsCache = clearBrokerageCache;

// ─── Provider ───────────────────────────────────────────────────────

export function BrokerageDataProvider({ clerkId, children }: { clerkId: string | null; children: ReactNode }) {
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
      fetch(`/api/snaptrade/accounts?clerkId=${userId}`),
      fetch(`/api/snaptrade/holdings?clerkId=${userId}`),
    ]);

    const acctData = await acctRes.json();
    const holdData = await holdRes.json();

    // Build account list with balances
    const rawAccounts = acctData.accounts || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brokerageAccounts: BrokerageAccount[] = rawAccounts.map((a: any) => ({
      id: a.id || '',
      name: a.name || '',
      number: a.number || '',
      institution_name: a.institution_name || a.name || 'Unknown',
      type: a.meta?.type || a.type || '',
      balance: a.balance?.total?.amount ?? 0,
      meta: a.meta,
    }));

    // Build lookup: account name → institution name from accounts API
    // The holdings API often doesn't return institution_name, so we cross-reference
    const nameToInstitution: Record<string, string> = {};
    for (const acct of brokerageAccounts) {
      if (acct.name) {
        nameToInstitution[acct.name] = acct.institution_name;
      }
      // Also map by last 4 digits of account number for fuzzy matching
      if (acct.number) {
        const last4 = acct.number.slice(-4);
        if (last4) nameToInstitution[`****${last4}`] = acct.institution_name;
      }
    }

    // Build positions, enriching with institution name from accounts API
    const holdPositions: BrokeragePosition[] = (holdData.positions || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => {
        const rawAccountName = p.accountName || '';
        // Try to find institution name: first from the position itself,
        // then cross-reference with accounts data
        const institutionName =
          (p.institutionName && p.institutionName !== 'Unknown' ? p.institutionName : null) ||
          nameToInstitution[rawAccountName] ||
          'Unknown';

        return {
          ticker: p.ticker || 'N/A',
          name: p.name || p.ticker || '',
          shares: p.shares || 0,
          price: p.price || 0,
          value: p.value || 0,
          accountId: p.accountId || '',
          accountName: rawAccountName,
          accountType: p.accountType || '',
          institutionName,
        };
      }
    );

    // Find accounts that have no positions from the holdings API
    // and create a synthetic "Cash / Other Assets" entry for each
    const accountsWithPositions = new Set(holdPositions.map(p => p.accountName));
    for (const acct of brokerageAccounts) {
      if (!accountsWithPositions.has(acct.name) && acct.balance > 0) {
        holdPositions.push({
          ticker: '—',
          name: 'Cash / Other Assets',
          shares: 1,
          price: acct.balance,
          value: acct.balance,
          accountId: acct.id,
          accountName: acct.name,
          accountType: acct.type,
          institutionName: acct.institution_name,
        });
      }
    }

    // Use the sum of all account balances as totalInvestment
    // This is more accurate because some accounts have only cash (no stock positions)
    const totalFromBalances = brokerageAccounts.reduce((sum, a) => sum + a.balance, 0);
    const totalFromPositions = holdData.totalInvestment || 0;
    const totalInvestment = Math.max(totalFromBalances, totalFromPositions);

    const cached: CachedBrokerageData = {
      accounts: brokerageAccounts,
      positions: holdPositions,
      totalInvestment,
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
      applyCache(cached);
    } catch {
      console.error('Failed to refresh brokerage data');
    } finally {
      setLoading(false);
    }
  }, [clerkId, fetchAndCache, applyCache]);

  const forceRefresh = useCallback(async () => {
    clearBrokerageCache();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (!clerkId) {
      setLoading(false);
      return;
    }

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
        const fresh = await fetchAndCache(clerkId);
        applyCache(fresh);
      } catch {
        console.error('Failed to fetch brokerage data');
      } finally {
        setLoading(false);
      }
    })();
  }, [clerkId, loadFromCache, fetchAndCache, applyCache]);

  return (
    <BrokerageDataContext.Provider value={{ accounts, positions, totalInvestment, loading, refresh, forceRefresh }}>
      {children}
    </BrokerageDataContext.Provider>
  );
}
