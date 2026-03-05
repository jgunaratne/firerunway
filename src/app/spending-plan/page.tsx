'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Card from '@/components/shared/Card';
import { formatCurrency } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { useBrokerageData } from '@/lib/BrokerageDataContext';
import { useStockPrice } from '@/hooks/useStockPrice';

interface Transaction {
  amount: number;
  personalFinanceCategory: string | null;
  category: string[];
}

// Map Plaid categories to spending plan buckets
const FIXED_COST_CATEGORIES = [
  'RENT_AND_UTILITIES',
  'HOME_IMPROVEMENT',
  'TRANSPORTATION',
  'LOAN_PAYMENTS',
  'MEDICAL',
  'PERSONAL_CARE',
  'GENERAL_SERVICES',
];

const FIXED_COST_SUBCATEGORIES: Record<string, string> = {
  'RENT_AND_UTILITIES': 'Rent / Mortgage & Utilities',
  'TRANSPORTATION': 'Car Payment / Transportation',
  'LOAN_PAYMENTS': 'Debt Payments',
  'MEDICAL': 'Insurance / Medical',
  'PERSONAL_CARE': 'Personal Care',
  'HOME_IMPROVEMENT': 'Home Maintenance',
  'GENERAL_SERVICES': 'Services',
  'FOOD_AND_DRINK': 'Dining & Groceries',
  'GENERAL_MERCHANDISE': 'Shopping / Clothes',
};

