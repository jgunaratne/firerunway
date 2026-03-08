'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts';
import Card from '@/components/shared/Card';
import FilterPills from '@/components/shared/FilterPills';
import { formatCurrency } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import {
  Utensils, Car, Plane, ShoppingBag, Film, Home as HomeIcon,
  Heart, Sparkles, Wrench, Package, ShoppingCart, Hammer,
  ArrowRightLeft, Landmark, CreditCard, DollarSign, FileText,
} from 'lucide-react';

interface Transaction {
  id: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number;
  category: string[];
  personalFinanceCategory: string | null;
  accountId: string;
  institutionName: string;
  pending: boolean;
}

const CATEGORY_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  '#a855f7', '#e11d48',
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'FOOD_AND_DRINK': <Utensils size={14} />,
  'TRANSPORTATION': <Car size={14} />,
  'TRAVEL': <Plane size={14} />,
  'SHOPPING': <ShoppingBag size={14} />,
  'ENTERTAINMENT': <Film size={14} />,
  'RENT_AND_UTILITIES': <HomeIcon size={14} />,
  'MEDICAL': <Heart size={14} />,
  'PERSONAL_CARE': <Sparkles size={14} />,
  'GENERAL_SERVICES': <Wrench size={14} />,
  'GENERAL_MERCHANDISE': <Package size={14} />,
  'GROCERIES': <ShoppingCart size={14} />,
  'HOME_IMPROVEMENT': <Hammer size={14} />,
  'TRANSFER': <ArrowRightLeft size={14} />,
  'LOAN_PAYMENTS': <Landmark size={14} />,
  'BANK_FEES': <CreditCard size={14} />,
  'INCOME': <DollarSign size={14} />,
  'OTHER': <FileText size={14} />,
};

function getCategoryIcon(category: string | null): React.ReactNode {
  if (!category) return <FileText size={14} />;
  return CATEGORY_ICONS[category] || <FileText size={14} />;
}

