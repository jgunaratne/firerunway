'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  Legend,
  Treemap,
} from 'recharts';
import Card from '@/components/shared/Card';
import AIAnalysis from '@/components/shared/AIAnalysis';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency } from '@/lib/calculations';
import { useSearchParams } from 'next/navigation';
import { useBrokerageData, BrokeragePosition } from '@/lib/BrokerageDataContext';
import { useUserData } from '@/lib/UserDataContext';
import { useAuth } from '@/lib/AuthProvider';
import {
  TrendingUp, Building2, CreditCard, Landmark,
  PiggyBank, CircleCheck, List, LayoutGrid,
} from 'lucide-react';

const tabs = ['Holdings', 'Allocation', 'Performance', 'Accounts'] as const;



// ─── Treemap helpers ────────────────────────────────────────────────

/** Compute P&L percentage for a position. */
function pnlPercent(pos: BrokeragePosition): number | null {
  if (pos.openPnl != null && pos.value > 0) {
    const costBasis = pos.value - pos.openPnl;
    if (costBasis > 0) return (pos.openPnl / costBasis) * 100;
  }
  if (pos.averagePurchasePrice != null && pos.averagePurchasePrice > 0) {
    return ((pos.price - pos.averagePurchasePrice) / pos.averagePurchasePrice) * 100;
  }
  return null;
}

/** Map a P&L percentage to a green/red fill color. */
function pnlColor(pct: number | null): string {
  if (pct == null || pct === 0) return '#4b5563'; // gray-600 – no data or flat
  if (pct > 0) {
    // green gradient: brighter for bigger gains
    const intensity = Math.min(pct / 40, 1); // cap at 40%
    const g = Math.round(130 + intensity * 90); // 130..220
    const r = Math.round(22 - intensity * 10);
    return `rgb(${r}, ${g}, 60)`;
  }
  // red gradient: deeper for bigger losses
  const intensity = Math.min(Math.abs(pct) / 30, 1); // cap at 30%
  const r = Math.round(180 + intensity * 60); // 180..240
  const g = Math.round(60 - intensity * 30); // 60..30
  return `rgb(${r}, ${g}, 50)`;
}

