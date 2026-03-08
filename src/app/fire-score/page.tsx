'use client';

import { useState, useMemo, useCallback, ReactNode } from 'react';
import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { calculateFIScore, formatCurrency } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { useBrokerageData } from '@/lib/BrokerageDataContext';
import { useStockPrice } from '@/hooks/useStockPrice';
import {
  TrendingDown, BarChart3, TrendingUp, PieChart, Coins,
  Landmark, Target, Banknote, PartyPopper,
} from 'lucide-react';

// ─── Milestone labels for the progress bar ─────────────────────────

const milestones = [
  { value: 0, label: 'Starting out' },
  { value: 25, label: 'Building base' },
  { value: 50, label: 'Halfway' },
  { value: 75, label: 'Approaching FI' },
  { value: 100, label: 'Financially independent' },
];

// ─── Editable currency field ────────────────────────────────────────

function EditableAmount({
  label,
  value,
  onSave,
  placeholder = 'Click to set',
}: {
  label: string;
  value: number;
  onSave: (val: number) => void;
  placeholder?: string;
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
    <div className="text-center">
      <p className="text-sm text-text-secondary mb-1">{label}</p>
      {editing ? (
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          placeholder="e.g. 3000000"
          className="w-full text-center bg-bg-elevated border border-accent/50 rounded px-2 py-1 text-xl font-bold number-display text-text-primary focus:outline-none focus:border-accent"
        />
      ) : (
        <button
          onClick={startEdit}
          className="w-full group"
        >
          <p className={`number-display text-xl font-bold ${value > 0 ? 'text-text-primary' : 'text-text-secondary/50'}`}>
            {value > 0 ? formatCurrency(value, true) : placeholder}
          </p>
          <p className="text-sm text-text-secondary/40 opacity-0 group-hover:opacity-100 transition-opacity">
            click to edit
          </p>
        </button>
      )}
    </div>
  );
}

// ─── Projection calculator ─────────────────────────────────────────

