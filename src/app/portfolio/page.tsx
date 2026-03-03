'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  Legend,
} from 'recharts';
import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency } from '@/lib/calculations';
import { mockETFRecommendations } from '@/lib/mock-data';
import { useSearchParams } from 'next/navigation';
import { useSafeAuth } from '@/hooks/useSafeAuth';
import { useHoldingsCache } from '@/hooks/useHoldingsCache';

const tabs = ['Holdings', 'Allocation', 'Performance', 'Accounts'] as const;



function HoldingsTab() {
  const { userId } = useSafeAuth();
  const { positions, totalInvestment, loading } = useHoldingsCache(userId);

  if (loading) {
    return <div className="text-center py-10 text-text-secondary text-sm">Loading holdings...</div>;
  }

  if (positions.length === 0) {
    return (
      <Card delay={0.1}>
        <div className="text-center py-8">
          <p className="text-text-secondary text-sm">No holdings found.</p>
          <p className="text-text-secondary/60 text-xs mt-2">
            Connect a brokerage account in the Accounts tab to see your real holdings.
          </p>
        </div>
      </Card>
    );
  }

  // Group positions by account
  const grouped = positions.reduce((acc, pos) => {
    const key = pos.accountName || 'Unknown Account';
    if (!acc[key]) acc[key] = { name: key, type: pos.accountType, holdings: [] };
    acc[key].holdings.push(pos);
    return acc;
  }, {} as Record<string, { name: string; type: string; holdings: typeof positions }>);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([name, group], i) => {
        const accountTotal = group.holdings.reduce((sum, h) => sum + h.value, 0);
        return (
          <Card key={name} delay={0.1 * (i + 1)} className="overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">{name}</h4>
                <p className="text-xs text-text-secondary">{group.type}</p>
              </div>
              <p className="number-display text-lg font-bold text-text-primary">{formatCurrency(accountTotal)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-text-secondary border-b border-border">
                    <th className="text-left pb-2 font-medium">Ticker</th>
                    <th className="text-right pb-2 font-medium">Shares</th>
                    <th className="text-right pb-2 font-medium">Price</th>
                    <th className="text-right pb-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {group.holdings.map((h, j) => (
                    <tr key={`${h.ticker}-${j}`} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="py-2">
                        <p className="number-display font-semibold text-text-primary">{h.ticker}</p>
                        <p className="text-xs text-text-secondary hidden md:block">{h.name}</p>
                      </td>
                      <td className="text-right number-display py-2">{h.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                      <td className="text-right number-display py-2">${h.price.toFixed(2)}</td>
                      <td className="text-right number-display font-medium py-2">{formatCurrency(h.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}

      {/* Totals bar */}
      <Card delay={0.4} className="bg-accent/5 border-accent/20">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text-primary">Total Portfolio Value</span>
          <div className="text-right">
            <p className="number-display text-xl font-bold text-text-primary">
              <AnimatedNumber value={totalInvestment} format={(n) => formatCurrency(n)} />
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
  const { userId } = useSafeAuth();
  const { positions, totalInvestment, loading } = useHoldingsCache(userId);

  // Compute allocation from positions
  const allocationData = (() => {
    if (totalInvestment <= 0 || positions.length === 0) return [];
    const byTicker: Record<string, number> = {};
    for (const pos of positions) {
      const key = pos.ticker || 'Other';
      byTicker[key] = (byTicker[key] || 0) + pos.value;
    }
    const sorted = Object.entries(byTicker).sort((a, b) => b[1] - a[1]);
    const topN = sorted.slice(0, 8);
    const rest = sorted.slice(8).reduce((s, [, v]) => s + v, 0);
    const chartData = topN.map(([name, value]) => ({
      name,
      value: Math.round((value / totalInvestment) * 1000) / 10,
    }));
    if (rest > 0) chartData.push({ name: 'Other', value: Math.round((rest / totalInvestment) * 1000) / 10 });
    return chartData;
  })();

  const recommendedData = [
    { name: 'US Equity', value: 53.2 },
    { name: 'Intl Equity', value: 22.8 },
    { name: 'Bonds', value: 19 },
    { name: 'Cash', value: 5 },
  ];

  if (loading) return <div className="text-center py-10 text-text-secondary text-sm">Loading allocation...</div>;

  if (allocationData.length === 0) {
    return (
      <Card delay={0.1}>
        <div className="text-center py-8">
          <p className="text-text-secondary text-sm">No allocation data available.</p>
          <p className="text-text-secondary/60 text-xs mt-2">Connect a brokerage in the Accounts tab.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card delay={0.1}>
          <h4 className="text-sm font-semibold text-text-primary mb-2">Your Current Allocation</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocationData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" animationDuration={1000}>
                  {allocationData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
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

      <Card delay={0.3}>
        <h4 className="text-sm font-semibold text-text-primary mb-4">Allocation Breakdown</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-text-secondary border-b border-border">
              <th className="text-left pb-2 font-medium">Holding</th>
              <th className="text-right pb-2 font-medium">% of Portfolio</th>
            </tr>
          </thead>
          <tbody>
            {allocationData.map((item) => (
              <tr key={item.name} className="border-b border-border/50">
                <td className="py-2 font-medium text-text-primary">{item.name}</td>
                <td className="text-right number-display py-2">{item.value.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card delay={0.4}>
        <h4 className="text-sm font-semibold text-text-primary mb-4">Recommended Low-Cost ETFs</h4>
        {Object.entries(mockETFRecommendations).map(([category, etfs]) => (
          <div key={category} className="mb-4 last:mb-0">
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">
              {category === 'usEquity' ? 'US Equity' : category === 'intlEquity' ? 'International Equity' : 'Bonds'}
            </p>
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
        ))}
        <p className="text-[10px] text-text-secondary/50 mt-3 italic">This is educational information, not personalized investment advice.</p>
      </Card>
    </div>
  );
}


function PerformanceTab() {
  const { userId } = useSafeAuth();
  const { totalInvestment, loading } = useHoldingsCache(userId);

  if (loading) return <div className="text-center py-10 text-text-secondary text-sm">Loading performance...</div>;

  return (
    <div className="space-y-4">
      <Card delay={0.1}>
        <h4 className="text-sm font-semibold text-text-primary mb-4">Portfolio Performance</h4>
        <div className="text-center py-8">
          <p className="text-text-secondary/60 text-xs uppercase tracking-wider mb-2">Current Portfolio Value</p>
          <p className="number-display text-3xl font-bold text-text-primary">
            {totalInvestment > 0 ? <AnimatedNumber value={totalInvestment} format={(n) => formatCurrency(n)} /> : '—'}
          </p>
          <p className="text-xs text-text-secondary mt-2">as of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
      </Card>

      <Card delay={0.2} className="border-accent/20">
        <div className="text-center py-6">
          <span className="text-2xl mb-2 block">📈</span>
          <h4 className="text-sm font-semibold text-text-primary mb-2">Performance History Coming Soon</h4>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            Historical portfolio tracking will build automatically as daily snapshots are collected.
            Check back in a few days to see your portfolio performance over time.
          </p>
        </div>
      </Card>
    </div>
  );
}

// Brokerages that can be connected — shown as cards
const brokerages = [
  { id: 'FIDELITY', name: 'Fidelity', icon: '🟢' },
  { id: 'VANGUARD', name: 'Vanguard', icon: '🔴' },
  { id: 'SCHWAB', name: 'Charles Schwab', icon: '🔵' },
  { id: '', name: 'Other Brokerage', icon: '🏦' },
];

interface ConnectedAccount {
  id: string;
  name: string;
  number: string;
  institution_name: string;
  meta?: { type?: string };
}

function AccountsTab() {
  const { userId } = useSafeAuth();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/snaptrade/accounts?clerkId=${userId}`);
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch {
      console.error('Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const connectBrokerage = async (brokerId?: string) => {
    if (!userId) return;
    setConnecting(true);
    setError(null);
    try {
      // Step 1: Register user (idempotent)
      await fetch('/api/snaptrade/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkId: userId }),
      });

      // Step 2: Get connection portal URL
      const connectRes = await fetch('/api/snaptrade/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkId: userId, broker: brokerId || undefined }),
      });
      const connectData = await connectRes.json();

      if (connectData.redirectURI) {
        // Open SnapTrade portal in popup
        const popup = window.open(connectData.redirectURI, 'snaptrade-connect', 'width=600,height=700');

        // Listen for completion message from callback page
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'SNAPTRADE_CONNECTED') {
            window.removeEventListener('message', handleMessage);
            clearInterval(interval);
            setConnecting(false);
            fetchAccounts();
            popup?.close();
          }
        };
        window.addEventListener('message', handleMessage);

        // Also poll for popup close as fallback
        const interval = setInterval(() => {
          if (popup?.closed) {
            clearInterval(interval);
            window.removeEventListener('message', handleMessage);
            setConnecting(false);
            fetchAccounts();
          }
        }, 1000);
      } else {
        setError(connectData.error || 'Failed to get connection URL');
        setConnecting(false);
      }
    } catch (err) {
      console.error('Connect error:', err);
      setError('Failed to connect. Please try again.');
      setConnecting(false);
    }
  };

  const disconnectAccount = async (authorizationId: string) => {
    if (!userId) return;
    try {
      await fetch('/api/snaptrade/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkId: userId, authorizationId }),
      });
      fetchAccounts();
    } catch {
      console.error('Disconnect error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Connected Accounts */}
      {accounts.length > 0 && (
        <Card delay={0.1}>
          <h4 className="text-sm font-semibold text-text-primary mb-4">Connected Accounts</h4>
          <div className="space-y-3">
            {accounts.map((acct) => (
              <div key={acct.id} className="flex items-center justify-between p-3 glass-card rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏦</span>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{acct.institution_name || acct.name}</p>
                    <p className="text-xs text-text-secondary">{acct.name} • ****{acct.number?.slice(-4)}</p>
                    {acct.meta?.type && (
                      <p className="text-xs text-text-secondary/60">{acct.meta.type}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => disconnectAccount(acct.id)}
                  className="text-xs text-red-400/60 hover:text-red-400 transition-colors px-3 py-1 border border-red-400/20 rounded-md hover:border-red-400/40"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Connect New Account */}
      <Card delay={0.2}>
        <h4 className="text-sm font-semibold text-text-primary mb-2">Connect a Brokerage Account</h4>
        <p className="text-xs text-text-secondary mb-4">
          Securely connect your investment accounts to see real holdings, allocation, and performance.
          Powered by SnapTrade with bank-level encryption.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {brokerages.map((broker) => (
            <button
              key={broker.id || 'other'}
              onClick={() => connectBrokerage(broker.id)}
              disabled={connecting || !userId}
              className="glass-card-hover p-4 text-center flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-3xl">{broker.icon}</span>
              <span className="text-sm font-medium text-text-primary">{broker.name}</span>
              {connecting && <span className="text-xs text-text-secondary">Opening...</span>}
            </button>
          ))}
        </div>

        {!userId && (
          <p className="text-xs text-amber-400 mt-4">
            ⚠️ Sign in to connect your brokerage accounts.
          </p>
        )}
      </Card>

      {/* How It Works */}
      <Card delay={0.3} className="border-accent/20">
        <h4 className="text-sm font-semibold text-text-primary mb-3">How It Works</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-text-secondary">
          <div className="flex items-start gap-2">
            <span className="text-lg">1️⃣</span>
            <p>Click your brokerage above. A secure connection portal opens.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">2️⃣</span>
            <p>Sign in to your brokerage through SnapTrade&apos;s SOC 2 certified portal.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">3️⃣</span>
            <p>Your holdings sync automatically. Read-only access — we never trade on your behalf.</p>
          </div>
        </div>
      </Card>

      {loading && (
        <div className="text-center py-10 text-text-secondary text-sm">Loading accounts...</div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'accounts' ? 'Accounts' : 'Holdings';
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>(initialTab);

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
        {activeTab === 'Accounts' && <AccountsTab />}
      </motion.div>

      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
      </div>
    </div>
  );
}