/** Custom rectangle renderer for the Treemap. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TreemapCell(props: any) {
  const { x, y, width, height, ticker, value: cellValue, pct, fill } = props;
  if (width < 4 || height < 4) return null;
  const showTicker = width > 36 && height > 22;
  const showValue = width > 60 && height > 38;
  const showPct = width > 50 && height > 52;
  const fontSize = Math.min(14, Math.max(9, width / 7));
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        fill={fill}
        stroke="var(--bg-primary)"
        strokeWidth={2}
        style={{ transition: 'fill 0.3s' }}
      />
      {showTicker && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showValue ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={fontSize}
          fontWeight={700}
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)', fontFamily: 'var(--font-mono, monospace)' }}
        >
          {ticker}
        </text>
      )}
      {showValue && (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showPct ? 4 : 10)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.85)"
          fontSize={Math.max(8, fontSize - 2)}
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
        >
          {formatCurrency(cellValue)}
        </text>
      )}
      {showPct && pct != null && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 18}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.7)"
          fontSize={Math.max(8, fontSize - 3)}
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
        >
          {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
        </text>
      )}
    </g>
  );
}

// ─── Custom Treemap Tooltip ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TreemapTooltipContent({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d || !d.ticker) return null;
  const pct = d.pct as number | null;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 12,
      color: 'var(--text-primary)',
      minWidth: 160,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    }}>
      <p style={{ fontWeight: 700, marginBottom: 4, fontFamily: 'var(--font-mono, monospace)' }}>
        {d.ticker} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>{d.posName}</span>
      </p>
      <p>Value: <b>{formatCurrency(d.value)}</b></p>
      <p>Shares: {d.shares?.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
      <p>Price: ${d.posPrice?.toFixed(2)}</p>
      {pct != null && (
        <p style={{ color: pct >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>
          P&L: {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
          {d.openPnl != null && ` (${d.openPnl >= 0 ? '+' : ''}${formatCurrency(d.openPnl)})`}
        </p>
      )}
      <p style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{d.accountLabel}</p>
    </div>
  );
}

// ─── Holdings Tab ───────────────────────────────────────────────────

function HoldingsTab() {
  const { positions, totalInvestment, loading, accounts: brokerageAccounts, lastRefreshedAt } = useBrokerageData();
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'treemap'>('list');

  // Build a resolver: given a position, find the institution name from accounts data
  const resolveInstitution = useCallback((pos: BrokeragePosition): string => {
    if (pos.institutionName && pos.institutionName.toLowerCase() !== 'unknown') {
      return pos.institutionName;
    }
    const match = brokerageAccounts.find(a =>
      (pos.accountId && a.id === pos.accountId) ||
      (pos.accountName && a.name === pos.accountName) ||
      (pos.accountId && a.number === pos.accountId) ||
      (pos.accountName && a.number === pos.accountName)
    );
    if (match && match.institution_name && match.institution_name.toLowerCase() !== 'unknown') {
      return match.institution_name;
    }
    const uniqueInstitutions = new Set(
      brokerageAccounts
        .map(a => a.institution_name)
        .filter(n => n && n.toLowerCase() !== 'unknown')
    );
    if (uniqueInstitutions.size === 1) {
      return Array.from(uniqueInstitutions)[0];
    }
    return pos.institutionName || '';
  }, [brokerageAccounts]);

  // Group positions by account
  const grouped = useMemo(() => positions.reduce((acc, pos) => {
    const inst = resolveInstitution(pos);
    const key = pos.accountName || inst || 'Unknown Account';
    if (!acc[key]) acc[key] = { name: key, institutionName: inst, type: pos.accountType, holdings: [] };
    acc[key].holdings.push(pos);
    return acc;
  }, {} as Record<string, { name: string; institutionName: string; type: string; holdings: BrokeragePosition[] }>), [positions, resolveInstitution]);

  // Build treemap data: group by account as parent nodes
  const treemapData = useMemo(() => {
    return Object.entries(grouped).map(([accountName, group]) => ({
      name: accountName,
      children: group.holdings
        .filter(h => h.value > 0 && h.ticker !== '—') // exclude zero-value and cash entries
        .map(h => {
          const pct = pnlPercent(h);
          return {
            name: h.ticker,
            ticker: h.ticker,
            posName: h.name,
            value: Math.round(h.value),
            shares: h.shares,
            posPrice: h.price,
            openPnl: h.openPnl,
            pct,
            fill: pnlColor(pct),
            accountLabel: `${accountName}${group.institutionName && group.institutionName !== accountName ? ` · ${group.institutionName}` : ''}`,
          };
        }),
    })).filter(g => g.children.length > 0);
  }, [grouped]);

  if (loading) {
    return <div className="text-center py-10 text-text-secondary text-sm">Loading holdings...</div>;
  }

  if (positions.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-text-secondary text-sm">No holdings found.</p>
          <p className="text-text-secondary/60 text-sm mt-2">
            Connect a brokerage account in the Accounts tab to see your real holdings.
          </p>
        </div>
      </Card>
    );
  }

  const accountKeys = Object.keys(grouped);
  const allExpanded = accountKeys.every(k => expandedAccounts.has(k));

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedAccounts(new Set());
    } else {
      setExpandedAccounts(new Set(accountKeys));
    }
  };

  const toggleAccount = (key: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: Toggle + Expand/Collapse */}
      <div className="flex items-center justify-between">
        {viewMode === 'list' ? (
          <button
            onClick={toggleAll}
            className="text-sm text-accent hover:text-accent/80 transition-colors font-medium"
          >
            {allExpanded ? '▾ Collapse All' : '▸ Expand All'}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgb(22, 200, 60)' }} />
            <span className="text-sm text-text-secondary">Gain</span>
            <span className="inline-block w-3 h-3 rounded-sm ml-2" style={{ background: 'rgb(220, 50, 50)' }} />
            <span className="text-sm text-text-secondary">Loss</span>
            <span className="inline-block w-3 h-3 rounded-sm ml-2" style={{ background: '#4b5563' }} />
            <span className="text-sm text-text-secondary">N/A</span>
          </div>
        )}

        <div className="flex items-center gap-1 bg-bg-secondary rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'list'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            title="List view"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('treemap')}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'treemap'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            title="Treemap view"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* ── Treemap View ── */}
      {viewMode === 'treemap' && (
        <Card className="overflow-hidden">
          <div style={{ width: '100%', height: Math.max(400, Math.min(600, positions.length * 30)) }}>
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treemapData}
                dataKey="value"
                stroke="var(--bg-primary)"
                animationDuration={500}
                content={<TreemapCell />}
              >
                <Tooltip content={<TreemapTooltipContent />} />
              </Treemap>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* ── List View ── */}
      {viewMode === 'list' && (
        <>
          {Object.entries(grouped).map(([name, group]) => {
            const accountTotal = group.holdings.reduce((sum, h) => sum + h.value, 0);
            const isExpanded = expandedAccounts.has(name);
            return (
              <Card key={name} className="overflow-hidden">
                <button onClick={() => toggleAccount(name)} className="w-full text-left flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-accent text-sm">{isExpanded ? '▾' : '▸'}</span>
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">{name}</h4>
                      <p className="text-sm text-text-secondary">
                        {group.institutionName && group.institutionName !== name && group.institutionName.toLowerCase() !== 'unknown' ? `${group.institutionName} · ` : ''}{group.type ? `${group.type} · ` : ''}{group.holdings.length} positions
                      </p>
                    </div>
                  </div>
                  <p className="number-display text-lg font-bold text-text-primary">{formatCurrency(accountTotal)}</p>
                </button>
                {isExpanded && (
                  <div className="overflow-x-auto mt-4 border-t border-border pt-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-sm text-text-secondary border-b border-border">
                          <th className="text-left pb-2 font-medium">Ticker</th>
                          <th className="text-right pb-2 font-medium">Shares</th>
                          <th className="text-right pb-2 font-medium">Price</th>
                          <th className="text-right pb-2 font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.holdings.map((h, j) => (
                          <tr key={`${h.ticker}-${j}`} className="border-b border-border/50 transition-colors themed-hover">
                            <td className="py-2">
                              <p className="number-display font-semibold text-text-primary">{h.ticker}</p>
                              <p className="text-sm text-text-secondary hidden md:block">{h.name}</p>
                            </td>
                            <td className="text-right number-display py-2">{h.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                            <td className="text-right number-display py-2">${h.price.toFixed(2)}</td>
                            <td className="text-right number-display font-medium py-2">{formatCurrency(h.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </>
      )}

      {/* Totals bar */}
      <Card className="bg-accent/5 border-accent/20">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text-primary">Total Portfolio Value</span>
          <div className="text-right">
            <p className="number-display text-xl font-bold text-text-primary">
              <AnimatedNumber value={totalInvestment} format={(n) => formatCurrency(n)} />
            </p>
            <p className="text-sm text-text-secondary">
              {lastRefreshedAt
                ? `Synced ${new Date(lastRefreshedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`
                : 'Not yet synced'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

const DONUT_COLORS = ['#6366f1', '#818cf8', '#10b981', '#8888aa', '#f59e0b'];

function AllocationTab() {
  const { positions, totalInvestment, loading } = useBrokerageData();

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
      <Card>
        <div className="text-center py-8">
          <p className="text-text-secondary text-sm">No allocation data available.</p>
          <p className="text-text-secondary/60 text-sm mt-2">Connect a brokerage in the Accounts tab.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h4 className="text-sm font-semibold text-text-primary mb-2">Your Current Allocation</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocationData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" animationDuration={1000}>
                  {allocationData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)' }} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h4 className="text-sm font-semibold text-text-primary mb-1">Recommended for Your Profile</h4>
          <p className="text-sm text-text-secondary mb-2">Based on a 2028 target date and moderate risk tolerance</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={recommendedData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" animationDuration={1000} animationBegin={200}>
                  {recommendedData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)' }} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <h4 className="text-sm font-semibold text-text-primary mb-4">Allocation Breakdown</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-sm text-text-secondary border-b border-border">
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

      <Card>
        <h4 className="text-sm font-semibold text-text-primary mb-4">Recommended Low-Cost ETFs</h4>
        {[
          {
            category: 'US Equity', etfs: [
              { ticker: 'VTI', name: 'Vanguard Total Stock Market', expenseRatio: '0.03', return10yr: '11.8' },
              { ticker: 'VOO', name: 'Vanguard S&P 500', expenseRatio: '0.03', return10yr: '12.5' },
              { ticker: 'SWTSX', name: 'Schwab Total Stock Market', expenseRatio: '0.03', return10yr: '11.7' },
            ]
          },
          {
            category: 'International Equity', etfs: [
              { ticker: 'VXUS', name: 'Vanguard Total International', expenseRatio: '0.07', return10yr: '5.2' },
              { ticker: 'IXUS', name: 'iShares Core MSCI Total Intl', expenseRatio: '0.07', return10yr: '5.1' },
            ]
          },
          {
            category: 'Bonds', etfs: [
              { ticker: 'BND', name: 'Vanguard Total Bond Market', expenseRatio: '0.03', return10yr: '1.5' },
              { ticker: 'AGG', name: 'iShares Core US Aggregate Bond', expenseRatio: '0.03', return10yr: '1.4' },
            ]
          },
        ].map(({ category, etfs }) => (
          <div key={category} className="mb-4 last:mb-0">
            <p className="text-sm text-text-secondary mb-2">{category}</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-sm text-text-secondary border-b border-border/50">
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
                      <span className="text-text-secondary ml-2 text-sm">{etf.name}</span>
                    </td>
                    <td className="text-right number-display text-emerald-400">{etf.expenseRatio}%</td>
                    <td className="text-right number-display">{etf.return10yr}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <p className="text-sm text-text-secondary/50 mt-3 italic">This is educational information, not personalized investment advice.</p>
      </Card>
    </div>
  );
}


function PerformanceTab() {
  const { totalInvestment, loading } = useBrokerageData();

  if (loading) return <div className="text-center py-10 text-text-secondary text-sm">Loading performance...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <h4 className="text-sm font-semibold text-text-primary mb-4">Portfolio Performance</h4>
        <div className="text-center py-8">
          <p className="text-text-secondary/60 text-sm mb-2">Current Portfolio Value</p>
          <p className="number-display text-3xl font-bold text-text-primary">
            {totalInvestment > 0 ? <AnimatedNumber value={totalInvestment} format={(n) => formatCurrency(n)} /> : '—'}
          </p>
          <p className="text-sm text-text-secondary mt-2">as of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
      </Card>

      <Card className="border-accent/20">
        <div className="text-center py-6">
          <TrendingUp size={28} className="text-accent/60 mb-2 mx-auto" />
          <h4 className="text-sm font-semibold text-text-primary mb-2">Performance History Coming Soon</h4>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
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
  { id: 'FIDELITY', name: 'Fidelity', color: 'text-emerald-400' },
  { id: 'VANGUARD', name: 'Vanguard', color: 'text-red-400' },
  { id: 'SCHWAB', name: 'Charles Schwab', color: 'text-blue-400' },
  { id: '', name: 'Other Brokerage', color: 'text-text-secondary' },
];


function AccountsTab() {
  const { user } = useAuth();
  const { uid: userId, refresh: refreshUserData } = useUserData();
  const { accounts: cachedAccounts, plaidAccounts, forceRefresh: refreshBrokerage, loading: brokerageLoading } = useBrokerageData();
  const [connecting, setConnecting] = useState(false);
  const [connectingPlaid, setConnectingPlaid] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefreshData = async () => {
    setRefreshing(true);
    await refreshBrokerage();
    await refreshUserData();
    setRefreshing(false);
  };

  const connectBrokerage = async (brokerId?: string) => {
    if (!userId) return;
    setConnecting(true);
    setError(null);
    try {
      // Step 1: Register user (idempotent)
      await fetch('/api/snaptrade/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId }),
      });

      // Step 2: Get connection portal URL
      const connectRes = await fetch('/api/snaptrade/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId, broker: brokerId || undefined }),
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
            refreshBrokerage();
            refreshUserData();
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
            refreshBrokerage();
            refreshUserData();
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

  const connectPlaid = async () => {
    if (!userId) return;
    setConnectingPlaid(true);
    setError(null);
    try {
      // Get link token from our API
      const res = await fetch('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId }),
      });
      const data = await res.json();

      if (!data.linkToken) {
        setError(data.error || 'Failed to create Plaid link');
        setConnectingPlaid(false);
        return;
      }

      // Load Plaid Link script if not already loaded
      if (!(window as unknown as Record<string, unknown>).Plaid) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Plaid Link'));
          document.head.appendChild(script);
        });
      }

      // Open Plaid Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const PlaidLink = (window as any).Plaid;
      const handler = PlaidLink.create({
        token: data.linkToken,
        onSuccess: async (publicToken: string, metadata: { institution?: { name?: string; institution_id?: string } }) => {
          try {
            const exchangeRes = await fetch('/api/plaid/exchange-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid: userId,
                email: user?.email || null,
                publicToken,
                institutionName: metadata.institution?.name || 'Unknown',
              }),
            });
            if (!exchangeRes.ok) {
              const body = await exchangeRes.json().catch(() => ({}));
              throw new Error(body.error || 'Failed to save connection');
            }
            await refreshBrokerage();
            refreshUserData();
          } catch (err) {
            console.error('Plaid token exchange error:', err);
            const msg = err instanceof Error ? err.message : 'Failed to save connection';
            setError(msg);
          }
          setConnectingPlaid(false);
        },
        onExit: () => {
          setConnectingPlaid(false);
        },
      });
      handler.open();
    } catch (err) {
      console.error('Plaid connect error:', err);
      setError('Failed to connect with Plaid. Please try again.');
      setConnectingPlaid(false);
    }
  };

  const disconnectAccount = async (authorizationId: string) => {
    if (!userId) return;
    try {
      await fetch('/api/snaptrade/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId, authorizationId }),
      });
      refreshBrokerage();
      refreshUserData();
    } catch {
      console.error('Disconnect error');
    }
  };

  const disconnectPlaidItem = async (itemId: string) => {
    if (!userId) return;
    try {
      await fetch('/api/plaid/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId, itemId }),
      });
      refreshBrokerage();
      refreshUserData();
    } catch {
      console.error('Plaid disconnect error');
    }
  };

  // Group Plaid accounts by institution
  const plaidByInstitution = plaidAccounts.reduce((acc, acct) => {
    const key = `${acct.itemId}::${acct.institutionName}`;
    if (!acc[key]) acc[key] = { itemId: acct.itemId, institutionName: acct.institutionName, accounts: [] };
    acc[key].accounts.push(acct);
    return acc;
  }, {} as Record<string, { itemId: string; institutionName: string; accounts: typeof plaidAccounts }>);

  const getAccountIcon = (type: string, subtype: string | null) => {
    if (type === 'credit') return <CreditCard size={18} className="text-amber-400" />;
    if (type === 'loan') return <Landmark size={18} className="text-text-secondary" />;
    if (subtype === 'checking') return <CircleCheck size={18} className="text-emerald-400" />;
    if (subtype === 'savings') return <PiggyBank size={18} className="text-blue-400" />;
    return <Landmark size={18} className="text-text-secondary" />;
  };

  return (
    <div className="space-y-6">
      {/* Connected Brokerage Accounts */}
      {cachedAccounts.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-text-primary">Brokerage Accounts</h4>
            <button
              onClick={handleRefreshData}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors font-medium disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={refreshing ? 'animate-spin' : ''}
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
          <div className="space-y-3">
            {cachedAccounts.map((acct) => (
              <div key={acct.id} className="flex items-center justify-between p-3 glass-card rounded-lg">
                <div className="flex items-center gap-3">
                  <Landmark size={20} className="text-accent/60" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{acct.institution_name || acct.name}</p>
                    <p className="text-sm text-text-secondary">{acct.name} • ****{acct.number?.slice(-4)}</p>
                    {acct.type && (
                      <p className="text-sm text-text-secondary/60">{acct.type}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {acct.balance > 0 && (
                    <p className="number-display text-sm font-bold text-text-primary">
                      {formatCurrency(acct.balance)}
                    </p>
                  )}
                  <button
                    onClick={() => disconnectAccount(acct.authorization_id || acct.id)}
                    className="text-sm text-red-400/60 hover:text-red-400 transition-colors px-3 py-1 border border-red-400/20 rounded-md hover:border-red-400/40"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Connected Plaid Accounts (Banking / Credit Cards) */}
      {Object.keys(plaidByInstitution).length > 0 && (
        <Card>
          <h4 className="text-sm font-semibold text-text-primary mb-4">Banking & Credit Cards</h4>
          <div className="space-y-4">
            {Object.values(plaidByInstitution).map((group) => (
              <div key={group.itemId}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-text-primary">{group.institutionName}</p>
                  <button
                    onClick={() => disconnectPlaidItem(group.itemId)}
                    className="text-sm text-red-400/60 hover:text-red-400 transition-colors px-3 py-1 border border-red-400/20 rounded-md hover:border-red-400/40"
                  >
                    Disconnect
                  </button>
                </div>
                <div className="space-y-2">
                  {group.accounts.map((acct) => (
                    <div key={acct.id} className="flex items-center justify-between p-3 glass-card rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getAccountIcon(acct.type, acct.subtype)}</span>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{acct.officialName || acct.name}</p>
                          <p className="text-sm text-text-secondary">
                            {acct.subtype || acct.type}{acct.mask ? ` • ****${acct.mask}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {acct.currentBalance !== null && (
                          <p className={`number-display text-sm font-bold ${acct.type === 'credit' || acct.type === 'loan' ? 'text-red-400' : 'text-text-primary'}`}>
                            {acct.type === 'credit' || acct.type === 'loan' ? '-' : ''}{formatCurrency(Math.abs(acct.currentBalance))}
                          </p>
                        )}
                        {acct.type === 'credit' && acct.limit !== null && (
                          <p className="text-sm text-text-secondary">
                            {formatCurrency(acct.limit - (acct.currentBalance || 0))} available
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Connect New Account */}
      <Card>
        <h4 className="text-sm font-semibold text-text-primary mb-2">Connect a Brokerage Account</h4>
        <p className="text-sm text-text-secondary mb-4">
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
              <Building2 size={28} className={broker.color} />
              <span className="text-sm font-medium text-text-primary">{broker.name}</span>
              {connecting && <span className="text-sm text-text-secondary">Opening...</span>}
            </button>
          ))}
        </div>

        {!userId && (
          <p className="text-sm text-amber-400 mt-4">
            ⚠️ Sign in to connect your brokerage accounts.
          </p>
        )}
      </Card>

      {/* Connect Banking / Credit Card */}
      <Card>
        <h4 className="text-sm font-semibold text-text-primary mb-2">Connect Bank or Credit Card</h4>
        <p className="text-sm text-text-secondary mb-4">
          Connect your bank accounts, credit cards, and loans for a complete financial picture.
          Powered by Plaid with bank-level encryption.
        </p>
        <button
          onClick={connectPlaid}
          disabled={connectingPlaid || !userId}
          className="w-full glass-card-hover p-4 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CreditCard size={24} className="text-accent" />
          <span className="text-sm font-medium text-text-primary">
            {connectingPlaid ? 'Opening Plaid...' : 'Connect with Plaid'}
          </span>
        </button>
        <p className="text-sm text-text-secondary/50 mt-2 text-center">
          Supports Amex, Chase, Bank of America, Capital One, and 10,000+ institutions
        </p>
      </Card>

      {/* How It Works */}
      <Card className="border-accent/20">
        <h4 className="text-sm font-semibold text-text-primary mb-3">How It Works</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-text-secondary">
          <div className="flex items-start gap-2">
            <span className="text-lg">1️⃣</span>
            <p>Click your brokerage above or connect via Plaid. A secure portal opens.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">2️⃣</span>
            <p>Sign in to your institution through a SOC 2 certified portal.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">3️⃣</span>
            <p>Your data syncs automatically. Read-only access — we never transact on your behalf.</p>
          </div>
        </div>
      </Card>

      {brokerageLoading && (
        <div className="text-center py-10 text-text-secondary text-sm">Loading accounts...</div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>(
    tabParam === 'accounts' ? 'Accounts' : 'Holdings'
  );
  const { uid } = useUserData();
  const { positions } = useBrokerageData();

  // Sync tab state when URL search params change (e.g., sidebar nav click)
  useEffect(() => {
    if (tabParam === 'accounts') setActiveTab('Accounts');
  }, [tabParam]);

  const handleAnalyze = useCallback(async (): Promise<{ analysis: string }> => {
    const res = await fetch(`/api/portfolio/analyze?uid=${uid}`, { method: 'POST' });
    if (!res.ok) throw new Error('Analysis failed');
    return res.json();
  }, [uid]);

  return (
    <div className="space-y-8">
      <div
      >
        <h1 className="page-title">Portfolio</h1>
        <p className="page-subtitle">All your investments in one place</p>
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
      <div
        key={activeTab}
      >
        {activeTab === 'Holdings' && <HoldingsTab />}
        {activeTab === 'Allocation' && <AllocationTab />}
        {activeTab === 'Performance' && <PerformanceTab />}
        {activeTab === 'Accounts' && <AccountsTab />}
      </div>

      {/* AI Analysis */}
      <AIAnalysis
        type="portfolio"
        onAnalyze={handleAnalyze}
        ready={positions.length > 0}
      />

      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
      </div>
    </div>
  );
}