function computeProjections(
  currentPortfolio: number,
  annualSavings: number,
  fireNumber: number,
) {
  const scenarios: Array<{ label: string; icon: ReactNode; percentile: string; realReturn: number }> = [
    { label: 'Bear Case', icon: <TrendingDown size={24} className="text-red-400" />, percentile: '10th percentile', realReturn: 0.03 },
    { label: 'Base Case', icon: <BarChart3 size={24} className="text-accent" />, percentile: '50th percentile', realReturn: 0.06 },
    { label: 'Bull Case', icon: <TrendingUp size={24} className="text-emerald-400" />, percentile: '90th percentile', realReturn: 0.10 },
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
      icon: <PieChart size={16} className="text-accent" />,
      priority: 1,
    });
  }

  if (savingsRate < 0.3 && annualIncome > 0) {
    const targetIncrease = Math.round((0.35 - savingsRate) * annualIncome);
    recs.push({
      action: `Increasing savings rate from ${Math.round(savingsRate * 100)}% to 35% would add ${formatCurrency(targetIncrease)}/yr to investments`,
      impact: '+3',
      icon: <Coins size={16} className="text-accent-amber" />,
      priority: 2,
    });
  } else if (savingsRate < 0.5 && annualIncome > 0) {
    recs.push({
      action: `Your ${Math.round(savingsRate * 100)}% savings rate is good — pushing to 50% would accelerate your timeline by ~2 years`,
      impact: '+2',
      icon: <Coins size={16} className="text-accent-amber" />,
      priority: 3,
    });
  }

  if (fundingRatio < 0.5 && fireNumber > 0) {
    recs.push({
      action: `You're ${Math.round(fundingRatio * 100)}% to your FIRE number — maximizing tax-advantaged accounts (401k/IRA) would accelerate progress`,
      impact: '+2',
      icon: <Landmark size={16} className="text-accent" />,
      priority: 2,
    });
  }

  if (fireNumber <= 0) {
    recs.push({
      action: 'Set your FIRE number above to get accurate projections and tracking',
      impact: '—',
      icon: <Target size={16} className="text-accent" />,
      priority: 0,
    });
  }

  if (annualIncome <= 0) {
    recs.push({
      action: 'Set your annual income to calculate savings rate and contribution projections',
      impact: '—',
      icon: <Banknote size={16} className="text-accent" />,
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
  if (score >= 60) return 'text-accent';
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
    const latestYear = incomeTaxRecords[0].tax_year; // already sorted desc by API
    return incomeTaxRecords
      .filter(r => r.tax_year === latestYear)
      .reduce((sum, r) => sum + (r.total_income || 0), 0);
  }, [incomeTaxRecords]);

  const annualSpend = profile?.annual_spend || 0;
  // Use profile income if set, otherwise fall back to income from tax records
  const profileIncome = profile?.annual_income || 0;
  const annualIncome = profileIncome > 0 ? profileIncome : incomeFromTax;
  const isIncomeFromTax = profileIncome === 0 && incomeFromTax > 0;
  const fireNumber = profile?.fire_number || 0;
  const ticker = rsuGrants[0]?.company_ticker || 'AMZN';
  const stockPrice = useStockPrice(ticker);
  const rsuValue = rsuGrants.reduce((sum, g) => sum + g.vested_shares * stockPrice, 0);
  const realEstateEquity = realEstate.reduce((sum, p) => sum + ((p.current_value ?? 0) - (p.mortgage_balance ?? 0)), 0);
  const investable = totalInvestment > 0 ? totalInvestment : rsuValue;
  const totalNetWorth = investable + realEstateEquity;
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

  // Dynamic projections
  const projections = useMemo(
    () => computeProjections(investable, annualSavings, fireNumber),
    [investable, annualSavings, fireNumber]
  );

  // Dynamic recommendations
  const recommendations = useMemo(
    () => generateRecommendations(savingsRate, concentrationPct, fundingRatio, annualIncome, fireNumber),
    [savingsRate, concentrationPct, fundingRatio, annualIncome, fireNumber]
  );

  // Save profile field to API
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
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-text-secondary text-sm">Calculating your FIRE score...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div
        >
          <h1 className="page-title">FIRE Score</h1>
          <p className="page-subtitle">A single, honest answer to &quot;am I financially independent?&quot;</p>
        </div>
        {saving && <span className="text-sm text-accent animate-pulse">Saving...</span>}
      </div>

      {/* Score Hero */}
      <Card className="py-12 relative overflow-hidden">
        {/* Radial glow behind score */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-accent/[0.06] rounded-full blur-3xl pointer-events-none" />
        <div className="text-center relative z-10">
          <p className={`number-display text-7xl lg:text-8xl font-bold ${getScoreColor(score)} glow-text`}>
            <AnimatedNumber value={score} />
          </p>
          <p className="text-text-secondary mt-3 text-sm">out of 100 — <span className="text-text-primary font-medium">{getScoreLabel(score)}</span></p>
        </div>

        {/* Progress bar with milestones */}
        <div className="mt-8 px-4 lg:px-16 relative z-10">
          <div className="relative h-3 bg-[var(--overlay-bg-secondary)] rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
              style={{
                background: `linear-gradient(90deg, #ef4444 0%, #f59e0b 40%, #10b981 70%, #6366f1 100%)`,
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)',
                width: `${Math.min(score, 100)}%`,
              }}
            />
          </div>
          <div className="flex justify-between mt-3">
            {milestones.map((m) => (
              <div key={m.value} className="text-center" style={{ width: '20%' }}>
                <p className={`text-sm ${score >= m.value ? 'text-text-primary' : 'text-text-secondary/50'}`}>
                  {m.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Editable Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <Card className="text-center">
          <p className="stat-label mb-2">Investable Assets</p>
          <p className="number-display text-xl font-bold text-text-primary glow-text">{formatCurrency(investable, true)}</p>
          <p className="text-sm text-text-secondary/40 mt-1">from linked accounts</p>
        </Card>
        <Card>
          <EditableAmount
            label="FIRE Number"
            value={fireNumber}
            onSave={(val) => updateProfileField('fire_number', val)}
            placeholder="Click to set"
          />
        </Card>
        <Card>
          <EditableAmount
            label="Annual Income"
            value={annualIncome}
            onSave={(val) => updateProfileField('annual_income', val)}
            placeholder="Click to set"
          />
          {isIncomeFromTax && (
            <p className="text-sm text-accent/60 text-center mt-0.5">from W-2 ({incomeTaxRecords[0]?.tax_year})</p>
          )}
        </Card>
        <Card>
          <EditableAmount
            label="Annual Spend"
            value={annualSpend}
            onSave={(val) => updateProfileField('annual_spend', val)}
            placeholder="Click to set"
          />
        </Card>
      </div>

      {/* Derived Metrics */}
      {(fireNumber > 0 || annualIncome > 0) && (
        <div className="grid grid-cols-3 gap-5">
          <Card className="text-center">
            <p className="stat-label mb-2">Progress</p>
            <p className={`number-display text-2xl font-bold ${fundingRatio >= 0.75 ? 'text-emerald-400 glow-text-green' : fundingRatio >= 0.5 ? 'text-accent glow-text' : 'text-text-primary'}`}>
              {fireNumber > 0 ? `${Math.round(fundingRatio * 100)}%` : '—'}
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-sm text-text-secondary mb-1">Savings Rate</p>
            <p className={`number-display text-2xl font-bold ${savingsRate >= 0.3 ? 'text-emerald-400' : savingsRate > 0 ? 'text-amber-400' : 'text-text-primary'}`}>
              {annualIncome > 0 && annualSpend > 0 ? `${Math.round(savingsRate * 100)}%` : '—'}
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-sm text-text-secondary mb-1">Runway</p>
            <p className="number-display text-2xl font-bold text-text-primary">
              {annualSpend > 0 ? `${(investable / annualSpend).toFixed(1)} yrs` : '—'}
            </p>
          </Card>
        </div>
      )}

      {/* Score Breakdown */}
      <Card>
        <h3 className="section-title">Score Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-sm text-text-secondary border-b border-border">
                <th className="text-left pb-2 font-medium">Factor</th>
                <th className="text-left pb-2 font-medium">Your Value</th>
                <th className="text-right pb-2 font-medium">Weight</th>
                <th className="text-right pb-2 font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {fiData.breakdown.map((row) => (
                <tr
                  key={row.factor}
                  className="border-b border-border/50"
                >
                  <td className="py-2.5 text-text-primary font-medium">{row.factor}</td>
                  <td className="py-2.5 number-display text-text-secondary">{row.value}</td>
                  <td className="py-2.5 text-right number-display text-text-secondary">{row.weight}%</td>
                  <td className="py-2.5 text-right number-display font-bold text-text-primary">{row.points}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border">
                <td className="py-2.5 font-bold text-text-primary">Total</td>
                <td></td>
                <td></td>
                <td className="py-2.5 text-right number-display text-xl font-bold text-accent">{score}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Timeline Projections */}
      {fireNumber > 0 && annualSavings > 0 && (
        <div>
          <h3 className="section-title">Timeline Projections</h3>
          <p className="text-sm text-text-secondary mb-4">
            Based on your portfolio of {formatCurrency(investable, true)} and annual savings of {formatCurrency(annualSavings, true)}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {projections.map((proj) => (
              <Card key={proj.label} hover className="text-center">
                <div
                >
                  {proj.icon}
                  <p className="text-sm font-semibold text-text-primary mt-2">{proj.label}</p>
                  <p className="text-sm text-text-secondary">{proj.percentile}</p>
                  <p className="number-display text-3xl font-bold text-text-primary mt-3">{proj.year}</p>
                  <p className="text-sm text-text-secondary mt-1">
                    {proj.yearsAway > 0 ? `${proj.yearsAway} years away` : 'Now'}
                  </p>
                  <p className="number-display text-sm text-text-secondary mt-1">
                    Portfolio: {formatCurrency(proj.portfolioAtFI, true)}
                  </p>
                  <p className="text-sm text-text-secondary/60 mt-3 leading-relaxed">{proj.assumptions}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* What Moves Your Score */}
      {recommendations.length > 0 && (
        <Card>
          <h3 className="section-title">What Moves Your Score</h3>
          <p className="text-sm text-text-secondary mb-4">Personalized actions based on your current financial data</p>
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-[var(--overlay-subtle)] border border-border/50 hover:border-accent/20 transition-colors"
              >
                <span className="flex-shrink-0">{rec.icon}</span>
                <div className="flex-1">
                  <p className="text-sm text-text-primary">{rec.action}</p>
                </div>
                <span className="number-display text-sm font-bold text-emerald-400">{rec.impact}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Net Worth Composition */}
      {totalNetWorth > 0 && (
        <Card>
          <h3 className="section-title">Net Worth Composition</h3>
          <div className="space-y-3">
            {[
              { label: 'Investment Portfolio', value: totalInvestment, color: 'bg-accent' },
              { label: 'RSU / Employer Stock', value: rsuValue, color: 'bg-amber-400' },
              { label: 'Real Estate Equity', value: realEstateEquity, color: 'bg-emerald-400' },
            ]
              .filter((item) => item.value > 0)
              .map((item) => {
                const pct = totalNetWorth > 0 ? (item.value / totalNetWorth) * 100 : 0;
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text-secondary">{item.label}</span>
                      <span className="number-display text-text-primary font-medium">
                        {formatCurrency(item.value, true)} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--overlay-hover)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${item.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-text-primary font-medium">Total Net Worth</span>
                <span className="number-display text-text-primary font-bold">{formatCurrency(totalNetWorth, true)}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
      </div>
    </div>
  );
}
