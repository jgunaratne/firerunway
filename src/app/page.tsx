'use client';

import { motion } from 'framer-motion';
import {
  LineChart,
  PieChart,
  Calculator,
  Flame,
  BrainCircuit,
  FileText,
  ArrowRight,
  ShieldCheck,
  Activity,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signInWithGoogle } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthProvider';

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
      // Redirect happens automatically via the useEffect above
    } catch (error) {
      console.error('Sign-in failed:', error);
      setIsSigningIn(false);
    }
  };

  // If already logged in, the screen will transition to the dashboard, skip the rendering
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary selection:bg-accent/30 font-sans overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-bg-primary/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent/50 flex items-center justify-center">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">FireRunway</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              Sign In
            </button>
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="h-9 px-4 rounded-md bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/20 rounded-full blur-[120px] opacity-50 pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium uppercase tracking-wider mb-8"
          >
            <Activity className="w-3 h-3" />
            <span>Financial Independence Platform</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-[1.1]"
          >
            How much longer do you <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50">
              need to keep working?
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-text-secondary mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            The ultimate financial independence dashboard for senior tech workers. Model RSU compensation, aggregate accounts, and run Monte Carlo simulations to find your exact FIRE date.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="h-12 px-8 rounded-lg bg-white text-black font-medium hover:bg-gray-100 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center disabled:opacity-50"
            >
              {isSigningIn ? 'Connecting...' : 'Continue with Google'}
              {!isSigningIn && <ArrowRight className="w-4 h-4" />}
            </button>
            <button className="h-12 px-8 rounded-lg bg-bg-surface border border-border text-text-primary font-medium hover:bg-bg-elevated transition-colors flex items-center gap-2 w-full sm:w-auto justify-center">
              View Demo
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="mt-12 flex items-center justify-center gap-6 text-sm text-text-secondary"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent-green" />
              <span>Bank-level encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent-green" />
              <span>Read-only access</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="px-6 pb-24 relative z-10">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="rounded-2xl border border-border bg-bg-surface/50 backdrop-blur-sm p-2 overflow-hidden shadow-2xl shadow-black/50"
          >
            <div className="rounded-xl border border-border/50 bg-bg-primary overflow-hidden">
              {/* Mock Dashboard Header */}
              <div className="h-14 border-b border-border flex items-center px-6 justify-between bg-bg-surface/30">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-text-secondary uppercase tracking-wider font-mono">FI Score</span>
                    <span className="text-lg font-semibold text-accent-green">84</span>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-text-secondary uppercase tracking-wider font-mono">Net Worth</span>
                    <span className="text-lg font-semibold font-mono tracking-tight">$3,245,890</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                  <span className="text-xs text-text-secondary font-mono">Live Sync Active</span>
                </div>
              </div>

              {/* Mock Dashboard Content */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <div className="h-64 rounded-lg border border-border bg-bg-surface/30 p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-medium">Net Worth Trajectory</h3>
                      <div className="flex gap-2">
                        {['1M', '3M', '1Y', 'ALL'].map((t, i) => (
                          <div key={t} className={`text-xs px-2 py-1 rounded ${i === 2 ? 'bg-bg-elevated text-white' : 'text-text-secondary'}`}>
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Mock Chart */}
                    <div className="flex-1 relative flex items-end gap-1">
                      {Array.from({ length: 40 }).map((_, i) => {
                        const height = 20 + Math.pow(i, 1.2) + ((i * 13) % 10);
                        return (
                          <div
                            key={i}
                            className="flex-1 bg-accent/20 rounded-t-sm relative group"
                            style={{ height: `${height}%` }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-accent/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        );
                      })}
                      {/* Trend line mock */}
                      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                        <path d="M0,80 Q100,70 200,50 T400,20" fill="none" stroke="var(--color-accent)" strokeWidth="2" />
                      </svg>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="h-32 rounded-lg border border-border bg-bg-surface/30 p-5 flex flex-col justify-between">
                      <div className="text-xs text-text-secondary uppercase tracking-wider font-mono">Runway</div>
                      <div>
                        <div className="text-3xl font-semibold">14.2 <span className="text-lg text-text-secondary font-normal">yrs</span></div>
                        <div className="text-xs text-accent-green mt-1">Target: 25.0 yrs</div>
                      </div>
                    </div>
                    <div className="h-32 rounded-lg border border-border bg-bg-surface/30 p-5 flex flex-col justify-between">
                      <div className="text-xs text-text-secondary uppercase tracking-wider font-mono">Unvested RSUs</div>
                      <div>
                        <div className="text-3xl font-semibold font-mono tracking-tight">$412k</div>
                        <div className="text-xs text-text-secondary mt-1">Next vest: 14 days</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-lg border border-border bg-bg-surface/30 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <BrainCircuit className="w-4 h-4 text-accent" />
                      <h3 className="text-sm font-medium">AI Insights</h3>
                    </div>
                    <div className="space-y-4">
                      {[
                        "Your employer stock concentration is at 24%. Consider diversifying to reduce risk.",
                        "Based on your current savings rate, you are on track to hit your FIRE number 2 years early.",
                        "Tax loss harvesting opportunity detected in your taxable brokerage account."
                      ].map((insight, i) => (
                        <div key={i} className="p-3 rounded bg-bg-elevated/50 border border-border/50 text-sm text-text-secondary leading-relaxed">
                          {insight}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 bg-bg-surface/30 border-y border-border relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Everything you need to plan your exit.</h2>
            <p className="text-text-secondary max-w-2xl mx-auto">Stop using fragile spreadsheets. FireRunway connects directly to your accounts to provide real-time, actionable insights.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<LineChart className="w-5 h-5 text-accent" />}
              title="Net Worth Tracking"
              description="Connect brokerage, bank, and real estate accounts via SnapTrade and Plaid for real-time net worth tracking."
            />
            <FeatureCard
              icon={<PieChart className="w-5 h-5 text-accent" />}
              title="Portfolio Analysis"
              description="Deep dive into asset allocation, performance, and concentration risk across all your connected accounts."
            />
            <FeatureCard
              icon={<TrendingUp className="w-5 h-5 text-accent" />}
              title="RSU & Equity Modeling"
              description="Track unvested RSUs, model stock price scenarios, and visualize your vesting timeline over the next 24 months."
            />
            <FeatureCard
              icon={<Calculator className="w-5 h-5 text-accent" />}
              title="Monte Carlo Simulations"
              description="Run 10,000 client-side simulations to determine your success rate and median portfolio value at year 20."
            />
            <FeatureCard
              icon={<BrainCircuit className="w-5 h-5 text-accent" />}
              title="Gemini AI Analysis"
              description="Get plain-English interpretations of your financial data, Monte Carlo results, and portfolio concentration."
            />
            <FeatureCard
              icon={<FileText className="w-5 h-5 text-accent" />}
              title="Smart Document Parsing"
              description="Drag and drop brokerage statements and tax documents. Our AI extracts holdings, income, and tax data automatically."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 relative overflow-hidden z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-accent/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Ready to find your FIRE number?</h2>
          <p className="text-lg text-text-secondary mb-10">Join hundreds of senior tech workers who have already mapped out their path to financial independence.</p>
          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="h-14 px-10 rounded-lg bg-white text-black font-medium text-lg hover:bg-gray-100 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          >
            {isSigningIn ? 'Connecting...' : 'Start Your Free Trial'}
            {!isSigningIn && <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-accent" />
            <span className="font-semibold tracking-tight">FireRunway</span>
          </div>
          <p className="text-sm text-text-secondary text-center md:text-left">
            FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
          </p>
          <div className="flex items-center gap-6 text-sm text-text-secondary">
            <Link href="#" className="hover:text-text-primary transition-colors">Terms</Link>
            <Link href="#" className="hover:text-text-primary transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-xl border border-border bg-bg-elevated/50 hover:bg-bg-elevated transition-colors group">
      <div className="w-10 h-10 rounded-lg bg-bg-surface border border-border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </div>
  );
}
