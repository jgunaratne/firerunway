'use client';

import { useState, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import Card from '@/components/shared/Card';
import AIAnalysis from '@/components/shared/AIAnalysis';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { TrendingUp, Home, Briefcase } from 'lucide-react';
import { useBrokerageData } from '@/lib/BrokerageDataContext';
import { useStockPrice } from '@/hooks/useStockPrice';
import Link from 'next/link';


const timeRanges = ['3M', '6M', '1Y', '3Y', 'All'] as const;

function getFilteredHistory(range: string, history: Array<{ date: string; totalNetWorth: number }>) {
  const now = new Date();
  let cutoff = new Date('2023-03-01');
  if (range === '3M') cutoff = new Date(now.getTime() - 90 * 86400000);
  else if (range === '6M') cutoff = new Date(now.getTime() - 180 * 86400000);
  else if (range === '1Y') cutoff = new Date(now.getTime() - 365 * 86400000);
  else if (range === '3Y') cutoff = new Date(now.getTime() - 1095 * 86400000);
  return history.filter(d => new Date(d.date) >= cutoff);
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-content">
      <p className="text-sm text-text-secondary mb-1 uppercase tracking-wider">{label}</p>
      <p className="number-display text-sm font-bold text-text-primary glow-text">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export default function NetWorthPage() {
  const { rsuGrants, realEstate, netWorthHistory, isLoading, clerkId: userId } = useUserData();
  const { totalInvestment, loading: holdingsLoading } = useBrokerageData();
  const [timeRange, setTimeRange] = useState<string>('All');

  // Derive totals from context + SnapTrade
  const ticker = rsuGrants[0]?.company_ticker || 'AMZN';
  const stockPrice = useStockPrice(ticker);
  const rsuValue = rsuGrants.reduce((sum, g) => sum + g.vested_shares * stockPrice, 0);
  const totalPropertyValue = realEstate.reduce((sum, p) => sum + p.current_value, 0);
  const totalMortgage = realEstate.reduce((sum, p) => sum + p.mortgage_balance, 0);
  const realEstateEquity = totalPropertyValue - totalMortgage;
  const investmentAccounts = totalInvestment; // Real portfolio value from SnapTrade
  const totalAssets = rsuValue + totalPropertyValue + investmentAccounts;
  const netWorth = totalAssets - totalMortgage;

  // Use real history if available, otherwise show current value as single data point
  const historyData = netWorthHistory.length > 0
    ? netWorthHistory.map(h => ({ date: h.recorded_date, totalNetWorth: h.total_net_worth }))
    : [{ date: new Date().toISOString().split('T')[0], totalNetWorth: netWorth }];

  const chartData = getFilteredHistory(timeRange, historyData);

  const handleAnalyze = useCallback(async (): Promise<{ analysis: string }> => {
    const res = await fetch(`/api/net-worth/analyze?clerkId=${userId}`, { method: 'POST' });
    if (!res.ok) throw new Error('Analysis failed');
    return res.json();
  }, [userId]);

  if (isLoading || holdingsLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-text-secondary text-sm">Loading net worth data...</p>
      </div>
    </div>
  );


  const assetClasses = [
    { key: 'investmentValue', label: 'Investment Accounts', value: investmentAccounts, color: '#6366f1', pct: totalAssets > 0 ? Math.round(investmentAccounts / totalAssets * 100 * 10) / 10 : 0, icon: <TrendingUp size={16} />, href: '/portfolio' },
    { key: 'realEstateEquity', label: 'Real Estate Equity', value: realEstateEquity, color: '#10b981', pct: totalAssets > 0 ? Math.round(realEstateEquity / totalAssets * 100 * 10) / 10 : 0, icon: <Home size={16} />, href: '/real-estate' },
    { key: 'rsuValue', label: 'RSU Value (vested)', value: rsuValue, color: '#f59e0b', pct: totalAssets > 0 ? Math.round(rsuValue / totalAssets * 100 * 10) / 10 : 0, icon: <Briefcase size={16} />, href: '/equity' },
  ].filter(a => a.value > 0 || a.key === 'rsuValue'); // Only show non-zero or RSU

  // Calculate change from first to last data point
  const firstValue = chartData[0]?.totalNetWorth || 0;
  const lastValue = chartData[chartData.length - 1]?.totalNetWorth || 0;
  const change = lastValue - firstValue;
  const changePct = firstValue > 0 ? (change / firstValue) * 100 : 0;

  // Milestone markers
  const milestones = [1000000, 2000000, 3000000, 4000000];

  return (
    <div className="space-y-8">
      <div
      >
        <h1 className="page-title">Net Worth</h1>
        <p className="page-subtitle">Your total financial picture, always current</p>
      </div>

      {/* Hero — Total Net Worth */}
      <Card className="text-center py-12 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent/[0.06] rounded-full blur-3xl pointer-events-none" />
        <p className="stat-label mb-3 relative z-10">Total Net Worth</p>
        <p className="number-display text-5xl lg:text-6xl font-bold text-text-primary glow-text relative z-10">
          <AnimatedNumber value={netWorth} format={(n) => formatCurrency(n)} />
        </p>
        <p className={`number-display text-base mt-3 relative z-10 ${change >= 0 ? 'text-emerald-400 glow-text-green' : 'text-red-400 glow-text-red'}`}>
          {change >= 0 ? '+' : ''}{formatCurrency(change)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%)
        </p>
      </Card>

      {/* Asset Breakdown Bar */}
      <Card>
        <h3 className="section-title">Asset Breakdown</h3>

        {/* Stacked bar */}
        <div className="h-8 rounded-lg overflow-hidden flex mb-6">
          {assetClasses.map((asset) => (
            <div
              key={asset.key}
              className="h-full relative group"
              style={{ backgroundColor: asset.color }}
              animate={{ width: `${asset.pct}%` }}
            >
              <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 tooltip-content whitespace-nowrap z-10 transition-opacity">
                {asset.label}: {formatCurrency(asset.value)}
              </div>
            </div>
          ))}
        </div>

        {/* Asset table */}
        <div className="space-y-2">
          {assetClasses.map((asset) => (
            <div key={asset.key} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: asset.color }} />
                <span className="text-sm text-text-secondary">{asset.label}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="number-display text-sm text-text-primary font-medium">{formatCurrency(asset.value)}</span>
                <span className="number-display text-sm text-text-secondary w-12 text-right">{asset.pct}%</span>
              </div>
            </div>
          ))}
          <div className="border-t border-border pt-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">Total Assets</span>
            <span className="number-display text-sm font-bold text-text-primary">{formatCurrency(totalAssets)}</span>
          </div>
          <div className="flex items-center justify-between text-red-400">
            <span className="text-sm">Mortgage(s)</span>
            <span className="number-display text-sm">−{formatCurrency(totalMortgage)}</span>
          </div>
          <div className="border-t border-border pt-2 flex items-center justify-between">
            <span className="text-sm font-bold text-text-primary">Net Worth</span>
            <span className="number-display text-sm font-bold text-accent-green">{formatCurrency(netWorth)}</span>
          </div>
        </div>
      </Card>

      {/* Net Worth Over Time */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title mb-0">Net Worth Over Time</h3>
          <div className="flex gap-1">
            {timeRanges.map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`tab-button text-sm px-3 py-1.5 ${timeRange === range ? 'active' : ''}`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="h-80 chart-animate relative">
          {/* Chart background glow */}
          <div className="absolute inset-0 bg-gradient-to-t from-accent/[0.03] to-transparent rounded-xl pointer-events-none" />
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="#2a2a3a"
                tick={{ fill: '#8888aa', fontSize: 11 }}
                tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#2a2a3a"
                tick={{ fill: '#8888aa', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Milestone lines */}
              {milestones.map((m) => (
                <Area key={m} type="monotone" dataKey={() => m} stroke="none" fill="none" />
              ))}
              <Area
                type="monotone"
                dataKey="totalNetWorth"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#nwGradient)"
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Asset Class Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {assetClasses.slice(0, 4).map((asset) => (
          <Link key={asset.key} href={asset.href}>
            <Card hover className="text-center cursor-pointer">
              <span className="text-3xl">{asset.icon}</span>
              <p className="text-sm text-text-secondary mt-2">{asset.label}</p>
              <p className="number-display text-lg font-bold text-text-primary mt-1">{formatCurrency(asset.value, true)}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* AI Analysis */}
      <AIAnalysis
        type="net_worth"
        onAnalyze={handleAnalyze}
        ready={netWorth > 0}
      />

      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
      </div>
    </div>
  );
}
