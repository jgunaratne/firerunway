'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency } from '@/lib/calculations';

const steps = [
  'Welcome',
  'Create Account',
  'Connect Accounts',
  'RSU Setup',
  'Real Estate',
  'Your Numbers',
  'First Look',
];

function ProgressIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${i < current ? 'bg-accent w-8' : i === current ? 'bg-accent w-12' : 'bg-border w-8'
            }`}
        />
      ))}
    </div>
  );
}

// Welcome Screen
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <span className="text-6xl mb-6 block">🔥</span>
      </motion.div>
      <motion.h1
        className="font-display text-3xl lg:text-5xl text-text-primary max-w-2xl leading-tight"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        Know if you&apos;re financially independent — before you find out the hard way
      </motion.h1>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="mt-10"
      >
        <button
          onClick={onNext}
          className="px-8 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-all transform hover:scale-105 text-lg"
        >
          Get Started
        </button>
      </motion.div>
    </motion.div>
  );
}

// Create Account Screen
function CreateAccountStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="max-w-md mx-auto space-y-6"
    >
      <div>
        <h2 className="font-display text-2xl text-text-primary">Create Your Account</h2>
        <p className="text-sm text-text-secondary mt-1">Secure, private, encrypted</p>
      </div>

      <div className="space-y-4">
        <button className="w-full glass-card-hover p-3 flex items-center justify-center gap-3 text-sm font-medium">
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-text-secondary">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-secondary block mb-1">Email</label>
            <input type="email" placeholder="you@email.com" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary/50 focus:border-accent focus:outline-none transition-colors" />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">Password</label>
            <input type="password" placeholder="••••••••••" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary/50 focus:border-accent focus:outline-none transition-colors" />
          </div>
        </div>

        <button
          onClick={onNext}
          className="w-full py-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-all text-sm"
        >
          Create Account
        </button>
      </div>
    </motion.div>
  );
}

// Connect Accounts Screen
function ConnectAccountsStep({ onNext }: { onNext: () => void }) {
  const [connected, setConnected] = useState({ brokerage: false, retirement: false, ira: false });

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="max-w-md mx-auto space-y-6"
    >
      <div>
        <h2 className="font-display text-2xl text-text-primary">Connect Your Accounts</h2>
        <p className="text-sm text-text-secondary mt-1">Securely link your brokerage and retirement accounts</p>
      </div>

      <div className="space-y-3">
        {[
          { key: 'brokerage', label: 'Brokerage', desc: 'Schwab, Fidelity, E*Trade, etc.', icon: '📈' },
          { key: 'retirement', label: '401k / Retirement', desc: 'Employer retirement plan', icon: '🏦' },
          { key: 'ira', label: 'IRA / Roth IRA', desc: 'Individual retirement accounts', icon: '💰' },
        ].map((account) => (
          <button
            key={account.key}
            onClick={() => setConnected(prev => ({ ...prev, [account.key]: !prev[account.key as keyof typeof prev] }))}
            className={`w-full glass-card p-4 flex items-center gap-4 text-left transition-all ${connected[account.key as keyof typeof connected] ? 'border-emerald-500/30 bg-emerald-500/5' : ''
              }`}
          >
            <span className="text-2xl">{account.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">{account.label}</p>
              <p className="text-xs text-text-secondary">{account.desc}</p>
            </div>
            <span className="text-lg">{connected[account.key as keyof typeof connected] ? '✅' : '○'}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={onNext} className="flex-1 py-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-all text-sm">
          Continue
        </button>
        <button onClick={onNext} className="px-4 py-2.5 text-text-secondary text-sm hover:text-text-primary transition-colors">
          Skip for now
        </button>
      </div>
    </motion.div>
  );
}

// RSU Setup Screen
function RSUSetupStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="max-w-lg mx-auto space-y-6"
    >
      <div>
        <h2 className="font-display text-2xl text-text-primary">RSU / Equity Setup</h2>
        <p className="text-sm text-text-secondary mt-1">Tell us about your equity compensation</p>
      </div>

      <div className="glass-card p-5 space-y-4">
        <div>
          <label className="text-xs text-text-secondary block mb-1">Employer Company</label>
          <input type="text" defaultValue="Amazon" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1">Grant Date</label>
            <input type="date" defaultValue="2022-01-15" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors" />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">Total Shares Granted</label>
            <input type="number" defaultValue={1000} className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors number-display" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1">Shares Already Vested</label>
            <input type="number" defaultValue={750} className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors number-display" />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">Vesting Schedule</label>
            <select className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors">
              <option>4-year / 1-year cliff</option>
              <option>Custom</option>
            </select>
          </div>
        </div>
      </div>

      <button className="w-full glass-card-hover p-3 text-sm text-accent font-medium flex items-center justify-center gap-2">
        <span>+</span> Add Another Grant
      </button>

      <button className="w-full glass-card-hover p-3 text-sm text-text-secondary font-medium flex items-center justify-center gap-2">
        📄 Upload Grant Document (AI will parse it)
      </button>

      <button onClick={onNext} className="w-full py-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-all text-sm">
        Continue
      </button>
    </motion.div>
  );
}

// Real Estate Setup Screen
function RealEstateSetupStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="max-w-lg mx-auto space-y-6"
    >
      <div>
        <h2 className="font-display text-2xl text-text-primary">Real Estate</h2>
        <p className="text-sm text-text-secondary mt-1">Add your properties to get a complete net worth picture</p>
      </div>

      <div className="glass-card p-5 space-y-4">
        <div>
          <label className="text-xs text-text-secondary block mb-1">Property Address</label>
          <input type="text" defaultValue="123 Main St, Seattle, WA" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1">Property Type</label>
            <select className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none">
              <option>Primary Residence</option>
              <option>Rental</option>
              <option>Vacation</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">Current Value</label>
            <input type="text" defaultValue="$1,400,000" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none number-display" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1">Mortgage Balance</label>
            <input type="text" defaultValue="$620,000" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none number-display" />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">Monthly Payment</label>
            <input type="text" defaultValue="$3,840" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none number-display" />
          </div>
        </div>
      </div>

      <button className="w-full glass-card-hover p-3 text-sm text-accent font-medium flex items-center justify-center gap-2">
        <span>+</span> Add Another Property
      </button>

      <div className="flex gap-3">
        <button onClick={onNext} className="flex-1 py-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-all text-sm">
          Continue
        </button>
        <button onClick={onNext} className="px-4 py-2.5 text-text-secondary text-sm hover:text-text-primary transition-colors">
          Skip
        </button>
      </div>
    </motion.div>
  );
}

// Your Numbers Screen
function YourNumbersStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="max-w-lg mx-auto space-y-6"
    >
      <div>
        <h2 className="font-display text-2xl text-text-primary">Your Numbers</h2>
        <p className="text-sm text-text-secondary mt-1">We need a few more details to calculate your FIRE score</p>
      </div>

      <div className="glass-card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1">Annual Gross Income</label>
            <input type="text" defaultValue="$380,000" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none number-display" />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">Annual Expenses</label>
            <input type="text" defaultValue="$120,000" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none number-display" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1">Retirement Spending</label>
            <input type="text" defaultValue="$96,000" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none number-display" />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">Target FIRE Date</label>
            <input type="text" placeholder="Optional — we'll calculate" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary/50 focus:border-accent focus:outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1">State of Residence</label>
            <select className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none">
              <option>WA — Washington</option>
              <option>CA — California</option>
              <option>NY — New York</option>
              <option>TX — Texas</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">Filing Status</label>
            <select className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none">
              <option>Single</option>
              <option>Married Filing Jointly</option>
            </select>
          </div>
        </div>
      </div>

      <button onClick={onNext} className="w-full py-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-all text-sm">
        Calculate My Score
      </button>
    </motion.div>
  );
}

// First Look / Payoff Screen
function FirstLookStep({ onFinish }: { onFinish: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 space-y-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
      >
        <span className="text-7xl block">🔥</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="space-y-2"
      >
        <p className="text-sm text-text-secondary uppercase tracking-wider">Your FI Score</p>
        <p className="number-display text-7xl lg:text-8xl font-bold text-accent">
          <AnimatedNumber value={72} duration={1500} />
        </p>
        <p className="text-text-secondary">out of 100 — Approaching Independence</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="grid grid-cols-3 gap-6 max-w-xl"
      >
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-text-secondary mb-1">Net Worth</p>
          <p className="number-display text-xl font-bold text-emerald-400">
            <AnimatedNumber value={3960000} format={(n) => formatCurrency(n, true)} duration={1200} />
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-text-secondary mb-1">FIRE Date</p>
          <p className="number-display text-xl font-bold text-text-primary">
            <AnimatedNumber value={2028} duration={1200} />
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-text-secondary mb-1">Runway</p>
          <p className="number-display text-xl font-bold text-accent">
            <AnimatedNumber value={142} format={(n) => `${(n / 10).toFixed(1)}yr`} duration={1200} />
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8 }}
      >
        <button
          onClick={onFinish}
          className="px-8 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-all transform hover:scale-105 text-lg"
        >
          Go to Dashboard →
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();

  const next = () => setStep(s => Math.min(s + 1, steps.length - 1));
  const finish = () => router.push('/dashboard');

  // Step mappings (0-based):
  // 0: Welcome, 1: Create, 2: Connect, 3: RSU, 4: Real Estate, 5: Numbers, 6: First Look

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Progress (hidden on welcome and first look) */}
      {step > 0 && step < 6 && (
        <div className="fixed top-0 left-0 right-0 z-50 py-4 px-6 flex justify-center bg-bg-primary/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary">Step {step} of 5</span>
            <ProgressIndicator current={step} total={6} />
          </div>
        </div>
      )}

      <div className="pt-16 pb-8 px-4">
        <AnimatePresence mode="wait">
          {step === 0 && <WelcomeStep key="welcome" onNext={next} />}
          {step === 1 && <CreateAccountStep key="create" onNext={next} />}
          {step === 2 && <ConnectAccountsStep key="connect" onNext={next} />}
          {step === 3 && <RSUSetupStep key="rsu" onNext={next} />}
          {step === 4 && <RealEstateSetupStep key="realestate" onNext={next} />}
          {step === 5 && <YourNumbersStep key="numbers" onNext={next} />}
          {step === 6 && <FirstLookStep key="firstlook" onFinish={finish} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
