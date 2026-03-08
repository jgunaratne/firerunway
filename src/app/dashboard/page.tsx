'use client';

import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency, calculateFIScore } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { useBrokerageData } from '@/lib/BrokerageDataContext';
import { useNetWorth } from '@/hooks/useNetWorth';
import Link from 'next/link';
import {
  CheckCircle2, AlertTriangle, AlertCircle,
  Wallet, BarChart3, Flame, TrendingUp,
} from 'lucide-react';

// Arc Gauge Component
function ArcGauge({ value, max = 100, size = 180, label }: { value: number; max?: number; size?: number; label: string }) {
  const pct = value / max;
  const radius = (size - 24) / 2;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - pct);
  const color = pct >= 0.75 ? '#10b981' : pct >= 0.5 ? '#f59e0b' : '#ef4444';
  const glowColor = pct >= 0.75 ? 'rgba(16,185,129,0.4)' : pct >= 0.5 ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)';

  return (
    <div className="flex flex-col items-center relative">
      {/* Ambient glow behind gauge */}
      <div
        className="absolute top-0 w-32 h-20 rounded-full blur-3xl opacity-30 pulse-glow"
        style={{ background: glowColor }}
      />
      <svg width={size} height={size / 2 + 24} viewBox={`0 0 ${size} ${size / 2 + 24}`}>
        {/* Background arc */}
        <path
          d={`M 12,${size / 2 + 12} A ${radius},${radius} 0 0,1 ${size - 12},${size / 2 + 12}`}
          fill="none"
          stroke="var(--overlay-separator)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M 12,${size / 2 + 12} A ${radius},${radius} 0 0,1 ${size - 12},${size / 2 + 12}`}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}
        />
        {/* Center text */}
        <text
          x={size / 2}
          y={size / 2 - 8}
          textAnchor="middle"
          className="number-display"
          fill="currentColor"
          fontSize="36"
          fontWeight="bold"
        >
          {value}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 14}
          textAnchor="middle"
          fill="var(--text-secondary)"
          fontSize="12"
          fontWeight="500"
        >
          / {max}
        </text>
      </svg>
      <p className="text-sm text-text-secondary mt-1 tracking-wide">{label}</p>
    </div>
  );
}

