'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Flame, Clock, ShieldCheck, CheckCircle2, Send } from 'lucide-react';

export default function ContactPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');

    try {
      const res = await fetch(`https://formspree.io/f/${process.env.NEXT_PUBLIC_FORMSPREE_ID}`, {
        method: 'POST',
        body: new FormData(e.currentTarget),
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        setStatus('success');
      } else {
        throw new Error('Failed');
      }
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary font-sans">
      {/* Nav */}
      <nav className="border-b border-border bg-bg-primary/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-accent-amber" />
            <span className="font-semibold tracking-tight">FireRunway</span>
          </Link>
          <Link href="/" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            ← Back to home
          </Link>
        </div>
      </nav>

      <div className="max-w-xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-3">Contact Us</h1>
          <p className="text-text-secondary leading-relaxed">
            Have a question, feedback, or partnership inquiry?<br />
            We&apos;d love to hear from you.
          </p>
        </div>

        {/* Form or Success */}
        {status === 'success' ? (
          <div className="rounded-2xl border border-border bg-bg-surface/50 backdrop-blur-sm p-10 text-center">
            <CheckCircle2 className="w-12 h-12 text-accent-green mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Message Sent!</h2>
            <p className="text-text-secondary text-sm">
              Thank you for reaching out. We&apos;ll get back to you within 1–2 business days.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-bg-surface/50 backdrop-blur-sm p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name + Email row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    placeholder="Your name"
                    required
                    className="w-full px-3 py-2.5 rounded-lg bg-bg-elevated/50 border border-border text-text-primary text-sm placeholder:text-text-secondary/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="you@example.com"
                    required
                    className="w-full px-3 py-2.5 rounded-lg bg-bg-elevated/50 border border-border text-text-primary text-sm placeholder:text-text-secondary/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="subject" className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                  Subject
                </label>
                <select
                  id="subject"
                  name="subject"
                  required
                  defaultValue=""
                  className="w-full px-3 py-2.5 rounded-lg bg-bg-elevated/50 border border-border text-text-primary text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23a1a1aa' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
                    paddingRight: '2.5rem',
                  }}
                >
                  <option value="" disabled>Select a topic</option>
                  <option value="general">General Inquiry</option>
                  <option value="support">Technical Support</option>
                  <option value="bug">Bug Report</option>
                  <option value="feature">Feature Request</option>
                  <option value="partnership">Partnership / Business</option>
                  <option value="privacy">Privacy / Data Request</option>
                </select>
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  placeholder="How can we help?"
                  required
                  rows={5}
                  className="w-full px-3 py-2.5 rounded-lg bg-bg-elevated/50 border border-border text-text-primary text-sm placeholder:text-text-secondary/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors resize-y"
                />
              </div>

              {/* Honeypot */}
              <input type="text" name="_gotcha" className="hidden" />

              {/* Submit */}
              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full py-3 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {status === 'sending' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : status === 'error' ? (
                  'Something went wrong. Try again.'
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Message
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="p-5 rounded-xl border border-border bg-bg-surface/50 backdrop-blur-sm text-center">
            <Clock className="w-6 h-6 text-accent mx-auto mb-2" />
            <h3 className="text-sm font-semibold mb-1">Response Time</h3>
            <p className="text-xs text-text-secondary leading-relaxed">We typically respond within 1–2 business days</p>
          </div>
          <div className="p-5 rounded-xl border border-border bg-bg-surface/50 backdrop-blur-sm text-center">
            <ShieldCheck className="w-6 h-6 text-accent-green mx-auto mb-2" />
            <h3 className="text-sm font-semibold mb-1">Privacy</h3>
            <p className="text-xs text-text-secondary leading-relaxed">Your information is never shared with third parties</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-text-secondary mt-10 space-y-1">
          <p><Link href="/" className="hover:text-text-primary transition-colors underline underline-offset-2">FireRunway</Link> — Financial Independence Dashboard</p>
          <p>&copy; {new Date().getFullYear()} Gunaratne. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
