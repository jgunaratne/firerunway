'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency } from '@/lib/calculations';

interface LifeEvent {
  id: string;
  type: 'quit' | 'layoff' | 'college' | 'purchase' | 'windfall' | 'expense';
  label: string;
  emoji: string;
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
  lifeEvents: LifeEvent[];
}

interface SimResult {
  percentiles: { p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[] };
  successRate: number;
  medianFinalValue: number;
}

function runMonteCarloSync(params: SimParams): SimResult {
  const NUM_SIMS = 2000; // Reduced for client-side perf
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

      const currentYear = 2026 + year;
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

const eventTypes = [
  { type: 'quit', emoji: '💼', label: 'Quit / Retire' },
  { type: 'college', emoji: '🏫', label: 'Child College' },
  { type: 'layoff', emoji: '📉', label: 'Layoff' },
  { type: 'windfall', emoji: '💰', label: 'Windfall' },
  { type: 'expense', emoji: '🏥', label: 'Major Expense' },
  { type: 'purchase', emoji: '🏠', label: 'Home Purchase' },
] as const;

function CustomFanTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-content min-w-[160px]">
      <p className="text-xs text-text-secondary mb-2">Year {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between text-xs gap-4 py-0.5">
          <span className="text-text-secondary">{p.name}</span>
          <span className="number-display text-text-primary font-medium">{formatCurrency(p.value, true)}</span>
        </div>
      ))}
    </div>
  );
}

