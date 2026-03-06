'use client';

import { useState, useMemo, useEffect } from 'react';
import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { useBrokerageData } from '@/lib/BrokerageDataContext';

function ConcentrationGauge({ pct, size = 220 }: { pct: number; size?: number }) {
  const radius = (size - 28) / 2;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - Math.min(pct / 50, 1));
  const color = pct <= 15 ? '#10b981' : pct <= 25 ? '#f59e0b' : '#ef4444';
  const glowColor = pct <= 15 ? 'rgba(16,185,129,0.4)' : pct <= 25 ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)';
  const label = pct <= 15 ? 'Well diversified' : pct <= 25 ? 'Moderate concentration' : 'High concentration risk';

  return (
    <div className="flex flex-col items-center relative">
      {/* Ambient glow */}
      <div
        className="absolute top-0 w-40 h-24 rounded-full blur-3xl opacity-25 pulse-glow"
        style={{ background: glowColor }}
      />
      <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
        <path
          d={`M 14,${size / 2 + 14} A ${radius},${radius} 0 0,1 ${size - 14},${size / 2 + 14}`}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" strokeLinecap="round"
        />
        <path
          d={`M 14,${size / 2 + 14} A ${radius},${radius} 0 0,1 ${size - 14},${size / 2 + 14}`}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 10px ${glowColor})` }}
        />
        <text x={size / 2} y={size / 2 - 5} textAnchor="middle" className="number-display" fill={color} fontSize="38" fontWeight="bold">
          {pct.toFixed(0)}%
        </text>
        <text x={size / 2} y={size / 2 + 18} textAnchor="middle" fill="#7878a0" fontSize="12" fontWeight="500">
          of net worth
        </text>
      </svg>
      <p className="text-sm mt-1 font-medium" style={{ color }}>{label}</p>
    </div>
  );
}

export default function EquityPage() {
  const { rsuGrants, realEstate, clerkId: userId } = useUserData();
  const { totalInvestment } = useBrokerageData();
  const [priceAdjust, setPriceAdjust] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(190);

  // Use first grant's ticker for price lookup (default AMZN)
  const ticker = rsuGrants[0]?.company_ticker || 'AMZN';

  // Fetch real stock price from our API
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/stock/${ticker}`);
        const data = await res.json();
        if (data.price) setCurrentPrice(data.price);
      } catch {
        // Fall back to default price
      }
    })();
  }, [ticker]);

  const adjustedPrice = currentPrice * (1 + priceAdjust / 100);

  const totalVestedShares = rsuGrants.reduce((s, g) => s + g.vested_shares, 0);
  const totalUnvestedShares = rsuGrants.reduce((s, g) => s + (g.total_shares - g.vested_shares), 0);
  const vestedValue = totalVestedShares * adjustedPrice;
  const unvestedValue = totalUnvestedShares * adjustedPrice;
  const totalRSUValue = vestedValue + unvestedValue;
  const realEstateEquity = realEstate.reduce((sum, p) => sum + (p.current_value - p.mortgage_balance), 0);
  // Include SnapTrade portfolio in net worth for concentration calc
  const netWorth = totalRSUValue + realEstateEquity + totalInvestment;
  const concentrationPct = netWorth > 0 ? (totalRSUValue / netWorth) * 100 : 0;

  // Estimate FIRE date delta
  const monthsDelta = Math.round(priceAdjust * 0.3);

  // Compute vesting events from actual RSU grants
  const adjustedEvents = useMemo(() => {
    const events: { date: string; shares: number; grossValue: number; afterTaxValue: number }[] = [];
    const now = new Date();
    for (const grant of rsuGrants) {
      const unvested = grant.total_shares - grant.vested_shares;
      if (unvested <= 0) continue;
      const freq = grant.vest_frequency === 'monthly' ? 1 : 3;
      const sharesPerVest = Math.round(grant.total_shares / (grant.vest_period_months / freq));
      for (let i = 0; i < 8; i++) {
        const vestDate = new Date(now);
        vestDate.setMonth(vestDate.getMonth() + (i * freq));
        if (sharesPerVest <= 0) break;
        events.push({
          date: vestDate.toISOString().split('T')[0],
          shares: sharesPerVest,
          grossValue: sharesPerVest * adjustedPrice,
          afterTaxValue: sharesPerVest * adjustedPrice * 0.557,
        });
      }
    }
    return events.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  }, [rsuGrants, adjustedPrice]);

  const taxRate = {
    federal: 35,
    state: 9.3,
    total: 44.3,
  };

  return (
    <div className="space-y-8">
      <div
      >
        <h1 className="page-title">Equity / RSUs</h1>
        <p className="page-subtitle">Equity compensation — vesting, concentration, and scenarios</p>
      </div>

      {/* Concentration Gauge */}
      <Card className="text-center py-10 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-accent-amber/[0.04] rounded-full blur-3xl pointer-events-none" />
        <p className="stat-label mb-4 relative z-10">Employer Stock Concentration</p>
        <ConcentrationGauge pct={concentrationPct} />
        <div className="flex justify-center gap-10 mt-5 text-sm relative z-10">
          <div>
            <p className="stat-label">Unvested Value</p>
            <p className="number-display font-bold text-accent-amber glow-text-amber mt-1">
              <AnimatedNumber value={Math.round(unvestedValue)} format={(n) => formatCurrency(n)} />
            </p>
          </div>
          <div>
            <p className="stat-label">Vested Unsold</p>
            <p className="number-display font-bold text-text-primary glow-text mt-1">
              <AnimatedNumber value={Math.round(vestedValue)} format={(n) => formatCurrency(n)} />
            </p>
          </div>
        </div>
      </Card>

      {/* Stock Price Scenario Slider */}
      <Card>
        <h3 className="section-title">Stock Price Scenario</h3>
        <p className="text-sm text-text-secondary mb-4">Drag to see how price changes affect your finances</p>

        <div className="flex items-center justify-between text-sm text-text-secondary mb-2">
          <span>-50%</span>
          <span className="number-display text-lg font-bold text-text-primary">
            AMZN ${adjustedPrice.toFixed(2)}
            {priceAdjust !== 0 && (
              <span className={priceAdjust > 0 ? 'text-emerald-400 ml-2' : 'text-red-400 ml-2'}>
                ({priceAdjust > 0 ? '+' : ''}{priceAdjust}%)
              </span>
            )}
          </span>
          <span>+50%</span>
        </div>
        <input
          type="range"
          min={-50}
          max={50}
          step={1}
          value={priceAdjust}
          onChange={(e) => setPriceAdjust(Number(e.target.value))}
          className="w-full accent-accent"
        />

        {priceAdjust !== 0 && (
          <div
            className="mt-4 grid grid-cols-3 gap-4 text-center"
          >
            <div className="glass-card p-3 rounded-lg">
              <p className="text-sm text-text-secondary">Unvested Value</p>
              <p className="number-display text-sm font-bold text-text-primary">{formatCurrency(unvestedValue)}</p>
            </div>
            <div className="glass-card p-3 rounded-lg">
              <p className="text-sm text-text-secondary">Concentration</p>
              <p className="number-display text-sm font-bold" style={{ color: concentrationPct > 25 ? '#ef4444' : concentrationPct > 15 ? '#f59e0b' : '#10b981' }}>
                {concentrationPct.toFixed(1)}%
              </p>
            </div>
            <div className="glass-card p-3 rounded-lg">
              <p className="text-sm text-text-secondary">FIRE Date Delta</p>
              <p className={`number-display text-sm font-bold ${monthsDelta <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {monthsDelta <= 0 ? '' : '+'}{monthsDelta} months
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Vesting Timeline */}
      <Card>
        <h3 className="section-title">Vesting Timeline — Next 24 Months</h3>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {adjustedEvents.map((event, i) => (
            <div
              key={i}
              className="glass-card p-4 min-w-[180px] flex-shrink-0"
            >
              <p className="text-sm text-text-secondary">
                {new Date(event.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
              <p className="number-display text-lg font-bold text-text-primary mt-1">{event.shares} shares</p>
              <div className="border-t border-border mt-2 pt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Gross</span>
                  <span className="number-display text-text-primary">{formatCurrency(event.grossValue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">After tax</span>
                  <span className="number-display text-emerald-400">{formatCurrency(event.afterTaxValue)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-text-secondary mt-4 border-t border-border pt-3">
          RSUs are taxed as ordinary income at vest. Estimated federal withholding at your bracket: {taxRate.federal}%. State: {taxRate.state}%.
        </p>
      </Card>

      {/* Grant Summary Table */}
      <Card>
        <h3 className="section-title">Grant Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-sm text-text-secondary border-b border-border">
                <th className="text-left pb-2 font-medium">Grant</th>
                <th className="text-left pb-2 font-medium">Date</th>
                <th className="text-right pb-2 font-medium">Total</th>
                <th className="text-right pb-2 font-medium">Vested</th>
                <th className="text-right pb-2 font-medium">Unvested</th>
                <th className="text-right pb-2 font-medium">Unvested Value</th>
              </tr>
            </thead>
            <tbody>
              {rsuGrants.map((grant, idx) => {
                const unvested = grant.total_shares - grant.vested_shares;
                return (
                  <tr key={grant.id} className="border-b border-border/50">
                    <td className="py-2 font-medium text-text-primary">Grant {String.fromCharCode(65 + idx)}</td>
                    <td className="py-2 text-text-secondary">
                      {new Date(grant.grant_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-2 text-right number-display">{grant.total_shares.toLocaleString()}</td>
                    <td className="py-2 text-right number-display">{grant.vested_shares.toLocaleString()}</td>
                    <td className="py-2 text-right number-display">{unvested.toLocaleString()}</td>
                    <td className="py-2 text-right number-display font-bold text-accent-amber">
                      {formatCurrency(unvested * adjustedPrice)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
      </div>
    </div>
  );
}
