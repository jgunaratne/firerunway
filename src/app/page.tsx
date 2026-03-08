'use client';

import { useAuth } from '@/lib/AuthProvider';
import { signInWithGoogle } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TrendingUp, Shield, Zap, BarChart3, PieChart, Brain } from 'lucide-react';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);

  // If already authed, go to dashboard
  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
      router.push('/dashboard');
    } catch (err) {
      console.error('Sign-in error:', err);
      setSigningIn(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-glow" />
        <div className="landing-hero-content">
          <div className="landing-badge">
            <Zap size={14} />
            <span>Financial Independence Platform</span>
          </div>
          <h1 className="landing-title">
            Your Complete<br />
            <span className="landing-title-accent">FIRE Dashboard</span>
          </h1>
          <p className="landing-subtitle">
            Track net worth, analyze investments, simulate retirement scenarios, and
            reach financial independence — all in one place.
          </p>
          <div className="landing-cta-group">
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              className="landing-cta-primary"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {signingIn ? 'Signing in...' : 'Sign in with Google'}
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="landing-features">
        <h2 className="landing-section-title">Everything you need for FIRE</h2>
        <div className="landing-features-grid">
          {[
            { icon: <TrendingUp size={24} />, title: 'Net Worth Tracking', desc: 'Aggregate all your accounts — brokerage, real estate, RSUs — in one real-time view.' },
            { icon: <PieChart size={24} />, title: 'Portfolio Analysis', desc: 'Connect via SnapTrade & Plaid. See holdings, allocation, and performance at a glance.' },
            { icon: <BarChart3 size={24} />, title: 'Monte Carlo Simulation', desc: 'Run thousands of scenarios to stress-test your retirement plan against market volatility.' },
            { icon: <Shield size={24} />, title: 'FIRE Score', desc: 'One number that tells you how close you are to financial independence, updated live.' },
            { icon: <Brain size={24} />, title: 'AI Analysis', desc: 'Gemini-powered insights on your portfolio, taxes, and spending — personalized to your data.' },
            { icon: <Zap size={24} />, title: 'Statement Upload', desc: 'Upload brokerage PDFs that are instantly parsed by AI. Your data stays yours.' },
          ].map((feature) => (
            <div key={feature.title} className="landing-feature-card">
              <div className="landing-feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="landing-bottom-cta">
        <h2>Start your FIRE journey today</h2>
        <p>Free. No credit card required. Your data never leaves your account.</p>
        <button onClick={handleSignIn} disabled={signingIn} className="landing-cta-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Get Started
        </button>
      </section>
    </div>
  );
}
