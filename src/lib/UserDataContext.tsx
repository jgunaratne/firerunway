'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import * as mockDataModule from '@/lib/mock-data';

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
  isLoading: boolean;
  isUsingMockData: boolean;
  refresh: () => void;
}

const defaultProfile: UserProfile = {
  annual_income: 380000,
  annual_spend: 120000,
  retirement_spend: 96000,
  state_of_residence: 'WA',
  filing_status: 'single',
  fire_number: 3000000,
  fire_target_year: 2028,
  swr: 0.04,
};

// ─── Context ────────────────────────────────────────────────────────

const UserDataContext = createContext<UserData>({
  profile: null,
  rsuGrants: [],
  realEstate: [],
  accounts: [],
  netWorthHistory: [],
  isLoading: true,
  isUsingMockData: true,
  refresh: () => { },
});

export function useUserData() {
  return useContext(UserDataContext);
}

// ─── Provider ───────────────────────────────────────────────────────

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded: clerkLoaded } = useUser();
  const [data, setData] = useState<Omit<UserData, 'refresh'>>({
    profile: null,
    rsuGrants: [],
    realEstate: [],
    accounts: [],
    netWorthHistory: [],
    isLoading: true,
    isUsingMockData: true,
  });

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      // No user logged in — use mock data
      setData({
        profile: defaultProfile,
        rsuGrants: mockDataModule.mockRSUGrants.map((g, i) => ({
          id: `mock-${i}`,
          company_ticker: g.companyTicker,
          grant_date: g.grantDate,
          total_shares: g.totalShares,
          vested_shares: g.vestedShares,
          cliff_months: 12,
          vest_period_months: 48,
          vest_frequency: 'quarterly',
        })),
        realEstate: mockDataModule.mockRealEstate.map((p, i) => ({
          id: `mock-${i}`,
          address: p.address,
          property_type: p.propertyType,
          purchase_price: p.purchasePrice,
          purchase_date: p.purchaseDate,
          current_value: p.currentValue,
          original_loan_amount: p.originalLoanAmount,
          mortgage_balance: p.mortgageBalance,
          mortgage_rate: p.mortgageRate,
          mortgage_term_months: p.mortgageTermMonths,
          mortgage_start_date: p.mortgageStartDate,
          monthly_payment: p.monthlyPayment,
          monthly_rent: p.monthlyRent ?? null,
          include_equity_in_fire: false,
        })),
        accounts: [],
        netWorthHistory: mockDataModule.mockNetWorthHistory.map(h => ({
          recorded_date: h.date,
          total_net_worth: h.totalNetWorth,
          investment_value: h.investmentValue,
          retirement_value: h.retirementValue,
          rsu_value: h.rsuValue,
          real_estate_equity: h.realEstateEquity,
        })),
        isLoading: false,
        isUsingMockData: true,
      });
      return;
    }

    try {
      const res = await fetch(`/api/user/data?clerkId=${user.id}`);
      if (res.ok) {
        const json = await res.json();
        const hasRealData = json.profile || json.rsuGrants?.length > 0 || json.realEstate?.length > 0;

        if (hasRealData) {
          setData({
            profile: json.profile || defaultProfile,
            rsuGrants: json.rsuGrants ?? [],
            realEstate: json.realEstate ?? [],
            accounts: json.accounts ?? [],
            netWorthHistory: json.netWorthHistory ?? [],
            isLoading: false,
            isUsingMockData: false,
          });
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }

    // Fallback to mock data
    setData(prev => ({ ...prev, profile: defaultProfile, isLoading: false, isUsingMockData: true }));
  }, [user?.id]);

  useEffect(() => {
    if (clerkLoaded) fetchData();
  }, [clerkLoaded, fetchData]);

  return (
    <UserDataContext.Provider value={{ ...data, refresh: fetchData }}>
      {children}
    </UserDataContext.Provider>
  );
}
