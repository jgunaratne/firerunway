'use client';

import { useMemo } from 'react';
import { useUserData } from '@/lib/UserDataContext';
import { useBrokerageData } from '@/lib/BrokerageDataContext';
import { useStockPrice } from '@/hooks/useStockPrice';

export interface NetWorthBreakdown {
  /** Total net worth = investments + realEstateEquity */
  totalNetWorth: number;
  /** SnapTrade portfolio value, or RSU estimate if no brokerage connected */
  investable: number;
  /** Vested RSU value at current stock price */
  rsuValue: number;
  /** Real estate equity (value - mortgage) */
  realEstateEquity: number;
  /** Total property value before debt */
  totalPropertyValue: number;
  /** Total mortgage debt */
  totalMortgageDebt: number;
  /** Current stock price for RSU ticker */
  stockPrice: number;
  /** RSU ticker symbol */
  ticker: string;
  /** True while any data source is still loading */
  isLoading: boolean;
}

/**
 * Single source of truth for Net Worth across all pages.
 *
 * Formula:
 *   investable = SnapTrade portfolio value (if connected), otherwise vested RSU value
 *   realEstateEquity = Σ(property value - mortgage balance)
 *   totalNetWorth = investable + realEstateEquity
 */
export function useNetWorth(): NetWorthBreakdown {
  const { rsuGrants, realEstate, isLoading: userLoading } = useUserData();
  const { totalInvestment, loading: holdingsLoading } = useBrokerageData();

  const ticker = rsuGrants[0]?.company_ticker || '';
  const stockPrice = useStockPrice(ticker);

  return useMemo(() => {
    const rsuValue = rsuGrants.reduce((sum, g) => sum + g.vested_shares * stockPrice, 0);
    const totalPropertyValue = realEstate.reduce((sum, p) => sum + p.current_value, 0);
    const totalMortgageDebt = realEstate.reduce((sum, p) => sum + p.mortgage_balance, 0);
    const realEstateEquity = totalPropertyValue - totalMortgageDebt;

    // Use real portfolio value from brokerages if available, otherwise fall back to RSU estimate
    const investable = totalInvestment > 0 ? totalInvestment : rsuValue;
    const totalNetWorth = investable + realEstateEquity;

    return {
      totalNetWorth,
      investable,
      rsuValue,
      realEstateEquity,
      totalPropertyValue,
      totalMortgageDebt,
      stockPrice,
      ticker,
      isLoading: userLoading || holdingsLoading,
    };
  }, [rsuGrants, realEstate, totalInvestment, stockPrice, ticker, userLoading, holdingsLoading]);
}
