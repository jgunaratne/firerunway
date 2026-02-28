'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency } from '@/lib/calculations';
import { mockRSUGrants, mockStockPrice, mockVestingEvents, mockTotals } from '@/lib/mock-data';

function ConcentrationGauge({ pct, size = 200 }: { pct: number; size?: number }) {
  const radius = (size - 24) / 2;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - Math.min(pct / 50, 1));
  const color = pct <= 15 ? '#10b981' : pct <= 25 ? '#f59e0b' : '#ef4444';
  const label = pct <= 15 ? 'Well diversified' : pct <= 25 ? 'Moderate concentration' : 'High concentration risk';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
        <path
          d={`M 12,${size / 2 + 12} A ${radius},${radius} 0 0,1 ${size - 12},${size / 2 + 12}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round"
        />
        <motion.path
          d={`M 12,${size / 2 + 12} A ${radius},${radius} 0 0,1 ${size - 12},${size / 2 + 12}`}
          fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
        <text x={size / 2} y={size / 2 - 5} textAnchor="middle" className="number-display" fill={color} fontSize="36" fontWeight="bold">
          {pct.toFixed(0)}%
        </text>
        <text x={size / 2} y={size / 2 + 18} textAnchor="middle" fill="#8888aa" fontSize="12">
          of net worth
        </text>
      </svg>
      <p className="text-sm mt-1" style={{ color }}>{label}</p>
    </div>
  );
}

export default function EquityPage() {
  const [priceAdjust, setPriceAdjust] = useState(0);
  const currentPrice = mockStockPrice.AMZN;
  const adjustedPrice = currentPrice * (1 + priceAdjust / 100);

  const totalVestedShares = mockRSUGrants.reduce((s, g) => s + g.vestedShares, 0);
  const totalUnvestedShares = mockRSUGrants.reduce((s, g) => s + (g.totalShares - g.vestedShares), 0);
  const vestedValue = totalVestedShares * adjustedPrice;
  const unvestedValue = totalUnvestedShares * adjustedPrice;
  const concentrationPct = ((vestedValue + unvestedValue) / (mockTotals.netWorth + (adjustedPrice - currentPrice) * (totalVestedShares + totalUnvestedShares))) * 100;

  // Estimate FIRE date delta
  const monthsDelta = Math.round(priceAdjust * 0.3);

  const adjustedEvents = useMemo(() =>
    mockVestingEvents.map(e => ({
      ...e,
      grossValue: e.shares * adjustedPrice,
      afterTaxValue: e.shares * adjustedPrice * 0.557,
    })),
    [adjustedPrice]
  );

  const taxRate = {
    federal: 35,
    state: 9.3,
    total: 44.3,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl text-text-primary">Equity / RSUs</h1>
        <p className="text-sm text-text-secondary mt-1">Equity compensation — vesting, concentration, and scenarios</p>
      </div>

      {/* Concentration Gauge */}
      <Card delay={0.1} className="text-center py-8">
        <p className="text-xs text-text-secondary uppercase tracking-wider mb-4">Employer Stock Concentration</p>
        <ConcentrationGauge pct={concentrationPct} />
        <div className="flex justify-center gap-8 mt-4 text-sm">
          <div>
            <p className="text-text-secondary text-xs">Unvested Value</p>
            <p className="number-display font-bold text-accent-amber">
              <AnimatedNumber value={Math.round(unvestedValue)} format={(n) => formatCurrency(n)} />
            </p>
          </div>
          <div>
            <p className="text-text-secondary text-xs">Vested Unsold</p>
            <p className="number-display font-bold text-text-primary">
              <AnimatedNumber value={Math.round(vestedValue)} format={(n) => formatCurrency(n)} />
            </p>
          </div>
        </div>
      </Card>

      {/* Stock Price Scenario Slider */}
      <Card delay={0.2}>
        <h3 className="font-display text-lg text-text-primary mb-2">Stock Price Scenario</h3>
        <p className="text-xs text-text-secondary mb-4">Drag to see how price changes affect your finances</p>

        <div className="flex items-center justify-between text-xs text-text-secondary mb-2">
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
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 grid grid-cols-3 gap-4 text-center"
          >
            <div className="glass-card p-3 rounded-lg">
              <p className="text-xs text-text-secondary">Unvested Value</p>
              <p className="number-display text-sm font-bold text-text-primary">{formatCurrency(unvestedValue)}</p>
            </div>
            <div className="glass-card p-3 rounded-lg">
              <p className="text-xs text-text-secondary">Concentration</p>
              <p className="number-display text-sm font-bold" style={{ color: concentrationPct > 25 ? '#ef4444' : concentrationPct > 15 ? '#f59e0b' : '#10b981' }}>
                {concentrationPct.toFixed(1)}%
              </p>
            </div>
            <div className="glass-card p-3 rounded-lg">
              <p className="text-xs text-text-secondary">FIRE Date Delta</p>
              <p className={`number-display text-sm font-bold ${monthsDelta <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {monthsDelta <= 0 ? '' : '+'}{monthsDelta} months
              </p>
            </div>
          </motion.div>
        )}
      </Card>

      {/* Vesting Timeline */}
      <Card delay={0.3}>
        <h3 className="font-display text-lg text-text-primary mb-4">Vesting Timeline — Next 24 Months</h3>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {adjustedEvents.map((event, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.08 }}
              className="glass-card p-4 min-w-[180px] flex-shrink-0"
            >
              <p className="text-xs text-text-secondary">
                {new Date(event.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
              <p className="number-display text-lg font-bold text-text-primary mt-1">{event.shares} shares</p>
              <div className="border-t border-border mt-2 pt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Gross</span>
                  <span className="number-display text-text-primary">{formatCurrency(event.grossValue)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">After tax</span>
                  <span className="number-display text-emerald-400">{formatCurrency(event.afterTaxValue)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="text-xs text-text-secondary mt-4 border-t border-border pt-3">
          RSUs are taxed as ordinary income at vest. Estimated federal withholding at your bracket: {taxRate.federal}%. State: {taxRate.state}%.
        </p>
      </Card>

      {/* Grant Summary Table */}
      <Card delay={0.4}>
        <h3 className="font-display text-lg text-text-primary mb-4">Grant Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-text-secondary border-b border-border">
                <th className="text-left pb-2 font-medium">Grant</th>
                <th className="text-left pb-2 font-medium">Date</th>
                <th className="text-right pb-2 font-medium">Total</th>
                <th className="text-right pb-2 font-medium">Vested</th>
                <th className="text-right pb-2 font-medium">Unvested</th>
                <th className="text-right pb-2 font-medium">Unvested Value</th>
              </tr>
            </thead>
            <tbody>
              {mockRSUGrants.map((grant) => {
                const unvested = grant.totalShares - grant.vestedShares;
                return (
                  <tr key={grant.id} className="border-b border-border/50">
                    <td className="py-2 font-medium text-text-primary">Grant {grant.id === '1' ? 'A' : 'B'}</td>
                    <td className="py-2 text-text-secondary">
                      {new Date(grant.grantDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-2 text-right number-display">{grant.totalShares.toLocaleString()}</td>
                    <td className="py-2 text-right number-display">{grant.vestedShares.toLocaleString()}</td>
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
