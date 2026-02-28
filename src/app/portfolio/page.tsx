'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  Legend, LineChart, Line,
} from 'recharts';
import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency } from '@/lib/calculations';
import { mockAccounts, mockAllocation, mockPortfolioHistory, mockETFRecommendations } from '@/lib/mock-data';

const tabs = ['Holdings', 'Allocation', 'Performance'] as const;

function AccountBucket({ title, account, delay }: { title: string; account: { type: string; name: string; totalValue: number; holdings: { ticker: string; name: string; shares: number; price: number; value: number; costBasis: number; change1d: number }[] }; delay: number }) {
  const [expanded, setExpanded] = useState(true);
  const totalGain = account.holdings.reduce((sum, h) => sum + (h.value - h.costBasis), 0);

  return (
    <Card delay={delay} className="overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
          <p className="text-xs text-text-secondary">{account.name}</p>
        </div>
        <div className="text-right">
          <p className="number-display text-lg font-bold text-text-primary">{formatCurrency(account.totalValue)}</p>
          <p className={`number-display text-xs ${totalGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain)} total
          </p>
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mt-4"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-text-secondary border-b border-border">
                  <th className="text-left pb-2 font-medium">Ticker</th>
                  <th className="text-right pb-2 font-medium">Shares</th>
                  <th className="text-right pb-2 font-medium">Price</th>
                  <th className="text-right pb-2 font-medium">Value</th>
                  <th className="text-right pb-2 font-medium hidden md:table-cell">Gain/Loss</th>
                  <th className="text-right pb-2 font-medium hidden md:table-cell">1D</th>
                </tr>
              </thead>
              <tbody>
                {account.holdings.map((h) => {
                  const gain = h.value - h.costBasis;
                  return (
                    <tr key={h.ticker} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="py-2">
                        <p className="number-display font-semibold text-text-primary">{h.ticker}</p>
                        <p className="text-xs text-text-secondary hidden md:block">{h.name}</p>
                      </td>
                      <td className="text-right number-display py-2">{h.shares.toLocaleString()}</td>
                      <td className="text-right number-display py-2">${h.price.toFixed(2)}</td>
                      <td className="text-right number-display font-medium py-2">{formatCurrency(h.value)}</td>
                      <td className={`text-right number-display py-2 hidden md:table-cell ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {gain >= 0 ? '+' : ''}{formatCurrency(gain)}
                      </td>
                      <td className={`text-right number-display py-2 hidden md:table-cell ${h.change1d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {h.change1d >= 0 ? '+' : ''}{h.change1d.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </Card>
  );
}

function HoldingsTab() {
  return (
    <div className="space-y-4">
      <AccountBucket title="Taxable Brokerage" account={mockAccounts.brokerage} delay={0.1} />
      <AccountBucket title="Tax-Advantaged (401k)" account={mockAccounts.retirement401k} delay={0.2} />
      <AccountBucket title="Roth IRA" account={mockAccounts.rothIRA} delay={0.3} />

      {/* Totals bar */}
      <Card delay={0.4} className="bg-accent/5 border-accent/20">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text-primary">Total Portfolio Value</span>
          <div className="text-right">
            <p className="number-display text-xl font-bold text-text-primary">
              <AnimatedNumber value={3080000} format={(n) => formatCurrency(n)} />
            </p>
            <p className="text-xs text-text-secondary">Last synced: just now</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

const DONUT_COLORS = ['#6366f1', '#818cf8', '#10b981', '#8888aa', '#f59e0b'];

function AllocationTab() {
  const currentData = [
    { name: 'US Equity', value: mockAllocation.current.usEquity },
    { name: 'Intl Equity', value: mockAllocation.current.intlEquity },
    { name: 'Bonds', value: mockAllocation.current.bonds },
    { name: 'Cash', value: mockAllocation.current.cash },
    { name: 'Employer Stock', value: mockAllocation.current.employerStock },
  ];
  const recommendedData = [
    { name: 'US Equity', value: mockAllocation.recommended.usEquity },
    { name: 'Intl Equity', value: mockAllocation.recommended.intlEquity },
    { name: 'Bonds', value: mockAllocation.recommended.bonds },
    { name: 'Cash', value: mockAllocation.recommended.cash },
  ];

  const gapData = [
    { name: 'US Equity', current: 72, recommended: 53.2, gap: 72 - 53.2 },
    { name: 'Intl Equity', current: 8, recommended: 22.8, gap: 8 - 22.8 },
    { name: 'Bonds', current: 3, recommended: 19, gap: 3 - 19 },
    { name: 'Cash', current: 5, recommended: 5, gap: 0 },
    { name: 'Employer Stock', current: 12, recommended: 0, gap: 12 },
  ];

  return (
    <div className="space-y-6">
      {/* Donut charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card delay={0.1}>
          <h4 className="text-sm font-semibold text-text-primary mb-2">Your Current Allocation</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={currentData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" animationDuration={1000}>
                  {currentData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#8888aa' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card delay={0.2}>
          <h4 className="text-sm font-semibold text-text-primary mb-1">Recommended for Your Profile</h4>
          <p className="text-xs text-text-secondary mb-2">Based on a 2028 target date and moderate risk tolerance</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={recommendedData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" animationDuration={1000} animationBegin={200}>
                  {recommendedData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#8888aa' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Gap Analysis */}
      <Card delay={0.3}>
        <h4 className="text-sm font-semibold text-text-primary mb-4">Allocation Gap Analysis</h4>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gapData} layout="vertical">
              <XAxis type="number" tick={{ fill: '#8888aa', fontSize: 11 }} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`} domain={[-20, 20]} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#8888aa', fontSize: 11 }} width={100} />
              <Tooltip formatter={(v) => `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(1)}%`} contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 13 }} />
              <Bar dataKey="gap" animationDuration={800}>
                {gapData.map((entry, i) => (
                  <Cell key={i} fill={entry.gap > 0 ? '#10b981' : entry.gap < 0 ? '#ef4444' : '#8888aa'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ETF Recommendations */}
      <Card delay={0.4}>
        <h4 className="text-sm font-semibold text-text-primary mb-4">Recommended Low-Cost ETFs</h4>
        {Object.entries(mockETFRecommendations).map(([category, etfs]) => (
          <div key={category} className="mb-4 last:mb-0">
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">
              {category === 'usEquity' ? 'US Equity' : category === 'intlEquity' ? 'International Equity' : 'Bonds'}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-text-secondary border-b border-border/50">
                    <th className="text-left pb-1 font-medium">ETF</th>
                    <th className="text-right pb-1 font-medium">Expense Ratio</th>
                    <th className="text-right pb-1 font-medium">10yr Return</th>
                  </tr>
                </thead>
                <tbody>
                  {etfs.map((etf) => (
                    <tr key={etf.ticker} className="border-b border-border/30">
                      <td className="py-1.5">
                        <span className="number-display font-semibold text-text-primary">{etf.ticker}</span>
                        <span className="text-text-secondary ml-2 text-xs">{etf.name}</span>
                      </td>
                      <td className="text-right number-display text-emerald-400">{etf.expenseRatio}%</td>
                      <td className="text-right number-display">{etf.return10yr}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="text-[10px] text-text-secondary/50 mt-3 italic">This is educational information, not personalized investment advice.</p>
      </Card>
    </div>
  );
}

function PerformanceTab() {
  const [timeRange, setTimeRange] = useState('1Y');
  const ranges = ['1M', '3M', '6M', '1Y', 'All'];

  const now = new Date('2026-02-27');
  const cutoffs: Record<string, Date> = {
    '1M': new Date(now.getTime() - 30 * 86400000),
    '3M': new Date(now.getTime() - 90 * 86400000),
    '6M': new Date(now.getTime() - 180 * 86400000),
    '1Y': new Date(now.getTime() - 365 * 86400000),
    'All': new Date('2023-03-01'),
  };

  const data = mockPortfolioHistory.filter(d => new Date(d.date) >= cutoffs[timeRange]);

  return (
    <div className="space-y-4">
      <Card delay={0.1}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-text-primary">Portfolio Performance</h4>
          <div className="flex gap-1">
            {ranges.map((r) => (
              <button key={r} onClick={() => setTimeRange(r)} className={`tab-button text-xs px-3 py-1 ${timeRange === r ? 'active' : ''}`}>{r}</button>
            ))}
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="date" stroke="#2a2a3a" tick={{ fill: '#8888aa', fontSize: 11 }} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short' })} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis stroke="#2a2a3a" tick={{ fill: '#8888aa', fontSize: 11, fontFamily: 'JetBrains Mono' }} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} tickLine={false} axisLine={false} width={60} />
              <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 13 }} formatter={(v) => formatCurrency(Number(v))} />
              <Line type="monotone" dataKey="portfolio" stroke="#6366f1" strokeWidth={2} dot={false} animationDuration={1200} name="Your Portfolio" />
              <Line type="monotone" dataKey="sp500" stroke="#8888aa" strokeWidth={1} strokeDasharray="4 4" dot={false} animationDuration={1200} name="S&P 500" />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('Holdings');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl text-text-primary">Portfolio</h1>
        <p className="text-sm text-text-secondary mt-1">All your investments in one place</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`tab-button ${activeTab === tab ? 'active' : ''}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'Holdings' && <HoldingsTab />}
        {activeTab === 'Allocation' && <AllocationTab />}
        {activeTab === 'Performance' && <PerformanceTab />}
      </motion.div>

      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
      </div>
    </div>
  );
}