function formatCategoryName(category: string | null) {
  if (!category) return 'Other';
  return category
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default function ExpensesPage() {
  const { uid } = useUserData();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(3);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/plaid/transactions?uid=${uid}&months=${months}`)
      .then(r => r.json())
      .then(d => setTransactions(d.transactions || []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, [uid, months]);

  // Filter out income / transfers for expense analysis
  const expenses = useMemo(
    () => transactions.filter(t => t.amount > 0 && t.personalFinanceCategory !== 'INCOME' && t.personalFinanceCategory !== 'TRANSFER'),
    [transactions]
  );

  const totalSpend = useMemo(() => expenses.reduce((sum, t) => sum + t.amount, 0), [expenses]);

  // Category breakdown
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of expenses) {
      const cat = tx.personalFinanceCategory || 'OTHER';
      map.set(cat, (map.get(cat) || 0) + tx.amount);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, displayName: formatCategoryName(name), icon: getCategoryIcon(name) }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Monthly breakdown
  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of expenses) {
      const month = tx.date.substring(0, 7); // YYYY-MM
      map.set(month, (map.get(month) || 0) + tx.amount);
    }
    return Array.from(map.entries())
      .map(([month, total]) => ({
        month,
        label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        total,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [expenses]);

  // Filtered transactions for list
  const filteredTransactions = useMemo(() => {
    let filtered = expenses;
    if (selectedCategory) {
      filtered = filtered.filter(t => (t.personalFinanceCategory || 'OTHER') === selectedCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.merchantName && t.merchantName.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [expenses, selectedCategory, searchQuery]);

  const avgMonthly = monthlyData.length > 0 ? totalSpend / monthlyData.length : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary text-sm">Loading expenses...</p>
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="space-y-8">
        <div
        >
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track your spending across all connected accounts</p>
        </div>
        <Card className="text-center py-12">
          <CreditCard size={40} className="text-text-secondary/40 mx-auto" />
          <p className="text-text-secondary mt-4">No transaction data available.</p>
          <p className="text-sm text-text-secondary mt-1">Connect a bank or credit card via Plaid to see your spending.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div
        >
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track your spending across all connected accounts</p>
        </div>
        <FilterPills
          options={[{ label: '1M', value: '1' }, { label: '3M', value: '3' }, { label: '6M', value: '6' }, { label: '1Y', value: '12' }]}
          selected={String(months)}
          onChange={v => setMonths(Number(v))}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="stat-label">Total Spending</p>
          <p className="stat-value mt-1">{formatCurrency(totalSpend)}</p>
          <p className="text-sm text-text-secondary mt-1">
            Last {months} month{months > 1 ? 's' : ''}
          </p>
        </Card>
        <Card>
          <p className="stat-label">Monthly Average</p>
          <p className="stat-value mt-1" style={{ color: 'var(--accent)' }}>{formatCurrency(avgMonthly)}</p>
          <p className="text-sm text-text-secondary mt-1">/month</p>
        </Card>
        <Card>
          <p className="stat-label">Transactions</p>
          <p className="stat-value mt-1">{expenses.length}</p>
          <p className="text-sm text-text-secondary mt-1">
            {categoryData.length} categories
          </p>
        </Card>
      </div>

      {/* Monthly Trend + Category Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Bar Chart */}
        <Card>
          <h3 className="section-title">Monthly Spending</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#f0f0ff' }}
                  formatter={(value?: number) => [formatCurrency(value ?? 0), 'Spending']}
                />
                <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Category Pie */}
        <Card>
          <h3 className="section-title">By Category</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData.slice(0, 8)}
                  dataKey="value"
                  nameKey="displayName"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {categoryData.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value?: number) => [formatCurrency(value ?? 0), 'Spent']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Category Grid */}
      <Card>
        <h3 className="section-title">Category Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {categoryData.map((cat, i) => {
            const pct = totalSpend > 0 ? (cat.value / totalSpend) * 100 : 0;
            const isSelected = selectedCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(isSelected ? null : cat.name)}
                className={`text-left p-3 rounded-lg border transition-all ${isSelected
                  ? 'border-accent bg-accent/10'
                  : 'border-border glass-card hover:border-text-secondary/30'
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{cat.icon}</span>
                  <span className="text-sm font-medium text-text-primary truncate">{cat.displayName}</span>
                </div>
                <p className="number-display text-sm font-bold text-text-primary">{formatCurrency(cat.value)}</p>
                {/* Progress bar */}
                <div className="mt-2 h-1 rounded-full bg-[var(--overlay-hover)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                    }}
                  />
                </div>
                <p className="text-sm text-text-secondary mt-1">{pct.toFixed(1)}%</p>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Transaction List */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title mb-0">
            {selectedCategory ? `${formatCategoryName(selectedCategory)} Transactions` : 'All Transactions'}
            <span className="text-text-secondary font-normal ml-2">({filteredTransactions.length})</span>
          </h3>
          <div className="flex items-center gap-2">
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-sm text-accent hover:text-accent/80 transition-colors"
              >
                Clear filter ✕
              </button>
            )}
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-border bg-transparent text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-accent w-40"
            />
          </div>
        </div>
        <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
          {filteredTransactions.slice(0, 100).map(tx => (
            <div key={tx.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-[var(--overlay-subtle)] transition-colors border-b border-border/30 last:border-0">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-lg flex-shrink-0">{getCategoryIcon(tx.personalFinanceCategory)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{tx.merchantName || tx.name}</p>
                  <p className="text-sm text-text-secondary">
                    {new Date(tx.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' · '}
                    {tx.institutionName}
                    {tx.pending && <span className="text-amber-400 ml-1">(pending)</span>}
                  </p>
                </div>
              </div>
              <p className="number-display text-sm font-semibold text-text-primary flex-shrink-0 ml-3">
                {formatCurrency(tx.amount)}
              </p>
            </div>
          ))}
          {filteredTransactions.length > 100 && (
            <p className="text-sm text-text-secondary text-center py-3">
              Showing first 100 of {filteredTransactions.length} transactions
            </p>
          )}
        </div>
      </Card>

      <div className="disclaimer">
        Transaction data provided by Plaid. Categories are automatically assigned and may not be 100% accurate.
      </div>
    </div>
  );
}
