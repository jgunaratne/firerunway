'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency, calcRentalMetrics, generateAmortizationSchedule } from '@/lib/calculations';
import { mockRealEstate } from '@/lib/mock-data';

function PropertyCard({ property, delay }: { property: typeof mockRealEstate[0]; delay: number }) {
  const [expanded, setExpanded] = useState(false);
  const [showAmortization, setShowAmortization] = useState(false);
  const [extraPayment, setExtraPayment] = useState(0);
  const equity = property.currentValue - property.mortgageBalance;
  const appreciation = property.currentValue - property.purchasePrice;
  const appreciationPct = (appreciation / property.purchasePrice) * 100;
  const rentalMetrics = calcRentalMetrics(property);
  const remainingMonths = Math.ceil((property.mortgageBalance / property.monthlyPayment));

  const amortization = useMemo(() =>
    generateAmortizationSchedule(property.mortgageBalance, property.mortgageRate, property.monthlyPayment, extraPayment),
    [property.mortgageBalance, property.mortgageRate, property.monthlyPayment, extraPayment]
  );
  const baseAmortization = useMemo(() =>
    generateAmortizationSchedule(property.mortgageBalance, property.mortgageRate, property.monthlyPayment, 0),
    [property.mortgageBalance, property.mortgageRate, property.monthlyPayment]
  );
  const interestSaved = baseAmortization.reduce((s, a) => s + a.interest, 0) - amortization.reduce((s, a) => s + a.interest, 0);
  const monthsSaved = baseAmortization.length - amortization.length;

  const typeLabel = property.propertyType === 'primary' ? 'Primary Residence' : property.propertyType === 'rental' ? 'Rental Property' : 'Vacation Home';
  const typeIcon = property.propertyType === 'primary' ? '🏠' : property.propertyType === 'rental' ? '🏢' : '🏖️';

  return (
    <Card delay={delay}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-text-primary flex items-center gap-2">
              <span>{typeIcon}</span>
              {property.address}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">{typeLabel}</p>
          </div>
          <div className="text-right">
            <p className="number-display text-lg font-bold text-text-primary">{formatCurrency(property.currentValue)}</p>
            <p className="number-display text-xs text-emerald-400">Equity: {formatCurrency(equity)}</p>
          </div>
        </div>
      </button>

      {expanded && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ duration: 0.3 }} className="mt-4 space-y-4">
          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
              <div>
                <p className="text-text-secondary text-xs">Current Value</p>
                <p className="number-display font-medium">{formatCurrency(property.currentValue)}</p>
              </div>
              <div>
                <p className="text-text-secondary text-xs">Purchase Price</p>
                <p className="number-display font-medium">{formatCurrency(property.purchasePrice)} ({new Date(property.purchaseDate).getFullYear()})</p>
              </div>
              <div>
                <p className="text-text-secondary text-xs">Appreciation</p>
                <p className="number-display font-medium text-emerald-400">+{formatCurrency(appreciation)} (+{appreciationPct.toFixed(1)}%)</p>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
              <div>
                <p className="text-text-secondary text-xs">Mortgage Balance</p>
                <p className="number-display font-medium">{formatCurrency(property.mortgageBalance)}</p>
              </div>
              <div>
                <p className="text-text-secondary text-xs">Monthly Payment</p>
                <p className="number-display font-medium">{formatCurrency(property.monthlyPayment)}/mo</p>
              </div>
              <div>
                <p className="text-text-secondary text-xs">Rate / Remaining</p>
                <p className="number-display font-medium">{property.mortgageRate}% ({Math.ceil(remainingMonths / 12)}yr left)</p>
              </div>
              <div>
                <p className="text-text-secondary text-xs">Equity</p>
                <p className="number-display font-bold text-emerald-400">{formatCurrency(equity)}</p>
              </div>
            </div>
          </div>

          {/* Rental metrics */}
          {rentalMetrics && (
            <div className="border-t border-border pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-sm">
                <div>
                  <p className="text-text-secondary text-xs">Monthly Rent</p>
                  <p className="number-display font-medium">{formatCurrency(property.monthlyRent!)}/mo</p>
                </div>
                <div>
                  <p className="text-text-secondary text-xs">Annual NOI</p>
                  <p className="number-display font-medium">{formatCurrency(rentalMetrics.noi)}</p>
                </div>
                <div>
                  <p className="text-text-secondary text-xs">Cap Rate</p>
                  <p className="number-display font-medium">{(rentalMetrics.capRate * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-text-secondary text-xs">Cash-on-Cash</p>
                  <p className="number-display font-medium">{(rentalMetrics.cashOnCash * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>
          )}

          {/* Amortization Toggle */}
          <div className="border-t border-border pt-4">
            <button onClick={() => setShowAmortization(!showAmortization)} className="text-sm text-accent hover:text-accent/80 transition-colors">
              {showAmortization ? 'Hide' : 'Show'} Amortization Schedule →
            </button>

            {showAmortization && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-xs text-text-secondary block mb-2">Extra Monthly Payment: {formatCurrency(extraPayment)}</label>
                  <input
                    type="range"
                    min={0}
                    max={3000}
                    step={100}
                    value={extraPayment}
                    onChange={(e) => setExtraPayment(Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                  {extraPayment > 0 && (
                    <div className="flex gap-4 mt-2 text-xs">
                      <span className="text-emerald-400">Save {formatCurrency(interestSaved)} in interest</span>
                      <span className="text-accent">Pay off {monthsSaved} months earlier</span>
                    </div>
                  )}
                </div>

                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={amortization.filter((_, i) => i % 12 === 0)}>
                      <XAxis dataKey="month" tick={{ fill: '#8888aa', fontSize: 10 }} tickFormatter={(v) => `Yr ${Math.round(v / 12)}`} />
                      <YAxis tick={{ fill: '#8888aa', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} width={50} />
                      <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }} formatter={(v) => formatCurrency(Number(v))} />
                      <Area type="monotone" dataKey="balance" stroke="#ef4444" fill="rgba(239,68,68,0.1)" strokeWidth={2} name="Balance" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 text-xs">
            <button className="px-3 py-1.5 rounded-md border border-border text-text-secondary hover:text-text-primary hover:border-accent/30 transition-all">Refresh Estimate</button>
            <button className="px-3 py-1.5 rounded-md border border-border text-text-secondary hover:text-text-primary hover:border-accent/30 transition-all">Edit</button>
            <button className="px-3 py-1.5 rounded-md border border-border text-red-400/60 hover:text-red-400 hover:border-red-400/30 transition-all">Remove</button>
          </div>
        </motion.div>
      )}
    </Card>
  );
}

export default function RealEstatePage() {
  const totalPropertyValue = mockRealEstate.reduce((s, p) => s + p.currentValue, 0);
  const totalMortgageBalance = mockRealEstate.reduce((s, p) => s + p.mortgageBalance, 0);
  const totalEquity = totalPropertyValue - totalMortgageBalance;

  // Generate equity over time data
  const equityData = useMemo(() => {
    const data = [];
    for (let m = 0; m < 36; m++) {
      const date = new Date('2023-03-01');
      date.setMonth(date.getMonth() + m);
      const valueFactor = 1 + m * 0.012;
      const balanceReduction = m * 2800;
      data.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(1630000 * valueFactor),
        mortgage: Math.round(1200000 - balanceReduction),
        equity: Math.round(1630000 * valueFactor - (1200000 - balanceReduction)),
      });
    }
    return data;
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl text-text-primary">Real Estate</h1>
        <p className="text-sm text-text-secondary mt-1">Property values, mortgages, and equity</p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card delay={0.1} className="text-center">
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Total Property Value</p>
          <p className="number-display text-2xl font-bold text-text-primary">
            <AnimatedNumber value={totalPropertyValue} format={(n) => formatCurrency(n)} />
          </p>
        </Card>
        <Card delay={0.15} className="text-center">
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Total Mortgage Balance</p>
          <p className="number-display text-2xl font-bold text-red-400">
            <AnimatedNumber value={totalMortgageBalance} format={(n) => `−${formatCurrency(n)}`} />
          </p>
        </Card>
        <Card delay={0.2} className="text-center">
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Total Equity</p>
          <p className="number-display text-2xl font-bold text-emerald-400">
            <AnimatedNumber value={totalEquity} format={(n) => formatCurrency(n)} />
          </p>
        </Card>
      </div>

      {/* Property cards */}
      {mockRealEstate.map((property, i) => (
        <PropertyCard key={property.id} property={property} delay={0.3 + i * 0.1} />
      ))}

      {/* Equity Over Time Chart */}
      <Card delay={0.5}>
        <h3 className="font-display text-lg text-text-primary mb-4">Equity Over Time</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityData}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#2a2a3a" tick={{ fill: '#8888aa', fontSize: 11 }} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis stroke="#2a2a3a" tick={{ fill: '#8888aa', fontSize: 11, fontFamily: 'JetBrains Mono' }} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} tickLine={false} axisLine={false} width={60} />
              <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 13 }} formatter={(v) => formatCurrency(Number(v))} />
              <Area type="monotone" dataKey="value" stroke="#6366f1" fill="none" strokeWidth={2} name="Property Value" animationDuration={1200} />
              <Area type="monotone" dataKey="equity" stroke="#10b981" fill="url(#eqGrad)" strokeWidth={2} name="Equity" animationDuration={1200} />
              <Area type="monotone" dataKey="mortgage" stroke="#ef4444" fill="none" strokeWidth={1} strokeDasharray="4 4" name="Mortgage" animationDuration={1200} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* FIRE Impact */}
      <Card delay={0.6} className="border-accent/20">
        <p className="text-sm text-text-secondary leading-relaxed">
          <span className="text-text-primary font-medium">Your real estate equity of {formatCurrency(totalEquity)}</span> represents{' '}
          {((totalEquity / 3960000) * 100).toFixed(1)}% of your net worth. Primary residence equity is excluded from your investable FIRE number by default.
        </p>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-xs text-text-secondary">Include home equity in FIRE number:</span>
          <button className="px-3 py-1 rounded-md text-xs font-medium bg-bg-elevated border border-border text-text-secondary">OFF</button>
        </div>
      </Card>

      {/* Add Property */}
      <button className="w-full glass-card-hover p-4 text-sm text-accent font-medium flex items-center justify-center gap-2">
        <span className="text-lg">+</span> Add Another Property
      </button>

      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Estimates provided by Zillow. Actual value may differ.
      </div>
    </div>
  );
}
