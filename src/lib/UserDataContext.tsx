'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

// Resolved at build time — determines if Clerk hooks are called
const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

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

interface UserData {
  profile: UserProfile | null;
  rsuGrants: RSUGrant[];
  realEstate: RealEstateProperty[];
  accounts: AccountSnapshot[];
  netWorthHistory: NetWorthEntry[];
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
  clerkId: null,
  isLoading: true,
  refresh: () => Promise.resolve(),
});

export function useUserData() {
  return useContext(UserDataContext);
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
    isLoading: true,
  });

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      // No user logged in — show empty state (no mock data)
      setData({
        profile: null,
        rsuGrants: [],
        realEstate: [],
        accounts: [],
        netWorthHistory: [],
        isLoading: false,
      });
      return;
    }

    try {
      const res = await fetch(`/api/user/data?clerkId=${user.id}`);
      if (res.ok) {
        const json = await res.json();
        console.log('[UserData] Refreshed. realEstate count:', json.realEstate?.length, json.realEstate?.map((p: { address: string }) => p.address));
        setData({
          profile: json.profile || null,
          rsuGrants: json.rsuGrants ?? [],
          realEstate: json.realEstate ?? [],
          accounts: json.accounts ?? [],
          netWorthHistory: json.netWorthHistory ?? [],
          isLoading: false,
        });
        return;
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }

    // Fallback — empty data, not mock
    setData(prev => ({ ...prev, isLoading: false }));
  }, [user?.id]);

  useEffect(() => {
    if (clerkLoaded) fetchData();
  }, [clerkLoaded, fetchData]);

  return (
    <UserDataContext.Provider value={{ ...data, clerkId, refresh: fetchData }}>
      {children}
    </UserDataContext.Provider>
  );
}
