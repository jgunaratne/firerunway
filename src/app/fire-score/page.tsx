'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { calculateFIScore, formatCurrency } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { useBrokerageData } from '@/lib/BrokerageDataContext';
import { useStockPrice } from '@/hooks/useStockPrice';

// ─── Milestone labels for the progress bar ─────────────────────────

const milestones = [
  { value: 0, label: 'Starting out' },
  { value: 25, label: 'Building base' },
  { value: 50, label: 'Halfway' },
  { value: 75, label: 'Approaching FI' },
  { value: 100, label: 'Financially independent' },
];

// ─── Projection calculator ─────────────────────────────────────────

function computeProjections(
  currentPortfolio: number,
  annualSavings: number,
  fireNumber: number,
) {
  const scenarios = [
    { label: 'Bear Case', emoji: '🐻', percentile: '10th percentile', realReturn: 0.03 },
    { label: 'Base Case', emoji: '📊', percentile: '50th percentile', realReturn: 0.06 },
    { label: 'Bull Case', emoji: '🐂', percentile: '90th percentile', realReturn: 0.10 },
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

// ─── Dynamic recommendations based on actual data ───────────────────

function generateRecommendations(
  fiData: ReturnType<typeof calculateFIScore>,
  savingsRate: number,
  concentrationPct: number,
  fundingRatio: number,
  annualIncome: number,
  fireNumber: number,
) {
  const recs: { action: string; impact: string; icon: string; priority: number }[] = [];

  // High concentration risk
  if (concentrationPct > 0.25) {
    const potentialGain = Math.round(concentrationPct * 10);
    recs.push({
      action: `Your employer stock is ${Math.round(concentrationPct * 100)}% of net worth — diversifying to <20% would reduce concentration risk significantly`,
      impact: `+${Math.min(potentialGain, 6)}`,
      icon: '📊',
      priority: 1,
    });
  }

  // Low savings rate
  if (savingsRate < 0.3 && annualIncome > 0) {
    const targetIncrease = Math.round((0.35 - savingsRate) * annualIncome);
    recs.push({
      action: `Increasing savings rate from ${Math.round(savingsRate * 100)}% to 35% would add ${formatCurrency(targetIncrease)}/yr to investments`,
      impact: '+3',
      icon: '💰',
      priority: 2,
    });
  } else if (savingsRate < 0.5 && annualIncome > 0) {
    recs.push({
      action: `Your ${Math.round(savingsRate * 100)}% savings rate is good — pushing to 50% would accelerate your timeline by ~2 years`,
      impact: '+2',
      icon: '💰',
      priority: 3,
    });
  }

  // Low funding ratio
  if (fundingRatio < 0.5 && fireNumber > 0) {
    recs.push({
      action: `You're ${Math.round(fundingRatio * 100)}% to your FIRE number — maximizing tax-advantaged accounts (401k/IRA) would accelerate progress`,
      impact: '+2',
      icon: '🏦',
      priority: 2,
    });
  }

  // No FIRE number set
  if (fireNumber <= 0) {
    recs.push({
      action: 'Set your FIRE number in your profile to get accurate projections and tracking',
      impact: '—',
      icon: '🎯',
      priority: 0,
    });
  }

  // Already close to FI
  if (fundingRatio >= 0.9 && fireNumber > 0) {
    recs.push({
      action: `You're ${Math.round(fundingRatio * 100)}% funded! Consider building a 2-year cash buffer before transitioning`,
      impact: '+1',
      icon: '🎉',
      priority: 4,
    });
  }

  // Sort by priority
  return recs.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

// ─── Score gauge color ──────────────────────────────────────────────

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
  const { profile, rsuGrants, realEstate, isLoading } = useUserData();
  const { totalInvestment, loading: holdingsLoading } = useBrokerageData();

  const annualSpend = profile?.annual_spend || 0;
  const annualIncome = profile?.annual_income || 0;
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
    () => generateRecommendations(fiData, savingsRate, concentrationPct, fundingRatio, annualIncome, fireNumber),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savingsRate, concentrationPct, fundingRatio, annualIncome, fireNumber]
  );

  if (isLoading || holdingsLoading) return <div className="text-center py-20 text-text-secondary">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl text-text-primary">FIRE Score</h1>
        <p className="text-sm text-text-secondary mt-1">A single, honest answer to &quot;am I financially independent?&quot;</p>
      </div>

      {/* Score Hero */}
      <Card className="py-10">
        <div className="text-center">
          <p className={`number-display text-7xl lg:text-8xl font-bold ${getScoreColor(score)}`}>
            <AnimatedNumber value={score} />
          </p>
          <p className="text-text-secondary mt-2 text-sm">out of 100 — <span className="text-text-primary font-medium">{getScoreLabel(score)}</span></p>
        </div>

        {/* Progress bar with milestones */}
        <div className="mt-8 px-4 lg:px-16">
          <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, #ef4444 0%, #f59e0b 40%, #10b981 70%, #6366f1 100%)`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(score, 100)}%` }}
              transition={{ duration: 1.5, ease: 'easeOut', delay: 0.5 }}
            />
          </div>
          <div className="flex justify-between mt-3">
            {milestones.map((m) => (
              <div key={m.value} className="text-center" style={{ width: '20%' }}>
                <p className={`text-[10px] ${score >= m.value ? 'text-text-primary' : 'text-text-secondary/50'}`}>
                  {m.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Investable Assets</p>
          <p className="number-display text-xl font-bold text-text-primary">{formatCurrency(investable, true)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">FIRE Number</p>
          <p className="number-display text-xl font-bold text-accent">{fireNumber > 0 ? formatCurrency(fireNumber, true) : '—'}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Savings Rate</p>
          <p className={`number-display text-xl font-bold ${savingsRate >= 0.3 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {annualIncome > 0 ? `${Math.round(savingsRate * 100)}%` : '—'}
          </p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Progress</p>
          <p className={`number-display text-xl font-bold ${fundingRatio >= 0.75 ? 'text-emerald-400' : 'text-text-primary'}`}>
            {fireNumber > 0 ? `${Math.round(fundingRatio * 100)}%` : '—'}
          </p>
        </Card>
      </div>

      {/* Score Breakdown */}
      <Card>
        <h3 className="font-display text-lg text-text-primary mb-4">Score Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-text-secondary border-b border-border">
                <th className="text-left pb-2 font-medium">Factor</th>
                <th className="text-left pb-2 font-medium">Your Value</th>
                <th className="text-right pb-2 font-medium">Weight</th>
                <th className="text-right pb-2 font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {fiData.breakdown.map((row, i) => (
                <motion.tr
                  key={row.factor}
                  className="border-b border-border/50"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                >
                  <td className="py-2.5 text-text-primary font-medium">{row.factor}</td>
                  <td className="py-2.5 number-display text-text-secondary">{row.value}</td>
                  <td className="py-2.5 text-right number-display text-text-secondary">{row.weight}%</td>
                  <td className="py-2.5 text-right number-display font-bold text-text-primary">{row.points}</td>
                </motion.tr>
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
          <h3 className="font-display text-lg text-text-primary mb-3">Timeline Projections</h3>
          <p className="text-xs text-text-secondary mb-4">
            Based on your current portfolio of {formatCurrency(investable, true)} and annual savings of {formatCurrency(annualSavings, true)}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {projections.map((proj, i) => (
              <Card key={proj.label} hover className="text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                >
                  <span className="text-3xl">{proj.emoji}</span>
                  <p className="text-sm font-semibold text-text-primary mt-2">{proj.label}</p>
                  <p className="text-xs text-text-secondary">{proj.percentile}</p>
                  <p className="number-display text-3xl font-bold text-text-primary mt-3">{proj.year}</p>
                  <p className="text-xs text-text-secondary mt-1">
                    {proj.yearsAway > 0 ? `${proj.yearsAway} years away` : 'Now'}
                  </p>
                  <p className="number-display text-sm text-text-secondary mt-1">
                    Portfolio: {formatCurrency(proj.portfolioAtFI, true)}
                  </p>
                  <p className="text-[10px] text-text-secondary/60 mt-3 leading-relaxed">{proj.assumptions}</p>
                </motion.div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Missing data prompt */}
      {(fireNumber <= 0 || annualSavings <= 0) && (
        <Card className="border-amber-500/20">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-sm font-medium text-text-primary">Complete your profile for projections</p>
              <p className="text-xs text-text-secondary mt-1">
                {fireNumber <= 0 && 'Set your FIRE number (target portfolio size). '}
                {annualIncome <= 0 && 'Add your annual income. '}
                {annualSpend <= 0 && 'Add your annual spending. '}
                These are needed to calculate your timeline to financial independence.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* What Moves Your Score */}
      {recommendations.length > 0 && (
        <Card>
          <h3 className="font-display text-lg text-text-primary mb-4">What Moves Your Score</h3>
          <p className="text-xs text-text-secondary mb-4">Personalized actions based on your current financial data</p>
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <motion.div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-border/50 hover:border-accent/20 transition-colors"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.1 }}
              >
                <span className="text-xl">{rec.icon}</span>
                <div className="flex-1">
                  <p className="text-sm text-text-primary">{rec.action}</p>
                </div>
                <span className="number-display text-sm font-bold text-emerald-400">{rec.impact}</span>
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      {/* Net Worth Composition */}
      <Card>
        <h3 className="font-display text-lg text-text-primary mb-4">Net Worth Composition</h3>
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
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${item.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                    />
                  </div>
                </div>
              );
            })}
          {totalNetWorth > 0 && (
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-text-primary font-medium">Total Net Worth</span>
                <span className="number-display text-text-primary font-bold">{formatCurrency(totalNetWorth, true)}</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
      </div>
    </div>
  );
}
