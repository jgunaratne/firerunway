'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  Label,
} from 'recharts';
import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import AIAnalysis from '@/components/shared/AIAnalysis';
import { formatCurrency } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';

import { usePageContext } from '@/lib/PageContextProvider';

import { useNetWorth } from '@/hooks/useNetWorth';
import {
  Briefcase, GraduationCap, TrendingDown, DollarSign,
  Heart, Home as HomeIcon, Calendar,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface LifeEvent {
  id: string;
  type: 'quit' | 'layoff' | 'college' | 'purchase' | 'windfall' | 'expense';
  label: string;
  iconLabel: string;
  year: number;
  params: Record<string, number>;
}

interface SimParams {
  // Liquid investments
  startingPortfolio: number;
  annualContribution: number;
  annualSpend: number;
  retirementSpend: number;
  // Home
  homeValue: number;
  mortgageBalance: number;
  annualMortgagePayment: number; // total annual payment (P&I)
  mortgageRate: number; // annual interest rate
  homeMaintenanceRate: number; // annual % of home value spent on maintenance
  includeHome: boolean;
  // Distribution params
  muStock: number;
  sigmaStock: number;
  muHome: number;
  sigmaHome: number;
  rho: number; // correlation coefficient
  // Retirement
  retirementYear: number | null; // calendar year when contributions stop
  // General
  inflationRate: number;
  years: number;
  fireNumber: number;
  lifeEvents: LifeEvent[];
}

interface PercentileSet {
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
}

interface SimResult {
  // Total net worth percentiles (stock + home)
  percentiles: PercentileSet;
  // Component breakdowns (median paths)
  stockMedian: number[];
  homeMedian: number[];
  // Liquidity-based success rate (stock > $0)
  successRate: number;
  // Legacy value = median total net worth at end
  medianLegacyValue: number;
  // Median liquid portfolio at end
  medianLiquidValue: number;
}

// ─── localStorage persistence ───────────────────────────────────────

const STORAGE_KEY = 'firerunway_mc_params_v2';
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

// ─── Correlated Dual-Asset Simulation Engine (Cholesky) ─────────────

function runMonteCarloSync(params: SimParams): SimResult {
  const NUM_SIMS = 2000;

  // Distribution parameters
  const { muStock, sigmaStock, muHome, sigmaHome, rho } = params;

  // Cholesky decomposition of 2x2 covariance matrix
  // Σ = [[σs², ρσsσh], [ρσsσh, σh²]]
  // L = [[σs, 0], [ρσh, σh√(1-ρ²)]]
  const L11 = sigmaStock;
  const L21 = rho * sigmaHome;
  const L22 = sigmaHome * Math.sqrt(1 - rho * rho);

  // Box-Muller: generate a pair of independent standard normals
  function boxMullerPair(): [number, number] {
    const u1 = Math.random(), u2 = Math.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    return [r * Math.cos(2 * Math.PI * u2), r * Math.sin(2 * Math.PI * u2)];
  }

  const allStockRuns: number[][] = [];
  const allHomeRuns: number[][] = [];
  const allTotalRuns: number[][] = [];
  let successes = 0;

  for (let sim = 0; sim < NUM_SIMS; sim++) {
    let stockVal = params.startingPortfolio;
    let homeVal = params.includeHome ? params.homeValue : 0;
    let mortgage = params.includeHome ? params.mortgageBalance : 0;
    let failed = false;

    // Home equity = home value - mortgage
    const homeEquity0 = Math.max(homeVal - mortgage, 0);
    const stockValues: number[] = [stockVal];
    const homeEquityValues: number[] = [homeEquity0];
    const totalValues: number[] = [stockVal + homeEquity0];
    let spend = params.annualSpend;
    let isRetired = false;

    for (let year = 1; year <= params.years; year++) {
      // Generate correlated returns via Cholesky
      const [z1, z2] = boxMullerPair();
      const rStock = muStock + L11 * z1;
      const rHome = muHome + L21 * z1 + L22 * z2;

      const currentYear = new Date().getFullYear() + year;

      // Check if retirement year has been reached
      if (params.retirementYear && currentYear >= params.retirementYear) {
        isRetired = true;
      }

      let contrib = isRetired ? 0 : params.annualContribution;
      let yearSpend = isRetired ? params.retirementSpend : spend;

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

      // Liquid investments: grows by stock return, plus contributions, minus spending
      stockVal = stockVal * (1 + rStock) + contrib - yearSpend;

      // Home: full value appreciates, minus maintenance costs
      const maintenanceCost = homeVal * params.homeMaintenanceRate;
      homeVal = homeVal * (1 + rHome) - maintenanceCost;
      homeVal = Math.max(homeVal, 0);

      // Mortgage: pay down principal (payment minus interest)
      if (mortgage > 0) {
        const interestPayment = mortgage * params.mortgageRate;
        const principalPayment = Math.min(params.annualMortgagePayment - interestPayment, mortgage);
        mortgage = Math.max(mortgage - principalPayment, 0);
      }

      // Home equity = home value - remaining mortgage
      const homeEquity = Math.max(homeVal - mortgage, 0);

      // Inflation-adjust spend
      spend *= (1 + params.inflationRate);

      stockValues.push(Math.max(stockVal, 0));
      homeEquityValues.push(homeEquity);
      totalValues.push(Math.max(stockVal, 0) + homeEquity);

      // Success = liquid portfolio never goes to $0
      if (stockVal <= 0) {
        failed = true;
        for (let r = year + 1; r <= params.years; r++) {
          stockValues.push(0);
          // Continue home appreciation and mortgage paydown even after liquid runs out
          const hv = homeEquityValues[homeEquityValues.length - 1];
          homeEquityValues.push(Math.max(hv * (1 + muHome), 0));
          totalValues.push(homeEquityValues[homeEquityValues.length - 1]);
        }
        break;
      }
    }
    if (!failed) successes++;
    allStockRuns.push(stockValues);
    allHomeRuns.push(homeEquityValues);
    allTotalRuns.push(totalValues);
  }

  // Compute percentiles for total net worth
  const percentiles: PercentileSet = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  const stockMedian: number[] = [];
  const homeMedian: number[] = [];

  for (let y = 0; y <= params.years; y++) {
    const totalVals = allTotalRuns.map(r => r[y]).sort((a, b) => a - b);
    percentiles.p10.push(totalVals[Math.floor(NUM_SIMS * 0.10)]);
    percentiles.p25.push(totalVals[Math.floor(NUM_SIMS * 0.25)]);
    percentiles.p50.push(totalVals[Math.floor(NUM_SIMS * 0.50)]);
    percentiles.p75.push(totalVals[Math.floor(NUM_SIMS * 0.75)]);
    percentiles.p90.push(totalVals[Math.floor(NUM_SIMS * 0.90)]);

    const sVals = allStockRuns.map(r => r[y]).sort((a, b) => a - b);
    stockMedian.push(sVals[Math.floor(NUM_SIMS * 0.50)]);

    const hVals = allHomeRuns.map(r => r[y]).sort((a, b) => a - b);
    homeMedian.push(hVals[Math.floor(NUM_SIMS * 0.50)]);
  }

  return {
    percentiles,
    stockMedian,
    homeMedian,
    successRate: successes / NUM_SIMS,
    medianLegacyValue: percentiles.p50[params.years],
    medianLiquidValue: stockMedian[params.years],
  };
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

function CustomFanTooltip({ active, payload, label, birthYear }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color?: string; fill?: string; stroke?: string }>;
  label?: string;
  birthYear?: number | null;
}) {
  if (!active || !payload?.length) return null;
  const yearNum = Number(label);
  const age = birthYear && yearNum ? yearNum - birthYear : null;

  // Define a display order and colors for clarity
  const colorMap: Record<string, string> = {
    'Total Net Worth': '#6366f1',
    '90th pctile': 'rgba(99,102,241,0.4)',
    '75th pctile': 'rgba(99,102,241,0.6)',
    'Median': '#6366f1',
    '25th pctile': 'rgba(99,102,241,0.4)',
    '10th pctile': 'rgba(99,102,241,0.3)',
    'Liquid Investments': '#818cf8',
    'Home Equity': '#f59e0b',
  };

  return (
    <div className="tooltip-content min-w-[200px]">
      <p className="text-sm text-text-secondary mb-2">
        {label}{age ? ` (age ${age})` : ''}
      </p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between text-sm gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: colorMap[p.name] || p.stroke || p.fill || '#6366f1' }} />
            <span className="text-text-secondary">{p.name}</span>
          </span>
          <span className="number-display text-text-primary font-medium">{formatCurrency(p.value, true)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function MonteCarloPage() {
  const { profile, realEstate, isLoading, uid, refresh } = useUserData();
  const { investable: netWorthInvestable,
          totalPropertyValue, totalMortgageDebt } = useNetWorth();
  const [savingProfile, setSavingProfile] = useState(false);
  const fireNumberTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use useNetWorth as single source of truth for starting values (matches TopBar)
  const homeValue = totalPropertyValue;
  const mortgageBalance = totalMortgageDebt;
  const mortgageRate = realEstate[0]?.mortgage_rate ? realEstate[0].mortgage_rate / 100 : 0.04;
  const annualMortgagePayment = realEstate.reduce((sum, p) => sum + ((p.monthly_payment ?? 0) * 12), 0);
  const basePortfolio = netWorthInvestable;
  const annualSpend = profile?.annual_spend || 0;
  const annualIncome = profile?.annual_income || 0;
  const fireNumber = profile?.fire_number || 0;
  const savingsRate = annualIncome > 0 ? (annualIncome - annualSpend) / annualIncome : 0.3;
  const currentYear = new Date().getFullYear();
  const birthYear = profile?.birth_year || null;
  const currentAge = birthYear ? currentYear - birthYear : null;

  const updateProfileField = useCallback(async (field: string, value: number | null) => {
    if (!uid) return;
    setSavingProfile(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, [field]: value }),
      });
      if (res.ok) await refresh();
    } catch (err) {
      console.error('Profile update error:', err);
    } finally {
      setSavingProfile(false);
    }
  }, [uid, refresh]);

  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [params, setParams] = useState<SimParams>({
    startingPortfolio: basePortfolio || 500000,
    annualContribution: Math.round(annualIncome * savingsRate),
    annualSpend,
    retirementSpend: Math.round(annualSpend * 0.8),
    homeValue: homeValue || 0,
    mortgageBalance: mortgageBalance || 0,
    annualMortgagePayment: annualMortgagePayment || 0,
    mortgageRate: mortgageRate,
    homeMaintenanceRate: 0.01,
    includeHome: homeValue > 0,
    muStock: 0.08,
    sigmaStock: 0.18,
    muHome: 0.04,
    sigmaHome: 0.04,
    rho: 0.20,
    retirementYear: null,
    inflationRate: 0.03,
    years: 25,
    fireNumber: fireNumber,
    lifeEvents: [],
  });
  const [dataSeeded, setDataSeeded] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [scenarios, setScenarios] = useState<{ name: string; result: SimResult }[]>([]);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [birthDate, setBirthDate] = useState<string>(
    birthYear ? `${birthYear}-01-01` : ''
  );

  // Sync birthDate when profile loads asynchronously
  useEffect(() => {
    if (birthYear && !birthDate) {
      setBirthDate(`${birthYear}-01-01`);
    }
  }, [birthYear, birthDate]);

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

  // Sync params when real data finishes loading
  useEffect(() => {
    if (!isLoading && !dataSeeded && (basePortfolio > 0 || profile)) {
      const saved = loadSavedParams();
      // Always sync financial facts from real data — these change over time
      // Only preserve user-configured settings (distribution params, etc.) from save
      const financialFacts = {
        startingPortfolio: basePortfolio || 0,
        homeValue: homeValue || 0,
        mortgageBalance: mortgageBalance || 0,
        annualMortgagePayment: annualMortgagePayment || 0,
        mortgageRate: mortgageRate,
        includeHome: homeValue > 0,
      };
      if (!saved) {
        setParams(prev => ({
          ...prev,
          ...financialFacts,
          annualContribution: Math.round(annualIncome * savingsRate),
          annualSpend,
          retirementSpend: Math.round(annualSpend * 0.8),
          fireNumber,
        }));
      } else {
        // Merge saved user preferences with fresh financial data
        setParams(prev => ({
          ...prev,
          ...financialFacts,
        }));
      }
      setDataSeeded(true);
    }
  }, [isLoading, dataSeeded, basePortfolio, homeValue, mortgageBalance, annualMortgagePayment, mortgageRate, annualIncome, annualSpend, savingsRate, fireNumber, profile]);

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

  const ageAtYear = useCallback((yr: number) => birthYear ? yr - birthYear : null, [birthYear]);

  // Report simulation data to ChatRail via PageContextProvider
  const { setPageContext } = usePageContext();
  useEffect(() => {
    const parts = [
      `Monte Carlo Simulation (Correlated Dual-Asset Model):`,
      `  Liquid Portfolio: $${params.startingPortfolio.toLocaleString()}`,
      `  Home Value: $${params.homeValue.toLocaleString()} (${params.includeHome ? 'included' : 'excluded'})`,
      `  Annual Contribution: $${params.annualContribution.toLocaleString()}`,
      `  Annual Spend: $${params.annualSpend.toLocaleString()}`,
      `  Retirement Spend: $${params.retirementSpend.toLocaleString()}`,
      `  Stock Return: μ=${(params.muStock * 100).toFixed(1)}% σ=${(params.sigmaStock * 100).toFixed(0)}%`,
      `  Home Return: μ=${(params.muHome * 100).toFixed(1)}% σ=${(params.sigmaHome * 100).toFixed(0)}%`,
      `  Correlation (ρ): ${params.rho}`,
      `  Inflation Rate: ${(params.inflationRate * 100).toFixed(1)}%`,
      `  Home Maintenance: ${(params.homeMaintenanceRate * 100).toFixed(1)}%/yr`,
      `  Projection Years: ${params.years}`,
      `  FIRE Number: $${params.fireNumber.toLocaleString()}`,
      ``,
      `Simulation Results (2,000 runs):`,
      `  Liquidity Success Rate: ${(result.successRate * 100).toFixed(1)}% (stock never hits $0)`,
      `  Median Legacy (Total NW): $${Math.round(result.medianLegacyValue).toLocaleString()}`,
      `  Median Liquid Portfolio: $${Math.round(result.medianLiquidValue).toLocaleString()}`,
      `  10th Percentile (worst): $${Math.round(result.percentiles.p10[params.years]).toLocaleString()}`,
      `  25th Percentile (conservative): $${Math.round(result.percentiles.p25[params.years]).toLocaleString()}`,
      `  75th Percentile (optimistic): $${Math.round(result.percentiles.p75[params.years]).toLocaleString()}`,
      `  90th Percentile (best): $${Math.round(result.percentiles.p90[params.years]).toLocaleString()}`,
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

    const step = params.years > 30 ? 2 : 1;
    parts.push(``);
    parts.push(`Year-by-Year Total Net Worth (Year | p10 | p25 | Median | p75 | p90 | Liquid | Home):`);
    for (let y = 0; y <= params.years; y += step) {
      const yr = currentYear + y;
      const fmt = (v: number) => `$${Math.round(v).toLocaleString()}`;
      parts.push(`  ${yr}: ${fmt(result.percentiles.p10[y])} | ${fmt(result.percentiles.p25[y])} | ${fmt(result.percentiles.p50[y])} | ${fmt(result.percentiles.p75[y])} | ${fmt(result.percentiles.p90[y])} | ${fmt(result.stockMedian[y])} | ${fmt(result.homeMedian[y])}`);
    }
    if (params.years % step !== 0) {
      const y = params.years;
      const yr = currentYear + y;
      const fmt = (v: number) => `$${Math.round(v).toLocaleString()}`;
      parts.push(`  ${yr}: ${fmt(result.percentiles.p10[y])} | ${fmt(result.percentiles.p25[y])} | ${fmt(result.percentiles.p50[y])} | ${fmt(result.percentiles.p75[y])} | ${fmt(result.percentiles.p90[y])} | ${fmt(result.stockMedian[y])} | ${fmt(result.homeMedian[y])}`);
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
        stockMedian: result.stockMedian[y],
        homeMedian: result.homeMedian[y],
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
  }, []);

  const handleAnalyze = useCallback(async () => {
    const res = await fetch(`/api/monte-carlo/analyze?uid=${uid || ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        params,
        result: {
          successRate: result.successRate,
          medianLegacyValue: result.medianLegacyValue,
          medianLiquidValue: result.medianLiquidValue,
          p10End: result.percentiles.p10[params.years],
          p25End: result.percentiles.p25[params.years],
          p75End: result.percentiles.p75[params.years],
          p90End: result.percentiles.p90[params.years],
          stockMedianEnd: result.stockMedian[params.years],
          homeMedianEnd: result.homeMedian[params.years],
        },
        fireYear,
        conservativeFireYear,
        lifeEvents: events,
      }),
    });
    if (!res.ok) throw new Error('Analysis failed');
    return res.json();
  }, [params, result, fireYear, conservativeFireYear, events, uid]);

  // Toggle between total net worth fan chart and component breakdown view
  const [chartView, setChartView] = useState<'fan' | 'breakdown'>('fan');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Monte Carlo Simulator</h1>
          <p className="page-subtitle">Correlated dual-asset projection — stocks + home</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Birth Date Input — always visible */}
          <div className="flex items-center gap-2 px-3 py-1.5 glass-card rounded-lg">
            <Calendar size={14} className="text-accent" />
            <label className="text-sm text-text-secondary whitespace-nowrap">Born:</label>
            <input
              type="date"
              value={birthDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => {
                const val = e.target.value;
                setBirthDate(val);
                if (val) {
                  const yr = parseInt(val.split('-')[0]);
                  if (yr >= 1940 && yr <= currentYear) {
                    updateProfileField('birth_year', yr);
                  }
                } else {
                  updateProfileField('birth_year', null);
                }
              }}
              className="bg-bg-elevated border border-border rounded px-2 py-1 text-sm number-display text-text-primary"
            />
            {currentAge !== null && (
              <span className="text-sm text-accent font-semibold whitespace-nowrap">Age {currentAge}</span>
            )}
            {savingProfile && <span className="text-xs text-accent animate-pulse">Saving...</span>}
          </div>
          <button
            onClick={() => setShowVariables(!showVariables)}
            className="tab-button text-sm"
          >
            {showVariables ? 'Hide' : 'Show'} Variables ⚙️
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 space-y-8 min-w-0">
          {/* Fan Chart */}
          <Card>
            <div className="flex items-center justify-between mb-1">
              <h3 className="section-title mb-0">
                {chartView === 'fan' ? 'Total Net Worth' : 'Asset Breakdown'} — {params.years} Years
                {currentAge ? <span className="text-text-secondary font-normal text-sm ml-2">(age {currentAge} → {currentAge + params.years})</span> : null}
              </h3>
              <div className="flex gap-1 p-0.5 bg-bg-elevated rounded-lg border border-border">
                <button
                  onClick={() => setChartView('fan')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartView === 'fan' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  Fan Chart
                </button>
                <button
                  onClick={() => setChartView('breakdown')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartView === 'breakdown' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  Breakdown
                </button>
              </div>
            </div>
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
                    <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="homeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="year"
                    stroke="var(--border)"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.max(Math.floor(params.years / 6) - 1, 0)}
                    tickFormatter={(yr) => {
                      const age = birthYear ? yr - birthYear : null;
                      return age ? `'${String(yr).slice(2)} (${age})` : `'${String(yr).slice(2)}`;
                    }}
                  />
                  <YAxis stroke="var(--border)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} tickLine={false} axisLine={false} width={60} />
                  <Tooltip content={<CustomFanTooltip birthYear={birthYear} />} />
                  <ReferenceLine y={params.fireNumber} stroke="#10b981" strokeDasharray="6 4" strokeWidth={2} label={{ value: `FIRE: ${formatCurrency(params.fireNumber, true)}`, position: 'right', fill: '#10b981', fontSize: 11 }} />
                  {/* Current age marker */}
                  {currentAge !== null && (
                    <ReferenceLine x={currentYear} stroke="#f472b6" strokeWidth={2} strokeDasharray="3 3">
                      <Label value={`You (${currentAge})`} position="insideTopLeft" fill="#f472b6" fontSize={12} fontWeight={600} offset={8} />
                    </ReferenceLine>
                  )}
                  {/* Event markers */}
                  {events.map(evt => (
                    <ReferenceLine key={evt.id} x={evt.year} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} label={{ value: evt.iconLabel, position: 'top', fontSize: 11 }} />
                  ))}

                  {/* Retirement year marker */}
                  {params.retirementYear && params.retirementYear > currentYear && params.retirementYear <= currentYear + params.years && (
                    <ReferenceLine
                      x={params.retirementYear}
                      stroke="#f97316"
                      strokeDasharray="6 3"
                      strokeWidth={1.5}
                      label={{
                        value: birthYear ? `Retire (${params.retirementYear - birthYear})` : `Retire ${params.retirementYear}`,
                        position: 'top',
                        fill: '#f97316',
                        fontSize: 11,
                      }}
                    />
                  )}
                  {chartView === 'fan' ? (
                    <>
                      <Area type="monotone" dataKey="p90" stroke="none" fill="url(#p90grad)" name="90th pctile" isAnimationActive={false} />
                      <Area type="monotone" dataKey="p75" stroke="none" fill="url(#p75grad)" name="75th pctile" isAnimationActive={false} />
                      <Area type="monotone" dataKey="p50" stroke="#6366f1" strokeWidth={2.5} fill="url(#p50grad)" name="Median" isAnimationActive={false} />
                      <Area type="monotone" dataKey="p25" stroke="none" fill="rgba(99,102,241,0.06)" name="25th pctile" isAnimationActive={false} />
                      <Area type="monotone" dataKey="p10" stroke="rgba(99,102,241,0.3)" strokeWidth={1} strokeDasharray="4 4" fill="none" name="10th pctile" isAnimationActive={false} />
                    </>
                  ) : (
                    <>
                      <Area type="monotone" dataKey="stockMedian" stackId="breakdown" stroke="#818cf8" strokeWidth={2} fill="url(#stockGrad)" name="Liquid Investments" isAnimationActive={false} />
                      <Area type="monotone" dataKey="homeMedian" stackId="breakdown" stroke="#f59e0b" strokeWidth={2} fill="url(#homeGrad)" name="Home Equity" isAnimationActive={false} />
                    </>
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Chart legend */}
            {chartView === 'breakdown' && (
              <div className="flex items-center justify-center gap-6 mt-3 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-1.5 rounded-sm bg-[#818cf8]" /> Liquid Investments (median)</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-1.5 rounded-sm bg-[#f59e0b]" /> Home Equity (median)</span>
              </div>
            )}
          </Card>

          {/* Outcome Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="text-center">
              <p className="stat-label mb-2">Liquidity Success</p>
              <p className="number-display text-2xl font-bold text-emerald-400 glow-text-green">
                <AnimatedNumber value={Math.round(result.successRate * 100)} suffix="%" />
              </p>
              <p className="text-xs text-text-secondary mt-1">Stock &gt; $0</p>
            </Card>
            <Card className="text-center">
              <p className="stat-label mb-2">Legacy Value</p>
              <p className="number-display text-2xl font-bold text-text-primary glow-text">
                <AnimatedNumber value={result.medianLegacyValue} format={(n) => formatCurrency(n, true)} />
              </p>
              <p className="text-xs text-text-secondary mt-1">Total NW at yr {params.years}</p>
            </Card>
            <Card className="text-center">
              <p className="stat-label mb-2">Liquid at Yr {params.years}</p>
              <p className="number-display text-2xl font-bold text-indigo-400">
                <AnimatedNumber value={result.medianLiquidValue} format={(n) => formatCurrency(n, true)} />
              </p>
            </Card>
            <Card className="text-center">
              <p className="stat-label mb-2">Conservative FI</p>
              <p className="number-display text-2xl font-bold text-accent-amber glow-text-amber">
                {conservativeFireYear || 'N/A'}
              </p>
              {conservativeFireYear && ageAtYear(conservativeFireYear) && (
                <p className="text-xs text-text-secondary mt-1">Age {ageAtYear(conservativeFireYear)}</p>
              )}
            </Card>
            <Card className="text-center">
              <p className="text-sm text-text-secondary">Base Case FI</p>
              <p className="number-display text-2xl font-bold text-accent">
                {fireYear || 'N/A'}
              </p>
              {fireYear && ageAtYear(fireYear) && (
                <p className="text-xs text-text-secondary mt-1">Age {ageAtYear(fireYear)}</p>
              )}
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
                      <th className="text-right pb-2 font-medium">Legacy (yr {params.years})</th>
                      <th className="text-right pb-2 font-medium">Liquid</th>
                      <th className="text-right pb-2 font-medium">10th pct</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((s, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 text-text-primary">{s.name}</td>
                        <td className="py-2 text-right number-display">{(s.result.successRate * 100).toFixed(0)}%</td>
                        <td className="py-2 text-right number-display">{formatCurrency(s.result.medianLegacyValue, true)}</td>
                        <td className="py-2 text-right number-display">{formatCurrency(s.result.medianLiquidValue, true)}</td>
                        <td className="py-2 text-right number-display">{formatCurrency(s.result.percentiles.p10[params.years], true)}</td>
                      </tr>
                    ))}
                    {/* Current */}
                    <tr className="border-t border-accent/30 bg-accent/5">
                      <td className="py-2 text-accent font-medium">Current</td>
                      <td className="py-2 text-right number-display text-accent">{(result.successRate * 100).toFixed(0)}%</td>
                      <td className="py-2 text-right number-display text-accent">{formatCurrency(result.medianLegacyValue, true)}</td>
                      <td className="py-2 text-right number-display text-accent">{formatCurrency(result.medianLiquidValue, true)}</td>
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

              {/* Liquid Portfolio */}
              <div>
                <p className="text-sm text-text-secondary mb-2">Liquid Portfolio</p>
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
                    <label className="text-sm text-text-secondary">Stop contributions at{birthYear ? ' (age)' : ' (year)'}</label>
                    <div className="flex items-center gap-2 mt-0.5">
                      <input
                        type="number"
                        value={params.retirementYear ? (birthYear ? params.retirementYear - birthYear : params.retirementYear) : ''}
                        placeholder={birthYear ? 'e.g. 65' : `e.g. ${currentYear + 20}`}
                        onChange={e => {
                          const val = parseInt(e.target.value);
                          if (!e.target.value) {
                            setParams(p => ({ ...p, retirementYear: null }));
                          } else if (birthYear) {
                            setParams(p => ({ ...p, retirementYear: birthYear + val }));
                          } else {
                            setParams(p => ({ ...p, retirementYear: val }));
                          }
                        }}
                        className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-sm number-display text-text-primary"
                      />
                      {params.retirementYear && (
                        <button
                          onClick={() => setParams(p => ({ ...p, retirementYear: null }))}
                          className="text-xs text-text-secondary hover:text-accent-red transition-colors shrink-0"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-text-secondary/60 mt-0.5">
                      {params.retirementYear
                        ? `Contributions stop in ${params.retirementYear}${birthYear ? ` (age ${params.retirementYear - birthYear})` : ''}, then spend $${params.retirementSpend.toLocaleString()}/yr`
                        : 'Leave empty to contribute for the full period'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Home */}
              <div className="border-t border-border pt-4">
                <p className="text-sm text-text-secondary mb-2">Primary Residence</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--overlay-subtle)] border border-border/50">
                    <div>
                      <p className="text-sm text-text-primary font-medium">Include home</p>
                      <p className="text-sm text-text-secondary">{formatCurrency(params.homeValue, true)}</p>
                    </div>
                    <button
                      onClick={() => setParams(p => ({ ...p, includeHome: !p.includeHome }))}
                      className={`relative inline-flex h-5 w-10 flex-shrink-0 rounded-full transition-colors ${params.includeHome ? 'bg-accent' : 'bg-[var(--overlay-border)]'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${params.includeHome ? 'ml-[22px]' : 'ml-0.5'}`} />
                    </button>
                  </div>
                  {params.includeHome && (
                    <>
                      <div>
                        <label className="text-sm text-text-secondary">Home value</label>
                        <input type="text" value={`$${params.homeValue.toLocaleString()}`} onChange={e => setParams(p => ({ ...p, homeValue: parseInt(e.target.value.replace(/\D/g, '')) || 0 }))} className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-sm number-display text-text-primary mt-0.5" />
                      </div>
                      <div>
                        <label className="text-sm text-text-secondary">Maintenance: {(params.homeMaintenanceRate * 100).toFixed(1)}%/yr</label>
                        <input type="range" min={0} max={3} step={0.1} value={params.homeMaintenanceRate * 100} onChange={e => setParams(p => ({ ...p, homeMaintenanceRate: Number(e.target.value) / 100 }))} className="w-full accent-accent" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Distribution Parameters */}
              <div className="border-t border-border pt-4">
                <p className="text-sm text-text-secondary mb-2">Return Distributions</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm text-text-secondary">Stock return (μ): {(params.muStock * 100).toFixed(1)}%</label>
                    <input type="range" min={2} max={15} step={0.5} value={params.muStock * 100} onChange={e => setParams(p => ({ ...p, muStock: Number(e.target.value) / 100 }))} className="w-full accent-accent" />
                  </div>
                  <div>
                    <label className="text-sm text-text-secondary">Stock volatility (σ): {(params.sigmaStock * 100).toFixed(0)}%</label>
                    <input type="range" min={5} max={35} step={1} value={params.sigmaStock * 100} onChange={e => setParams(p => ({ ...p, sigmaStock: Number(e.target.value) / 100 }))} className="w-full accent-accent" />
                  </div>
                  {params.includeHome && (
                    <>
                      <div>
                        <label className="text-sm text-text-secondary">Home return (μ): {(params.muHome * 100).toFixed(1)}%</label>
                        <input type="range" min={0} max={8} step={0.5} value={params.muHome * 100} onChange={e => setParams(p => ({ ...p, muHome: Number(e.target.value) / 100 }))} className="w-full accent-amber-400" />
                      </div>
                      <div>
                        <label className="text-sm text-text-secondary">Home volatility (σ): {(params.sigmaHome * 100).toFixed(0)}%</label>
                        <input type="range" min={1} max={15} step={1} value={params.sigmaHome * 100} onChange={e => setParams(p => ({ ...p, sigmaHome: Number(e.target.value) / 100 }))} className="w-full accent-amber-400" />
                      </div>
                      <div>
                        <label className="text-sm text-text-secondary">Correlation (ρ): {params.rho.toFixed(2)}</label>
                        <input type="range" min={-50} max={80} step={5} value={params.rho * 100} onChange={e => setParams(p => ({ ...p, rho: Number(e.target.value) / 100 }))} className="w-full accent-accent" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Expenses */}
              <div className="border-t border-border pt-4">
                <p className="text-sm text-text-secondary mb-2">Expenses</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm text-text-secondary">Current annual spend</label>
                    <input type="text" value={`$${params.annualSpend.toLocaleString()}`} onChange={e => setParams(p => ({ ...p, annualSpend: parseInt(e.target.value.replace(/\D/g, '')) || 0 }))} className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-sm number-display text-text-primary mt-0.5" />
                  </div>
                  <div>
                    <label className="text-sm text-text-secondary">Retirement spend</label>
                    <input type="text" value={`$${params.retirementSpend.toLocaleString()}`} onChange={e => setParams(p => ({ ...p, retirementSpend: parseInt(e.target.value.replace(/\D/g, '')) || 0 }))} className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-sm number-display text-text-primary mt-0.5" />
                  </div>
                  <div>
                    <label className="text-sm text-text-secondary">Inflation: {(params.inflationRate * 100).toFixed(1)}%</label>
                    <input type="range" min={1} max={6} step={0.5} value={params.inflationRate * 100} onChange={e => setParams(p => ({ ...p, inflationRate: Number(e.target.value) / 100 }))} className="w-full accent-accent" />
                  </div>
                </div>
              </div>

              {/* FIRE Parameters */}
              <div className="border-t border-border pt-4">
                <p className="text-sm text-text-secondary mb-2">FIRE Parameters</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm text-text-secondary">FIRE number</label>
                    <input type="text" value={`$${params.fireNumber.toLocaleString()}`} onChange={e => {
                      const val = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                      setParams(p => ({ ...p, fireNumber: val }));
                      // Debounce profile save
                      if (fireNumberTimerRef.current) clearTimeout(fireNumberTimerRef.current);
                      fireNumberTimerRef.current = setTimeout(() => {
                        updateProfileField('fire_number', val);
                      }, 500);
                    }} className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-sm number-display text-text-primary mt-0.5" />
                    <p className="text-[11px] text-text-secondary/60 mt-0.5">Synced across all pages</p>
                  </div>
                  <div>
                    <label className="text-sm text-text-secondary">Projection years: {params.years}{currentAge ? ` (to age ${currentAge + params.years})` : ''}</label>
                    <input type="range" min={10} max={50} value={params.years} onChange={e => setParams(p => ({ ...p, years: Number(e.target.value) }))} className="w-full accent-accent" />
                  </div>
                </div>
              </div>

              {/* Personal */}
              <div className="border-t border-border pt-4">
                <p className="text-sm text-text-secondary mb-2">Personal</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm text-text-secondary">Birth year{currentAge ? ` (age ${currentAge})` : ''}</label>
                    <input
                      type="number"
                      placeholder="e.g. 1990"
                      value={birthYear || ''}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        if (val >= 1940 && val <= currentYear) {
                          updateProfileField('birth_year', val);
                        } else if (e.target.value === '') {
                          updateProfileField('birth_year', null);
                        }
                      }}
                      className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-sm number-display text-text-primary mt-0.5"
                    />
                    {savingProfile && <p className="text-xs text-accent animate-pulse mt-0.5">Saving...</p>}
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
