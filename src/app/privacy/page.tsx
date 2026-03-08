'use client';

import Link from 'next/link';
import { Flame, Shield, Database, Eye, Lock, Trash2, Mail, Server, Key, Network, AlertTriangle, Users, FileCheck } from 'lucide-react';

export default function PrivacyPage() {
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

      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium uppercase tracking-wider mb-6">
            <Shield className="w-3 h-3" />
            <span>Privacy &amp; Security</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">Privacy Policy &amp; Security Practices</h1>
          <p className="text-text-secondary leading-relaxed">
            Last updated: March 2026
          </p>
        </div>

        <div className="space-y-6">
          {/* Overview */}
          <Section icon={<Eye className="w-5 h-5 text-accent" />} title="Overview">
            <p>
              FireRunway is a personal financial dashboard that helps you track your path to financial independence.
              We take your privacy and security seriously and are committed to protecting your personal and financial information.
              This policy describes what data we collect, how we use it, how we protect it, and your rights regarding your data.
            </p>
          </Section>

          {/* Data Collection */}
          <Section icon={<Database className="w-5 h-5 text-accent" />} title="Information We Collect">
            <p className="mb-3">We collect only the data necessary to provide our service:</p>
            <ul className="list-disc list-outside ml-5 space-y-2">
              <li><strong className="text-text-primary">Account Information:</strong> Name, email address, and profile photo from your Google account when you sign in via Firebase Authentication.</li>
              <li><strong className="text-text-primary">Financial Data:</strong> Portfolio holdings, account balances, real estate values, RSU grants, income, and spending information you provide or connect via read-only brokerage integrations (SnapTrade, Plaid).</li>
              <li><strong className="text-text-primary">Uploaded Documents:</strong> Brokerage statements and tax documents you upload for AI-powered extraction. Documents are processed in-memory and are not permanently stored after extraction.</li>
              <li><strong className="text-text-primary">Usage Data:</strong> Basic analytics to improve the product experience. We do not use third-party tracking pixels or advertising SDKs.</li>
            </ul>
          </Section>

          {/* Data Processing & Use */}
          <Section icon={<Server className="w-5 h-5 text-accent" />} title="How We Process & Use Your Data">
            <p className="mb-3">Your data is processed solely to power your personal financial dashboard:</p>
            <ul className="list-disc list-outside ml-5 space-y-2">
              <li><strong className="text-text-primary">Collection:</strong> Financial data is collected via authenticated, read-only API connections to SnapTrade and Plaid. We never access your bank login credentials — authentication is handled entirely by these providers using OAuth.</li>
              <li><strong className="text-text-primary">Processing:</strong> Data is used to calculate net worth, FIRE score, projections, and AI-powered insights via Google Gemini. AI analysis is performed on-demand and is not used to train models.</li>
              <li><strong className="text-text-primary">Storage:</strong> Processed financial data is stored in Supabase (PostgreSQL) with row-level security policies ensuring users can only access their own data.</li>
            </ul>
            <div className="mt-4 p-4 rounded-lg border border-accent-green/30 bg-accent-green/5">
              <p className="text-text-primary font-medium mb-1">We never sell your data.</p>
              <p>Your financial information is used solely to power your personal dashboard. We do not monetize, sell, or share your data with advertisers or data brokers.</p>
            </div>
          </Section>

          {/* Encryption & Data Security */}
          <Section icon={<Key className="w-5 h-5 text-accent-green" />} title="Encryption & Data Security">
            <p className="mb-3">We implement industry-standard security controls to protect your data at every layer:</p>
            <div className="space-y-4">
              <div>
                <h4 className="text-text-primary font-medium mb-1">Data in Transit</h4>
                <ul className="list-disc list-outside ml-5 space-y-1">
                  <li>All data transmitted between your browser and our servers uses TLS 1.2 or higher.</li>
                  <li>API connections to third-party services (Plaid, SnapTrade, Gemini) use HTTPS with certificate validation.</li>
                </ul>
              </div>
              <div>
                <h4 className="text-text-primary font-medium mb-1">Data at Rest</h4>
                <ul className="list-disc list-outside ml-5 space-y-1">
                  <li>Database storage is encrypted at rest using AES-256 via Supabase&apos;s managed PostgreSQL infrastructure.</li>
                  <li>API keys and secrets are stored as environment variables, never committed to source code.</li>
                </ul>
              </div>
              <div>
                <h4 className="text-text-primary font-medium mb-1">Authentication</h4>
                <ul className="list-disc list-outside ml-5 space-y-1">
                  <li>User authentication is handled by Firebase Authentication (Google) with industry-standard OAuth 2.0 flows.</li>
                  <li>Server-side API routes verify Firebase ID tokens on every request.</li>
                  <li>No passwords are stored — authentication is delegated to Google&apos;s identity platform.</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* Access Management */}
          <Section icon={<Lock className="w-5 h-5 text-accent" />} title="Access Management">
            <ul className="list-disc list-outside ml-5 space-y-2">
              <li><strong className="text-text-primary">Row-Level Security:</strong> Database queries are scoped to the authenticated user&apos;s UID via Supabase RLS policies. Users cannot access other users&apos; data.</li>
              <li><strong className="text-text-primary">Read-Only Brokerage Access:</strong> Brokerage connections via SnapTrade and Plaid are strictly read-only. We cannot move money, execute trades, or modify your accounts in any way.</li>
              <li><strong className="text-text-primary">Principle of Least Privilege:</strong> Server-side service accounts have the minimum permissions required to perform their function.</li>
              <li><strong className="text-text-primary">No Shared Credentials:</strong> All system access uses unique credentials. Secrets are rotated periodically.</li>
            </ul>
          </Section>

          {/* Network Security */}
          <Section icon={<Network className="w-5 h-5 text-accent-amber" />} title="Network & Infrastructure Security">
            <ul className="list-disc list-outside ml-5 space-y-2">
              <li><strong className="text-text-primary">Hosting:</strong> The application is deployed on managed cloud infrastructure with built-in DDoS protection, firewall rules, and automatic security patching.</li>
              <li><strong className="text-text-primary">No Direct Database Access:</strong> The database is not exposed to the public internet. All data access goes through authenticated API routes.</li>
              <li><strong className="text-text-primary">CORS Policies:</strong> API routes enforce strict Cross-Origin Resource Sharing rules to prevent unauthorized cross-site requests.</li>
              <li><strong className="text-text-primary">Dependency Management:</strong> Dependencies are regularly audited for known vulnerabilities.</li>
            </ul>
          </Section>

          {/* Third-Party Services */}
          <Section icon={<Shield className="w-5 h-5 text-accent" />} title="Third-Party Services & Vendor Management">
            <p className="mb-3">We integrate with the following vetted third-party services. Each vendor has been selected for their strong security posture:</p>
            <div className="space-y-3">
              {[
                { name: 'Firebase (Google)', desc: 'Authentication and identity management. SOC 2 Type II certified. ISO 27001 compliant.' },
                { name: 'Supabase', desc: 'Secure PostgreSQL database with row-level security, encrypted at rest, and SOC 2 Type II certified.' },
                { name: 'Plaid', desc: 'Bank account and transaction data aggregation. SOC 2 Type II certified. Read-only OAuth access. No bank credentials stored.' },
                { name: 'SnapTrade', desc: 'Brokerage account connections. Read-only access via industry-standard OAuth. No trading credentials stored.' },
                { name: 'Google Gemini', desc: 'AI-powered financial analysis. Data sent to Gemini is not used to train models per Google\'s API data usage policy.' },
                { name: 'Formspree', desc: 'Contact form submissions only. No financial data is transmitted.' },
              ].map((vendor) => (
                <div key={vendor.name} className="flex gap-3 text-sm">
                  <div className="w-1 bg-border rounded-full shrink-0" />
                  <div>
                    <span className="text-text-primary font-medium">{vendor.name}:</span>{' '}
                    <span>{vendor.desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4">
              All vendor integrations are reviewed for security compliance. Confidential information shared with vendors is governed by their respective data processing agreements.
            </p>
          </Section>

          {/* Incident Response */}
          <Section icon={<AlertTriangle className="w-5 h-5 text-accent-red" />} title="Incident Response">
            <ul className="list-disc list-outside ml-5 space-y-2">
              <li><strong className="text-text-primary">Monitoring:</strong> Application errors and security events are logged and monitored.</li>
              <li><strong className="text-text-primary">Response:</strong> In the event of a data breach, affected users will be notified within 72 hours with details of the breach and remediation steps taken.</li>
              <li><strong className="text-text-primary">Post-Incident:</strong> All security incidents are reviewed with a post-mortem to prevent recurrence.</li>
            </ul>
          </Section>

          {/* Change Management */}
          <Section icon={<FileCheck className="w-5 h-5 text-accent" />} title="Change Management">
            <ul className="list-disc list-outside ml-5 space-y-2">
              <li>All code changes are version controlled via Git and reviewed before deployment.</li>
              <li>Production deployments go through CI/CD pipelines with automated builds and linting.</li>
              <li>Environment-specific configurations are managed through environment variables, never hardcoded.</li>
            </ul>
          </Section>

          {/* User Rights */}
          <Section icon={<Users className="w-5 h-5 text-accent-green" />} title="Your Rights">
            <p className="mb-3">You have the following rights regarding your data:</p>
            <ul className="list-disc list-outside ml-5 space-y-2">
              <li><strong className="text-text-primary">Access:</strong> You can view all data we hold about you directly in your dashboard.</li>
              <li><strong className="text-text-primary">Correction:</strong> You can update your profile, financial data, and connected accounts at any time.</li>
              <li><strong className="text-text-primary">Portability:</strong> Your financial data is accessible through your connected account providers.</li>
              <li><strong className="text-text-primary">Revocation:</strong> You can disconnect brokerage accounts at any time, immediately revoking our read-only access.</li>
              <li><strong className="text-text-primary">Deletion:</strong> You can request complete deletion of your account and all associated data.</li>
            </ul>
          </Section>

          {/* Data Deletion */}
          <Section icon={<Trash2 className="w-5 h-5 text-accent-red" />} title="Data Deletion">
            <p>
              You can request deletion of your account and all associated data at any time by contacting us
              via our <Link href="/contact" className="text-accent hover:text-accent/80 transition-colors underline underline-offset-2">contact page</Link>.
              Upon receiving your request:
            </p>
            <ul className="list-disc list-outside ml-5 space-y-2 mt-3">
              <li>All brokerage connections will be immediately revoked.</li>
              <li>Your financial data, uploaded documents, and profile will be permanently deleted from our database within 30 days.</li>
              <li>Backups containing your data will be purged on the next retention cycle.</li>
            </ul>
          </Section>

          {/* Contact */}
          <Section icon={<Mail className="w-5 h-5 text-accent" />} title="Questions?">
            <p>
              If you have any questions about this privacy policy or our security practices, please{' '}
              <Link href="/contact" className="text-accent hover:text-accent/80 transition-colors underline underline-offset-2">get in touch</Link>.
              We are committed to transparency and will be happy to address any concerns.
            </p>
          </Section>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-text-secondary mt-12 space-y-1">
          <p><Link href="/" className="hover:text-text-primary transition-colors underline underline-offset-2">FireRunway</Link> — Financial Independence Dashboard</p>
          <p>&copy; {new Date().getFullYear()} Gunaratne. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-bg-surface/50 backdrop-blur-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="p-6 text-sm text-text-secondary leading-relaxed">
        {children}
      </div>
    </div>
  );
}
