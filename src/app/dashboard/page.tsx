'use client';

import { formatCurrency, calculateFIScore } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { useBrokerageData } from '@/lib/BrokerageDataContext';
import { useNetWorth } from '@/hooks/useNetWorth';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import Link from 'next/link';
import {
  CheckCircle2, AlertTriangle, AlertCircle,
  Wallet, BarChart3, Flame, LineChart, ArrowRight,
} from 'lucide-react';

// ─── Arc Gauge ───────────────────────────────────────────────────────
function ArcGauge({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(value / max, 1);
  // SVG arc: semicircle from (10,50) to (90,50), radius 40
  const totalLen = 125.6; // π * 40
  const offset = totalLen * (1 - pct);
  const color = pct >= 0.75 ? 'var(--color-accent-green)' : pct >= 0.5 ? 'var(--color-accent-amber)' : 'var(--color-accent-red)';

  return (
    <div className="relative w-48 h-24 mb-4 flex items-end justify-center">
      <svg viewBox="0 0 100 50" className="absolute inset-0 w-full h-full overflow-visible">
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--color-bg-elevated)" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={totalLen}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="z-10 flex flex-col items-center translate-y-2">
        <div className="text-4xl font-bold"><AnimatedNumber value={value} /></div>
        <div className="text-[10px] text-text-secondary font-mono mt-0.5">/ {max}</div>
      </div>
    </div>
  );
}

// ─── Layoff Readiness Row ────────────────────────────────────────────
function LayoffRow({ status, label, detail }: { status: 'green' | 'amber' | 'red'; label: string; detail: string }) {
  const Icon = status === 'green' ? CheckCircle2 : status === 'amber' ? AlertTriangle : AlertCircle;
  const color = status === 'green' ? 'text-accent-green' : status === 'amber' ? 'text-accent-amber' : 'text-accent-red';
  return (
    <div className="flex gap-4">
      <Icon className={`w-5 h-5 ${color} shrink-0 mt-0.5`} />
      <div>
        <div className={`font-medium ${color} mb-1`}>{label}</div>
        <div className="text-sm text-text-secondary">{detail}</div>
      </div>
    </div>
  );
}

// ─── Insight Card ────────────────────────────────────────────────────
function InsightCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-xl border border-border bg-bg-surface flex flex-col h-full">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-text-secondary leading-relaxed flex-1 mb-4">{description}</p>
      <button className="text-sm text-accent hover:text-accent/80 transition-colors flex items-center gap-1 mt-auto w-fit">
        Tell me more <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Quick Link Card ─────────────────────────────────────────────────
function LinkCard({ icon, title, href }: { icon: React.ReactNode; title: string; href: string }) {
  return (
    <Link href={href} className="p-6 rounded-xl border border-border bg-bg-surface hover:bg-bg-elevated transition-colors flex flex-col gap-4 group">
      {icon}
      <div className="flex items-center gap-2 font-medium">
        {title}
        <ArrowRight className="w-4 h-4 text-text-secondary group-hover:text-text-primary transition-colors" />
      </div>
    </Link>
  );
}

