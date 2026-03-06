'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import AIAnalysis from '@/components/shared/AIAnalysis';
import { formatCurrency } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { useBrokerageData } from '@/lib/BrokerageDataContext';
import { usePageContext } from '@/lib/PageContextProvider';
import { useStockPrice } from '@/hooks/useStockPrice';
import {
  Briefcase, GraduationCap, TrendingDown, DollarSign,
  Heart, Home as HomeIcon,
} from 'lucide-react';

interface LifeEvent {
  id: string;
  type: 'quit' | 'layoff' | 'college' | 'purchase' | 'windfall' | 'expense';
  label: string;
  iconLabel: string;
  year: number;
  params: Record<string, number>;
}

interface SimParams {
  startingPortfolio: number;
  annualContribution: number;
  annualSpend: number;
  retirementSpend: number;
  equityPct: number;
  bondPct: number;
  inflationRate: number;
  years: number;
  fireNumber: number;
  includeRealEstate: boolean;
  lifeEvents: LifeEvent[];
}

interface SimResult {
  percentiles: { p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[] };
  successRate: number;
  medianFinalValue: number;
}

// ─── localStorage persistence ───────────────────────────────────────

const STORAGE_KEY = 'firerunway_mc_params';
const EVENTS_KEY = 'firerunway_mc_events';

