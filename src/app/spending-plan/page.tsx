'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Card from '@/components/shared/Card';
import { formatCurrency } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { useBrokerageData } from '@/lib/BrokerageDataContext';
import { useStockPrice } from '@/hooks/useStockPrice';
import { Upload, FileText, X, Wand2 } from 'lucide-react';

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

function PlanRow({ label, amount, indent = false, bold = false, highlight = false, dimLabel = false, onAmountChange }: {
  label: string; amount: number | string; indent?: boolean; bold?: boolean; highlight?: boolean; dimLabel?: boolean;
  onAmountChange?: (val: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');
  const editable = !!onAmountChange && typeof amount === 'number';

  return (
    <div className={`flex items-center justify-between py-2 px-3 ${bold ? 'border-t border-border' : 'border-b border-border/20'} ${highlight ? 'bg-accent/5' : ''}`}>
      <span className={`text-sm ${indent ? 'pl-4' : ''} ${bold ? 'font-semibold text-text-primary' : dimLabel ? 'text-text-secondary/60' : 'text-text-secondary'}`}>
        {label}
      </span>
      {editing ? (
        <input
          autoFocus
          type="number"
          className="w-28 bg-bg-elevated border border-accent/40 rounded px-2 py-0.5 text-sm text-text-primary text-right number-display focus:outline-none"
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={() => {
            const n = parseFloat(editVal);
            if (!isNaN(n) && n >= 0) onAmountChange!(n);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span
          className={`number-display text-sm ${bold ? 'font-bold text-accent' : 'text-text-primary'} ${editable ? 'cursor-pointer hover:text-accent/80 hover:underline decoration-dotted underline-offset-2' : ''}`}
          onClick={editable ? () => { setEditVal(String(Math.round(amount as number))); setEditing(true); } : undefined}
          title={editable ? 'Click to edit' : undefined}
        >
          {typeof amount === 'number' ? formatCurrency(amount) : amount}
        </span>
      )}
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
    <div className="flex items-center justify-between py-2.5 px-3 bg-[var(--overlay-bg-secondary)] rounded-t-lg border-b border-border">
      <span className="text-sm font-bold text-text-primary">{title}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-secondary">Target: {targetRange}</span>
        <span className={`text-sm font-bold ${color}`}>{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export default function SpendingPlanPage() {
  const { profile, rsuGrants, realEstate, clerkId, incomeTaxRecords } = useUserData();
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

  // === Upload State (persisted to localStorage) ===
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedData, setUploadedData] = useState<{
    period: 'monthly' | 'annual';
    grossIncome: number | null;
    netIncome: number | null;
    categories: Record<string, number>;
    notes: string;
  } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [manualOverrides, setManualOverrides] = useState<Record<string, number>>({});

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('csp_uploaded_data');
      if (saved) setUploadedData(JSON.parse(saved));
      const savedOverrides = localStorage.getItem('csp_overrides');
      if (savedOverrides) setManualOverrides(JSON.parse(savedOverrides));
    } catch { /* ignore */ }
  }, []);

  // Persist uploadedData to localStorage
  useEffect(() => {
    if (uploadedData) {
      localStorage.setItem('csp_uploaded_data', JSON.stringify(uploadedData));
    } else {
      localStorage.removeItem('csp_uploaded_data');
      localStorage.removeItem('csp_overrides');
    }
  }, [uploadedData]);

  // Persist manual overrides
  useEffect(() => {
    if (Object.keys(manualOverrides).length > 0) {
      localStorage.setItem('csp_overrides', JSON.stringify(manualOverrides));
    }
  }, [manualOverrides]);

  const setOverride = useCallback((label: string, val: number) => {
    setManualOverrides(prev => ({ ...prev, [label]: val }));
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/ai/spending', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) {
        setUploadError(data.error);
      } else {
        setUploadedData(data.result);
      }
    } catch {
      setUploadError('Failed to process file');
    } finally {
      setUploading(false);
    }
  }, []);

  // === Net Worth ===
  const rsuValue = rsuGrants.reduce((sum, g) => sum + g.vested_shares * stockPrice, 0);
  const realEstateValue = realEstate.reduce((sum, p) => sum + p.current_value, 0);
  const realEstateDebt = realEstate.reduce((sum, p) => sum + p.mortgage_balance, 0);
  // realEstateEquity used for net worth display below
  const investable = totalInvestment > 0 ? totalInvestment : rsuValue;

  const bankBalances = plaidAccounts.filter(a => a.type === 'depository').reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const creditDebt = plaidAccounts.filter(a => a.type === 'credit').reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  const totalAssets = realEstateValue;
  const totalInvestments = investable;
  const totalSavings = bankBalances;
  const totalDebt = realEstateDebt + creditDebt;
  const totalNetWorth = totalAssets + totalInvestments + totalSavings - totalDebt;

  // === Income ===
  const [incomeOverride, setIncomeOverride] = useState<{ gross: number; net: number } | null>(null);

  // Hydrate income override from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('csp_income_override');
      if (saved) setIncomeOverride(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Persist income override
  useEffect(() => {
    if (incomeOverride) {
      localStorage.setItem('csp_income_override', JSON.stringify(incomeOverride));
    } else {
      localStorage.removeItem('csp_income_override');
    }
  }, [incomeOverride]);

  const importIncomeFromTax = useCallback(() => {
    if (incomeTaxRecords.length === 0) return;
    const latest = incomeTaxRecords[0]; // most recent
    const gross = latest.total_income / 12;
    const net = (latest.total_income - latest.total_tax) / 12;
    setIncomeOverride({ gross, net });
  }, [incomeTaxRecords]);

  const grossMonthlyIncome = incomeOverride?.gross ?? (profile?.annual_income || 0) / 12;
  const netMonthlyIncome = incomeOverride?.net ?? grossMonthlyIncome * (1 - 0.30);

  // === Categorize Monthly Spending from Plaid (last month) ===
  const expenses = useMemo(
    () => transactions.filter(t => t.amount > 0 && t.personalFinanceCategory !== 'INCOME' && t.personalFinanceCategory !== 'TRANSFER'),
    [transactions]
  );

  // Build category totals from Plaid OR uploaded data
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();

    if (uploadedData) {
      // Use uploaded data — convert annual to monthly if needed
      const divisor = uploadedData.period === 'annual' ? 12 : 1;
      const cats = uploadedData.categories;
      if (cats.rent_mortgage) map.set('RENT_AND_UTILITIES', (cats.rent_mortgage + (cats.utilities || 0)) / divisor);
      if (cats.transportation) map.set('TRANSPORTATION', cats.transportation / divisor);
      if (cats.debt_payments) map.set('LOAN_PAYMENTS', cats.debt_payments / divisor);
      if (cats.insurance || cats.medical) map.set('MEDICAL', ((cats.insurance || 0) + (cats.medical || 0)) / divisor);
      if (cats.personal_care) map.set('PERSONAL_CARE', cats.personal_care / divisor);
      if (cats.home_maintenance) map.set('HOME_IMPROVEMENT', cats.home_maintenance / divisor);
      if (cats.groceries || cats.dining_out) map.set('FOOD_AND_DRINK', ((cats.groceries || 0) + (cats.dining_out || 0)) / divisor);
      if (cats.clothing) map.set('GENERAL_MERCHANDISE', cats.clothing / divisor);
      if (cats.subscriptions || cats.entertainment) map.set('ENTERTAINMENT', ((cats.subscriptions || 0) + (cats.entertainment || 0)) / divisor);
      if (cats.childcare) map.set('GENERAL_SERVICES', cats.childcare / divisor);
      // Put travel, education, gifts into guilt-free via OTHER
      const guiltFreeExtra = ((cats.travel || 0) + (cats.education || 0) + (cats.gifts_donations || 0) + (cats.other || 0)) / divisor;
      if (guiltFreeExtra > 0) map.set('GUILT_FREE_EXTRA', guiltFreeExtra);
      // Savings/investments
      if (cats.savings_investments) map.set('SAVINGS_INVESTMENTS', cats.savings_investments / divisor);
    } else {
    // Use Plaid transaction data
      for (const tx of expenses) {
        const cat = tx.personalFinanceCategory || 'OTHER';
        map.set(cat, (map.get(cat) || 0) + tx.amount);
      }
    }
    return map;
  }, [expenses, uploadedData]);

  // Fixed Costs
  const fixedCostItems = useMemo(() => {
    const items: { label: string; amount: number }[] = [];
    const groceries = categoryTotals.get('FOOD_AND_DRINK') || 0;
    const shopping = (categoryTotals.get('GENERAL_MERCHANDISE') || 0) + (categoryTotals.get('SHOPPING') || 0);

    for (const cat of FIXED_COST_CATEGORIES) {
      const amount = categoryTotals.get(cat) || 0;
      items.push({ label: FIXED_COST_SUBCATEGORIES[cat] || cat, amount });
    }
    items.push({ label: 'Groceries & Dining', amount: groceries });
    items.push({ label: 'Clothes / Shopping', amount: shopping });

    // Subscriptions
    const subs = categoryTotals.get('ENTERTAINMENT') || 0;
    items.push({ label: 'Subscriptions / Entertainment', amount: subs });

    items.sort((a, b) => b.amount - a.amount);
    // Apply manual overrides
    return items.map(item => ({
      ...item,
      amount: manualOverrides[item.label] ?? item.amount,
    }));
  }, [categoryTotals, manualOverrides]);

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

  // Guilt-free spending = what's left (include uploaded extras)
  const guiltFreeExtra = categoryTotals.get('GUILT_FREE_EXTRA') || 0;
  const guiltFreeBase = Math.max(0, netMonthlyIncome - fixedCostsTotalWithMisc - monthlyInvestments - savingsGoals) + guiltFreeExtra;
  const guiltFreeSpending = manualOverrides['__guilt_free'] ?? guiltFreeBase;

  // Override investments/savings from uploaded data + manual edits
  const uploadedSavingsInvestments = categoryTotals.get('SAVINGS_INVESTMENTS') || 0;
  const effectiveInvestments = manualOverrides['__investments'] ?? (uploadedData ? Math.max(monthlyInvestments, uploadedSavingsInvestments * 0.6) : monthlyInvestments);
  const effectiveSavings = manualOverrides['__savings'] ?? (uploadedData ? Math.max(savingsGoals, uploadedSavingsInvestments * 0.4) : savingsGoals);

  // Percentages
  const fixedPct = netMonthlyIncome > 0 ? (fixedCostsTotalWithMisc / netMonthlyIncome) * 100 : 0;
  const investPct = netMonthlyIncome > 0 ? (effectiveInvestments / netMonthlyIncome) * 100 : 0;
  const savingsPct = netMonthlyIncome > 0 ? (effectiveSavings / netMonthlyIncome) * 100 : 0;
  const guiltFreePct = netMonthlyIncome > 0 ? (guiltFreeSpending / netMonthlyIncome) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary text-sm">Building your spending plan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div
      >
        <h1 className="page-title">Conscious Spending Plan</h1>
        <p className="page-subtitle">Know exactly where your money goes — so you can spend guilt-free on what you love</p>

        {/* Upload Section */}
        <div className="mt-4 flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = '';
            }}
          />
          {uploadedData ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <FileText size={16} className="text-emerald-400" />
              <span className="text-sm text-emerald-400">Statement loaded</span>
              <button
                onClick={() => setUploadedData(null)}
                className="ml-1 text-text-secondary hover:text-text-primary transition-colors"
                title="Remove uploaded data"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-all disabled:opacity-50"
            >
              <Upload size={16} />
              <span className="text-sm font-medium">
                {uploading ? 'Processing...' : 'Upload Spending Statement'}
              </span>
            </button>
          )}
          {uploadError && (
            <span className="text-sm text-red-400">{uploadError}</span>
          )}
        </div>

        {uploadedData?.notes && (
          <p className="mt-2 text-sm text-text-secondary/70 italic">
            AI: {uploadedData.notes}
          </p>
        )}
      </div>

      {/* Four-bucket overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Fixed Costs', pct: fixedPct, target: '50-60%', amount: fixedCostsTotalWithMisc, color: fixedPct > 60 ? '#ef4444' : '#10b981' },
          { label: 'Investments', pct: investPct, target: '≥10%', amount: effectiveInvestments, color: investPct >= 10 ? '#10b981' : '#f59e0b' },
          { label: 'Savings', pct: savingsPct, target: '5-10%', amount: effectiveSavings, color: '#6366f1' },
          { label: 'Guilt-Free', pct: guiltFreePct, target: '20-35%', amount: guiltFreeSpending, color: guiltFreePct > 0 ? '#10b981' : '#ef4444' },
        ].map((bucket) => (
          <div
            key={bucket.label}
            className="glass-card p-4 rounded-xl"
          >
            <p className="stat-label">{bucket.label}</p>
            <p className="number-display text-2xl font-bold text-text-primary mt-1">{formatCurrency(bucket.amount)}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-2 rounded-full bg-[var(--overlay-hover)] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(bucket.pct, 100)}%`, backgroundColor: bucket.color }} />
              </div>
              <span className="text-sm font-bold" style={{ color: bucket.color }}>{bucket.pct.toFixed(0)}%</span>
            </div>
            <p className="text-sm text-text-secondary mt-1">Target: {bucket.target}</p>
          </div>
        ))}
      </div>

      {/* Net Worth */}
      <Card>
        <div className="py-2 px-3 bg-[var(--overlay-bg-secondary)] rounded-t-lg border-b border-border mb-1">
          <span className="text-sm font-bold text-text-primary">Net Worth</span>
        </div>
        <PlanRow label="Assets (real estate, property)" amount={totalAssets} indent />
        <PlanRow label="Investments (401k, brokerage)" amount={totalInvestments} indent />
        <PlanRow label="Savings (bank accounts)" amount={totalSavings} indent />
        <PlanRow label="Debt (mortgages, credit cards)" amount={-totalDebt} indent />
        <PlanRow label="TOTAL NET WORTH" amount={totalNetWorth} bold highlight />
      </Card>

      {/* Income */}
      <Card>
        <div className="py-2 px-3 bg-[var(--overlay-bg-secondary)] rounded-t-lg border-b border-border mb-1 flex items-center justify-between">
          <span className="text-sm font-bold text-text-primary">Income</span>
          <button
            onClick={incomeTaxRecords.length > 0 ? importIncomeFromTax : undefined}
              className={`flex items-center gap-1.5 text-sm font-medium px-2 py-1 rounded-lg transition-all ${incomeOverride
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'text-text-secondary hover:text-accent hover:bg-accent/10'
                }`}
            title={incomeTaxRecords.length > 0 ? `Import from ${incomeTaxRecords[0].document_type} (${incomeTaxRecords[0].tax_year})` : 'Enter income manually by clicking the amounts below'}
            >
              <Wand2 size={14} />
            {incomeOverride ? (incomeTaxRecords.length > 0 ? 'Imported from W-2' : 'Income Set') : (incomeTaxRecords.length > 0 ? 'Import from Tax' : 'Set Income')}
          </button>
        </div>
        <PlanRow
          label="Gross monthly income (before taxes)"
          amount={grossMonthlyIncome}
          indent
          onAmountChange={(val) => setIncomeOverride(prev => prev ? { ...prev, gross: val } : { gross: val, net: val * 0.7 })}
        />
        <PlanRow
          label="Net monthly income (after taxes)"
          amount={netMonthlyIncome}
          bold
          highlight
          onAmountChange={(val) => setIncomeOverride(prev => prev ? { ...prev, net: val } : { gross: val / 0.7, net: val })}
        />
      </Card>

      {/* Fixed Costs */}
      <Card>
        <SectionHeader title="Fixed Costs" pct={fixedPct} targetRange="50-60%" actual={fixedPct} />
        {fixedCostItems.map((item) => (
          <PlanRow
            key={item.label}
            label={item.label}
            amount={item.amount}
            indent
            onAmountChange={(val) => setOverride(item.label, val)}
          />
        ))}
        <PlanRow label="Miscellaneous (15% buffer)" amount={miscellaneous} indent dimLabel />
        <PlanRow label="FIXED COSTS TOTAL" amount={fixedCostsTotalWithMisc} bold highlight />
      </Card>

      {/* Investments */}
      <Card>
        <SectionHeader title="Investments" pct={investPct} targetRange="10%" actual={investPct} />
        <PlanRow
          label="Post-Tax Retirement / Brokerage"
          amount={effectiveInvestments}
          indent
          onAmountChange={(val) => setOverride('__investments', val)}
        />
        <PlanRow label="INVESTMENTS TOTAL" amount={effectiveInvestments} bold highlight />
      </Card>

      {/* Savings Goals */}
      <Card>
        <SectionHeader title="Savings Goals" pct={savingsPct} targetRange="5-10%" actual={savingsPct} />
        <PlanRow
          label="Emergency Fund / Vacations / Gifts"
          amount={effectiveSavings}
          indent
          onAmountChange={(val) => setOverride('__savings', val)}
        />
        <PlanRow label="SAVINGS TOTAL" amount={effectiveSavings} bold highlight />
      </Card>

      {/* Guilt-Free Spending */}
      <Card>
        <SectionHeader title="Guilt-Free Spending" pct={guiltFreePct} targetRange="20-35%" actual={guiltFreePct} />
        <PlanRow label="Dining out, movies, anything you want!" amount={guiltFreeSpending} indent onAmountChange={(val) => setOverride('__guilt_free', val)} />
        <PlanRow label="GUILT-FREE SPENDING TOTAL" amount={guiltFreeSpending} bold highlight />
      </Card>

      <div className="disclaimer">
        Conscious Spending Plan framework by Ramit Sethi. Fixed costs are auto-calculated from your last month of Plaid transactions.
        Income data comes from your profile. Adjust your profile income for more accurate results.
      </div>
    </div>
  );
}