// ─── Dashboard Page ──────────────────────────────────────────────────
export default function DashboardPage() {
  const { profile, rsuGrants, realEstate, isLoading } = useUserData();
  const { totalInvestment, loading: holdingsLoading } = useBrokerageData();
  const { totalNetWorth, investable, rsuValue, stockPrice } = useNetWorth();

  const annualSpend = profile?.annual_spend || 0;
  const annualIncome = profile?.annual_income || 0;
  const fireNumber = profile?.fire_number || 0;

  const fiScore = calculateFIScore({
    currentInvestableAssets: investable,
    fireNumber,
    liquidAssets: investable,
    annualSpend,
    employerStockValue: rsuValue,
    totalNetWorth,
    isEmployed: true,
    annualIncome,
  });

  const runway = annualSpend > 0 ? investable / annualSpend : 0;
  const fireGap = Math.max(fireNumber - investable, 0);
  const targetYear = profile?.fire_target_year;

  // Layoff readiness metrics
  const totalMonthlyMortgage = realEstate.reduce((sum, p) => sum + (p.monthly_payment ?? 0), 0);
  const monthlySpend = annualSpend > 0 ? annualSpend / 12 : 0;
  const mortgageCoverageYears = totalMonthlyMortgage > 0 ? investable / (totalMonthlyMortgage * 12) : 0;
  const emergencyMonths = monthlySpend > 0 ? investable / monthlySpend : 0;
  const unvestedShares = rsuGrants.reduce((sum, g) => sum + Math.max(g.total_shares - g.vested_shares, 0), 0);
  const unvestedValue = unvestedShares * stockPrice;
  const savingsRate = annualIncome > 0 ? (annualIncome - annualSpend) / annualIncome : 0;

  // Dynamic insights
  const insights = [
    {
      icon: <Wallet className="w-5 h-5 text-accent" />,
      title: 'Savings Rate',
      description: annualIncome > 0
        ? `You're saving ${Math.round(savingsRate * 100)}% of your income — ${savingsRate > 0.4 ? 'excellent' : savingsRate > 0.25 ? 'good' : 'keep building'} for FIRE.`
        : 'Set your income and spending in the onboarding profile to see your savings rate.',
    },
    {
      icon: <BarChart3 className="w-5 h-5 text-accent" />,
      title: 'Portfolio Status',
      description: totalInvestment > 0
        ? `Your connected portfolio is worth ${formatCurrency(totalInvestment)}. ${investable > fireNumber * 0.8 ? 'Getting close to your FIRE number!' : `${formatCurrency(fireGap)} remaining to reach FI.`}`
        : 'Connect a brokerage account to see your real portfolio data.',
    },
    {
      icon: <Flame className="w-5 h-5 text-accent" />,
      title: 'FIRE Trajectory',
      description: fireGap <= 0
        ? 'Congratulations! You\'ve reached your FIRE number!'
        : `At your current savings rate, you have a ${formatCurrency(fireGap)} gap to reach FI.`,
    },
  ];

  // Loading state
  const hasAnyData = profile || totalInvestment > 0 || rsuGrants.length > 0 || realEstate.length > 0;
  if ((isLoading || holdingsLoading) && !hasAnyData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary text-sm">Loading your financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-text-secondary">Your financial independence at a glance</p>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* FI Score */}
        <div className="p-6 rounded-xl border border-border bg-bg-surface flex flex-col items-center justify-center text-center">
          <ArcGauge value={fiScore.total} />
          <div className="text-sm font-medium mt-2">{fiScore.total >= 75 ? 'Approaching independence' : fiScore.total >= 50 ? 'Halfway there' : 'Building your base'}</div>
          <div className="text-xs text-text-secondary mt-1">FI Score</div>
        </div>

        {/* Runway */}
        <div className="p-6 rounded-xl border border-border bg-bg-surface flex flex-col items-center justify-center text-center">
          <div className="text-5xl font-bold mb-2">
            <AnimatedNumber value={Math.round(runway * 10)} format={(n) => (n / 10).toFixed(1)} />
          </div>
          <div className="text-text-secondary mb-4">years</div>
          <div className="text-sm font-medium">Runway</div>
          <div className="text-xs text-text-secondary mt-1">If income stopped today</div>
        </div>

        {/* FIRE Gap */}
        <div className="p-6 rounded-xl border border-border bg-bg-surface flex flex-col items-center justify-center text-center">
          <div className="text-5xl font-bold text-accent-amber mb-2">
            <AnimatedNumber value={fireGap > 0 ? fireGap : 0} format={(n) => formatCurrency(n, true)} />
          </div>
          <div className="text-text-secondary mb-4">away</div>
          <div className="text-sm font-medium">FIRE Gap</div>
          <div className="text-xs text-text-secondary mt-1">{targetYear ? `Target: ${targetYear}` : 'Set target in profile'}</div>
        </div>
      </div>

      {/* If Laid Off Tomorrow */}
      <div className="rounded-xl border border-border bg-bg-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className="w-1 h-5 bg-accent-red rounded-full" />
          <h2 className="text-lg font-semibold">If Laid Off Tomorrow</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <LayoffRow
            status={mortgageCoverageYears >= 5 ? 'green' : mortgageCoverageYears >= 2 ? 'amber' : 'red'}
            label={totalMonthlyMortgage > 0 ? `Mortgage covered: ${mortgageCoverageYears >= 1 ? `${mortgageCoverageYears.toFixed(1)}+ years` : `${Math.round(mortgageCoverageYears * 12)} months`}` : 'No mortgage debt'}
            detail={totalMonthlyMortgage > 0 ? `${formatCurrency(totalMonthlyMortgage)}/mo across ${realEstate.filter(p => (p.monthly_payment ?? 0) > 0).length} mortgage(s)` : 'No properties with mortgages'}
          />
          <LayoffRow
            status={emergencyMonths >= 12 ? 'green' : emergencyMonths >= 6 ? 'amber' : 'red'}
            label={monthlySpend > 0 ? `Emergency fund: ${emergencyMonths >= 12 ? `${Math.round(emergencyMonths)} months` : `${emergencyMonths.toFixed(1)} months`}` : 'Set spending to calculate'}
            detail={investable > 0 ? `${formatCurrency(investable)} in investable assets` : 'No investable assets tracked'}
          />
          <LayoffRow
            status={unvestedValue <= 0 ? 'green' : unvestedValue < 100000 ? 'amber' : 'red'}
            label={unvestedShares > 0 ? `Unvested RSUs at risk: ${formatCurrency(unvestedValue)}` : 'No unvested RSUs'}
            detail={unvestedShares > 0 ? `${unvestedShares.toLocaleString()} unvested shares across ${rsuGrants.filter(g => g.total_shares - g.vested_shares > 0).length} grant(s)` : 'All grants fully vested or no RSU data'}
          />
          <LayoffRow
            status="amber"
            label="Healthcare gap: COBRA ~$1,800/mo"
            detail="Until marketplace enrollment or new employer coverage"
          />
        </div>
      </div>

      {/* AI Insights */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-5 bg-accent rounded-full" />
          <h2 className="text-lg font-semibold">AI Insights</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {insights.map((insight, i) => (
            <InsightCard key={i} {...insight} />
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <LinkCard icon={<LineChart className="w-5 h-5 text-accent" />} title="View Portfolio" href="/portfolio" />
        <LinkCard icon={<BarChart3 className="w-5 h-5 text-accent" />} title="Run Monte Carlo" href="/monte-carlo" />
        <LinkCard icon={<Flame className="w-5 h-5 text-accent" />} title="View FIRE Score" href="/fire-score" />
      </div>

      {/* Disclaimer */}
      <div className="text-center text-xs text-text-secondary pt-8 pb-4">
        FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
      </div>
    </div>
  );
}