function loadSavedParams(): Partial<SimParams> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveParams(params: SimParams) {
  if (typeof window === 'undefined') return;
  try {
    // Save only the user-adjustable fields, not lifeEvents (separate key)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { lifeEvents, ...toSave } = params;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* quota exceeded, ignore */ }
}

function loadSavedEvents(): LifeEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveEvents(events: LifeEvent[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(EVENTS_KEY, JSON.stringify(events)); } catch { /* ignore */ }
}

// ─── Simulation engine ──────────────────────────────────────────────

function runMonteCarloSync(params: SimParams): SimResult {
  const NUM_SIMS = 2000;
  const EQUITY_MEAN = 0.10, EQUITY_STD = 0.17;
  const BOND_MEAN = 0.04, BOND_STD = 0.06;

  const portfolioMean = params.equityPct * EQUITY_MEAN + params.bondPct * BOND_MEAN;
  const portfolioStd = Math.sqrt(
    Math.pow(params.equityPct * EQUITY_STD, 2) + Math.pow(params.bondPct * BOND_STD, 2)
  );

  const allRuns: number[][] = [];
  let successes = 0;

  for (let sim = 0; sim < NUM_SIMS; sim++) {
    let portfolio = params.startingPortfolio;
    let failed = false;
    const values: number[] = [portfolio];
    let spend = params.annualSpend;
    let isRetired = false;

    for (let year = 1; year <= params.years; year++) {
      const u1 = Math.random(), u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const ret = portfolioMean + portfolioStd * z;

      let contrib = isRetired ? 0 : params.annualContribution;
      let yearSpend = isRetired ? params.retirementSpend : spend;

      const currentYear = new Date().getFullYear() + year;
      for (const evt of params.lifeEvents) {
        if (evt.year === currentYear) {
          if (evt.type === 'quit' || evt.type === 'layoff') {
            isRetired = true;
            contrib = evt.params.severance || 0;
            yearSpend = params.retirementSpend;
          }
          if (evt.type === 'college') yearSpend += (evt.params.annualCost || 55000) - (evt.params.plan529 || 0);
          if (evt.type === 'windfall') contrib += evt.params.amount || 0;
          if (evt.type === 'expense') yearSpend += evt.params.amount || 0;
          if (evt.type === 'purchase') yearSpend += evt.params.downPayment || 0;
        }
      }

      portfolio = portfolio * (1 + ret) + contrib - yearSpend;
      spend *= (1 + params.inflationRate);
      values.push(Math.max(portfolio, 0));

      if (portfolio <= 0) {
        failed = true;
        for (let r = year + 1; r <= params.years; r++) values.push(0);
        break;
      }
    }
    if (!failed) successes++;
    allRuns.push(values);
  }

  const percentiles: SimResult['percentiles'] = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  for (let y = 0; y <= params.years; y++) {
    const vals = allRuns.map(r => r[y]).sort((a, b) => a - b);
    percentiles.p10.push(vals[Math.floor(NUM_SIMS * 0.10)]);
    percentiles.p25.push(vals[Math.floor(NUM_SIMS * 0.25)]);
    percentiles.p50.push(vals[Math.floor(NUM_SIMS * 0.50)]);
    percentiles.p75.push(vals[Math.floor(NUM_SIMS * 0.75)]);
    percentiles.p90.push(vals[Math.floor(NUM_SIMS * 0.90)]);
  }

  return { percentiles, successRate: successes / NUM_SIMS, medianFinalValue: percentiles.p50[params.years] };
}

// ─── Constants ──────────────────────────────────────────────────────

const eventTypes = [
  { type: 'quit', icon: <Briefcase size={14} />, label: 'Quit / Retire' },
  { type: 'college', icon: <GraduationCap size={14} />, label: 'Child College' },
  { type: 'layoff', icon: <TrendingDown size={14} />, label: 'Layoff' },
  { type: 'windfall', icon: <DollarSign size={14} />, label: 'Windfall' },
  { type: 'expense', icon: <Heart size={14} />, label: 'Major Expense' },
  { type: 'purchase', icon: <HomeIcon size={14} />, label: 'Home Purchase' },
] as const;

// ─── Tooltip ────────────────────────────────────────────────────────

function CustomFanTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-content min-w-[160px]">
      <p className="text-sm text-text-secondary mb-2">Year {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between text-sm gap-4 py-0.5">
          <span className="text-text-secondary">{p.name}</span>
          <span className="number-display text-text-primary font-medium">{formatCurrency(p.value, true)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function MonteCarloPage() {
  const { profile, rsuGrants, realEstate, isLoading, clerkId } = useUserData();
  const { totalInvestment } = useBrokerageData();
  const ticker = rsuGrants[0]?.company_ticker || 'AMZN';
  const stockPrice = useStockPrice(ticker);

  // Compute base values from real data
  const rsuValue = rsuGrants.reduce((sum, g) => sum + g.vested_shares * stockPrice, 0);
  const realEstateEquity = realEstate.reduce((sum, p) => sum + ((p.current_value ?? 0) - (p.mortgage_balance ?? 0)), 0);
  const basePortfolio = totalInvestment > 0 ? totalInvestment : rsuValue;
  const annualSpend = profile?.annual_spend || 0;
  const annualIncome = profile?.annual_income || 0;
  const fireNumber = profile?.fire_number || 0;
  const savingsRate = annualIncome > 0 ? (annualIncome - annualSpend) / annualIncome : 0.3;

  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [params, setParams] = useState<SimParams>({
    startingPortfolio: basePortfolio || 500000,
    annualContribution: Math.round(annualIncome * savingsRate),
    annualSpend,
    retirementSpend: Math.round(annualSpend * 0.8),
    equityPct: 0.8,
    bondPct: 0.2,
    inflationRate: 0.03,
    years: 25,
    fireNumber: fireNumber,
    includeRealEstate: true,
    lifeEvents: [],
  });
  const [dataSeeded, setDataSeeded] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [scenarios, setScenarios] = useState<{ name: string; result: SimResult }[]>([]);
  const [savedIndicator, setSavedIndicator] = useState(false);

  // Load saved params from localStorage on mount
  useEffect(() => {
    const saved = loadSavedParams();
    const savedEvts = loadSavedEvents();
    if (saved) {
      setParams(prev => ({ ...prev, ...saved }));
    }
    if (savedEvts.length > 0) {
      setEvents(savedEvts);
    }
  }, []);

  // Sync params when real data finishes loading (only if not already seeded AND no saved params)
  useEffect(() => {
    if (!isLoading && !dataSeeded && (basePortfolio > 0 || profile)) {
      const saved = loadSavedParams();
      if (!saved) {
        // No saved params — seed from real data
        setParams(prev => ({
          ...prev,
          startingPortfolio: (basePortfolio + realEstateEquity) || prev.startingPortfolio,
          annualContribution: Math.round(annualIncome * savingsRate),
          annualSpend,
          retirementSpend: Math.round(annualSpend * 0.8),
          fireNumber,
          includeRealEstate: true,
        }));
      } else {
        // Has saved params — only update the startingPortfolio to reflect current real data
        const reComputed = saved.includeRealEstate !== false
          ? basePortfolio + realEstateEquity
          : basePortfolio;
        setParams(prev => ({
          ...prev,
          startingPortfolio: reComputed || prev.startingPortfolio,
        }));
      }
      setDataSeeded(true);
    }
  }, [isLoading, dataSeeded, basePortfolio, realEstateEquity, annualIncome, annualSpend, savingsRate, fireNumber, profile]);

  // Recompute startingPortfolio when real estate toggle changes
  useEffect(() => {
    if (dataSeeded) {
      setParams(prev => ({
        ...prev,
        startingPortfolio: prev.includeRealEstate
          ? basePortfolio + realEstateEquity
          : basePortfolio,
      }));
    }
  }, [params.includeRealEstate, dataSeeded, basePortfolio, realEstateEquity]);

  // Auto-save params to localStorage whenever they change
  useEffect(() => {
    if (dataSeeded) {
      saveParams(params);
    }
  }, [params, dataSeeded]);

  // Auto-save events to localStorage whenever they change
  useEffect(() => {
    saveEvents(events);
  }, [events]);

  const result = useMemo(() => runMonteCarloSync({ ...params, lifeEvents: events }), [params, events]);

  const currentYear = new Date().getFullYear();

  // Report simulation data to ChatRail via PageContextProvider
  const { setPageContext } = usePageContext();
  useEffect(() => {
    const parts = [
      `Monte Carlo Simulation Parameters:`,
      `  Starting Portfolio: $${params.startingPortfolio.toLocaleString()}`,
      `  Annual Contribution: $${params.annualContribution.toLocaleString()}`,
      `  Annual Spend: $${params.annualSpend.toLocaleString()}`,
      `  Retirement Spend: $${params.retirementSpend.toLocaleString()}`,
      `  Equity/Bond Split: ${Math.round(params.equityPct * 100)}% / ${Math.round(params.bondPct * 100)}%`,
      `  Inflation Rate: ${(params.inflationRate * 100).toFixed(1)}%`,
      `  Projection Years: ${params.years}`,
      `  FIRE Number: $${params.fireNumber.toLocaleString()}`,
      `  Include Real Estate Equity: ${params.includeRealEstate}`,
      ``,
      `Simulation Results (2,000 runs):`,
      `  Success Rate: ${(result.successRate * 100).toFixed(1)}%`,
      `  Median Final Value: $${Math.round(result.medianFinalValue).toLocaleString()}`,
      `  10th Percentile (worst case): $${Math.round(result.percentiles.p10[params.years]).toLocaleString()}`,
      `  25th Percentile (conservative): $${Math.round(result.percentiles.p25[params.years]).toLocaleString()}`,
      `  75th Percentile (optimistic): $${Math.round(result.percentiles.p75[params.years]).toLocaleString()}`,
      `  90th Percentile (best case): $${Math.round(result.percentiles.p90[params.years]).toLocaleString()}`,
    ];

    // Add FIRE year info
    const fireYr = (() => {
      for (let y = 0; y <= params.years; y++) {
        if (result.percentiles.p50[y] >= params.fireNumber) return currentYear + y;
      }
      return null;
    })();
    const consFireYr = (() => {
      for (let y = 0; y <= params.years; y++) {
        if (result.percentiles.p25[y] >= params.fireNumber) return currentYear + y;
      }
      return null;
    })();
    parts.push(`  Base Case FI Year: ${fireYr || 'Not reached'}`);
    parts.push(`  Conservative FI Year: ${consFireYr || 'Not reached'}`);

    // Year-by-year chart data (sample every N years to keep context manageable)
    const step = params.years > 30 ? 2 : 1;
    parts.push(``);
    parts.push(`Year-by-Year Portfolio Projections (Year | p10 | p25 | Median | p75 | p90):`);
    for (let y = 0; y <= params.years; y += step) {
      const yr = currentYear + y;
      const fmt = (v: number) => `$${Math.round(v).toLocaleString()}`;
      parts.push(`  ${yr}: ${fmt(result.percentiles.p10[y])} | ${fmt(result.percentiles.p25[y])} | ${fmt(result.percentiles.p50[y])} | ${fmt(result.percentiles.p75[y])} | ${fmt(result.percentiles.p90[y])}`);
    }
    // Always include the final year if step skipped it
    if (params.years % step !== 0) {
      const y = params.years;
      const yr = currentYear + y;
      const fmt = (v: number) => `$${Math.round(v).toLocaleString()}`;
      parts.push(`  ${yr}: ${fmt(result.percentiles.p10[y])} | ${fmt(result.percentiles.p25[y])} | ${fmt(result.percentiles.p50[y])} | ${fmt(result.percentiles.p75[y])} | ${fmt(result.percentiles.p90[y])}`);
    }

    if (events.length > 0) {
      parts.push(``);
      parts.push(`Life Events (${events.length}):`);
      events.forEach(e => {
        parts.push(`  - ${e.iconLabel} ${e.label} in ${e.year} (${JSON.stringify(e.params)})`);
      });
    }

    setPageContext(parts.join('\n'));
  }, [params, result, events, currentYear, setPageContext]);

  const chartData = useMemo(() => {
    const data = [];
    for (let y = 0; y <= params.years; y++) {
      data.push({
        year: currentYear + y,
        p10: result.percentiles.p10[y],
        p25: result.percentiles.p25[y],
        p50: result.percentiles.p50[y],
        p75: result.percentiles.p75[y],
        p90: result.percentiles.p90[y],
      });
    }
    return data;
  }, [result, params.years, currentYear]);

  // Find intersection year for base case
  const fireYear = useMemo(() => {
    for (let y = 0; y <= params.years; y++) {
      if (result.percentiles.p50[y] >= params.fireNumber) return currentYear + y;
    }
    return null;
  }, [result, params.years, params.fireNumber, currentYear]);

  const conservativeFireYear = useMemo(() => {
    for (let y = 0; y <= params.years; y++) {
      if (result.percentiles.p25[y] >= params.fireNumber) return currentYear + y;
    }
    return null;
  }, [result, params.years, params.fireNumber, currentYear]);

  const addEvent = useCallback((type: string) => {
    const eventMeta = eventTypes.find(e => e.type === type)!;
    const newEvent: LifeEvent = {
      id: Date.now().toString(),
      type: type as LifeEvent['type'],
      label: eventMeta.label,
      iconLabel: eventMeta.label,
      year: currentYear + 4,
      params: type === 'college' ? { annualCost: 55000, plan529: 20000 } :
        type === 'windfall' ? { amount: 100000 } :
          type === 'expense' ? { amount: 50000 } :
            type === 'purchase' ? { downPayment: 200000 } :
              type === 'quit' ? { severance: 0 } :
                { severance: 50000 },
    };
    setEvents(prev => [...prev, newEvent]);
  }, [currentYear]);

  const removeEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  const updateEventYear = useCallback((id: string, year: number) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, year } : e));
  }, []);

  const saveScenario = useCallback(() => {
    const name = `Scenario ${scenarios.length + 1}${events.length > 0 ? ` (${events.map(e => e.label).join(', ')})` : ''}`;
    setScenarios(prev => [...prev, { name, result: { ...result } }]);
  }, [scenarios, events, result]);

  const handleSaveParams = useCallback(() => {
    saveParams(params);
    saveEvents(events);
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 2000);
  }, [params, events]);

  const handleResetParams = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(EVENTS_KEY);
    setDataSeeded(false);
    setEvents([]);
    // Will re-seed from real data on next render cycle
  }, []);

  const handleAnalyze = useCallback(async () => {
    const res = await fetch(`/api/monte-carlo/analyze?clerkId=${clerkId || ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        params,
        result: {
          successRate: result.successRate,
          medianFinalValue: result.medianFinalValue,
          p10End: result.percentiles.p10[params.years],
          p25End: result.percentiles.p25[params.years],
          p75End: result.percentiles.p75[params.years],
          p90End: result.percentiles.p90[params.years],
        },
        fireYear,
        conservativeFireYear,
        lifeEvents: events,
      }),
    });
    if (!res.ok) throw new Error('Analysis failed');
    return res.json();
  }, [params, result, fireYear, conservativeFireYear, events, clerkId]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div
        >
          <h1 className="page-title">Monte Carlo Simulator</h1>
          <p className="page-subtitle">How much longer do you need to keep working?</p>
        </div>
        <button
          onClick={() => setShowVariables(!showVariables)}
          className="tab-button text-sm"
        >
          {showVariables ? 'Hide' : 'Show'} Variables ⚙️
        </button>
      </div>

      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 space-y-8 min-w-0">
          {/* Fan Chart */}
          <Card>
            <h3 className="section-title">Portfolio Projections — {params.years} Years</h3>
            <div className="h-96 relative">
              {/* Chart glow background */}
              <div className="absolute inset-0 bg-gradient-to-t from-accent/[0.03] to-transparent rounded-xl pointer-events-none" />
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="p90grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.05} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="p75grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="p50grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="year" stroke="#2a2a3a" tick={{ fill: '#8888aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#2a2a3a" tick={{ fill: '#8888aa', fontSize: 11, fontFamily: 'JetBrains Mono' }} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} tickLine={false} axisLine={false} width={60} />
                  <Tooltip content={<CustomFanTooltip />} />
                  <ReferenceLine y={params.fireNumber} stroke="#10b981" strokeDasharray="6 4" strokeWidth={2} label={{ value: `FIRE: ${formatCurrency(params.fireNumber, true)}`, position: 'right', fill: '#10b981', fontSize: 11 }} />
                  {/* Event markers */}
                  {events.map(evt => (
                    <ReferenceLine key={evt.id} x={evt.year} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} label={{ value: evt.iconLabel, position: 'top', fontSize: 11 }} />
                  ))}
                  <Area type="monotone" dataKey="p90" stroke="none" fill="url(#p90grad)" name="90th pctile" isAnimationActive={false} />
                  <Area type="monotone" dataKey="p75" stroke="none" fill="url(#p75grad)" name="75th pctile" isAnimationActive={false} />
                  <Area type="monotone" dataKey="p50" stroke="#6366f1" strokeWidth={2.5} fill="url(#p50grad)" name="Median" isAnimationActive={false} />
                  <Area type="monotone" dataKey="p25" stroke="none" fill="rgba(99,102,241,0.06)" name="25th pctile" isAnimationActive={false} />
                  <Area type="monotone" dataKey="p10" stroke="rgba(99,102,241,0.3)" strokeWidth={1} strokeDasharray="4 4" fill="none" name="10th pctile" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Outcome Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="text-center">
              <p className="stat-label mb-2">Success Rate</p>
              <p className="number-display text-2xl font-bold text-emerald-400 glow-text-green">
                <AnimatedNumber value={Math.round(result.successRate * 100)} suffix="%" />
              </p>
            </Card>
            <Card className="text-center">
              <p className="stat-label mb-2">Median at Yr {params.years}</p>
              <p className="number-display text-2xl font-bold text-text-primary glow-text">
                <AnimatedNumber value={result.medianFinalValue} format={(n) => formatCurrency(n, true)} />
              </p>
            </Card>
            <Card className="text-center">
              <p className="stat-label mb-2">Conservative FI</p>
              <p className="number-display text-2xl font-bold text-accent-amber glow-text-amber">
                {conservativeFireYear || 'N/A'}
              </p>
            </Card>
            <Card className="text-center">
              <p className="text-sm text-text-secondary">Base Case FI</p>
              <p className="number-display text-2xl font-bold text-accent">
                {fireYear || 'N/A'}
              </p>
            </Card>
          </div>

          {/* Life Events Timeline */}
          <Card>
            <h3 className="section-title">Life Events</h3>
            <p className="text-sm text-text-secondary mb-4">Add events to see how they affect your projections</p>

            {/* Event chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {eventTypes.map((et) => (
                <button
                  key={et.type}
                  onClick={() => addEvent(et.type)}
                  className="glass-card-hover px-3 py-1.5 text-sm font-medium flex items-center gap-1.5"
                >
                  {et.icon} {et.label}
                </button>
              ))}
            </div>

            {/* Active events */}
            {events.length > 0 && (
              <div className="space-y-2">
                {events.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-center gap-3 p-3 glass-card rounded-lg"
                  >
                    <span className="text-xl text-accent">{eventTypes.find(et => et.type === evt.type)?.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">{evt.label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-text-secondary">Year:</label>
                      <input
                        type="number"
                        min={currentYear}
                        max={currentYear + params.years}
                        value={evt.year}
                        onChange={(e) => updateEventYear(evt.id, Number(e.target.value))}
                        className="w-20 bg-bg-elevated border border-border rounded px-2 py-1 text-sm number-display text-text-primary"
                      />
                    </div>
                    <button onClick={() => removeEvent(evt.id)} className="text-red-400/60 hover:text-red-400 text-sm transition-colors">✕</button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Scenario Manager */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title mb-0">Scenario Manager</h3>
              <button onClick={saveScenario} className="text-sm px-3 py-1.5 bg-accent/15 text-accent border border-accent/30 rounded-md hover:bg-accent/25 transition-colors">
                Save Current Scenario
              </button>
            </div>

            {scenarios.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-sm text-text-secondary border-b border-border">
                      <th className="text-left pb-2 font-medium">Scenario</th>
                      <th className="text-right pb-2 font-medium">Success Rate</th>
                      <th className="text-right pb-2 font-medium">Median (yr {params.years})</th>
                      <th className="text-right pb-2 font-medium">10th pct</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((s, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 text-text-primary">{s.name}</td>
                        <td className="py-2 text-right number-display">{(s.result.successRate * 100).toFixed(0)}%</td>
                        <td className="py-2 text-right number-display">{formatCurrency(s.result.medianFinalValue, true)}</td>
                        <td className="py-2 text-right number-display">{formatCurrency(s.result.percentiles.p10[params.years], true)}</td>
                      </tr>
                    ))}
                    {/* Current */}
                    <tr className="border-t border-accent/30 bg-accent/5">
                      <td className="py-2 text-accent font-medium">Current</td>
                      <td className="py-2 text-right number-display text-accent">{(result.successRate * 100).toFixed(0)}%</td>
                      <td className="py-2 text-right number-display text-accent">{formatCurrency(result.medianFinalValue, true)}</td>
                      <td className="py-2 text-right number-display text-accent">{formatCurrency(result.percentiles.p10[params.years], true)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">No saved scenarios yet. Adjust life events and variables, then save to compare.</p>
            )}
          </Card>

          {/* AI Analysis */}
          <AIAnalysis type="monte_carlo" onAnalyze={handleAnalyze} ready={result.successRate > 0} />
        </div>

        {/* Variables Panel (collapsible sidebar) */}
        {showVariables && (
          <div
            className="hidden lg:block flex-shrink-0"
          >
            <Card className="sticky top-20 space-y-5 text-sm">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-base text-text-primary">Variables</h4>
                <div className="flex items-center gap-2">
                  {savedIndicator && (
                    <span className="text-sm text-emerald-400">✓ Saved</span>
                  )}
                  <button
                    onClick={handleSaveParams}
                    className="text-sm px-2 py-1 bg-accent/15 text-accent border border-accent/30 rounded hover:bg-accent/25 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleResetParams}
                    className="text-sm px-2 py-1 text-text-secondary border border-border rounded hover:text-text-primary transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm text-text-secondary uppercase tracking-wider mb-2">Portfolio</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm text-text-secondary">Starting value</label>
                    <input type="text" value={formatCurrency(params.startingPortfolio)} readOnly className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-sm number-display text-text-primary mt-0.5 opacity-60" />
                    <p className="text-sm text-text-secondary/60 mt-0.5">Auto-calculated from your accounts</p>
                  </div>
                  <div>
                    <label className="text-sm text-text-secondary">Annual contribution</label>
                    <input type="text" value={`$${params.annualContribution.toLocaleString()}`} onChange={e => setParams(p => ({ ...p, annualContribution: parseInt(e.target.value.replace(/\D/g, '')) || 0 }))} className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-sm number-display text-text-primary mt-0.5" />
                  </div>
                  <div>
                    <label className="text-sm text-text-secondary">Allocation (equity/bond): {Math.round(params.equityPct * 100)}/{Math.round(params.bondPct * 100)}</label>
                    <input type="range" min={0} max={100} value={params.equityPct * 100} onChange={e => { const eq = Number(e.target.value) / 100; setParams(p => ({ ...p, equityPct: eq, bondPct: 1 - eq })); }} className="w-full accent-accent" />
                  </div>
                  <div>
                    <label className="text-sm text-text-secondary">Inflation: {(params.inflationRate * 100).toFixed(1)}%</label>
                    <input type="range" min={1} max={6} step={0.5} value={params.inflationRate * 100} onChange={e => setParams(p => ({ ...p, inflationRate: Number(e.target.value) / 100 }))} className="w-full accent-accent" />
                  </div>
                </div>
              </div>

              {/* Real Estate Toggle */}
              <div className="border-t border-border pt-4">
                <p className="text-sm text-text-secondary uppercase tracking-wider mb-2">Real Estate</p>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-border/50">
                  <div>
                    <p className="text-sm text-text-primary font-medium">Include equity</p>
                    <p className="text-sm text-text-secondary">{formatCurrency(realEstateEquity, true)}</p>
                  </div>
                  <button
                    onClick={() => setParams(p => ({ ...p, includeRealEstate: !p.includeRealEstate }))}
                    className={`relative inline-flex h-5 w-10 flex-shrink-0 rounded-full transition-colors ${params.includeRealEstate ? 'bg-accent' : 'bg-white/10'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${params.includeRealEstate ? 'ml-[22px]' : 'ml-0.5'
                        }`}
                    />
                  </button>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-sm text-text-secondary uppercase tracking-wider mb-2">Expenses</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm text-text-secondary">Current annual spend</label>
                    <input type="text" value={`$${params.annualSpend.toLocaleString()}`} onChange={e => setParams(p => ({ ...p, annualSpend: parseInt(e.target.value.replace(/\D/g, '')) || 0 }))} className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-sm number-display text-text-primary mt-0.5" />
                  </div>
                  <div>
                    <label className="text-sm text-text-secondary">Retirement spend</label>
                    <input type="text" value={`$${params.retirementSpend.toLocaleString()}`} onChange={e => setParams(p => ({ ...p, retirementSpend: parseInt(e.target.value.replace(/\D/g, '')) || 0 }))} className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-sm number-display text-text-primary mt-0.5" />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-sm text-text-secondary uppercase tracking-wider mb-2">FIRE Parameters</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm text-text-secondary">FIRE number</label>
                    <input type="text" value={`$${params.fireNumber.toLocaleString()}`} onChange={e => setParams(p => ({ ...p, fireNumber: parseInt(e.target.value.replace(/\D/g, '')) || 0 }))} className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-sm number-display text-text-primary mt-0.5" />
                  </div>
                  <div>
                    <label className="text-sm text-text-secondary">Projection years: {params.years}</label>
                    <input type="range" min={10} max={40} value={params.years} onChange={e => setParams(p => ({ ...p, years: Number(e.target.value) }))} className="w-full accent-accent" />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Monte Carlo simulations are for illustrative purposes and do not guarantee future results.
      </div>
    </div>
  );
}
