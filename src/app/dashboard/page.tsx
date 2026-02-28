'use client';

import { motion } from 'framer-motion';
import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency, calculateFIScore } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { mockInsights } from '@/lib/mock-data';
import Link from 'next/link';

// Arc Gauge Component
function ArcGauge({ value, max = 100, size = 160, label }: { value: number; max?: number; size?: number; label: string }) {
  const pct = value / max;
  const radius = (size - 20) / 2;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - pct);
  const color = pct >= 0.75 ? '#10b981' : pct >= 0.5 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        {/* Background arc */}
        <path
          d={`M 10,${size / 2 + 10} A ${radius},${radius} 0 0,1 ${size - 10},${size / 2 + 10}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <motion.path
          d={`M 10,${size / 2 + 10} A ${radius},${radius} 0 0,1 ${size - 10},${size / 2 + 10}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
        {/* Center text */}
        <text
          x={size / 2}
          y={size / 2 - 5}
          textAnchor="middle"
          className="number-display"
          fill="currentColor"
          fontSize="32"
          fontWeight="bold"
        >
          {value}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 15}
          textAnchor="middle"
          fill="#8888aa"
          fontSize="12"
        >
          / {max}
        </text>
      </svg>
      <p className="text-sm text-text-secondary mt-1">{label}</p>
    </div>
  );
}

// Layoff Readiness Item
function LayoffItem({ status, label, detail }: { status: 'green' | 'amber' | 'red'; label: string; detail: string }) {
  const icon = status === 'green' ? '✅' : status === 'amber' ? '⚠️' : '🔴';
  const textColor = status === 'green' ? 'text-emerald-400' : status === 'amber' ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-lg mt-0.5">{icon}</span>
      <div>
        <p className={`text-sm font-medium ${textColor}`}>{label}</p>
        <p className="text-xs text-text-secondary">{detail}</p>
      </div>
    </div>
  );
}

// Insight Card
function InsightCard({ insight, delay }: { insight: typeof mockInsights[0]; delay: number }) {
  const bgColor = insight.type === 'success' ? 'border-emerald-500/20' : insight.type === 'warning' ? 'border-amber-500/20' : 'border-accent/20';
  return (
    <Card delay={delay} className={`${bgColor}`} hover>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{insight.icon}</span>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-text-primary mb-1">{insight.title}</h4>
          <p className="text-xs text-text-secondary leading-relaxed">{insight.body}</p>
          <button className="text-xs text-accent hover:text-accent/80 mt-2 transition-colors">Tell me more →</button>
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { profile, rsuGrants, realEstate, isLoading } = useUserData();

  const annualSpend = profile?.annual_spend || 120000;
  const annualIncome = profile?.annual_income || 380000;
  const fireNumber = profile?.fire_number || 3000000;

  // Derive totals from real data
  const rsuValue = rsuGrants.reduce((sum, g) => sum + g.vested_shares * 190, 0); // TODO: use real stock price
  const realEstateEquity = realEstate.reduce((sum, p) => sum + (p.current_value - p.mortgage_balance), 0);
  const investable = rsuValue; // Without SnapTrade, RSU value is the only investable we know
  const totalNetWorth = investable + realEstateEquity;

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

  if (isLoading) return <div className="text-center py-20 text-text-secondary">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-display text-2xl lg:text-3xl text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">Your financial independence at a glance</p>
      </div>

      {/* Hero Row — 3 stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* FI Score */}
        <Card delay={0.1} className="flex flex-col items-center justify-center">
          <ArcGauge value={fiScore.total} label={fiScore.total >= 75 ? 'Approaching independence' : fiScore.total >= 50 ? 'Halfway there' : 'Building your base'} />
          <p className="text-xs text-text-secondary mt-2 uppercase tracking-wider">FI Score</p>
        </Card>

        {/* Runway */}
        <Card delay={0.2} className="flex flex-col items-center justify-center">
          <div className="text-center">
            <p className="number-display text-4xl font-bold text-text-primary">
              <AnimatedNumber value={Math.round(runway * 10)} format={(n) => (n / 10).toFixed(1)} />
            </p>
            <p className="text-lg text-text-secondary">years</p>
          </div>
          <p className="text-xs text-text-secondary mt-3 uppercase tracking-wider">Runway</p>
          <p className="text-xs text-text-secondary">If income stopped today</p>
        </Card>

        {/* FIRE Gap */}
        <Card delay={0.3} className="flex flex-col items-center justify-center">
          <div className="text-center">
            <p className="number-display text-4xl font-bold text-accent-amber">
              <AnimatedNumber value={fireGap > 0 ? fireGap : 0} format={(n) => formatCurrency(n, true)} />
            </p>
            <p className="text-lg text-text-secondary">away</p>
          </div>
          <p className="text-xs text-text-secondary mt-3 uppercase tracking-wider">FIRE Gap</p>
          <p className="text-xs text-text-secondary">Base case: 2028</p>
        </Card>
      </div>

      {/* If Laid Off Tomorrow */}
      <Card delay={0.4}>
        <h3 className="font-display text-lg text-text-primary mb-4">If Laid Off Tomorrow</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
          <LayoffItem status="green" label="Mortgage covered: 14+ years" detail="Liquid assets cover 14.2 years of mortgage payments" />
          <LayoffItem status="green" label="Emergency fund: 18 months liquid" detail="$120K in cash and equivalents" />
          <LayoffItem status="amber" label="Unvested RSUs at risk: $180,000" detail="375 unvested shares across 2 grants" />
          <LayoffItem status="amber" label="Healthcare gap: COBRA ~$1,800/mo" detail="Until Medicare eligibility or marketplace enrollment" />
        </div>
      </Card>

      {/* AI Insights */}
      <div>
        <h3 className="font-display text-lg text-text-primary mb-3">AI Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mockInsights.map((insight, i) => (
            <InsightCard key={insight.id} insight={insight} delay={0.5 + i * 0.1} />
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { href: '/portfolio', label: 'View Portfolio', icon: '📈' },
          { href: '/monte-carlo', label: 'Run Monte Carlo', icon: '📊' },
          { href: '/fire-score', label: 'View FIRE Score', icon: '🔥' },
        ].map((link, i) => (
          <Link key={link.href} href={link.href}>
            <Card delay={0.8 + i * 0.1} hover className="flex items-center gap-3 cursor-pointer">
              <span className="text-2xl">{link.icon}</span>
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