export default function MonteCarloPage() {
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [params, setParams] = useState<SimParams>({
    startingPortfolio: 3360000,
    annualContribution: 85000,
    annualSpend: 120000,
    retirementSpend: 96000,
    equityPct: 0.8,
    bondPct: 0.2,
    inflationRate: 0.03,
    years: 25,
    fireNumber: 3000000,
    lifeEvents: [],
  });
  const [showVariables, setShowVariables] = useState(false);
  const [scenarios, setScenarios] = useState<{ name: string; result: SimResult }[]>([]);

  const result = useMemo(() => runMonteCarloSync({ ...params, lifeEvents: events }), [params, events]);

  const chartData = useMemo(() => {
    const data = [];
    for (let y = 0; y <= params.years; y++) {
      data.push({
        year: 2026 + y,
        p10: result.percentiles.p10[y],
        p25: result.percentiles.p25[y],
        p50: result.percentiles.p50[y],
        p75: result.percentiles.p75[y],
        p90: result.percentiles.p90[y],
      });
    }
    return data;
  }, [result, params.years]);

  // Find intersection year for base case
  const fireYear = useMemo(() => {
    for (let y = 0; y <= params.years; y++) {
      if (result.percentiles.p50[y] >= params.fireNumber) return 2026 + y;
    }
    return null;
  }, [result, params.years, params.fireNumber]);

  const conservativeFireYear = useMemo(() => {
    for (let y = 0; y <= params.years; y++) {
      if (result.percentiles.p25[y] >= params.fireNumber) return 2026 + y;
    }
    return null;
  }, [result, params.years, params.fireNumber]);

  const addEvent = useCallback((type: string) => {
    const eventMeta = eventTypes.find(e => e.type === type)!;
    const newEvent: LifeEvent = {
      id: Date.now().toString(),
      type: type as LifeEvent['type'],
      label: eventMeta.label,
      emoji: eventMeta.emoji,
      year: 2030,
      params: type === 'college' ? { annualCost: 55000, plan529: 20000 } :
        type === 'windfall' ? { amount: 100000 } :
          type === 'expense' ? { amount: 50000 } :
            type === 'purchase' ? { downPayment: 200000 } :
              type === 'quit' ? { severance: 0 } :
                { severance: 50000 },
    };
    setEvents(prev => [...prev, newEvent]);
  }, []);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl text-text-primary">Monte Carlo Simulator</h1>
          <p className="text-sm text-text-secondary mt-1">How much longer do you need to keep working?</p>
        </div>
        <button
          onClick={() => setShowVariables(!showVariables)}
          className="tab-button text-xs"
        >
          {showVariables ? 'Hide' : 'Show'} Variables ⚙️
        </button>
      </div>

      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Fan Chart */}
          <Card delay={0.1}>
            <h3 className="font-display text-lg text-text-primary mb-4">Portfolio Projections — {params.years} Years</h3>
            <div className="h-96">
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
                    <ReferenceLine key={evt.id} x={evt.year} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} label={{ value: evt.emoji, position: 'top', fontSize: 16 }} />
                  ))}
                  <Area type="monotone" dataKey="p90" stroke="none" fill="url(#p90grad)" name="90th pctile" animationDuration={1000} />
                  <Area type="monotone" dataKey="p75" stroke="none" fill="url(#p75grad)" name="75th pctile" animationDuration={1000} />
                  <Area type="monotone" dataKey="p50" stroke="#6366f1" strokeWidth={2.5} fill="url(#p50grad)" name="Median" animationDuration={1000} />
                  <Area type="monotone" dataKey="p25" stroke="none" fill="rgba(99,102,241,0.06)" name="25th pctile" animationDuration={1000} />
                  <Area type="monotone" dataKey="p10" stroke="rgba(99,102,241,0.3)" strokeWidth={1} strokeDasharray="4 4" fill="none" name="10th pctile" animationDuration={1000} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Outcome Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card delay={0.2} className="text-center">
              <p className="text-xs text-text-secondary">Success Rate</p>
              <p className="number-display text-2xl font-bold text-emerald-400">
                <AnimatedNumber value={Math.round(result.successRate * 100)} suffix="%" />
              </p>
            </Card>
            <Card delay={0.25} className="text-center">
              <p className="text-xs text-text-secondary">Median at Yr {params.years}</p>
              <p className="number-display text-2xl font-bold text-text-primary">
                <AnimatedNumber value={result.medianFinalValue} format={(n) => formatCurrency(n, true)} />
              </p>
            </Card>
            <Card delay={0.3} className="text-center">
              <p className="text-xs text-text-secondary">Conservative FI</p>
              <p className="number-display text-2xl font-bold text-accent-amber">
                {conservativeFireYear || 'N/A'}
              </p>
            </Card>
            <Card delay={0.35} className="text-center">
              <p className="text-xs text-text-secondary">Base Case FI</p>
              <p className="number-display text-2xl font-bold text-accent">
                {fireYear || 'N/A'}
              </p>
            </Card>
          </div>

          {/* Life Events Timeline */}
          <Card delay={0.4}>
            <h3 className="font-display text-lg text-text-primary mb-2">Life Events</h3>
            <p className="text-xs text-text-secondary mb-4">Add events to see how they affect your projections</p>

            {/* Event chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {eventTypes.map((et) => (
                <button
                  key={et.type}
                  onClick={() => addEvent(et.type)}
                  className="glass-card-hover px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                >
                  <span>{et.emoji}</span> {et.label}
                </button>
              ))}
            </div>

            {/* Active events */}
            {events.length > 0 && (
              <div className="space-y-2">
                {events.map((evt) => (
                  <motion.div
                    key={evt.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 glass-card rounded-lg"
                  >
                    <span className="text-xl">{evt.emoji}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">{evt.label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-text-secondary">Year:</label>
                      <input
                        type="number"
                        min={2026}
                        max={2026 + params.years}
                        value={evt.year}
                        onChange={(e) => updateEventYear(evt.id, Number(e.target.value))}
                        className="w-20 bg-bg-elevated border border-border rounded px-2 py-1 text-xs number-display text-text-primary"
                      />
                    </div>
                    <button onClick={() => removeEvent(evt.id)} className="text-red-400/60 hover:text-red-400 text-xs transition-colors">✕</button>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>

          {/* Scenario Manager */}
          <Card delay={0.5}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg text-text-primary">Scenario Manager</h3>
              <button onClick={saveScenario} className="text-xs px-3 py-1.5 bg-accent/15 text-accent border border-accent/30 rounded-md hover:bg-accent/25 transition-colors">
                Save Current Scenario
              </button>
            </div>

            {scenarios.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-text-secondary border-b border-border">
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
              <p className="text-xs text-text-secondary">No saved scenarios yet. Adjust life events and variables, then save to compare.</p>
            )}
          </Card>

          {/* AI Interpretation */}
          <Card delay={0.6} className="border-accent/20">
            <h3 className="font-display text-lg text-text-primary mb-2">AI Interpretation</h3>
            <p className="text-sm text-text-secondary leading-relaxed italic">
              &ldquo;Your {(result.successRate * 100).toFixed(0)}% success rate is {result.successRate >= 0.85 ? 'solid' : result.successRate >= 0.70 ? 'moderate — consider increasing your savings rate' : 'concerning — review your spending and investment strategy'}.
              The primary risk in your 10th percentile scenario is a severe market downturn in the first 3 years of retirement combined with high employer stock concentration.
              Diversifying 15% of your Amazon position over the next 2 vesting cycles would improve your worst-case outcome by approximately $340,000 at year {params.years}.&rdquo;
            </p>
          </Card>
        </div>

        {/* Variables Panel (collapsible sidebar) */}
        {showVariables && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="hidden lg:block flex-shrink-0"
          >
            <Card delay={0.1} className="sticky top-20 space-y-5 text-sm">
              <h4 className="font-display text-base text-text-primary">Variables</h4>

              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">Portfolio</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-text-secondary">Starting value</label>
                    <input type="text" value={formatCurrency(params.startingPortfolio)} readOnly className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs number-display text-text-primary mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary">Annual contribution</label>
                    <input type="text" value={`$${params.annualContribution.toLocaleString()}`} onChange={e => setParams(p => ({ ...p, annualContribution: parseInt(e.target.value.replace(/\D/g, '')) || 0 }))} className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs number-display text-text-primary mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary">Allocation (equity/bond): {Math.round(params.equityPct * 100)}/{Math.round(params.bondPct * 100)}</label>
                    <input type="range" min={0} max={100} value={params.equityPct * 100} onChange={e => { const eq = Number(e.target.value) / 100; setParams(p => ({ ...p, equityPct: eq, bondPct: 1 - eq })); }} className="w-full accent-accent" />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary">Inflation: {(params.inflationRate * 100).toFixed(1)}%</label>
                    <input type="range" min={1} max={6} step={0.5} value={params.inflationRate * 100} onChange={e => setParams(p => ({ ...p, inflationRate: Number(e.target.value) / 100 }))} className="w-full accent-accent" />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">Expenses</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-text-secondary">Current annual spend</label>
                    <input type="text" value={`$${params.annualSpend.toLocaleString()}`} onChange={e => setParams(p => ({ ...p, annualSpend: parseInt(e.target.value.replace(/\D/g, '')) || 0 }))} className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs number-display text-text-primary mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary">Retirement spend</label>
                    <input type="text" value={`$${params.retirementSpend.toLocaleString()}`} onChange={e => setParams(p => ({ ...p, retirementSpend: parseInt(e.target.value.replace(/\D/g, '')) || 0 }))} className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs number-display text-text-primary mt-0.5" />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">FIRE Parameters</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-text-secondary">FIRE number</label>
                    <input type="text" value={`$${params.fireNumber.toLocaleString()}`} onChange={e => setParams(p => ({ ...p, fireNumber: parseInt(e.target.value.replace(/\D/g, '')) || 0 }))} className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs number-display text-text-primary mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary">Projection years: {params.years}</label>
                    <input type="range" min={10} max={40} value={params.years} onChange={e => setParams(p => ({ ...p, years: Number(e.target.value) }))} className="w-full accent-accent" />
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>

      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Monte Carlo simulations are for illustrative purposes and do not guarantee future results.
      </div>
    </div>
  );
}
