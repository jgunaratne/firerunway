'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Card from '@/components/shared/Card';
import { formatCurrency } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { Upload, FileText, X, Wand2, Users, Link2, Unlink, EyeOff } from 'lucide-react';

interface Transaction {
  id?: string;
  amount: number;
  personalFinanceCategory: string | null;
  personalFinanceCategoryDetailed: string | null;
  category: string[];
  name: string;
  date: string;
  merchantName: string | null;
  ownerName?: string;
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

// Comprehensive detailed category remapping
// Maps Plaid's detailed categories to the correct spending bucket
const DETAILED_CATEGORY_REMAP: Record<string, string> = {
  // Superstores/warehouse/pharmacies → groceries (they primarily sell food)
  'GENERAL_MERCHANDISE_SUPERSTORES': 'FOOD_AND_DRINK',
  'GENERAL_MERCHANDISE_WAREHOUSE_CLUBS': 'FOOD_AND_DRINK',
  'GENERAL_MERCHANDISE_PHARMACIES': 'FOOD_AND_DRINK',
  'GENERAL_MERCHANDISE_DISCOUNT_STORES': 'FOOD_AND_DRINK',

  // Pet supplies → general services (not clothing)
  'GENERAL_MERCHANDISE_PET_SUPPLIES': 'GENERAL_SERVICES',

  // Online marketplaces → keep as shopping
  'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES': 'GENERAL_MERCHANDISE',

  // Subscriptions that come through as entertainment → entertainment
  'ENTERTAINMENT_TV_AND_MOVIES': 'ENTERTAINMENT',
  'ENTERTAINMENT_MUSIC_AND_AUDIO': 'ENTERTAINMENT',
  'ENTERTAINMENT_VIDEO_GAMES': 'ENTERTAINMENT',

  // Gas stations → transportation
  'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR': 'FOOD_AND_DRINK',
  'FOOD_AND_DRINK_VENDING_MACHINES': 'FOOD_AND_DRINK',
};

// Merchant name patterns → category overrides (case-insensitive matching)
const MERCHANT_OVERRIDES: [RegExp, string][] = [
  // Grocery stores
  [/fred\s*meyer|kroger|safeway|albertsons|qfc|winco|grocery|trader\s*joe|whole\s*foods|aldi|lidl|sprouts|publix|h-?e-?b|meijer|food\s*lion|piggly|wegmans|stop\s*&?\s*shop|giant\s*(eagle|food)?|harris\s*teeter|market\s*basket/i, 'FOOD_AND_DRINK'],
  // Warehouse clubs (primarily groceries)
  [/costco|sam'?s\s*club|bj'?s\s*wholesale/i, 'FOOD_AND_DRINK'],
  // Big box stores with groceries
  [/walmart|target|winco/i, 'FOOD_AND_DRINK'],
  // Pharmacies (OTC, personal care)
  [/walgreens|cvs|rite\s*aid/i, 'PERSONAL_CARE'],
  // Gas stations → transportation
  [/shell|chevron|arco|76|exxon|mobil|bp\b|texaco|valero|marathon|speedway|circle\s*k|wawa|sheetz|pilot|loves|flying\s*j|gas|petro|fuel/i, 'TRANSPORTATION'],
  // Streaming/subscriptions → entertainment
  [/netflix|hulu|disney\+?|spotify|apple\s*(music|tv)|youtube|hbo|paramount|peacock|crunchyroll|amazon\s*prime|seattle\s*times|new\s*york\s*times|nytimes|wall\s*street\s*journal|wsj|washington\s*post|newspaper|news\s*sub/i, 'ENTERTAINMENT'],
  // Ride-share → transportation
  [/uber(?!\s*eats)|lyft|taxi|cab\b/i, 'TRANSPORTATION'],
  // Food delivery → food
  [/uber\s*eats|doordash|grubhub|postmates|instacart|gopuff/i, 'FOOD_AND_DRINK'],
  // Insurance → medical
  [/insurance|geico|allstate|state\s*farm|progressive|usaa/i, 'MEDICAL'],
  // Utilities → rent & utilities
  [/comcast|xfinity|spectrum|at&?t|verizon|t-?mobile|sprint|electric|power|energy|water|sewage|gas\s*(co|company)|pge|pg&e|duke\s*energy|con\s*edison/i, 'RENT_AND_UTILITIES'],
  // Gym / activities → personal care
  [/gym|gymnastics|fitness|planet\s*fitness|equinox|orangetheory|24\s*hour|ymca|crossfit|peloton|martial\s*arts|karate|dance|swim|yoga|pilates/i, 'PERSONAL_CARE'],
  // Coffee shops → food
  [/starbucks|dunkin|peet'?s|dutch\s*bros|coffee/i, 'FOOD_AND_DRINK'],
  // Restaurants → food
  [/restaurant|mcdonald|burger|wendy|chick-?fil|taco\s*bell|subway|chipotle|panera|five\s*guys|in-?n-?out|domino|pizza\s*hut|papa\s*john/i, 'FOOD_AND_DRINK'],
];

// Resolve the effective spending category, correcting common Plaid misclassifications
function resolveCategory(tx: Transaction): string {
  const primary = tx.personalFinanceCategory || 'OTHER';
  const detailed = tx.personalFinanceCategoryDetailed || '';
  const merchant = (tx.merchantName || tx.name || '').toLowerCase();

  // 1. Check detailed category remap first
  if (detailed && DETAILED_CATEGORY_REMAP[detailed]) {
    return DETAILED_CATEGORY_REMAP[detailed];
  }

  // 2. Check merchant name patterns
  for (const [pattern, category] of MERCHANT_OVERRIDES) {
    if (pattern.test(merchant)) {
      return category;
    }
  }

  // 3. Fall back to Plaid's primary category
  return primary;
}

function PlanRow({ label, amount, indent = false, bold = false, highlight = false, dimLabel = false, onAmountChange, transactions, onExclude, excludedIds }: {
  label: string; amount: number | string; indent?: boolean; bold?: boolean; highlight?: boolean; dimLabel?: boolean;
  onAmountChange?: (val: number) => void;
  transactions?: Transaction[];
  onExclude?: (txId: string) => void;
  excludedIds?: Set<string>;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');
  const [expanded, setExpanded] = useState(false);
  const editable = !!onAmountChange && typeof amount === 'number';
  const hasDetails = transactions && transactions.length > 0;

  return (
    <div>
      <div className={`flex items-center justify-between py-2 px-3 ${bold ? 'border-t border-border' : 'border-b border-border/20'} ${highlight ? 'bg-accent/5' : ''}`}>
        <div className="flex items-center gap-1.5">
          {hasDetails && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-accent/60 hover:text-accent text-xs w-4 flex-shrink-0 transition-colors"
              title={expanded ? 'Collapse' : 'Show transactions'}
            >
              {expanded ? '▾' : '▸'}
            </button>
          )}
          <span className={`text-sm ${indent && !hasDetails ? 'pl-4' : ''} ${bold ? 'font-semibold text-text-primary' : dimLabel ? 'text-text-secondary/60' : 'text-text-secondary'}`}>
            {label}
            {hasDetails && <span className="text-text-secondary/40 ml-1 text-xs">({transactions.length})</span>}
          </span>
        </div>
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
      {expanded && hasDetails && (
        <div className="bg-bg-elevated/50 border-b border-border/20">
          {transactions.sort((a, b) => b.amount - a.amount).map((tx, i) => {
            const isExcluded = excludedIds && tx.id && excludedIds.has(tx.id);
            return (
              <div key={i} className={`flex items-center justify-between py-1 px-3 pl-10 text-xs border-b border-border/10 last:border-b-0 group ${isExcluded ? 'opacity-40' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  {tx.ownerName && tx.ownerName.split(', ').map((name, j) => (
                    <span key={j} className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent/20 text-accent text-[9px] font-bold flex-shrink-0" title={name}>
                      {name.charAt(0).toUpperCase()}
                    </span>
                  ))}
                    <span className={`text-text-secondary truncate ${isExcluded ? 'line-through' : ''}`}>{tx.merchantName || tx.name}</span>
                </div>
                <span className="text-text-secondary/40">{tx.date}</span>
              </div>
              <div className="flex items-center gap-2">
                  <span className={`number-display text-text-secondary flex-shrink-0 ${isExcluded ? 'line-through' : ''}`}>{formatCurrency(tx.amount)}</span>
                {onExclude && tx.id && (
                  <button
                    onClick={() => onExclude(tx.id!)}
                      className={`${isExcluded ? 'opacity-100 text-amber-400' : 'opacity-0 group-hover:opacity-100 text-text-secondary/30 hover:text-red-400'} transition-all`}
                      title={isExcluded ? 'Re-include this charge' : 'Exclude this charge'}
                  >
                    <EyeOff size={12} />
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
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
  const { profile, uid } = useUserData();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [categorizing, setCategorizing] = useState(false);
  const [aiCorrections, setAiCorrections] = useState<Record<string, string>>({});
  const [partner, setPartner] = useState<{ id: string; email: string; name: string } | null>(null);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [linkingPartner, setLinkingPartner] = useState(false);
  const [partnerError, setPartnerError] = useState('');

  // Fetch partner info
  useEffect(() => {
    if (!uid) return;
    fetch(`/api/household?uid=${uid}`)
      .then(r => r.json())
      .then(d => { if (d.partner) setPartner(d.partner); })
      .catch(() => { /* no partner */ });
  }, [uid]);

  // Fetch transactions (re-fetch when partner changes)
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams({ uid, months: '1' });
    if (partner) params.set('includePartner', 'true');
    fetch(`/api/plaid/transactions?${params}`)
      .then(r => r.json())
      .then(d => setTransactions(d.transactions || []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, [uid, partner]);

  const handleLinkPartner = useCallback(async () => {
    if (!partnerEmail.trim()) return;
    setLinkingPartner(true);
    setPartnerError('');
    try {
      const res = await fetch('/api/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, partnerEmail: partnerEmail.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setPartnerError(data.error);
      } else if (data.partner) {
        setPartner(data.partner);
        setPartnerEmail('');
      }
    } catch {
      setPartnerError('Failed to link partner');
    } finally {
      setLinkingPartner(false);
    }
  }, [uid, partnerEmail]);

  const handleUnlinkPartner = useCallback(async () => {
    try {
      await fetch('/api/household', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      });
      setPartner(null);
    } catch { /* ignore */ }
  }, [uid]);

  // Hydrate AI corrections from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('csp_ai_corrections');
      if (saved) setAiCorrections(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Persist AI corrections
  useEffect(() => {
    if (Object.keys(aiCorrections).length > 0) {
      localStorage.setItem('csp_ai_corrections', JSON.stringify(aiCorrections));
    } else {
      localStorage.removeItem('csp_ai_corrections');
    }
  }, [aiCorrections]);

  const handleAiCategorize = useCallback(async () => {
    if (transactions.length === 0) return;
    setCategorizing(true);
    try {
      const res = await fetch('/api/ai/categorize-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      });
      const data = await res.json();
      if (data.corrections) {
        setAiCorrections(data.corrections);
        // Clear manual overrides since categories changed
        setManualOverrides({});
      }
    } catch (err) {
      console.error('AI categorization error:', err);
    } finally {
      setCategorizing(false);
    }
  }, [transactions]);

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

  const grossMonthlyIncome = incomeOverride?.gross ?? (profile?.annual_income || 0) / 12;
  const netMonthlyIncome = incomeOverride?.net ?? grossMonthlyIncome * (1 - 0.30);

  // === Excluded transactions (persisted) ===
  const [excludedTxIds, setExcludedTxIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem('csp_excluded_txs');
      if (saved) setExcludedTxIds(new Set(JSON.parse(saved)));
    } catch { /* ignore */ }
  }, []);

  const handleExclude = useCallback((txId: string) => {
    setExcludedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(txId)) {
        next.delete(txId); // Toggle: re-include
      } else {
        next.add(txId);
      }
      localStorage.setItem('csp_excluded_txs', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const handleClearExclusions = useCallback(() => {
    setExcludedTxIds(new Set());
    localStorage.removeItem('csp_excluded_txs');
  }, []);

  // === Categorize Monthly Spending from Plaid (last month) ===
  // Keep ALL transactions (including excluded) so they appear grayed out in expanded view
  const expenses = useMemo(
    () => transactions.filter(t => t.amount > 0 && t.personalFinanceCategory !== 'INCOME' && t.personalFinanceCategory !== 'TRANSFER'),
    [transactions]
  );

  // Date range from transactions
  const dateRange = useMemo(() => {
    if (expenses.length === 0) return null;
    const dates = expenses.map(t => t.date).sort();
    return { start: dates[0], end: dates[dates.length - 1] };
  }, [expenses]);

  // Resolve category with AI corrections applied
  const resolveCategoryWithAi = useCallback((tx: Transaction, index: number): string => {
    // AI correction takes priority
    if (aiCorrections[String(index)]) {
      return aiCorrections[String(index)];
    }
    return resolveCategory(tx);
  }, [aiCorrections]);

  // Build category totals from Plaid OR uploaded data
  const { categoryTotals, categoryTransactions } = useMemo(() => {
    const totals = new Map<string, number>();
    const txByCategory = new Map<string, Transaction[]>();

    if (uploadedData) {
      // Use uploaded data — convert annual to monthly if needed
      const divisor = uploadedData.period === 'annual' ? 12 : 1;
      const cats = uploadedData.categories;
      if (cats.rent_mortgage) totals.set('RENT_AND_UTILITIES', (cats.rent_mortgage + (cats.utilities || 0)) / divisor);
      if (cats.transportation) totals.set('TRANSPORTATION', cats.transportation / divisor);
      if (cats.debt_payments) totals.set('LOAN_PAYMENTS', cats.debt_payments / divisor);
      if (cats.insurance || cats.medical) totals.set('MEDICAL', ((cats.insurance || 0) + (cats.medical || 0)) / divisor);
      if (cats.personal_care) totals.set('PERSONAL_CARE', cats.personal_care / divisor);
      if (cats.home_maintenance) totals.set('HOME_IMPROVEMENT', cats.home_maintenance / divisor);
      if (cats.groceries || cats.dining_out) totals.set('FOOD_AND_DRINK', ((cats.groceries || 0) + (cats.dining_out || 0)) / divisor);
      if (cats.clothing) totals.set('GENERAL_MERCHANDISE', cats.clothing / divisor);
      if (cats.subscriptions || cats.entertainment) totals.set('ENTERTAINMENT', ((cats.subscriptions || 0) + (cats.entertainment || 0)) / divisor);
      if (cats.childcare) totals.set('GENERAL_SERVICES', cats.childcare / divisor);
      const guiltFreeExtra = ((cats.travel || 0) + (cats.education || 0) + (cats.gifts_donations || 0) + (cats.other || 0)) / divisor;
      if (guiltFreeExtra > 0) totals.set('GUILT_FREE_EXTRA', guiltFreeExtra);
      if (cats.savings_investments) totals.set('SAVINGS_INVESTMENTS', cats.savings_investments / divisor);
    } else {
      // Use Plaid transaction data — track both totals and individual transactions
      // We need to map expense index back to original transaction index for AI corrections
      for (let i = 0; i < expenses.length; i++) {
        const tx = expenses[i];
        const originalIdx = transactions.indexOf(tx);
        const cat = resolveCategoryWithAi(tx, originalIdx);
        totals.set(cat, (totals.get(cat) || 0) + tx.amount);
        if (!txByCategory.has(cat)) txByCategory.set(cat, []);
        txByCategory.get(cat)!.push(tx);
      }
    }
    return { categoryTotals: totals, categoryTransactions: txByCategory };
  }, [expenses, uploadedData, resolveCategoryWithAi, transactions]);

  const fixedCostItems = useMemo(() => {
    const items: { label: string; amount: number; transactions: Transaction[] }[] = [];
    const groceryTxs = categoryTransactions.get('FOOD_AND_DRINK') || [];
    const shoppingTxs = [...(categoryTransactions.get('GENERAL_MERCHANDISE') || []), ...(categoryTransactions.get('SHOPPING') || [])];

    // Track which categories we've accounted for
    const accountedCategories = new Set([
      ...FIXED_COST_CATEGORIES,
      'FOOD_AND_DRINK',
      'GENERAL_MERCHANDISE',
      'SHOPPING',
      'ENTERTAINMENT',
      'GUILT_FREE_EXTRA',
      'SAVINGS_INVESTMENTS',
    ]);

    // Helper: sum from transactions array, excluding excluded IDs
    const sumTxs = (txs: Transaction[]) => txs
      .filter(t => !t.id || !excludedTxIds.has(t.id))
      .reduce((s, t) => s + t.amount, 0);

    for (const cat of FIXED_COST_CATEGORIES) {
      const txs = categoryTransactions.get(cat) || [];
      items.push({ label: FIXED_COST_SUBCATEGORIES[cat] || cat, amount: sumTxs(txs), transactions: txs });
    }
    items.push({ label: 'Groceries & Dining', amount: sumTxs(groceryTxs), transactions: groceryTxs });
    items.push({ label: 'Clothes / Shopping', amount: sumTxs(shoppingTxs), transactions: shoppingTxs });

    // Subscriptions
    const subsTxs = categoryTransactions.get('ENTERTAINMENT') || [];
    items.push({ label: 'Subscriptions / Entertainment', amount: sumTxs(subsTxs), transactions: subsTxs });

    // Collect all uncategorized/other transactions not in a named row
    const otherTxs: Transaction[] = [];
    Array.from(categoryTransactions.entries()).forEach(([cat, txs]) => {
      if (!accountedCategories.has(cat)) {
        otherTxs.push(...txs);
      }
    });
    if (otherTxs.length > 0) {
      items.push({ label: 'Other / Uncategorized', amount: sumTxs(otherTxs), transactions: otherTxs });
    }

    items.sort((a, b) => b.amount - a.amount);
    return items;
  }, [categoryTransactions, excludedTxIds]);

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
        <div className="flex items-center gap-3 flex-wrap">
          <p className="page-subtitle">Know exactly where your money goes — so you can spend guilt-free on what you love</p>
          {dateRange && (
            <span className="text-xs text-text-secondary/50 bg-bg-elevated px-2 py-0.5 rounded-full border border-border/30">
              {new Date(dateRange.start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(dateRange.end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          {excludedTxIds.size > 0 && (
            <button
              onClick={handleClearExclusions}
              className="text-xs text-text-secondary/50 hover:text-accent transition-colors"
              title="Restore excluded transactions"
            >
              {excludedTxIds.size} excluded · restore
            </button>
          )}
        </div>

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

      {/* Partner Link */}
      <div className="flex items-center gap-3 flex-wrap">
        <Users size={16} className="text-text-secondary/60" />
        {partner ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20">
            <Link2 size={14} className="text-accent" />
            <span className="text-sm text-accent">Shared with <strong>{partner.name}</strong></span>
            <button
              onClick={handleUnlinkPartner}
              className="ml-1 text-text-secondary/40 hover:text-red-400 transition-colors"
              title="Unlink partner"
            >
              <Unlink size={12} />
            </button>
          </div>
        ) : (
          <>
            <input
              type="email"
              placeholder="Partner's email..."
              value={partnerEmail}
              onChange={(e) => setPartnerEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLinkPartner(); }}
              className="bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary w-52 focus:outline-none focus:border-accent/40"
            />
            <button
              onClick={handleLinkPartner}
              disabled={linkingPartner || !partnerEmail.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm hover:bg-accent/20 transition-all disabled:opacity-50"
            >
              <Link2 size={14} />
              {linkingPartner ? 'Linking...' : 'Link Partner'}
            </button>
          </>
        )}
        {partnerError && <span className="text-sm text-red-400">{partnerError}</span>}
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

      {/* Income */}
      <Card>
        <div className="py-2 px-3 bg-[var(--overlay-bg-secondary)] rounded-t-lg border-b border-border mb-1 flex items-center justify-between">
          <span className="text-sm font-bold text-text-primary">Income</span>
          <div className="flex items-center gap-2">
            {incomeOverride && (
              <button
                onClick={() => setIncomeOverride(null)}
                className="text-xs text-text-secondary/40 hover:text-red-400 transition-colors"
                title="Reset income"
              >
                <X size={12} />
              </button>
            )}
            <span className="text-xs text-text-secondary/50">Click amounts to edit</span>
          </div>
        </div>
        <PlanRow
          label="Annual base salary (excl. RSUs & bonus)"
          amount={grossMonthlyIncome * 12}
          indent
          onAmountChange={(val) => {
            const monthly = val / 12;
            setIncomeOverride({ gross: monthly, net: monthly * 0.7 });
          }}
        />
        <PlanRow
          label="Gross monthly income"
          amount={grossMonthlyIncome}
          indent
          dimLabel
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
        <div className="flex items-center justify-between py-2.5 px-3 bg-[var(--overlay-bg-secondary)] rounded-t-lg border-b border-border">
          <span className="text-sm font-bold text-text-primary">Fixed Costs</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAiCategorize}
              disabled={categorizing || transactions.length === 0}
              className={`flex items-center gap-1.5 text-sm font-medium px-2 py-1 rounded-lg transition-all ${Object.keys(aiCorrections).length > 0
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'text-text-secondary hover:text-accent hover:bg-accent/10'
                } disabled:opacity-50`}
              title="Use AI to recategorize transactions"
            >
              <Wand2 size={14} className={categorizing ? 'animate-spin' : ''} />
              {categorizing ? 'Categorizing...' : Object.keys(aiCorrections).length > 0 ? `${Object.keys(aiCorrections).length} corrected` : 'AI Categorize'}
            </button>
            {Object.keys(aiCorrections).length > 0 && (
              <button
                onClick={() => { setAiCorrections({}); setManualOverrides({}); }}
                className="text-xs text-text-secondary/60 hover:text-red-400 transition-colors"
                title="Clear AI corrections"
              >
                <X size={12} />
              </button>
            )}
            <span className="text-sm text-text-secondary">Target: 50-60%</span>
            <span className={`text-sm font-bold ${fixedPct > 60 ? 'text-red-400' : fixedPct < 50 ? 'text-amber-400' : 'text-emerald-400'}`}>{fixedPct.toFixed(0)}%</span>
          </div>
        </div>
        {fixedCostItems.map((item) => (
          <PlanRow
            key={item.label}
            label={item.label}
            amount={item.amount}
            indent
            onAmountChange={(val) => setOverride(item.label, val)}
            transactions={item.transactions}
            onExclude={handleExclude}
            excludedIds={excludedTxIds}
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
