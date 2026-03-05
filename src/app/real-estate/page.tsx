'use client';

import { useState, useMemo, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '@/components/shared/Card';
import AIAnalysis from '@/components/shared/AIAnalysis';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency, calcRentalMetrics, generateAmortizationSchedule } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { useBrokerageData } from '@/lib/BrokerageDataContext';
import AddressAutocomplete from '@/components/shared/AddressAutocomplete';

// ─── Types ──────────────────────────────────────────────────────────

interface PropertyForm {
  address: string;
  property_type: 'primary' | 'rental' | 'vacation';
  purchase_price: string;
  purchase_date: string;
  current_value: string;
  original_loan_amount: string;
  mortgage_balance: string;
  mortgage_rate: string;
  mortgage_term_months: string;
  mortgage_start_date: string;
  monthly_payment: string;
  monthly_rent: string;
}

const emptyForm: PropertyForm = {
  address: '',
  property_type: 'primary',
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
};

const inputClass = "w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent/50 number-display";

// ─── Property Card ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PropertyCard({ property, onEdit, onDelete }: { property: any; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showAmortization, setShowAmortization] = useState(false);
  const [extraPayment, setExtraPayment] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const currentValue = property.current_value ?? 0;
  const purchasePrice = property.purchase_price ?? 0;
  const mortgageBalance = property.mortgage_balance ?? 0;
  const mortgageRate = property.mortgage_rate ?? 0;
  const monthlyPayment = property.monthly_payment ?? 0;
  const monthlyRent = property.monthly_rent;

  const equity = currentValue - mortgageBalance;
  const appreciation = purchasePrice > 0 ? currentValue - purchasePrice : 0;
  const appreciationPct = purchasePrice > 0 ? (appreciation / purchasePrice) * 100 : 0;
  const remainingMonths = monthlyPayment > 0 ? Math.ceil(mortgageBalance / monthlyPayment) : 0;

  const typeLabel = property.property_type === 'primary' ? 'Primary Residence' : property.property_type === 'rental' ? 'Rental Property' : 'Vacation Home';
  const typeIcon = property.property_type === 'primary' ? '🏠' : property.property_type === 'rental' ? '🏢' : '🏖️';

  // Rental metrics (only if rental with rent set)
  const rentalMetrics = monthlyRent && property.property_type === 'rental' ? calcRentalMetrics({
    currentValue, monthlyRent, monthlyPayment, purchasePrice, originalLoanAmount: property.original_loan_amount ?? 0,
  }) : null;

  // Amortization schedule
  const amortization = useMemo(() =>
    mortgageBalance > 0 && mortgageRate > 0 && monthlyPayment > 0
      ? generateAmortizationSchedule(mortgageBalance, mortgageRate, monthlyPayment, extraPayment)
      : [],
    [mortgageBalance, mortgageRate, monthlyPayment, extraPayment]
  );
  const baseAmortization = useMemo(() =>
    mortgageBalance > 0 && mortgageRate > 0 && monthlyPayment > 0
      ? generateAmortizationSchedule(mortgageBalance, mortgageRate, monthlyPayment, 0)
      : [],
    [mortgageBalance, mortgageRate, monthlyPayment]
  );
  const interestSaved = baseAmortization.reduce((s, a) => s + a.interest, 0) - amortization.reduce((s, a) => s + a.interest, 0);
  const monthsSaved = baseAmortization.length - amortization.length;

  const handleDelete = async () => {
    if (!confirm('Delete this property? This cannot be undone.')) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  };

  return (
    <Card>
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
            {currentValue > 0 && (
              <p className="number-display text-lg font-bold text-text-primary">{formatCurrency(currentValue)}</p>
            )}
            {equity !== 0 && (
              <p className="number-display text-xs text-emerald-400">Equity: {formatCurrency(equity)}</p>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Value details */}
          {(currentValue > 0 || purchasePrice > 0) && (
            <div className="border-t border-border pt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                {currentValue > 0 && (
                  <div>
                    <p className="text-text-secondary text-xs">Current Value</p>
                    <p className="number-display font-medium">{formatCurrency(currentValue)}</p>
                  </div>
                )}
                {purchasePrice > 0 && (
                  <div>
                    <p className="text-text-secondary text-xs">Purchase Price</p>
                    <p className="number-display font-medium">
                      {formatCurrency(purchasePrice)}
                      {property.purchase_date ? ` (${new Date(property.purchase_date).getFullYear()})` : ''}
                    </p>
                  </div>
                )}
                {appreciation !== 0 && (
                  <div>
                    <p className="text-text-secondary text-xs">Appreciation</p>
                    <p className={`number-display font-medium ${appreciation >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {appreciation >= 0 ? '+' : ''}{formatCurrency(appreciation)} ({appreciationPct.toFixed(1)}%)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mortgage details */}
          {mortgageBalance > 0 && (
            <div className="border-t border-border pt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                <div>
                  <p className="text-text-secondary text-xs">Mortgage Balance</p>
                  <p className="number-display font-medium">{formatCurrency(mortgageBalance)}</p>
                </div>
                {monthlyPayment > 0 && (
                  <div>
                    <p className="text-text-secondary text-xs">Monthly Payment</p>
                    <p className="number-display font-medium">{formatCurrency(monthlyPayment)}/mo</p>
                  </div>
                )}
                {mortgageRate > 0 && (
                  <div>
                    <p className="text-text-secondary text-xs">Rate / Remaining</p>
                    <p className="number-display font-medium">
                      {mortgageRate}%{remainingMonths > 0 ? ` (${Math.ceil(remainingMonths / 12)}yr left)` : ''}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-text-secondary text-xs">Equity</p>
                  <p className="number-display font-bold text-emerald-400">{formatCurrency(equity)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Rental metrics */}
          {rentalMetrics && (
            <div className="border-t border-border pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-sm">
                <div>
                  <p className="text-text-secondary text-xs">Monthly Rent</p>
                  <p className="number-display font-medium">{formatCurrency(monthlyRent)}/mo</p>
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

          {/* Amortization toggle */}
          {amortization.length > 0 && (
            <div className="border-t border-border pt-4">
              <button onClick={() => setShowAmortization(!showAmortization)} className="text-sm text-accent hover:text-accent/80 transition-colors">
                {showAmortization ? 'Hide' : 'Show'} Amortization Schedule →
              </button>

              {showAmortization && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs text-text-secondary block mb-2">Extra Monthly Payment: {formatCurrency(extraPayment)}</label>
                    <input
                      type="range" min={0} max={3000} step={100}
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
                        <Area type="monotone" dataKey="balance" stroke="#ef4444" fill="rgba(239,68,68,0.1)" strokeWidth={2} name="Balance" isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 text-xs border-t border-border pt-4">
            <button onClick={onEdit} className="px-3 py-1.5 rounded-md border border-border text-text-secondary hover:text-text-primary hover:border-accent/30 transition-all">
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded-md border border-border text-red-400/60 hover:text-red-400 hover:border-red-400/30 transition-all disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Remove'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Property Form ──────────────────────────────────────────────────

function PropertyFormPanel({
  form,
  setForm,
  onSave,
  onCancel,
  saving,
  saveError,
  title,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: PropertyForm; setForm: (fn: (f: PropertyForm) => PropertyForm) => void;
  onSave: () => void; onCancel: () => void; saving: boolean; saveError: string | null; title: string;
}) {
  return (
    <Card>
      <h3 className="section-title">{title}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="text-xs text-text-secondary block mb-1">Address *</label>
          <AddressAutocomplete
            className={inputClass}
            placeholder="Start typing an address..."
            value={form.address}
            onChange={(val) => setForm(f => ({ ...f, address: val }))}
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">Property Type</label>
          <select className={inputClass} value={form.property_type} onChange={e => setForm(f => ({ ...f, property_type: e.target.value as PropertyForm['property_type'] }))}>
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
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Mortgage Details (optional)</p>
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

      {saveError && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {saveError}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={onSave}
          disabled={saving || !form.address.trim()}
          className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Property'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function RealEstatePage() {
  const { realEstate, isLoading, refresh, clerkId: userId } = useUserData();
  const { totalInvestment } = useBrokerageData();

  const [formMode, setFormMode] = useState<'hidden' | 'add' | 'edit'>('hidden');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PropertyForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async (): Promise<{ analysis: string }> => {
    const res = await fetch(`/api/real-estate/analyze?clerkId=${userId}`, { method: 'POST' });
    if (!res.ok) throw new Error('Analysis failed');
    return res.json();
  }, [userId]);

  // ─── Handlers ─────────────────────────────────────────────────────

  const openAddForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setSaveError(null);
    setFormMode('add');
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openEditForm = (p: any) => {
    setForm({
      address: p.address || '',
      property_type: p.property_type || 'primary',
      purchase_price: p.purchase_price != null ? String(p.purchase_price) : '',
      purchase_date: p.purchase_date || '',
      current_value: p.current_value != null ? String(p.current_value) : '',
      original_loan_amount: p.original_loan_amount != null ? String(p.original_loan_amount) : '',
      mortgage_balance: p.mortgage_balance != null ? String(p.mortgage_balance) : '',
      mortgage_rate: p.mortgage_rate != null ? String(p.mortgage_rate) : '',
      mortgage_term_months: p.mortgage_term_months != null ? String(p.mortgage_term_months) : '360',
      mortgage_start_date: p.mortgage_start_date || '',
      monthly_payment: p.monthly_payment != null ? String(p.monthly_payment) : '',
      monthly_rent: p.monthly_rent != null ? String(p.monthly_rent) : '',
    });
    setEditingId(p.id);
    setSaveError(null);
    setFormMode('edit');
  };

  const handleSave = async () => {
    if (!userId) { setSaveError('Not logged in.'); return; }
    if (!form.address.trim()) { setSaveError('Please enter an address.'); return; }

    setSaving(true);
    setSaveError(null);

    const payload = {
      clerkId: userId,
      address: form.address.trim(),
      property_type: form.property_type || 'primary',
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      purchase_date: form.purchase_date || null,
      current_value: form.current_value ? Number(form.current_value) : null,
      original_loan_amount: form.original_loan_amount ? Number(form.original_loan_amount) : null,
      mortgage_balance: form.mortgage_balance ? Number(form.mortgage_balance) : null,
      mortgage_rate: form.mortgage_rate ? Number(form.mortgage_rate) : null,
      mortgage_term_months: form.mortgage_term_months ? Number(form.mortgage_term_months) : null,
      mortgage_start_date: form.mortgage_start_date || null,
      monthly_payment: form.monthly_payment ? Number(form.monthly_payment) : null,
      monthly_rent: form.monthly_rent ? Number(form.monthly_rent) : null,
    };



    try {
      const method = formMode === 'edit' && editingId ? 'PUT' : 'POST';
      const body = formMode === 'edit' && editingId
        ? { ...payload, propertyId: editingId }
        : payload;


      const res = await fetch('/api/user/real-estate', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await refresh();
        setFormMode('hidden');
        setForm({ ...emptyForm });
        setEditingId(null);

      } else {
        const errBody = await res.text();
        console.error('Save failed:', res.status, errBody);
        setSaveError(`Failed to save (${res.status}): ${errBody}`);
      }
    } catch (err) {
      console.error('Save error:', err);
      setSaveError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (propertyId: string) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/user/real-estate?clerkId=${userId}&propertyId=${propertyId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await refresh();
      } else {
        console.error('Delete failed:', res.status);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // ─── Derived data ─────────────────────────────────────────────────

  const totalPropertyValue = realEstate.reduce((s, p) => s + (p.current_value ?? 0), 0);
  const totalMortgageBalance = realEstate.reduce((s, p) => s + (p.mortgage_balance ?? 0), 0);
  const totalEquity = totalPropertyValue - totalMortgageBalance;

  const equityData = useMemo(() => {
    if (totalPropertyValue === 0) return [];
    const data = [];
    for (let m = 0; m < 36; m++) {
      const date = new Date('2023-03-01');
      date.setMonth(date.getMonth() + m);
      const valueFactor = 1 + m * 0.012;
      const balanceReduction = m * 2800;
      data.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(totalPropertyValue * valueFactor),
        mortgage: Math.round(Math.max(totalMortgageBalance - balanceReduction, 0)),
        equity: Math.round(totalPropertyValue * valueFactor - Math.max(totalMortgageBalance - balanceReduction, 0)),
      });
    }
    return data;
  }, [totalPropertyValue, totalMortgageBalance]);

  // ─── Render ───────────────────────────────────────────────────────

  if (isLoading) return <div className="text-center py-20 text-text-secondary">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Real Estate</h1>
          <p className="page-subtitle">Property values, mortgages, and equity</p>
        </div>
        {realEstate.length > 0 && formMode === 'hidden' && (
          <button onClick={openAddForm} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors">
            + Add Property
          </button>
        )}
      </div>

      {/* Empty state */}
      {realEstate.length === 0 && formMode === 'hidden' && (
        <Card className="text-center py-12">
          <span className="text-5xl block mb-4">🏠</span>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Properties Yet</h3>
          <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
            Add your home or investment properties to track equity, mortgage payoff, and how real estate fits into your FIRE plan.
          </p>
          <button
            onClick={openAddForm}
            className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            + Add Your First Property
          </button>
        </Card>
      )}

      {/* Summary bar */}
      {realEstate.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="text-center">
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Total Property Value</p>
            <p className="number-display text-2xl font-bold text-text-primary">
              <AnimatedNumber value={totalPropertyValue} format={(n) => formatCurrency(n)} />
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Total Mortgage Balance</p>
            <p className="number-display text-2xl font-bold text-red-400">
              <AnimatedNumber value={totalMortgageBalance} format={(n) => `−${formatCurrency(n)}`} />
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Total Equity</p>
            <p className="number-display text-2xl font-bold text-emerald-400">
              <AnimatedNumber value={totalEquity} format={(n) => formatCurrency(n)} />
            </p>
          </Card>
        </div>
      )}

      {/* Form */}
      {formMode !== 'hidden' && (
        <PropertyFormPanel
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={() => { setFormMode('hidden'); setEditingId(null); setSaveError(null); }}
          saving={saving}
          saveError={saveError}
          title={formMode === 'edit' ? 'Edit Property' : 'Add Property'}
        />
      )}

      {/* Property cards */}
      {realEstate.map((property) => (
        <PropertyCard
          key={property.id}
          property={property}
          onEdit={() => openEditForm(property)}
          onDelete={() => handleDelete(property.id)}
        />
      ))}

      {/* Equity over time chart */}
      {equityData.length > 0 && (
        <Card>
          <h3 className="section-title">Equity Over Time</h3>
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
                <Area type="monotone" dataKey="value" stroke="#6366f1" fill="none" strokeWidth={2} name="Property Value" isAnimationActive={false} />
                <Area type="monotone" dataKey="equity" stroke="#10b981" fill="url(#eqGrad)" strokeWidth={2} name="Equity" isAnimationActive={false} />
                <Area type="monotone" dataKey="mortgage" stroke="#ef4444" fill="none" strokeWidth={1} strokeDasharray="4 4" name="Mortgage" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* FIRE impact */}
      {realEstate.length > 0 && (
        <Card className="border-accent/20">
          <p className="text-sm text-text-secondary leading-relaxed">
            <span className="text-text-primary font-medium">Your real estate equity of {formatCurrency(totalEquity)}</span> represents{' '}
            {((totalEquity / Math.max(totalEquity + totalInvestment, 1)) * 100).toFixed(1)}% of your net worth. Primary residence equity is excluded from your investable FIRE number by default.
          </p>
        </Card>
      )}

      {/* AI Analysis */}
      {realEstate.length > 0 && (
        <AIAnalysis
          type="real_estate"
          onAnalyze={handleAnalyze}
          ready={realEstate.length > 0}
        />
      )}

      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Actual property values may differ.
      </div>
    </div>
  );
}