function PlanRow({ label, amount, indent = false, bold = false, highlight = false, dimLabel = false }: {
  label: string; amount: number | string; indent?: boolean; bold?: boolean; highlight?: boolean; dimLabel?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2 px-3 ${bold ? 'border-t border-border' : 'border-b border-border/20'} ${highlight ? 'bg-accent/5' : ''}`}>
      <span className={`text-sm ${indent ? 'pl-4' : ''} ${bold ? 'font-semibold text-text-primary' : dimLabel ? 'text-text-secondary/60' : 'text-text-secondary'}`}>
        {label}
      </span>
      <span className={`number-display text-sm ${bold ? 'font-bold text-accent' : 'text-text-primary'}`}>
        {typeof amount === 'number' ? formatCurrency(amount) : amount}
      </span>
    </div>
  );
}

function SectionHeader({ title, pct, targetRange, actual }: {
  title: string; pct: number; targetRange: string; actual: number;
}) {
  const color = actual > parseFloat(targetRange.split('-')[1] || targetRange.replace('%', ''))
    ? 'text-red-400' : actual < parseFloat(targetRange.split('-')[0].replace('%', ''))
    ? 'text-amber-400' : 'text-emerald-400';
  return (
    <div className="flex items-center justify-between py-2.5 px-3 bg-white/[0.03] rounded-t-lg border-b border-border">
      <span className="text-sm font-bold text-text-primary uppercase tracking-wide">{title}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-secondary">Target: {targetRange}</span>
        <span className={`text-xs font-bold ${color}`}>{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export default function SpendingPlanPage() {
  const { profile, rsuGrants, realEstate, clerkId } = useUserData();
  const { totalInvestment, plaidAccounts } = useBrokerageData();
  const ticker = rsuGrants[0]?.company_ticker || 'AMZN';
  const stockPrice = useStockPrice(ticker);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clerkId) { setLoading(false); return; }
    fetch(`/api/plaid/transactions?clerkId=${clerkId}&months=1`)
      .then(r => r.json())
      .then(d => setTransactions(d.transactions || []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, [clerkId]);

  // === Net Worth ===
  const rsuValue = rsuGrants.reduce((sum, g) => sum + g.vested_shares * stockPrice, 0);
  const realEstateValue = realEstate.reduce((sum, p) => sum + p.current_value, 0);
  const realEstateDebt = realEstate.reduce((sum, p) => sum + p.mortgage_balance, 0);
  const realEstateEquity = realEstateValue - realEstateDebt;
  const investable = totalInvestment > 0 ? totalInvestment : rsuValue;

  const bankBalances = plaidAccounts.filter(a => a.type === 'depository').reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const creditDebt = plaidAccounts.filter(a => a.type === 'credit').reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  const totalAssets = realEstateValue;
  const totalInvestments = investable;
  const totalSavings = bankBalances;
  const totalDebt = realEstateDebt + creditDebt;
  const totalNetWorth = totalAssets + totalInvestments + totalSavings - totalDebt;

  // === Income ===
  const grossMonthlyIncome = (profile?.annual_income || 0) / 12;
  // Estimate net income (rough: 70% of gross after tax)
  const estimatedTaxRate = 0.30;
  const netMonthlyIncome = grossMonthlyIncome * (1 - estimatedTaxRate);

  // === Categorize Monthly Spending from Plaid (last month) ===
  const expenses = useMemo(
    () => transactions.filter(t => t.amount > 0 && t.personalFinanceCategory !== 'INCOME' && t.personalFinanceCategory !== 'TRANSFER'),
    [transactions]
  );

  // Build category totals
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of expenses) {
      const cat = tx.personalFinanceCategory || 'OTHER';
      map.set(cat, (map.get(cat) || 0) + tx.amount);
    }
    return map;
  }, [expenses]);

  // Fixed Costs
  const fixedCostItems = useMemo(() => {
    const items: { label: string; amount: number }[] = [];
    const groceries = categoryTotals.get('FOOD_AND_DRINK') || 0;
    const shopping = (categoryTotals.get('GENERAL_MERCHANDISE') || 0) + (categoryTotals.get('SHOPPING') || 0);

    for (const cat of FIXED_COST_CATEGORIES) {
      const amount = categoryTotals.get(cat) || 0;
      if (amount > 0) {
        items.push({ label: FIXED_COST_SUBCATEGORIES[cat] || cat, amount });
      }
    }
    if (groceries > 0) items.push({ label: 'Groceries & Dining', amount: groceries });
    if (shopping > 0) items.push({ label: 'Clothes / Shopping', amount: shopping });

    // Subscriptions
    const subs = categoryTotals.get('ENTERTAINMENT') || 0;
    if (subs > 0) items.push({ label: 'Subscriptions / Entertainment', amount: subs });

    items.sort((a, b) => b.amount - a.amount);
    return items;
  }, [categoryTotals]);

  const fixedCostsTotal = fixedCostItems.reduce((sum, i) => sum + i.amount, 0);
  // Add 15% miscellaneous buffer
  const miscellaneous = fixedCostsTotal * 0.15;
  const fixedCostsTotalWithMisc = fixedCostsTotal + miscellaneous;

  // Investments (monthly estimate)
  const monthlyInvestments = (profile?.annual_spend || 0) > 0
    ? Math.max(0, netMonthlyIncome - (profile?.annual_spend || 0) / 12)
    : netMonthlyIncome * 0.10; // default 10%

  // Savings goals (estimate from what's left after fixed + investments)
  const savingsGoals = Math.max(0, netMonthlyIncome * 0.05);

  // Guilt-free spending = what's left
  const guiltFreeSpending = Math.max(0, netMonthlyIncome - fixedCostsTotalWithMisc - monthlyInvestments - savingsGoals);

  // Percentages
  const fixedPct = netMonthlyIncome > 0 ? (fixedCostsTotalWithMisc / netMonthlyIncome) * 100 : 0;
  const investPct = netMonthlyIncome > 0 ? (monthlyInvestments / netMonthlyIncome) * 100 : 0;
  const savingsPct = netMonthlyIncome > 0 ? (savingsGoals / netMonthlyIncome) * 100 : 0;
  const guiltFreePct = netMonthlyIncome > 0 ? (guiltFreeSpending / netMonthlyIncome) * 100 : 0;

  if (loading) {
    return <div className="text-center py-20 text-text-secondary">Loading spending plan...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Conscious Spending Plan</h1>
        <p className="page-subtitle">Know exactly where your money goes — so you can spend guilt-free on what you love</p>
      </div>

      {/* Four-bucket overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Fixed Costs', pct: fixedPct, target: '50-60%', amount: fixedCostsTotalWithMisc, color: fixedPct > 60 ? '#ef4444' : '#10b981' },
          { label: 'Investments', pct: investPct, target: '≥10%', amount: monthlyInvestments, color: investPct >= 10 ? '#10b981' : '#f59e0b' },
          { label: 'Savings', pct: savingsPct, target: '5-10%', amount: savingsGoals, color: '#6366f1' },
          { label: 'Guilt-Free', pct: guiltFreePct, target: '20-35%', amount: guiltFreeSpending, color: guiltFreePct > 0 ? '#10b981' : '#ef4444' },
        ].map((bucket, i) => (
          <motion.div
            key={bucket.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
            className="glass-card p-4 rounded-xl"
          >
            <p className="stat-label">{bucket.label}</p>
            <p className="number-display text-2xl font-bold text-text-primary mt-1">{formatCurrency(bucket.amount)}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(bucket.pct, 100)}%`, backgroundColor: bucket.color }} />
              </div>
              <span className="text-xs font-bold" style={{ color: bucket.color }}>{bucket.pct.toFixed(0)}%</span>
            </div>
            <p className="text-[10px] text-text-secondary mt-1">Target: {bucket.target}</p>
          </motion.div>
        ))}
      </div>

      {/* Net Worth */}
      <Card delay={0.2}>
        <div className="py-2 px-3 bg-white/[0.03] rounded-t-lg border-b border-border mb-1">
          <span className="text-sm font-bold text-text-primary uppercase tracking-wide">Net Worth</span>
        </div>
        <PlanRow label="Assets (real estate, property)" amount={totalAssets} indent />
        <PlanRow label="Investments (401k, brokerage)" amount={totalInvestments} indent />
        <PlanRow label="Savings (bank accounts)" amount={totalSavings} indent />
        <PlanRow label="Debt (mortgages, credit cards)" amount={-totalDebt} indent />
        <PlanRow label="TOTAL NET WORTH" amount={totalNetWorth} bold highlight />
      </Card>

      {/* Income */}
      <Card delay={0.25}>
        <div className="py-2 px-3 bg-white/[0.03] rounded-t-lg border-b border-border mb-1">
          <span className="text-sm font-bold text-text-primary uppercase tracking-wide">Income</span>
        </div>
        <PlanRow label="Gross monthly income (before taxes)" amount={grossMonthlyIncome} indent />
        <PlanRow label="Net monthly income (after taxes, est.)" amount={netMonthlyIncome} bold highlight />
      </Card>

      {/* Fixed Costs */}
      <Card delay={0.3}>
        <SectionHeader title="Fixed Costs" pct={fixedPct} targetRange="50-60%" actual={fixedPct} />
        {fixedCostItems.map((item) => (
          <PlanRow key={item.label} label={item.label} amount={item.amount} indent />
        ))}
        {fixedCostItems.length === 0 && (
          <PlanRow label="No transaction data yet" amount="—" indent dimLabel />
        )}
        <PlanRow label="Miscellaneous (15% buffer)" amount={miscellaneous} indent dimLabel />
        <PlanRow label="FIXED COSTS TOTAL" amount={fixedCostsTotalWithMisc} bold highlight />
      </Card>

      {/* Investments */}
      <Card delay={0.35}>
        <SectionHeader title="Investments" pct={investPct} targetRange="10%" actual={investPct} />
        <PlanRow label="Post-Tax Retirement / Brokerage" amount={monthlyInvestments} indent />
        <PlanRow label="INVESTMENTS TOTAL" amount={monthlyInvestments} bold highlight />
      </Card>

      {/* Savings Goals */}
      <Card delay={0.4}>
        <SectionHeader title="Savings Goals" pct={savingsPct} targetRange="5-10%" actual={savingsPct} />
        <PlanRow label="Emergency Fund / Vacations / Gifts" amount={savingsGoals} indent />
        <PlanRow label="SAVINGS TOTAL" amount={savingsGoals} bold highlight />
      </Card>

      {/* Guilt-Free Spending */}
      <Card delay={0.45}>
        <SectionHeader title="Guilt-Free Spending" pct={guiltFreePct} targetRange="20-35%" actual={guiltFreePct} />
        <PlanRow label="Dining out, movies, anything you want!" amount={guiltFreeSpending} indent />
        <PlanRow label="GUILT-FREE SPENDING TOTAL" amount={guiltFreeSpending} bold highlight />
      </Card>

      <div className="disclaimer">
        Conscious Spending Plan framework by Ramit Sethi. Fixed costs are auto-calculated from your last month of Plaid transactions.
        Income data comes from your profile. Adjust your profile income for more accurate results.
      </div>
    </div>
  );
}
