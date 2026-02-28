'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { mockNetWorthHistory } from '@/lib/mock-data';
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
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      <p className="number-display text-sm font-bold text-text-primary">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export default function NetWorthPage() {
  const { rsuGrants, realEstate, netWorthHistory, isLoading } = useUserData();
  const [timeRange, setTimeRange] = useState<string>('All');

  // Derive totals from context
  const rsuValue = rsuGrants.reduce((sum, g) => sum + g.vested_shares * 190, 0);
  const totalPropertyValue = realEstate.reduce((sum, p) => sum + p.current_value, 0);
  const totalMortgage = realEstate.reduce((sum, p) => sum + p.mortgage_balance, 0);
  const realEstateEquity = totalPropertyValue - totalMortgage;
  const investmentAccounts = 0; // Placeholder until SnapTrade
  const retirementAccounts = 0;
  const cashOther = 0;
  const totalAssets = rsuValue + totalPropertyValue + investmentAccounts + retirementAccounts + cashOther;
  const netWorth = totalAssets - totalMortgage;

  const historyData = netWorthHistory.length > 0
    ? netWorthHistory.map(h => ({ date: h.recorded_date, totalNetWorth: h.total_net_worth }))
    : mockNetWorthHistory;

  const chartData = getFilteredHistory(timeRange, historyData);

  if (isLoading) return <div className="text-center py-20 text-text-secondary">Loading...</div>;

  const assetClasses = [
    { key: 'investmentValue', label: 'Investment Accounts', value: investmentAccounts, color: '#6366f1', pct: totalAssets > 0 ? Math.round(investmentAccounts / totalAssets * 100 * 10) / 10 : 0, icon: '📈', href: '/portfolio' },
    { key: 'retirementValue', label: 'Retirement Accounts', value: retirementAccounts, color: '#818cf8', pct: totalAssets > 0 ? Math.round(retirementAccounts / totalAssets * 100 * 10) / 10 : 0, icon: '🏦', href: '/portfolio' },
    { key: 'realEstateEquity', label: 'Real Estate Equity', value: realEstateEquity, color: '#10b981', pct: totalAssets > 0 ? Math.round(realEstateEquity / totalAssets * 100 * 10) / 10 : 0, icon: '🏠', href: '/real-estate' },
    { key: 'rsuValue', label: 'RSU Value (vested)', value: rsuValue, color: '#f59e0b', pct: totalAssets > 0 ? Math.round(rsuValue / totalAssets * 100 * 10) / 10 : 0, icon: '💼', href: '/equity' },
    { key: 'cashOther', label: 'Cash & Other', value: cashOther, color: '#8888aa', pct: totalAssets > 0 ? Math.round(cashOther / totalAssets * 100 * 10) / 10 : 0, icon: '💰', href: '#' },
  ].filter(a => a.value > 0 || a.key === 'rsuValue'); // Only show non-zero or RSU

  // Calculate change from first to last data point
  const firstValue = chartData[0]?.totalNetWorth || 0;
  const lastValue = chartData[chartData.length - 1]?.totalNetWorth || 0;
  const change = lastValue - firstValue;
  const changePct = firstValue > 0 ? (change / firstValue) * 100 : 0;

  // Milestone markers
  const milestones = [1000000, 2000000, 3000000, 4000000];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl text-text-primary">Net Worth</h1>
        <p className="text-sm text-text-secondary mt-1">Your total financial picture, always current</p>
      </div>

      {/* Hero — Total Net Worth */}
      <Card delay={0.1} className="text-center py-10">
        <p className="text-sm text-text-secondary uppercase tracking-wider mb-2">Total Net Worth</p>
        <p className="number-display text-5xl lg:text-6xl font-bold text-text-primary">
          <AnimatedNumber value={netWorth} format={(n) => formatCurrency(n)} />
        </p>
        <p className={`number-display text-base mt-2 ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {change >= 0 ? '+' : ''}{formatCurrency(change)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%)
        </p>
      </Card>

      {/* Asset Breakdown Bar */}
      <Card delay={0.2}>
        <h3 className="font-display text-lg text-text-primary mb-4">Asset Breakdown</h3>

        {/* Stacked bar */}
        <div className="h-8 rounded-lg overflow-hidden flex mb-6">
          {assetClasses.map((asset, i) => (
            <motion.div
              key={asset.key}
              className="h-full relative group"
              style={{ backgroundColor: asset.color }}
              initial={{ width: 0 }}
              animate={{ width: `${asset.pct}%` }}
              transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
            >
              <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 tooltip-content whitespace-nowrap z-10 transition-opacity">
                {asset.label}: {formatCurrency(asset.value)}
              </div>
            </motion.div>
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
                <span className="number-display text-xs text-text-secondary w-12 text-right">{asset.pct}%</span>
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
      <Card delay={0.3}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg text-text-primary">Net Worth Over Time</h3>
          <div className="flex gap-1">
            {timeRanges.map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`tab-button text-xs px-3 py-1.5 ${timeRange === range ? 'active' : ''}`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="h-80 chart-animate">
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
        {assetClasses.slice(0, 4).map((asset, i) => (
          <Link key={asset.key} href={asset.href}>
            <Card delay={0.5 + i * 0.1} hover className="text-center cursor-pointer">
              <span className="text-3xl">{asset.icon}</span>
              <p className="text-xs text-text-secondary mt-2">{asset.label}</p>
              <p className="number-display text-lg font-bold text-text-primary mt-1">{formatCurrency(asset.value, true)}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
      </div>
    </div>
  );
}