// Layoff Readiness Item
function LayoffItem({ status, label, detail }: { status: 'green' | 'amber' | 'red'; label: string; detail: string }) {
  const StatusIcon = status === 'green' ? CheckCircle2 : status === 'amber' ? AlertTriangle : AlertCircle;
  const textColor = status === 'green' ? 'text-emerald-400' : status === 'amber' ? 'text-amber-400' : 'text-red-400';
  const glowClass = status === 'green' ? 'glow-text-green' : status === 'amber' ? 'glow-text-amber' : 'glow-text-red';
  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-xl transition-colors themed-hover">
      <StatusIcon size={18} className={`mt-0.5 flex-shrink-0 ${textColor}`} />
      <div>
        <p className={`text-sm font-medium ${textColor} ${glowClass}`}>{label}</p>
        <p className="text-sm text-text-secondary mt-0.5 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}

// Insight Card
function InsightCard({ insight }: { insight: { icon: React.ReactNode; title: string; body: string; type: string } }) {
  const borderGlow = insight.type === 'success'
    ? 'hover:border-emerald-500/30 hover:shadow-glow-green'
    : insight.type === 'warning'
      ? 'hover:border-amber-500/30 hover:shadow-glow-amber'
      : 'hover:border-accent/30 hover:shadow-glow-sm';
  return (
    <Card className={borderGlow} hover>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 text-accent">{insight.icon}</div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-text-primary mb-1">{insight.title}</h4>
          <p className="text-sm text-text-secondary leading-relaxed">{insight.body}</p>
          <button className="text-sm text-accent hover:text-accent/80 mt-3 transition-colors font-medium">Tell me more →</button>
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { profile, rsuGrants, realEstate, isLoading } = useUserData();
  const { totalInvestment, loading: holdingsLoading } = useBrokerageData();

  const annualSpend = profile?.annual_spend || 0;
  const annualIncome = profile?.annual_income || 0;
  const fireNumber = profile?.fire_number || 0;

  // Derive totals from real data
  const { totalNetWorth, investable, rsuValue, stockPrice } = useNetWorth();

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

  // Compute dynamic insights from real data
  const insights = [
    {
      id: '1',
      icon: <Wallet size={22} />,
      title: 'Savings Rate',
      body: annualIncome > 0
        ? `You're saving ${Math.round(savingsRate * 100)}% of your income — ${savingsRate > 0.4 ? 'excellent' : savingsRate > 0.25 ? 'good' : 'keep building'} for FIRE.`
        : 'Set your income and spending in the onboarding profile to see your savings rate.',
      type: savingsRate > 0.4 ? 'success' : savingsRate > 0.25 ? 'info' : 'warning' as const,
    },
    {
      id: '2',
      icon: <BarChart3 size={22} />,
      title: 'Portfolio Status',
      body: totalInvestment > 0
        ? `Your connected portfolio is worth ${formatCurrency(totalInvestment)}. ${investable > fireNumber * 0.8 ? 'Getting close to your FIRE number!' : `${formatCurrency(fireGap)} remaining to reach FI.`}`
        : 'Connect a brokerage account to see your real portfolio data.',
      type: totalInvestment > 0 ? 'info' : 'warning' as const,
    },
    {
      id: '3',
      icon: <Flame size={22} />,
      title: 'FIRE Trajectory',
      body: fireGap <= 0
        ? 'Congratulations! You\'ve reached your FIRE number!'
        : `At your current savings rate, you have a ${formatCurrency(fireGap)} gap to reach FI.`,
      type: fireGap <= 0 ? 'success' : 'info' as const,
    },
  ];

  // Only show full-page loading if we have NO data at all (first visit, no cache)
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
      {/* Page header */}
      <div
      >
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Your financial independence at a glance</p>
      </div>

      {/* Hero Row — 3 stat cards in bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* FI Score */}
        <Card className="flex flex-col items-center justify-center py-8">
          <ArcGauge value={fiScore.total} label={fiScore.total >= 75 ? 'Approaching independence' : fiScore.total >= 50 ? 'Halfway there' : 'Building your base'} />
          <p className="stat-label mt-3">FI Score</p>
        </Card>

        {/* Runway */}
        <Card className="flex flex-col items-center justify-center py-8">
          <div className="text-center">
            <p className="number-display text-5xl font-bold text-text-primary glow-text">
              <AnimatedNumber value={Math.round(runway * 10)} format={(n) => (n / 10).toFixed(1)} />
            </p>
            <p className="text-base text-text-secondary mt-1 tracking-wide">years</p>
          </div>
          <p className="stat-label mt-4">Runway</p>
          <p className="text-sm text-text-secondary/70">If income stopped today</p>
        </Card>

        {/* FIRE Gap */}
        <Card className="flex flex-col items-center justify-center py-8">
          <div className="text-center">
            <p className="number-display text-5xl font-bold text-accent-amber glow-text-amber">
              <AnimatedNumber value={fireGap > 0 ? fireGap : 0} format={(n) => formatCurrency(n, true)} />
            </p>
            <p className="text-base text-text-secondary mt-1 tracking-wide">away</p>
          </div>
          <p className="stat-label mt-4">FIRE Gap</p>
          <p className="text-sm text-text-secondary/70">{targetYear ? `Target: ${targetYear}` : 'Set target in profile'}</p>
        </Card>
      </div>

      {/* If Laid Off Tomorrow */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-6 rounded-full bg-accent-red shadow-glow-red" />
          <h3 className="section-title mb-0">If Laid Off Tomorrow</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5">
          <LayoffItem
            status={mortgageCoverageYears >= 5 ? 'green' : mortgageCoverageYears >= 2 ? 'amber' : 'red'}
            label={totalMonthlyMortgage > 0 ? `Mortgage covered: ${mortgageCoverageYears >= 1 ? `${mortgageCoverageYears.toFixed(1)}+ years` : `${Math.round(mortgageCoverageYears * 12)} months`}` : 'No mortgage debt'}
            detail={totalMonthlyMortgage > 0 ? `${formatCurrency(totalMonthlyMortgage)}/mo across ${realEstate.filter(p => (p.monthly_payment ?? 0) > 0).length} mortgage(s)` : 'No properties with mortgages'}
          />
          <LayoffItem
            status={emergencyMonths >= 12 ? 'green' : emergencyMonths >= 6 ? 'amber' : 'red'}
            label={monthlySpend > 0 ? `Emergency fund: ${emergencyMonths >= 12 ? `${Math.round(emergencyMonths)} months` : `${emergencyMonths.toFixed(1)} months`}` : 'Set spending to calculate'}
            detail={investable > 0 ? `${formatCurrency(investable)} in investable assets` : 'No investable assets tracked'}
          />
          <LayoffItem
            status={unvestedValue <= 0 ? 'green' : unvestedValue < 100000 ? 'amber' : 'red'}
            label={unvestedShares > 0 ? `Unvested RSUs at risk: ${formatCurrency(unvestedValue)}` : 'No unvested RSUs'}
            detail={unvestedShares > 0 ? `${unvestedShares.toLocaleString()} unvested shares across ${rsuGrants.filter(g => g.total_shares - g.vested_shares > 0).length} grant(s)` : 'All grants fully vested or no RSU data'}
          />
          <LayoffItem
            status="amber"
            label="Healthcare gap: COBRA ~$1,800/mo"
            detail="Until marketplace enrollment or new employer coverage"
          />
        </div>
      </Card>

      {/* AI Insights */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-6 rounded-full bg-accent shadow-glow-sm" />
          <h3 className="section-title mb-0">AI Insights</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { href: '/portfolio', label: 'View Portfolio', Icon: TrendingUp },
          { href: '/monte-carlo', label: 'Run Monte Carlo', Icon: BarChart3 },
          { href: '/fire-score', label: 'View FIRE Score', Icon: Flame },
        ].map((link) => (
          <Link key={link.href} href={link.href}>
            <Card hover className="flex items-center gap-4 cursor-pointer group">
              <link.Icon size={24} className="text-accent group-hover:scale-110 transition-transform duration-300" />
              <span className="text-sm font-medium text-text-primary">{link.label} →</span>
            </Card>
          </Link>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
      </div>
    </div>
  );
}
