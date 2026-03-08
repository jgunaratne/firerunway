'use client';

import { useState, useMemo, useCallback, ReactNode } from 'react';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { calculateFIScore, formatCurrency } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { useBrokerageData } from '@/lib/BrokerageDataContext';
import { useStockPrice } from '@/hooks/useStockPrice';
import {
  TrendingDown, BarChart2, TrendingUp, PieChart, Coins,
  Landmark, Target, Banknote, PartyPopper,
} from 'lucide-react';

// ─── Editable currency field ────────────────────────────────────────

function EditableAmount({
  label,
  value,
  onSave,
  placeholder = 'Click to set',
  sublabel,
}: {
  label: string;
  value: number;
  onSave: (val: number) => void;
  placeholder?: string;
    sublabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => {
    setDraft(value > 0 ? value.toString() : '');
    setEditing(true);
  };

  const commitEdit = () => {
    const num = parseInt(draft.replace(/\D/g, '')) || 0;
    if (num !== value) onSave(num);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div className="bg-bg-surface border border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-1">
      <div className="text-sm text-gray-400">{label}</div>
      {editing ? (
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          placeholder="e.g. 3000000"
          className="w-full text-center bg-transparent border border-emerald-500/50 rounded px-2 py-1 text-2xl font-bold text-white focus:outline-none focus:border-emerald-400"
        />
      ) : (
          <button onClick={startEdit} className="w-full group">
            <div className={`text-2xl font-bold ${value > 0 ? 'text-white' : 'text-gray-500'}`}>
            {value > 0 ? formatCurrency(value, true) : placeholder}
            </div>
            <div className="text-xs text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
            click to edit
            </div>
        </button>
      )}
      {sublabel && <div className="text-xs text-indigo-400/80">{sublabel}</div>}
    </div>
  );
}

// ─── Projection calculator ─────────────────────────────────────────

function computeProjections(
  currentPortfolio: number,
  annualSavings: number,
  fireNumber: number,
) {
  const scenarios: Array<{ label: string; icon: ReactNode; percentile: string; realReturn: number; iconColor: string }> = [
    { label: 'Bear Case', icon: <TrendingDown className="w-5 h-5" />, percentile: '10th percentile', realReturn: 0.03, iconColor: 'text-red-400' },
    { label: 'Base Case', icon: <BarChart2 className="w-5 h-5" />, percentile: '50th percentile', realReturn: 0.06, iconColor: 'text-indigo-400' },
    { label: 'Bull Case', icon: <TrendingUp className="w-5 h-5" />, percentile: '90th percentile', realReturn: 0.10, iconColor: 'text-emerald-400' },
  ];

  const currentYear = new Date().getFullYear();

  return scenarios.map((s) => {
    let portfolio = currentPortfolio;
    let year = currentYear;
    const maxYears = 50;

    for (let y = 0; y < maxYears; y++) {
      if (portfolio >= fireNumber && fireNumber > 0) break;
      portfolio = portfolio * (1 + s.realReturn) + annualSavings;
      year++;
    }

    return {
      ...s,
      year: portfolio >= fireNumber && fireNumber > 0 ? year : currentYear + maxYears,
      portfolioAtFI: Math.round(portfolio),
      yearsAway: year - currentYear,
      assumptions:
        s.realReturn <= 0.03
          ? `${(s.realReturn * 100).toFixed(0)}% real returns, market corrections, higher inflation`
          : s.realReturn <= 0.06
            ? `${(s.realReturn * 100).toFixed(0)}% real returns, moderate inflation, steady savings`
            : `${(s.realReturn * 100).toFixed(0)}% real returns, strong growth, compounding acceleration`,
    };
  });
}

// ─── Dynamic recommendations ────────────────────────────────────────

function generateRecommendations(
  savingsRate: number,
  concentrationPct: number,
  fundingRatio: number,
  annualIncome: number,
  fireNumber: number,
) {
  const recs: { action: string; impact: string; icon: ReactNode; priority: number }[] = [];

  if (concentrationPct > 0.25) {
    const potentialGain = Math.round(concentrationPct * 10);
    recs.push({
      action: `Your employer stock is ${Math.round(concentrationPct * 100)}% of net worth — diversifying to <20% would reduce concentration risk significantly`,
      impact: `+${Math.min(potentialGain, 6)}`,
      icon: <PieChart size={16} className="text-indigo-400" />,
      priority: 1,
    });
  }

  if (savingsRate < 0.3 && annualIncome > 0) {
    const targetIncrease = Math.round((0.35 - savingsRate) * annualIncome);
    recs.push({
      action: `Increasing savings rate from ${Math.round(savingsRate * 100)}% to 35% would add ${formatCurrency(targetIncrease)}/yr to investments`,
      impact: '+3',
      icon: <Coins size={16} className="text-amber-400" />,
      priority: 2,
    });
  } else if (savingsRate < 0.5 && annualIncome > 0) {
    recs.push({
      action: `Your ${Math.round(savingsRate * 100)}% savings rate is good — pushing to 50% would accelerate your timeline by ~2 years`,
      impact: '+2',
      icon: <Coins size={16} className="text-amber-400" />,
      priority: 3,
    });
  }

  if (fundingRatio < 0.5 && fireNumber > 0) {
    recs.push({
      action: `You're ${Math.round(fundingRatio * 100)}% to your FIRE number — maximizing tax-advantaged accounts (401k/IRA) would accelerate progress`,
      impact: '+2',
      icon: <Landmark size={16} className="text-indigo-400" />,
      priority: 2,
    });
  }

  if (fireNumber <= 0) {
    recs.push({
      action: 'Set your FIRE number above to get accurate projections and tracking',
      impact: '—',
      icon: <Target size={16} className="text-indigo-400" />,
      priority: 0,
    });
  }

  if (annualIncome <= 0) {
    recs.push({
      action: 'Set your annual income to calculate savings rate and contribution projections',
      impact: '—',
      icon: <Banknote size={16} className="text-indigo-400" />,
      priority: 0,
    });
  }

  if (fundingRatio >= 0.9 && fireNumber > 0) {
    recs.push({
      action: `You're ${Math.round(fundingRatio * 100)}% funded! Consider building a 2-year cash buffer before transitioning`,
      impact: '+1',
      icon: <PartyPopper size={16} className="text-emerald-400" />,
      priority: 4,
    });
  }

  return recs.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

// ─── Score helpers ──────────────────────────────────────────────────

function getScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-indigo-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreLabel(score: number) {
  if (score >= 90) return 'Nearly FI';
  if (score >= 75) return 'Strong Progress';
  if (score >= 50) return 'On Track';
  if (score >= 25) return 'Building Foundation';
  return 'Getting Started';
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function FireScorePage() {
  const { profile, rsuGrants, realEstate, incomeTaxRecords, isLoading, uid: userId, refresh } = useUserData();
  const { totalInvestment, loading: holdingsLoading } = useBrokerageData();
  const [saving, setSaving] = useState(false);

  // Compute income from tax records: sum all records for the most recent tax year
  const incomeFromTax = useMemo(() => {
    if (!incomeTaxRecords || incomeTaxRecords.length === 0) return 0;
    const latestYear = incomeTaxRecords[0].tax_year;
    return incomeTaxRecords
      .filter(r => r.tax_year === latestYear)
      .reduce((sum, r) => sum + (r.total_income || 0), 0);
  }, [incomeTaxRecords]);

  const annualSpend = profile?.annual_spend || 0;
  const profileIncome = profile?.annual_income || 0;
  const annualIncome = profileIncome > 0 ? profileIncome : incomeFromTax;
  const isIncomeFromTax = profileIncome === 0 && incomeFromTax > 0;
  const fireNumber = profile?.fire_number || 0;
  const ticker = rsuGrants[0]?.company_ticker || 'AMZN';
  const stockPrice = useStockPrice(ticker);
  const rsuValue = rsuGrants.reduce((sum, g) => sum + g.vested_shares * stockPrice, 0);
  const realEstateEquity = realEstate.reduce((sum, p) => sum + ((p.current_value ?? 0) - (p.mortgage_balance ?? 0)), 0);
  const investable = totalInvestment + rsuValue;
  const totalNetWorth = totalInvestment + rsuValue + realEstateEquity;
  const annualSavings = Math.max(annualIncome - annualSpend, 0);
  const savingsRate = annualIncome > 0 ? annualSavings / annualIncome : 0;
  const concentrationPct = totalNetWorth > 0 ? rsuValue / totalNetWorth : 0;
  const fundingRatio = fireNumber > 0 ? investable / fireNumber : 0;

  const fiData = calculateFIScore({
    currentInvestableAssets: investable,
    fireNumber,
    liquidAssets: investable,
    annualSpend,
    employerStockValue: rsuValue,
    totalNetWorth,
    isEmployed: true,
    annualIncome,
  });

  const score = fiData.total;

  const projections = useMemo(
    () => computeProjections(investable, annualSavings, fireNumber),
    [investable, annualSavings, fireNumber]
  );

  const recommendations = useMemo(
    () => generateRecommendations(savingsRate, concentrationPct, fundingRatio, annualIncome, fireNumber),
    [savingsRate, concentrationPct, fundingRatio, annualIncome, fireNumber]
  );

  const updateProfileField = useCallback(async (field: string, value: number) => {
    if (!userId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId, [field]: value }),
      });
      if (res.ok) {
        await refresh();
      } else {
        console.error('Failed to update profile:', await res.text());
      }
    } catch (err) {
      console.error('Profile update error:', err);
    } finally {
      setSaving(false);
    }
  }, [userId, refresh]);

  if (isLoading || holdingsLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Calculating your FIRE score...</p>
      </div>
    </div>
  );

  // Net worth composition data
  const netWorthItems = [
    { label: 'Investment Portfolio', value: totalInvestment, color: 'bg-indigo-500', pct: totalNetWorth > 0 ? (totalInvestment / totalNetWorth) * 100 : 0 },
    { label: 'RSU / Employer Stock', value: rsuValue, color: 'bg-yellow-500', pct: totalNetWorth > 0 ? (rsuValue / totalNetWorth) * 100 : 0 },
    { label: 'Real Estate Equity', value: realEstateEquity, color: 'bg-emerald-500', pct: totalNetWorth > 0 ? (realEstateEquity / totalNetWorth) * 100 : 0 },
  ].filter(item => item.value > 0);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white tracking-tight">FIRE Score</h1>
          {saving && <span className="text-sm text-emerald-400 animate-pulse">Saving...</span>}
        </div>
        <p className="text-gray-400">A single, honest answer to &quot;am I financially independent?&quot;</p>
      </div>

      {/* Main Score Card */}
      <div className="bg-bg-surface border border-border rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />

        <div className="text-center space-y-2 z-10 relative">
          <div className={`text-[120px] leading-none font-bold ${getScoreColor(score)} tracking-tighter`}>
            <AnimatedNumber value={score} />
          </div>
          <div className="text-sm text-gray-400">out of 100 — <span className="text-white font-medium">{getScoreLabel(score)}</span></div>
        </div>

        <div className="w-full max-w-3xl mt-12 space-y-3 z-10 relative">
          <div className="h-3 w-full rounded-full bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-emerald-500 to-indigo-500" />
          <div className="flex justify-between text-[11px] text-gray-500 font-medium uppercase tracking-wider">
            <span>Starting out</span>
            <span>Building base</span>
            <span>Halfway</span>
            <span>Approaching FI</span>
            <span className="text-gray-600">Financially independent</span>
          </div>
        </div>
      </div>

      {/* 4 Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-bg-surface border border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-1">
          <div className="text-sm text-gray-400">Investable Assets</div>
          <div className="text-2xl font-bold text-white">{formatCurrency(investable, true)}</div>
          <div className="text-xs text-gray-500">from linked accounts</div>
        </div>
        <EditableAmount
          label="FIRE Number"
          value={fireNumber}
          onSave={(val) => updateProfileField('fire_number', val)}
          placeholder="Click to set"
        />
        <EditableAmount
          label="Annual Income"
          value={annualIncome}
          onSave={(val) => updateProfileField('annual_income', val)}
          placeholder="Click to set"
          sublabel={isIncomeFromTax ? `from W-2 (${incomeTaxRecords[0]?.tax_year})` : undefined}
        />
        <EditableAmount
          label="Annual Spend"
          value={annualSpend}
          onSave={(val) => updateProfileField('annual_spend', val)}
          placeholder="Click to set"
        />
      </div>

      {/* 3 Cards Grid */}
      {(fireNumber > 0 || annualIncome > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-bg-surface border border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="text-sm text-gray-400">Progress</div>
            <div className={`text-3xl font-bold ${fundingRatio >= 0.75 ? 'text-emerald-400' : fundingRatio >= 0.5 ? 'text-indigo-400' : 'text-white'}`}>
              {fireNumber > 0 ? `${Math.round(fundingRatio * 100)}%` : '—'}
            </div>
          </div>
          <div className="bg-bg-surface border border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="text-sm text-gray-400">Savings Rate</div>
            <div className={`text-3xl font-bold ${savingsRate >= 0.3 ? 'text-emerald-400' : savingsRate > 0 ? 'text-amber-400' : 'text-white'}`}>
              {annualIncome > 0 && annualSpend > 0 ? `${Math.round(savingsRate * 100)}%` : '—'}
            </div>
          </div>
          <div className="bg-bg-surface border border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="text-sm text-gray-400">Runway</div>
            <div className="text-3xl font-bold text-white">
              {annualSpend > 0 ? `${(investable / annualSpend).toFixed(1)} yrs` : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Score Breakdown */}
      <div className="bg-bg-surface border border-border rounded-2xl p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Score Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-border">
                <th className="pb-3 font-medium">Factor</th>
                <th className="pb-3 font-medium">Your Value</th>
                <th className="pb-3 font-medium text-right">Weight</th>
                <th className="pb-3 font-medium text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fiData.breakdown.map((row) => (
                <tr key={row.factor}>
                  <td className="py-4 text-gray-300">{row.factor}</td>
                  <td className="py-4 text-gray-400">{row.value}</td>
                  <td className="py-4 text-gray-400 text-right">{row.weight}%</td>
                  <td className="py-4 text-white font-bold text-right">{row.points}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td className="pt-4 text-white font-bold">Total</td>
                <td className="pt-4"></td>
                <td className="pt-4"></td>
                <td className="pt-4 text-indigo-400 font-bold text-lg text-right">{score}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Timeline Projections */}
      {fireNumber > 0 && annualSavings > 0 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">Timeline Projections</h2>
            <p className="text-sm text-gray-400">Based on your portfolio of {formatCurrency(investable, true)} and annual savings of {formatCurrency(annualSavings, true)}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {projections.map((proj) => (
              <div key={proj.label} className="bg-bg-surface border border-border rounded-2xl p-6 flex flex-col items-center text-center space-y-4 relative overflow-hidden">
                <div className={`absolute top-6 left-6 ${proj.iconColor}`}>
                  {proj.icon}
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-gray-300 font-medium">{proj.label}</div>
                  <div className="text-xs text-gray-500">{proj.percentile}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-4xl font-bold text-white">{proj.year}</div>
                  <div className="text-sm text-gray-400">
                    {proj.yearsAway > 0 ? `${proj.yearsAway} years away` : 'Now'}
                  </div>
                  <div className="text-sm text-gray-400">Portfolio: {formatCurrency(proj.portfolioAtFI, true)}</div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed max-w-[200px]">
                  {proj.assumptions}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What Moves Your Score */}
      {recommendations.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">What Moves Your Score</h2>
            <p className="text-sm text-gray-400">Personalized actions based on your current financial data</p>
          </div>

          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <div key={i} className="bg-bg-surface border border-border rounded-2xl p-4 flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  {rec.icon}
                </div>
                <p className="text-sm text-gray-300 flex-1">{rec.action}</p>
                <div className="text-emerald-400 font-medium text-sm">{rec.impact}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Net Worth Composition */}
      {totalNetWorth > 0 && (
        <div className="bg-bg-surface border border-border rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-white">Net Worth Composition</h2>

          <div className="space-y-5">
            {netWorthItems.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{item.label}</span>
                  <span className="text-white font-medium">{formatCurrency(item.value, true)} ({item.pct.toFixed(1)}%)</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}

            <div className="pt-4 border-t border-border flex justify-between">
              <span className="text-sm font-medium text-white">Total Net Worth</span>
              <span className="text-sm font-bold text-white">{formatCurrency(totalNetWorth, true)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
