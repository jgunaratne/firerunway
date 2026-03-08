'use client';

import { useState, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import AIAnalysis from '@/components/shared/AIAnalysis';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { TrendingUp, Home, Briefcase, Activity } from 'lucide-react';
import { useNetWorth } from '@/hooks/useNetWorth';
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

const formatAxisCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value}`;
};

export default function NetWorthPage() {
  const { netWorthHistory, isLoading, uid: userId } = useUserData();
  const [timeRange, setTimeRange] = useState<string>('All');

  const {
    totalNetWorth: netWorth,
    investable: investmentAccounts,
    rsuValue,
    totalPropertyValue,
    totalMortgageDebt: totalMortgage,
    realEstateEquity,
    isLoading: nwLoading,
  } = useNetWorth();

  const historyData = netWorthHistory.length > 0
    ? netWorthHistory.map(h => ({ date: h.recorded_date, totalNetWorth: h.total_net_worth }))
    : [{ date: new Date().toISOString().split('T')[0], totalNetWorth: netWorth }];

  const chartData = getFilteredHistory(timeRange, historyData);

  const handleAnalyze = useCallback(async (): Promise<{ analysis: string }> => {
    const res = await fetch(`/api/net-worth/analyze?uid=${userId}`, { method: 'POST' });
    if (!res.ok) throw new Error('Analysis failed');
    return res.json();
  }, [userId]);

  if (isLoading || nwLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-text-secondary text-sm">Loading net worth data...</p>
      </div>
    </div>
  );

  const totalAssets = investmentAccounts + rsuValue + totalPropertyValue;
  const assetClasses = [
    { key: 'investmentValue', label: 'Investment Accounts', value: investmentAccounts, color: 'accent', pct: totalAssets > 0 ? Math.round(investmentAccounts / totalAssets * 100 * 10) / 10 : 0, icon: <TrendingUp className="w-5 h-5 text-accent" />, href: '/portfolio' },
    { key: 'realEstateEquity', label: 'Real Estate Equity', value: realEstateEquity, color: 'accent-green', pct: totalAssets > 0 ? Math.round(realEstateEquity / totalAssets * 100 * 10) / 10 : 0, icon: <Home className="w-5 h-5 text-accent-green" />, href: '/real-estate' },
    { key: 'rsuValue', label: 'RSU Value (vested)', value: rsuValue, color: 'accent-amber', pct: totalAssets > 0 ? Math.round(rsuValue / totalAssets * 100 * 10) / 10 : 0, icon: <Briefcase className="w-5 h-5 text-accent-amber" />, href: '/equity' },
  ].filter(a => a.value > 0 || a.key === 'rsuValue');

  const firstValue = chartData[0]?.totalNetWorth || 0;
  const lastValue = chartData[chartData.length - 1]?.totalNetWorth || 0;
  const change = lastValue - firstValue;
  const changePct = firstValue > 0 ? (change / firstValue) * 100 : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Net Worth</h1>
        <p className="text-text-secondary">Your total financial picture, always current</p>
      </div>

      {/* Total Net Worth Hero */}
      <div className="relative p-10 rounded-2xl border border-border bg-bg-surface/50 backdrop-blur-sm flex flex-col items-center justify-center text-center overflow-hidden shadow-2xl shadow-black/20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium uppercase tracking-wider mb-6">
            <Activity className="w-3 h-3" />
            <span>Total Net Worth</span>
          </div>
          <div className="text-6xl md:text-7xl font-bold font-mono tracking-tight mb-6">
            <AnimatedNumber value={netWorth} format={(n) => formatCurrency(n)} />
          </div>
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium ${change >= 0
            ? 'bg-accent-green/10 border border-accent-green/20 text-accent-green'
            : 'bg-accent-red/10 border border-accent-red/20 text-accent-red'
            }`}>
            <TrendingUp className="w-4 h-4" />
            {change >= 0 ? '+' : ''}{formatCurrency(change)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%)
          </div>
        </div>
      </div>

      {/* Asset Breakdown */}
      <div className="rounded-2xl border border-border bg-bg-surface/50 backdrop-blur-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className="w-1 h-5 bg-accent rounded-full" />
          <h2 className="text-lg font-semibold">Asset Breakdown</h2>
        </div>
        <div className="p-6">
          {/* Stacked Bar */}
          <div className="h-4 rounded-full overflow-hidden flex w-full mb-8 bg-bg-elevated">
            {assetClasses.map((asset) => (
              <div
                key={asset.key}
                className={`h-full bg-${asset.color} hover:opacity-90 transition-opacity cursor-pointer`}
                style={{ width: `${asset.pct}%` }}
                title={`${asset.label}: ${asset.pct}%`}
              />
            ))}
          </div>

          {/* Breakdown List */}
          <div className="space-y-4">
            {assetClasses.map((asset) => (
              <div key={asset.key} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full bg-${asset.color}`} />
                  <span className="text-text-secondary">{asset.label}</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="font-mono font-medium">{formatCurrency(asset.value)}</span>
                  <span className="text-text-secondary font-mono w-12 text-right">{asset.pct}%</span>
                </div>
              </div>
            ))}

            <div className="pt-4 mt-4 border-t border-border/50">
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="font-medium">Total Assets</span>
                <span className="font-mono font-medium">{formatCurrency(totalAssets)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-4">
                <span className="text-accent-red">Mortgage(s)</span>
                <span className="font-mono text-accent-red">-{formatCurrency(totalMortgage)}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-4 border-t border-border/50">
                <span className="font-semibold">Net Worth</span>
                <span className="font-mono font-semibold text-accent-green">{formatCurrency(netWorth)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Net Worth Over Time */}
      <div className="rounded-2xl border border-border bg-bg-surface/50 backdrop-blur-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-accent rounded-full" />
            <h2 className="text-lg font-semibold">Net Worth Over Time</h2>
          </div>
          <div className="flex gap-2">
            {timeRanges.map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`text-xs px-3 py-1.5 rounded transition-colors ${timeRange === range
                  ? 'bg-bg-elevated text-white border border-border'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--color-text-secondary)', fontSize: 12, fontFamily: 'monospace' }}
                  tickFormatter={formatAxisCurrency}
                  domain={['dataMin - 1000000', 'dataMax + 500000']}
                  dx={-10}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-bg-elevated)',
                    borderColor: 'var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text-primary)'
                  }}
                  itemStyle={{ color: 'var(--color-accent)' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Net Worth']}
                />
                <Area
                  type="monotone"
                  dataKey="totalNetWorth"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {assetClasses.map((asset) => (
          <Link key={asset.key} href={asset.href}>
            <div className="p-6 rounded-2xl border border-border bg-bg-surface/50 backdrop-blur-sm flex flex-col items-center justify-center text-center hover:bg-bg-elevated/50 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-bg-elevated border border-border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {asset.icon}
              </div>
              <div className="text-sm text-text-secondary mb-1">{asset.label}</div>
              <div className="text-2xl font-bold font-mono">{formatCurrency(asset.value, true)}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* AI Analysis */}
      <AIAnalysis
        type="net_worth"
        onAnalyze={handleAnalyze}
        ready={netWorth > 0}
      />

      <div className="text-center text-xs text-text-secondary pt-8 pb-4">
        FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
      </div>
    </div>
  );
}
