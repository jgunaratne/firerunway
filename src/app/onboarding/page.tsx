'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency, calculateFIScore } from '@/lib/calculations';
import { Flame, TrendingUp, Landmark, PiggyBank, CheckCircle2 } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface RSUGrant {
  companyTicker: string;
  grantDate: string;
  totalShares: number;
  vestedShares: number;
  cliffMonths: number;
  vestPeriodMonths: number;
  vestFrequency: string;
}

interface RealEstateProperty {
  address: string;
  propertyType: string;
  purchasePrice: number;
  purchaseDate: string;
  currentValue: number;
  originalLoanAmount: number;
  mortgageBalance: number;
  mortgageRate: number;
  mortgageTermMonths: number;
  mortgageStartDate: string;
  monthlyPayment: number;
  monthlyRent: number | null;
}

interface UserProfile {
  annualIncome: number;
  annualSpend: number;
  retirementSpend: number;
  stateOfResidence: string;
  filingStatus: string;
  fireNumber: number;
  fireTargetYear: number | null;
}

interface OnboardingData {
  profile: UserProfile;
  rsuGrants: RSUGrant[];
  realEstate: RealEstateProperty[];
}

// ─── Helpers ────────────────────────────────────────────────────────

const inputClass = 'w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors';
const numberClass = `${inputClass} number-display`;
const labelClass = 'text-sm text-text-secondary block mb-1';

function parseNum(val: string): number {
  return Number(val.replace(/[^0-9.-]/g, '')) || 0;
}

// ─── Steps ──────────────────────────────────────────────────────────

const steps = ['Welcome', 'Connect Accounts', 'RSU Setup', 'Real Estate', 'Your Numbers', 'First Look'];

function ProgressIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${i < current ? 'bg-accent w-8' : i === current ? 'bg-accent w-12' : 'bg-border w-8'}`}
        />
      ))}
    </div>
  );
}

// Welcome
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div>
        <Flame size={56} className="text-accent mb-6 mx-auto" />
      </div>
      <h1 className="font-display text-3xl lg:text-5xl text-text-primary max-w-2xl leading-tight">
        Know if you&apos;re financially independent — before you find out the hard way
      </h1>
      <div className="mt-10">
        <button onClick={onNext} className="px-8 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-all transform hover:scale-105 text-lg">
          Get Started
        </button>
      </div>
    </div>
  );
}

// Connect Accounts (placeholder for SnapTrade)
function ConnectAccountsStep({ onNext }: { onNext: () => void }) {
  const [connected, setConnected] = useState({ brokerage: false, retirement: false, ira: false });
  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h2 className="font-display text-2xl text-text-primary">Connect Your Accounts</h2>
        <p className="page-subtitle">Securely link your brokerage and retirement accounts</p>
      </div>
      <div className="space-y-3">
        {[
          { key: 'brokerage', label: 'Brokerage', desc: 'Schwab, Fidelity, E*Trade, etc.', Icon: TrendingUp },
          { key: 'retirement', label: '401k / Retirement', desc: 'Employer retirement plan', Icon: Landmark },
          { key: 'ira', label: 'IRA / Roth IRA', desc: 'Individual retirement accounts', Icon: PiggyBank },
        ].map((account) => (
          <button key={account.key}
            onClick={() => setConnected(prev => ({ ...prev, [account.key]: !prev[account.key as keyof typeof prev] }))}
            className={`w-full glass-card p-4 flex items-center gap-4 text-left transition-all ${connected[account.key as keyof typeof connected] ? 'border-emerald-500/30 bg-emerald-500/5' : ''}`}>
            <account.Icon size={22} className="text-accent" />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">{account.label}</p>
              <p className="text-sm text-text-secondary">{account.desc}</p>
            </div>
            {connected[account.key as keyof typeof connected] ? <CheckCircle2 size={18} className="text-emerald-400" /> : <span className="text-text-secondary/30"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg></span>}
          </button>
        ))}
      </div>
      <p className="text-sm text-text-secondary/60 text-center">Account connections via SnapTrade coming soon. Skip for now and enter data manually.</p>
      <div className="flex gap-3">
        <button onClick={onNext} className="flex-1 py-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-all text-sm">Continue</button>
        <button onClick={onNext} className="px-4 py-2.5 text-text-secondary text-sm hover:text-text-primary transition-colors">Skip for now</button>
      </div>
    </div>
  );
}

// RSU Setup
function RSUSetupStep({ onNext, grants, setGrants }: { onNext: () => void; grants: RSUGrant[]; setGrants: (g: RSUGrant[]) => void }) {
  const updateGrant = (idx: number, field: keyof RSUGrant, val: string | number) => {
    const updated = [...grants];
    updated[idx] = { ...updated[idx], [field]: val };
    setGrants(updated);
  };

  const addGrant = () => {
    setGrants([...grants, { companyTicker: '', grantDate: '', totalShares: 0, vestedShares: 0, cliffMonths: 12, vestPeriodMonths: 48, vestFrequency: 'quarterly' }]);
  };

  const removeGrant = (idx: number) => {
    if (grants.length > 1) setGrants(grants.filter((_, i) => i !== idx));
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h2 className="font-display text-2xl text-text-primary">RSU / Equity Setup</h2>
        <p className="page-subtitle">Tell us about your equity compensation</p>
      </div>

      {grants.map((grant, idx) => (
        <div key={idx} className="glass-card p-5 space-y-4">
          {grants.length > 1 && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-text-secondary font-medium">Grant {idx + 1}</p>
              <button onClick={() => removeGrant(idx)} className="text-sm text-red-400 hover:text-red-300">Remove</button>
            </div>
          )}
          <div>
            <label className={labelClass}>Company Ticker</label>
            <input type="text" value={grant.companyTicker} onChange={e => updateGrant(idx, 'companyTicker', e.target.value.toUpperCase())} placeholder="AMZN" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Grant Date</label>
              <input type="date" value={grant.grantDate} onChange={e => updateGrant(idx, 'grantDate', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Total Shares Granted</label>
              <input type="number" value={grant.totalShares || ''} onChange={e => updateGrant(idx, 'totalShares', parseInt(e.target.value) || 0)} className={numberClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Shares Already Vested</label>
              <input type="number" value={grant.vestedShares || ''} onChange={e => updateGrant(idx, 'vestedShares', parseInt(e.target.value) || 0)} className={numberClass} />
            </div>
            <div>
              <label className={labelClass}>Vesting Schedule</label>
              <select value={grant.vestFrequency} onChange={e => updateGrant(idx, 'vestFrequency', e.target.value)} className={inputClass}>
                <option value="quarterly">4-year / 1-year cliff (quarterly)</option>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>
        </div>
      ))}

      <button onClick={addGrant} className="w-full glass-card-hover p-3 text-sm text-accent font-medium flex items-center justify-center gap-2">
        <span>+</span> Add Another Grant
      </button>

      <div className="flex gap-3">
        <button onClick={onNext} className="flex-1 py-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-all text-sm">Continue</button>
        <button onClick={onNext} className="px-4 py-2.5 text-text-secondary text-sm hover:text-text-primary transition-colors">Skip</button>
      </div>
    </div>
  );
}

// Real Estate Setup
function RealEstateSetupStep({ onNext, properties, setProperties }: { onNext: () => void; properties: RealEstateProperty[]; setProperties: (p: RealEstateProperty[]) => void }) {
  const updateProp = (idx: number, field: keyof RealEstateProperty, val: string | number | null) => {
    const updated = [...properties];
    updated[idx] = { ...updated[idx], [field]: val };
    setProperties(updated);
  };

  const addProperty = () => {
    setProperties([...properties, {
      address: '', propertyType: 'primary', purchasePrice: 0, purchaseDate: '', currentValue: 0,
      originalLoanAmount: 0, mortgageBalance: 0, mortgageRate: 0, mortgageTermMonths: 360,
      mortgageStartDate: '', monthlyPayment: 0, monthlyRent: null,
    }]);
  };

  const removeProperty = (idx: number) => {
    if (properties.length > 1) setProperties(properties.filter((_, i) => i !== idx));
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h2 className="font-display text-2xl text-text-primary">Real Estate</h2>
        <p className="page-subtitle">Add your properties to get a complete net worth picture</p>
      </div>

      {properties.map((prop, idx) => (
        <div key={idx} className="glass-card p-5 space-y-4">
          {properties.length > 1 && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-text-secondary font-medium">Property {idx + 1}</p>
              <button onClick={() => removeProperty(idx)} className="text-sm text-red-400 hover:text-red-300">Remove</button>
            </div>
          )}
          <div>
            <label className={labelClass}>Property Address</label>
            <input type="text" value={prop.address} onChange={e => updateProp(idx, 'address', e.target.value)} placeholder="123 Main St, City, State" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Property Type</label>
              <select value={prop.propertyType} onChange={e => updateProp(idx, 'propertyType', e.target.value)} className={inputClass}>
                <option value="primary">Primary Residence</option>
                <option value="rental">Rental</option>
                <option value="vacation">Vacation</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Current Value</label>
              <input type="number" value={prop.currentValue || ''} onChange={e => updateProp(idx, 'currentValue', parseNum(e.target.value))} placeholder="0" className={numberClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Purchase Price</label>
              <input type="number" value={prop.purchasePrice || ''} onChange={e => updateProp(idx, 'purchasePrice', parseNum(e.target.value))} className={numberClass} />
            </div>
            <div>
              <label className={labelClass}>Purchase Date</label>
              <input type="date" value={prop.purchaseDate} onChange={e => updateProp(idx, 'purchaseDate', e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Mortgage Balance</label>
              <input type="number" value={prop.mortgageBalance || ''} onChange={e => updateProp(idx, 'mortgageBalance', parseNum(e.target.value))} className={numberClass} />
            </div>
            <div>
              <label className={labelClass}>Monthly Payment</label>
              <input type="number" value={prop.monthlyPayment || ''} onChange={e => updateProp(idx, 'monthlyPayment', parseNum(e.target.value))} className={numberClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Mortgage Rate (%)</label>
              <input type="number" step="0.01" value={prop.mortgageRate || ''} onChange={e => updateProp(idx, 'mortgageRate', parseFloat(e.target.value) || 0)} className={numberClass} />
            </div>
            <div>
              <label className={labelClass}>Original Loan Amount</label>
              <input type="number" value={prop.originalLoanAmount || ''} onChange={e => updateProp(idx, 'originalLoanAmount', parseNum(e.target.value))} className={numberClass} />
            </div>
          </div>
          {prop.propertyType === 'rental' && (
            <div>
              <label className={labelClass}>Monthly Rent</label>
              <input type="number" value={prop.monthlyRent || ''} onChange={e => updateProp(idx, 'monthlyRent', parseNum(e.target.value))} className={numberClass} />
            </div>
          )}
        </div>
      ))}

      <button onClick={addProperty} className="w-full glass-card-hover p-3 text-sm text-accent font-medium flex items-center justify-center gap-2">
        <span>+</span> Add Another Property
      </button>

      <div className="flex gap-3">
        <button onClick={onNext} className="flex-1 py-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-all text-sm">Continue</button>
        <button onClick={onNext} className="px-4 py-2.5 text-text-secondary text-sm hover:text-text-primary transition-colors">Skip</button>
      </div>
    </div>
  );
}

// Your Numbers
function YourNumbersStep({ onNext, profile, setProfile }: { onNext: () => void; profile: UserProfile; setProfile: (p: UserProfile) => void }) {
  const update = (field: keyof UserProfile, val: string | number | null) => {
    setProfile({ ...profile, [field]: val });
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h2 className="font-display text-2xl text-text-primary">Your Numbers</h2>
        <p className="page-subtitle">We need a few more details to calculate your FIRE score</p>
      </div>

      <div className="glass-card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Annual Gross Income</label>
            <input type="number" value={profile.annualIncome || ''} onChange={e => update('annualIncome', parseNum(e.target.value))} placeholder="380000" className={numberClass} />
          </div>
          <div>
            <label className={labelClass}>Annual Expenses</label>
            <input type="number" value={profile.annualSpend || ''} onChange={e => update('annualSpend', parseNum(e.target.value))} placeholder="120000" className={numberClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Expected Retirement Spending</label>
            <input type="number" value={profile.retirementSpend || ''} onChange={e => update('retirementSpend', parseNum(e.target.value))} placeholder="96000" className={numberClass} />
          </div>
          <div>
            <label className={labelClass}>FIRE Number (target)</label>
            <input type="number" value={profile.fireNumber || ''} onChange={e => update('fireNumber', parseNum(e.target.value))} placeholder="3000000" className={numberClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>State of Residence</label>
            <select value={profile.stateOfResidence} onChange={e => update('stateOfResidence', e.target.value)} className={inputClass}>
              <option value="WA">WA — Washington</option>
              <option value="CA">CA — California</option>
              <option value="NY">NY — New York</option>
              <option value="TX">TX — Texas</option>
              <option value="FL">FL — Florida</option>
              <option value="CO">CO — Colorado</option>
              <option value="OR">OR — Oregon</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Filing Status</label>
            <select value={profile.filingStatus} onChange={e => update('filingStatus', e.target.value)} className={inputClass}>
              <option value="single">Single</option>
              <option value="mfj">Married Filing Jointly</option>
            </select>
          </div>
        </div>
      </div>

      <button onClick={onNext} className="w-full py-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-all text-sm">
        Calculate My Score
      </button>
    </div>
  );
}

// First Look / Payoff Screen
function FirstLookStep({ onFinish, data, saving }: { onFinish: () => void; data: OnboardingData; saving: boolean }) {
  const investable = data.rsuGrants.reduce((sum, g) => sum + g.vestedShares * 190, 0); // rough estimate
  const realEstateEquity = data.realEstate.reduce((sum, p) => sum + (p.currentValue - p.mortgageBalance), 0);
  const totalNetWorth = investable + realEstateEquity;
  const runway = data.profile.annualSpend > 0 ? totalNetWorth / data.profile.annualSpend : 0;

  const fiScore = calculateFIScore({
    currentInvestableAssets: investable,
    fireNumber: data.profile.fireNumber || 3000000,
    liquidAssets: investable,
    annualSpend: data.profile.annualSpend || 120000,
    employerStockValue: investable * 0.3,
    totalNetWorth,
    isEmployed: true,
    annualIncome: data.profile.annualIncome || 380000,
  });

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 space-y-8">
      <div>
        <Flame size={72} className="text-accent" />
      </div>

      <div className="space-y-2">
        <p className="text-sm text-text-secondary">Your FI Score</p>
        <p className="number-display text-7xl lg:text-8xl font-bold text-accent">
          <AnimatedNumber value={fiScore.total} duration={1500} />
        </p>
        <p className="text-text-secondary">
          out of 100 — {fiScore.total >= 75 ? 'Approaching Independence' : fiScore.total >= 50 ? 'Halfway There' : 'Building Your Base'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6 max-w-xl">
        <div className="glass-card p-4 text-center">
          <p className="text-sm text-text-secondary mb-1">Net Worth</p>
          <p className="number-display text-xl font-bold text-emerald-400">
            <AnimatedNumber value={totalNetWorth} format={(n) => formatCurrency(n, true)} duration={1200} />
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-sm text-text-secondary mb-1">FIRE Number</p>
          <p className="number-display text-xl font-bold text-text-primary">
            <AnimatedNumber value={data.profile.fireNumber || 3000000} format={(n) => formatCurrency(n, true)} duration={1200} />
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-sm text-text-secondary mb-1">Runway</p>
          <p className="number-display text-xl font-bold text-accent">
            <AnimatedNumber value={Math.round(runway * 10)} format={(n) => `${(n / 10).toFixed(1)}yr`} duration={1200} />
          </p>
        </div>
      </div>

      <div>
        <button onClick={onFinish} disabled={saving}
          className="px-8 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-all transform hover:scale-105 text-lg disabled:opacity-50 disabled:transform-none">
          {saving ? 'Saving your data...' : 'Go to Dashboard →'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Onboarding Page ───────────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { user } = useUser();

  // Form state
  const [profile, setProfile] = useState<UserProfile>({
    annualIncome: 0,
    annualSpend: 0,
    retirementSpend: 0,
    stateOfResidence: 'WA',
    filingStatus: 'single',
    fireNumber: 0,
    fireTargetYear: null,
  });

  const [rsuGrants, setRsuGrants] = useState<RSUGrant[]>([
    { companyTicker: '', grantDate: '', totalShares: 0, vestedShares: 0, cliffMonths: 12, vestPeriodMonths: 48, vestFrequency: 'quarterly' },
  ]);

  const [realEstate, setRealEstate] = useState<RealEstateProperty[]>([
    { address: '', propertyType: 'primary', purchasePrice: 0, purchaseDate: '', currentValue: 0, originalLoanAmount: 0, mortgageBalance: 0, mortgageRate: 0, mortgageTermMonths: 360, mortgageStartDate: '', monthlyPayment: 0, monthlyRent: null },
  ]);

  const next = () => setStep(s => Math.min(s + 1, steps.length - 1));

  const finish = async () => {
    setSaving(true);
    try {
      // Filter out empty grants and properties
      const validGrants = rsuGrants.filter(g => g.companyTicker && g.totalShares > 0);
      const validProperties = realEstate.filter(p => p.address && p.currentValue > 0);

      const res = await fetch('/api/onboarding/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId: user?.id,
          email: user?.primaryEmailAddress?.emailAddress,
          profile,
          rsuGrants: validGrants,
          realEstate: validProperties,
        }),
      });

      if (!res.ok) {
        console.error('Failed to save onboarding data:', await res.text());
      }
    } catch (err) {
      console.error('Onboarding save error:', err);
    } finally {
      setSaving(false);
      router.push('/dashboard');
    }
  };

  const data: OnboardingData = { profile, rsuGrants, realEstate };

  return (
    <div className="min-h-screen bg-bg-primary">
      {step > 0 && step < 5 && (
        <div className="fixed top-0 left-0 right-0 z-50 py-4 px-6 flex justify-center bg-bg-primary/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">Step {step} of {steps.length - 2}</span>
            <ProgressIndicator current={step} total={steps.length - 1} />
          </div>
        </div>
      )}

      <div className="pt-16 pb-8 px-4">
        
          {step === 0 && <WelcomeStep key="welcome" onNext={next} />}
          {step === 1 && <ConnectAccountsStep key="connect" onNext={next} />}
          {step === 2 && <RSUSetupStep key="rsu" onNext={next} grants={rsuGrants} setGrants={setRsuGrants} />}
          {step === 3 && <RealEstateSetupStep key="realestate" onNext={next} properties={realEstate} setProperties={setRealEstate} />}
          {step === 4 && <YourNumbersStep key="numbers" onNext={next} profile={profile} setProfile={setProfile} />}
          {step === 5 && <FirstLookStep key="firstlook" onFinish={finish} data={data} saving={saving} />}
        
      </div>
    </div>
  );
}
