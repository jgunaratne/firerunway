'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

// Resolved at build time — determines if Clerk hooks are called
const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const CACHE_KEY = 'user_data_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Types ──────────────────────────────────────────────────────────

interface UserProfile {
  annual_income: number;
  annual_spend: number;
  retirement_spend: number;
  state_of_residence: string;
  filing_status: string;
  fire_number: number;
  fire_target_year: number | null;
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
  clerkId: string | null;
  isLoading: boolean;
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
  clerkId: null,
  isLoading: true,
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
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const clerkData = CLERK_ENABLED ? useUser() : { user: null, isLoaded: true };
  const user = clerkData.user;
  const clerkLoaded = clerkData.isLoaded;
  const clerkId = user?.id ?? null;

  const [data, setData] = useState<Omit<UserData, 'refresh' | 'clerkId'>>({
    profile: null,
    rsuGrants: [],
    realEstate: [],
    accounts: [],
    netWorthHistory: [],
    incomeTaxRecords: [],
    isLoading: true,
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
    if (!user?.id) {
      // No user logged in — show empty state (no mock data)
      setData({
        profile: null,
        rsuGrants: [],
        realEstate: [],
        accounts: [],
        netWorthHistory: [],
        incomeTaxRecords: [],
        isLoading: false,
      });
      return;
    }

    try {
      const res = await fetch(`/api/user/data?clerkId=${user.id}&_t=${Date.now()}`, {
        cache: 'no-store',
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

        setData({ ...userData, isLoading: false });
        return;
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }

    // Fallback — empty data, not mock
    setData(prev => ({ ...prev, isLoading: false }));
  }, [user?.id]);

  const refresh = useCallback(async () => {
    // Clear cache so we always fetch fresh after mutations
    clearUserDataCache();
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!clerkLoaded) return;

    if (!user?.id) {
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
      });
      return;
    }

    // Cache miss — fetch fresh
    fetchData();
  }, [clerkLoaded, user?.id, loadFromCache, fetchData]);

  return (
    <UserDataContext.Provider value={{ ...data, clerkId, refresh }}>
      {children}
    </UserDataContext.Provider>
  );
}
