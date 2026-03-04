'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency, calcRentalMetrics, generateAmortizationSchedule } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { useHoldingsCache } from '@/hooks/useHoldingsCache';
import AddressAutocomplete from '@/components/shared/AddressAutocomplete';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PropertyCard({ property, delay }: { property: any; delay: number }) {
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
  const { realEstate, isLoading, refresh, clerkId: userId } = useUserData();
  const { totalInvestment } = useHoldingsCache(userId);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    address: '',
    property_type: 'primary' as 'primary' | 'rental' | 'vacation',
    purchase_price: '',
    purchase_date: '',
    current_value: '',
    original_loan_amount: '',
    mortgage_balance: '',
    mortgage_rate: '',
    mortgage_term_months: '360',
    mortgage_start_date: '',
    monthly_payment: '',
    monthly_rent: '',
  });

  const handleSave = async () => {
    if (!userId || !form.address || !form.current_value) return;
    setSaving(true);
    try {
      const res = await fetch('/api/user/real-estate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId: userId,
          address: form.address,
          property_type: form.property_type,
          purchase_price: Number(form.purchase_price) || 0,
          purchase_date: form.purchase_date || null,
          current_value: Number(form.current_value) || 0,
          original_loan_amount: Number(form.original_loan_amount) || 0,
          mortgage_balance: Number(form.mortgage_balance) || 0,
          mortgage_rate: Number(form.mortgage_rate) || 0,
          mortgage_term_months: Number(form.mortgage_term_months) || 360,
          mortgage_start_date: form.mortgage_start_date || null,
          monthly_payment: Number(form.monthly_payment) || 0,
          monthly_rent: form.monthly_rent ? Number(form.monthly_rent) : null,
        }),
      });
      if (res.ok) {
        await refresh(); // Wait for fresh data from Supabase
        setShowForm(false);
        setForm({ address: '', property_type: 'primary', purchase_price: '', purchase_date: '', current_value: '', original_loan_amount: '', mortgage_balance: '', mortgage_rate: '', mortgage_term_months: '360', mortgage_start_date: '', monthly_payment: '', monthly_rent: '' });
      }
    } catch (err) {
      console.error('Failed to save property:', err);
    } finally {
      setSaving(false);
    }
  };

  const properties = realEstate.map(p => ({
    ...p,
    propertyType: p.property_type,
    purchasePrice: p.purchase_price,
    purchaseDate: p.purchase_date,
    currentValue: p.current_value,
    originalLoanAmount: p.original_loan_amount,
    mortgageBalance: p.mortgage_balance,
    mortgageRate: p.mortgage_rate,
    mortgageTermMonths: p.mortgage_term_months,
    mortgageStartDate: p.mortgage_start_date,
    monthlyPayment: p.monthly_payment,
    monthlyRent: p.monthly_rent,
  }));

  const totalPropertyValue = properties.reduce((s, p) => s + p.currentValue, 0);
  const totalMortgageBalance = properties.reduce((s, p) => s + p.mortgageBalance, 0);
  const totalEquity = totalPropertyValue - totalMortgageBalance;

  // Generate equity over time data
  const equityData = useMemo(() => {
    if (properties.length === 0) return [];
    const data = [];
    for (let m = 0; m < 36; m++) {
      const date = new Date('2023-03-01');
      date.setMonth(date.getMonth() + m);
      const valueFactor = 1 + m * 0.012;
      const balanceReduction = m * 2800;
      data.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(totalPropertyValue * valueFactor),
        mortgage: Math.round(totalMortgageBalance - balanceReduction),
        equity: Math.round(totalPropertyValue * valueFactor - (totalMortgageBalance - balanceReduction)),
      });
    }
    return data;
  }, [totalPropertyValue, totalMortgageBalance, properties.length]);

  if (isLoading) return <div className="text-center py-20 text-text-secondary">Loading...</div>;

  const inputClass = "w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent/50 number-display";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl text-text-primary">Real Estate</h1>
        <p className="text-sm text-text-secondary mt-1">Property values, mortgages, and equity</p>
      </div>

      {properties.length === 0 && !showForm ? (
        /* Empty state */
        <Card delay={0.1} className="text-center py-12">
          <span className="text-5xl block mb-4">🏠</span>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Properties Yet</h3>
          <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
            Add your home or investment properties to track equity, mortgage payoff, and how real estate fits into your FIRE plan.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            + Add Your First Property
          </button>
        </Card>
      ) : (
        <>
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
          {properties.map((property, i) => (
            <PropertyCard key={property.id} property={property} delay={0.3 + i * 0.1} />
          ))}

          {/* Equity Over Time Chart */}
          {equityData.length > 0 && (
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
          )}

          {/* FIRE Impact */}
          <Card delay={0.6} className="border-accent/20">
            <p className="text-sm text-text-secondary leading-relaxed">
              <span className="text-text-primary font-medium">Your real estate equity of {formatCurrency(totalEquity)}</span> represents{' '}
              {((totalEquity / Math.max(totalEquity + totalInvestment, 1)) * 100).toFixed(1)}% of your net worth. Primary residence equity is excluded from your investable FIRE number by default.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs text-text-secondary">Include home equity in FIRE number:</span>
              <button className="px-3 py-1 rounded-md text-xs font-medium bg-bg-elevated border border-border text-text-secondary">OFF</button>
            </div>
          </Card>
        </>
      )}

      {/* Add Property Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card delay={0}>
            <h3 className="font-display text-lg text-text-primary mb-4">Add Property</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs text-text-secondary block mb-1">Address</label>
                <AddressAutocomplete
                  className={inputClass}
                  placeholder="Start typing an address..."
                  value={form.address}
                  onChange={(val) => setForm(f => ({ ...f, address: val }))}
                />
              </div>

              <div>
                <label className="text-xs text-text-secondary block mb-1">Property Type</label>
                <select className={inputClass} value={form.property_type} onChange={e => setForm(f => ({ ...f, property_type: e.target.value as 'primary' | 'rental' | 'vacation' }))}>
                  <option value="primary">Primary Residence</option>
                  <option value="rental">Rental Property</option>
                  <option value="vacation">Vacation Home</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-text-secondary block mb-1">Current Value ($)</label>
                <input className={inputClass} type="number" placeholder="750000" value={form.current_value} onChange={e => setForm(f => ({ ...f, current_value: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs text-text-secondary block mb-1">Purchase Price ($)</label>
                <input className={inputClass} type="number" placeholder="650000" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs text-text-secondary block mb-1">Purchase Date</label>
                <input className={inputClass} type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
              </div>

              <div className="md:col-span-2 border-t border-border pt-4 mt-2">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-3">Mortgage Details</p>
              </div>

              <div>
                <label className="text-xs text-text-secondary block mb-1">Original Loan Amount ($)</label>
                <input className={inputClass} type="number" placeholder="520000" value={form.original_loan_amount} onChange={e => setForm(f => ({ ...f, original_loan_amount: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs text-text-secondary block mb-1">Current Mortgage Balance ($)</label>
                <input className={inputClass} type="number" placeholder="480000" value={form.mortgage_balance} onChange={e => setForm(f => ({ ...f, mortgage_balance: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs text-text-secondary block mb-1">Interest Rate (%)</label>
                <input className={inputClass} type="number" step="0.01" placeholder="6.5" value={form.mortgage_rate} onChange={e => setForm(f => ({ ...f, mortgage_rate: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs text-text-secondary block mb-1">Monthly Payment ($)</label>
                <input className={inputClass} type="number" placeholder="3200" value={form.monthly_payment} onChange={e => setForm(f => ({ ...f, monthly_payment: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs text-text-secondary block mb-1">Loan Term (months)</label>
                <input className={inputClass} type="number" placeholder="360" value={form.mortgage_term_months} onChange={e => setForm(f => ({ ...f, mortgage_term_months: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs text-text-secondary block mb-1">Mortgage Start Date</label>
                <input className={inputClass} type="date" value={form.mortgage_start_date} onChange={e => setForm(f => ({ ...f, mortgage_start_date: e.target.value }))} />
              </div>

              {form.property_type === 'rental' && (
                <div>
                  <label className="text-xs text-text-secondary block mb-1">Monthly Rent ($)</label>
                  <input className={inputClass} type="number" placeholder="2800" value={form.monthly_rent} onChange={e => setForm(f => ({ ...f, monthly_rent: e.target.value }))} />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving || !form.address || !form.current_value}
                className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Property'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Add Property button (when properties exist) */}
      {properties.length > 0 && !showForm && (
        <button onClick={() => setShowForm(true)} className="w-full glass-card-hover p-4 text-sm text-accent font-medium flex items-center justify-center gap-2">
          <span className="text-lg">+</span> Add Another Property
        </button>
      )}

      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Estimates provided by Zillow. Actual value may differ.
      </div>
    </div>
  );
}

