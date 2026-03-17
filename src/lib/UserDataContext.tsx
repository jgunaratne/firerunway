'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import {
  isDemoMode,
  DEMO_PROFILE, DEMO_RSU_GRANTS, DEMO_REAL_ESTATE,
  DEMO_ACCOUNTS, DEMO_NET_WORTH_HISTORY, DEMO_INCOME_TAX_RECORDS,
} from '@/lib/demo-data';

const CACHE_KEY = 'user_data_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Types ──────────────────────────────────────────────────────────

interface UserProfile {
  annual_income: number;
  annual_bonus: number;
  annual_bonus_is_pct: boolean;
  spouse_income: number;
  spouse_bonus: number;
  spouse_bonus_is_pct: boolean;
  tax_rate_override: number | null;
  annual_spend: number;
  retirement_spend: number;
  state_of_residence: string;
  filing_status: string;
  fire_number: number;
  fire_target_year: number | null;
  birth_year: number | null;
  swr: number;
}

interface RSUGrant {
  id: string;
  company_ticker: string;
  grant_date: string;
  total_shares: number;
  vested_shares: number;
  cliff_months: number;
  vest_period_months: number;
  vest_frequency: string;
}

interface RealEstateProperty {
  id: string;
  address: string;
  property_type: string;
  purchase_price: number;
  purchase_date: string;
  current_value: number;
  original_loan_amount: number;
  mortgage_balance: number;
  mortgage_rate: number;
  mortgage_term_months: number;
  mortgage_start_date: string;
  monthly_payment: number;
  monthly_rent: number | null;
  include_equity_in_fire: boolean;
}

interface AccountSnapshot {
  id: string;
  account_type: string;
  total_value: number;
  holdings: Record<string, unknown>[];
}

interface NetWorthEntry {
  recorded_date: string;
  total_net_worth: number;
  investment_value: number;
  retirement_value: number;
  rsu_value: number;
  real_estate_equity: number;
}

export interface IncomeTaxRecord {
  id: string;
  tax_year: number;
  filename: string;
  document_type: string;
  employer: string;
  income_breakdown: Record<string, number>;
  total_income: number;
  tax_breakdown: Record<string, number>;
  total_tax: number;
  effective_tax_rate: number;
}

interface CachedUserData {
  profile: UserProfile | null;
  rsuGrants: RSUGrant[];
  realEstate: RealEstateProperty[];
  accounts: AccountSnapshot[];
  netWorthHistory: NetWorthEntry[];
  incomeTaxRecords: IncomeTaxRecord[];
  cachedAt: number;
}

interface UserData {
  profile: UserProfile | null;
  rsuGrants: RSUGrant[];
  realEstate: RealEstateProperty[];
  accounts: AccountSnapshot[];
  netWorthHistory: NetWorthEntry[];
  incomeTaxRecords: IncomeTaxRecord[];
  uid: string | null;
  isLoading: boolean;
  lastRefreshedAt: number | null;
  refresh: () => Promise<void>;
}

// ─── Context ────────────────────────────────────────────────────────

const UserDataContext = createContext<UserData>({
  profile: null,
  rsuGrants: [],
  realEstate: [],
  accounts: [],
  netWorthHistory: [],
  incomeTaxRecords: [],
  uid: null,
  isLoading: true,
  lastRefreshedAt: null,
  refresh: () => Promise.resolve(),
});

export function useUserData() {
  return useContext(UserDataContext);
}

/**
 * Clear the user data cache from localStorage.
 * Can be called from anywhere (no hook required).
 */
export function clearUserDataCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // SSR or localStorage unavailable — no-op
  }
}

// ─── Provider ───────────────────────────────────────────────────────

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const uid = user?.uid ?? null;

  const [data, setData] = useState<Omit<UserData, 'refresh' | 'uid'>>({
    profile: null,
    rsuGrants: [],
    realEstate: [],
    accounts: [],
    netWorthHistory: [],
    incomeTaxRecords: [],
    isLoading: true,
    lastRefreshedAt: null,
  });

  const loadFromCache = useCallback((): CachedUserData | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached: CachedUserData = JSON.parse(raw);
      if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      return cached;
    } catch {
      return null;
    }
  }, []);

  const fetchData = useCallback(async () => {
    // Demo mode — return hardcoded data, no API call
    if (isDemoMode()) {
      setData({
        profile: DEMO_PROFILE,
        rsuGrants: DEMO_RSU_GRANTS,
        realEstate: DEMO_REAL_ESTATE,
        accounts: DEMO_ACCOUNTS,
        netWorthHistory: DEMO_NET_WORTH_HISTORY,
        incomeTaxRecords: DEMO_INCOME_TAX_RECORDS,
        isLoading: false,
        lastRefreshedAt: Date.now(),
      });
      return;
    }

    if (!uid) {
    // No user logged in — show empty state
      setData({
        profile: null,
        rsuGrants: [],
        realEstate: [],
        accounts: [],
        netWorthHistory: [],
        incomeTaxRecords: [],
        isLoading: false,
        lastRefreshedAt: null,
      });
      return;
    }

    try {
      const token = await getIdToken();
      const headers: Record<string, string> = { cache: 'no-store' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const email = user?.email ? `&email=${encodeURIComponent(user.email)}` : '';
      const res = await fetch(`/api/user/data?uid=${uid}${email}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers,
      });
      if (res.ok) {
        const json = await res.json();

        const userData = {
          profile: json.profile || null,
          rsuGrants: json.rsuGrants ?? [],
          realEstate: json.realEstate ?? [],
          accounts: json.accounts ?? [],
          netWorthHistory: json.netWorthHistory ?? [],
          incomeTaxRecords: json.incomeTaxRecords ?? [],
        };

        // Write to localStorage cache
        try {
          const toCache: CachedUserData = { ...userData, cachedAt: Date.now() };
          localStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
        } catch {
          // localStorage full — no-op
        }

        setData({ ...userData, isLoading: false, lastRefreshedAt: Date.now() });
        return;
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }

    // Fallback — empty data, not mock
    setData(prev => ({ ...prev, isLoading: false }));
  }, [uid, user?.email, getIdToken]);

  const refresh = useCallback(async () => {
    clearUserDataCache();
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (authLoading) return;

    if (!uid) {
      fetchData();
      return;
    }

    // Try cache first
    const cached = loadFromCache();
    if (cached) {
      setData({
        profile: cached.profile,
        rsuGrants: cached.rsuGrants,
        realEstate: cached.realEstate,
        accounts: cached.accounts,
        netWorthHistory: cached.netWorthHistory,
        incomeTaxRecords: cached.incomeTaxRecords,
        isLoading: false,
        lastRefreshedAt: cached.cachedAt,
      });
      return;
    }

    // Cache miss — fetch fresh
    fetchData();
  }, [authLoading, uid, loadFromCache, fetchData]);

  return (
    <UserDataContext.Provider value={{ ...data, uid, refresh }}>
      {children}
    </UserDataContext.Provider>
  );
}
