'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { maskAccountNumber } from '@/lib/mask-utils';
import {
  isDemoMode,
  DEMO_BROKERAGE_ACCOUNTS, DEMO_POSITIONS,
  DEMO_PLAID_ACCOUNTS, DEMO_TOTAL_INVESTMENT,
} from '@/lib/demo-data';

const CACHE_KEY = 'snaptrade_brokerage_data';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MANUAL_HOLDINGS_KEY = 'firerunway-manual-holdings';

export interface ManualHolding {
  id: string;
  ticker: string;
  shares: number;
  price: number;
}

/** Read manual holdings from localStorage. Safe to call during SSR. */
export function getManualHoldings(): ManualHolding[] {
  try {
    const raw = localStorage.getItem(MANUAL_HOLDINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Write manual holdings to localStorage and dispatch a storage event. */
export function setManualHoldings(holdings: ManualHolding[]) {
  try {
    const value = JSON.stringify(holdings);
    localStorage.setItem(MANUAL_HOLDINGS_KEY, value);
    window.dispatchEvent(new StorageEvent('storage', {
      key: MANUAL_HOLDINGS_KEY,
      newValue: value,
    }));
  } catch { /* SSR guard */ }
}

// ─── Types ──────────────────────────────────────────────────────────

export interface BrokerageAccount {
  id: string;
  authorization_id: string;
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
  openPnl: number | null;
  averagePurchasePrice: number | null;
  accountId: string;
  accountName: string;
  accountType: string;
  institutionName: string;
}

export interface PlaidAccount {
  id: string;
  itemId: string;
  name: string;
  officialName: string | null;
  type: string; // depository, credit, loan, investment
  subtype: string | null; // checking, savings, credit card, etc.
  mask: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  limit: number | null;
  institutionName: string;
}

interface CachedBrokerageData {
  accounts: BrokerageAccount[];
  positions: BrokeragePosition[];
  totalInvestment: number;
  plaidAccounts: PlaidAccount[];
  cachedAt: number;
}

interface BrokerageDataContextType {
  accounts: BrokerageAccount[];
  positions: BrokeragePosition[];
  totalInvestment: number;
  plaidAccounts: PlaidAccount[];
  loading: boolean;
  refresh: () => Promise<void>;
  forceRefresh: () => Promise<void>;
}

// ─── Context ────────────────────────────────────────────────────────

const BrokerageDataContext = createContext<BrokerageDataContextType>({
  accounts: [],
  positions: [],
  totalInvestment: 0,
  plaidAccounts: [],
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

export function BrokerageDataProvider({ uid, children }: { uid: string | null; children: ReactNode }) {
  const [accounts, setAccounts] = useState<BrokerageAccount[]>([]);
  const [positions, setPositions] = useState<BrokeragePosition[]>([]);
  const [totalInvestment, setTotalInvestment] = useState(0);
  const [plaidAccounts, setPlaidAccounts] = useState<PlaidAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const applyCache = useCallback((cached: CachedBrokerageData) => {
    setAccounts(cached.accounts);
    setPositions(cached.positions);
    setTotalInvestment(cached.totalInvestment);
    setPlaidAccounts(cached.plaidAccounts || []);
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
    // Fetch accounts, holdings, and Plaid accounts in parallel
    const [acctRes, holdRes, plaidRes] = await Promise.all([
      fetch(`/api/snaptrade/accounts?uid=${userId}`),
      fetch(`/api/snaptrade/holdings?uid=${userId}`),
      fetch(`/api/plaid/accounts?uid=${userId}`).catch(() => null),
    ]);

    const acctData = await acctRes.json();
    const holdData = await holdRes.json();
    const plaidData = plaidRes ? await plaidRes.json().catch(() => ({ plaidAccounts: [] })) : { plaidAccounts: [] };

    // Build account list with balances
    const rawAccounts = acctData.accounts || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brokerageAccounts: BrokerageAccount[] = rawAccounts.map((a: any) => ({
      id: a.id || '',
      authorization_id: a.brokerage_authorization || '',
      name: a.name || '',
      number: maskAccountNumber(a.number || ''),
      institution_name: a.institution_name || a.name || 'Unknown',
      type: a.meta?.type || a.type || '',
      balance: a.balance?.total?.amount ?? 0,
      meta: a.meta,
    }));

    // Build lookup: account name/id/number → institution name from accounts API
    // The holdings API often doesn't return institution_name, so we cross-reference
    const nameToInstitution: Record<string, string> = {};
    const idToInstitution: Record<string, string> = {};
    // Collect all unique non-Unknown institution names for fallback
    const allInstitutionNames = new Set<string>();
    for (const acct of brokerageAccounts) {
      const inst = acct.institution_name && acct.institution_name.toLowerCase() !== 'unknown' ? acct.institution_name : '';
      if (inst) {
        allInstitutionNames.add(inst);
        if (acct.name) nameToInstitution[acct.name] = inst;
        if (acct.id) idToInstitution[acct.id] = inst;
        if (acct.number) {
          // Map by full account number and last-4 variants
          nameToInstitution[acct.number] = inst;
          const last4 = acct.number.slice(-4);
          if (last4) {
            nameToInstitution[`****${last4}`] = inst;
            nameToInstitution[last4] = inst;
          }
        }
      }
    }

    // If there's only one institution across all accounts, use it as fallback
    const singleInstitutionFallback = allInstitutionNames.size === 1
      ? Array.from(allInstitutionNames)[0]
      : '';

    // Build positions, enriching with institution name from accounts API
    const holdPositions: BrokeragePosition[] = (holdData.positions || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => {
        const rawAccountName = p.accountName || '';
        const rawAccountId = p.accountId || '';
        // Try to find institution name using multiple strategies:
        // 1. From position itself (if not "unknown")
        // 2. By account ID → institution lookup
        // 3. By account name → institution lookup
        // 4. Try account ID as name lookup key (sometimes IDs appear as names)
        // 5. Try account name as ID lookup key
        // 6. Find any brokerage account whose name matches the position accountName
        // 7. Single-institution fallback (if user only has one brokerage connected)
        let institutionName =
          (p.institutionName && p.institutionName.toLowerCase() !== 'unknown' ? p.institutionName : null) ||
          idToInstitution[rawAccountId] ||
          nameToInstitution[rawAccountName] ||
          idToInstitution[rawAccountName] ||
          nameToInstitution[rawAccountId] ||
          null;

        // If still unresolved, try to find any account that matches this position
        if (!institutionName) {
          const matchingAccount = brokerageAccounts.find(a =>
            (rawAccountId && a.id === rawAccountId) ||
            (rawAccountName && (a.name === rawAccountName || a.number === rawAccountName)) ||
            (rawAccountId && (a.name === rawAccountId || a.number === rawAccountId))
          );
          if (matchingAccount && matchingAccount.institution_name.toLowerCase() !== 'unknown') {
            institutionName = matchingAccount.institution_name;
          }
        }

        // Last resort: if only one institution is connected, use it
        if (!institutionName) {
          institutionName = singleInstitutionFallback;
        }

        return {
          ticker: p.ticker || 'N/A',
          name: p.name || p.ticker || '',
          shares: p.shares || 0,
          price: p.price || 0,
          value: p.value || 0,
          openPnl: p.openPnl ?? null,
          averagePurchasePrice: p.averagePurchasePrice ?? null,
          accountId: rawAccountId,
          accountName: rawAccountName,
          accountType: p.accountType || '',
          institutionName: institutionName || '',
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
          openPnl: null,
          averagePurchasePrice: null,
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

    // Flatten Plaid accounts from all items
    const flatPlaidAccounts: PlaidAccount[] = [];
    if (Array.isArray(plaidData.plaidAccounts)) {
      for (const item of plaidData.plaidAccounts) {
        for (const acct of item.accounts || []) {
          flatPlaidAccounts.push({
            id: acct.id,
            itemId: item.itemId,
            name: acct.name,
            officialName: acct.officialName,
            type: acct.type,
            subtype: acct.subtype,
            mask: acct.mask,
            currentBalance: acct.currentBalance,
            availableBalance: acct.availableBalance,
            limit: acct.limit,
            institutionName: item.institutionName,
          });
        }
      }
    }

    const cached: CachedBrokerageData = {
      accounts: brokerageAccounts,
      positions: holdPositions,
      totalInvestment,
      plaidAccounts: flatPlaidAccounts,
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

  const forceRefresh = useCallback(async () => {
    clearBrokerageCache();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    // Demo mode — return hardcoded data immediately
    if (isDemoMode()) {
      setAccounts(DEMO_BROKERAGE_ACCOUNTS);
      setPositions(DEMO_POSITIONS);
      setTotalInvestment(DEMO_TOTAL_INVESTMENT);
      setPlaidAccounts(DEMO_PLAID_ACCOUNTS);
      setLoading(false);
      return;
    }

    if (!uid) {
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
        const fresh = await fetchAndCache(uid);
        applyCache(fresh);
      } catch {
        console.error('Failed to fetch brokerage data');
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, loadFromCache, fetchAndCache, applyCache]);

  // ─── Manual Holdings ────────────────────────────────────────────────
  const [manualHoldings, setManualHoldingsState] = useState<ManualHolding[]>([]);

  useEffect(() => {
    setManualHoldingsState(getManualHoldings());
    const handler = (e: StorageEvent) => {
      if (e.key === MANUAL_HOLDINGS_KEY) {
        setManualHoldingsState(e.newValue ? JSON.parse(e.newValue) : []);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Merge manual holdings into positions + totalInvestment
  const mergedValue = useMemo(() => {
    const manualPositions: BrokeragePosition[] = manualHoldings.map(h => ({
      ticker: h.ticker || 'N/A',
      name: h.ticker || 'Manual Entry',
      shares: h.shares,
      price: h.price,
      value: h.shares * h.price,
      openPnl: null,
      averagePurchasePrice: null,
      accountId: 'manual',
      accountName: 'Manual Entry',
      accountType: 'Manual',
      institutionName: 'Manual Entry',
    }));
    const manualTotal = manualPositions.reduce((s, p) => s + p.value, 0);
    return {
      accounts,
      positions: [...positions, ...manualPositions],
      totalInvestment: totalInvestment + manualTotal,
      plaidAccounts,
      loading,
      refresh,
      forceRefresh,
    };
  }, [accounts, positions, totalInvestment, plaidAccounts, loading, refresh, forceRefresh, manualHoldings]);

  return (
    <BrokerageDataContext.Provider value={mergedValue}>
      {children}
    </BrokerageDataContext.Provider>
  );
}
