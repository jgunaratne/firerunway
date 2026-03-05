'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Card from '@/components/shared/Card';
import AIAnalysis from '@/components/shared/AIAnalysis';
import { useUserData } from '@/lib/UserDataContext';
import { formatCurrency } from '@/lib/calculations';

interface IncomeTaxRecord {
  id: string;
  tax_year: number;
  filename: string;
  document_type: string;
  employer: string;
  income_breakdown: Record<string, number>;
  total_income: number;
  tax_breakdown: Record<string, number>;
  total_tax: number;
  effective_tax_rate: number;
  extraction_confidence: string;
  extraction_notes: string | null;
  uploaded_at: string;
}

const INCOME_LABELS: Record<string, string> = {
  salary: 'Salary / Wages',
  bonus: 'Bonus',
  rsu: 'RSU / Stock Comp',
  espp: 'ESPP',
  overtime: 'Overtime',
  commission: 'Commission',
  dividends: 'Dividends',
  interest: 'Interest',
  capital_gains: 'Capital Gains',
  rental: 'Rental Income',
  other: 'Other',
};

const TAX_LABELS: Record<string, string> = {
  federal: 'Federal Income Tax',
  state: 'State Income Tax',
  local: 'Local / City Tax',
  fica_ss: 'Social Security (FICA)',
  fica_medicare: 'Medicare (FICA)',
  state_disability: 'State Disability (SDI)',
  retirement_401k: '401(k) Pre-Tax',
  retirement_roth: 'Roth 401(k)',
  hsa: 'HSA Contributions',
  other: 'Other',
};

const INCOME_COLORS: Record<string, string> = {
  salary: '#6366f1',
  bonus: '#f59e0b',
  rsu: '#10b981',
  espp: '#06b6d4',
  dividends: '#8b5cf6',
  interest: '#ec4899',
  capital_gains: '#14b8a6',
  other: '#636e7b',
};

const TAX_COLORS: Record<string, string> = {
  federal: '#ef4444',
  state: '#f97316',
  fica_ss: '#eab308',
  fica_medicare: '#f59e0b',
  retirement_401k: '#10b981',
  retirement_roth: '#06b6d4',
  hsa: '#8b5cf6',
  other: '#636e7b',
};

function BreakdownBar({ items, total, colors }: {
  items: Record<string, number>;
  total: number;
  colors: Record<string, string>;
}) {
  const entries = Object.entries(items).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);
  if (total === 0) return null;

  return (
    <div className="flex rounded-lg overflow-hidden h-4">
      {entries.map(([key, value]) => (
        <div
          key={key}
          style={{ width: `${(value / total) * 100}%`, backgroundColor: colors[key] ?? '#636e7b' }}
          title={`${INCOME_LABELS[key] ?? TAX_LABELS[key] ?? key}: ${formatCurrency(value)}`}
        />
      ))}
    </div>
  );
}

function BreakdownTable({ items, labels, colors }: {
  items: Record<string, number>;
  labels: Record<string, string>;
  colors: Record<string, string>;
}) {
  const entries = Object.entries(items).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => {
        const pct = total > 0 ? (value / total) * 100 : 0;
        return (
          <div key={key} className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: colors[key] ?? '#636e7b' }} />
            <div className="flex-1 min-w-0">
              <div className="text-text-primary text-sm">{labels[key] ?? key}</div>
            </div>
            <div className="number-display text-text-primary text-sm font-medium">{formatCurrency(value)}</div>
            <div className="text-text-secondary text-xs w-12 text-right">{pct.toFixed(0)}%</div>
          </div>
        );
      })}
    </div>
  );
}

export default function IncomeTaxPage() {
  const { clerkId } = useUserData();
  const [records, setRecords] = useState<IncomeTaxRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clerkId) return;
    try {
      const res = await fetch(`/api/income-tax?clerkId=${clerkId}`);
      const data = await res.json();
      setRecords(data.records ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [clerkId]);

  useEffect(() => { if (clerkId) load(); }, [clerkId, load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    // Simulated progress — advances quickly at first, slows near the end
    let progress = 0;
    progressRef.current = setInterval(() => {
      const remaining = 90 - progress;
      progress += Math.max(remaining * 0.08, 0.5);
      if (progress > 90) progress = 90;
      setUploadProgress(Math.round(progress));
    }, 200);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/income-tax/upload?clerkId=${clerkId}`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed: ${text}`);
      }
      if (progressRef.current) clearInterval(progressRef.current);
      setUploadProgress(100);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      if (progressRef.current) clearInterval(progressRef.current);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/income-tax/${id}?clerkId=${clerkId}`, { method: 'DELETE' });
    await load();
  };

  const handleAnalyze = async (): Promise<{ analysis: string }> => {
    const res = await fetch(`/api/income-tax/analyze?clerkId=${clerkId}`, { method: 'POST' });
    if (!res.ok) throw new Error('Analysis failed');
    return res.json();
  };

  // Compute aggregated breakdown across all records
  const aggregatedIncome: Record<string, number> = {};
  const aggregatedTax: Record<string, number> = {};
  let totalIncome = 0;
  let totalTax = 0;

  for (const r of records) {
    totalIncome += r.total_income;
    totalTax += r.total_tax;
    for (const [key, val] of Object.entries(r.income_breakdown)) {
      aggregatedIncome[key] = (aggregatedIncome[key] ?? 0) + val;
    }
    for (const [key, val] of Object.entries(r.tax_breakdown)) {
      aggregatedTax[key] = (aggregatedTax[key] ?? 0) + val;
    }
  }

  const effectiveRate = totalIncome > 0 ? (totalTax / totalIncome) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="page-title">Income & Taxes</h1>
        <p className="page-subtitle">Upload W-2s and tax documents to track your income and tax burden</p>
      </div>

      {/* Upload Area */}
      <Card delay={0.1}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="section-title mb-0">Upload Tax Document</h3>
            <p className="page-subtitle">W-2, 1099, pay stub, or tax return (PDF)</p>
          </div>
          <label className={`bg-accent/20 text-accent border border-accent/30 rounded-lg px-5 py-2.5 text-sm font-medium cursor-pointer transition-colors ${uploading ? 'opacity-50 cursor-wait' : 'hover:bg-accent/30'}`}>
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                {uploadProgress < 50 ? 'Uploading...' : uploadProgress < 90 ? 'Extracting data...' : 'Finishing...'} {uploadProgress}%
              </span>
            ) : (
              '📄 Upload PDF'
            )}
            <input type="file" accept=".pdf" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
      </Card>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-accent-red text-sm bg-accent-red/10 rounded-lg p-3"
        >
          {error}
        </motion.div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-2 border-border rounded-full" />
            <div className="absolute inset-0 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-text-secondary text-sm animate-pulse">Loading tax records...</p>
        </div>
      )}

      {!loading && records.length === 0 && (
        <Card delay={0.2} className="text-center">
          <div className="py-6">
            <div className="text-4xl mb-4">📄</div>
            <p className="text-text-primary text-lg font-medium">No tax documents yet</p>
            <p className="text-text-secondary text-sm mt-1">Upload a W-2, 1099, or tax return to see your income and tax breakdown</p>
          </div>
        </Card>
      )}

      {records.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card delay={0.1}>
              <div className="text-text-secondary text-xs uppercase tracking-wider mb-1">Total Income</div>
              <div className="number-display text-3xl font-bold text-accent-green">{formatCurrency(totalIncome)}</div>
            </Card>
            <Card delay={0.15}>
              <div className="text-text-secondary text-xs uppercase tracking-wider mb-1">Total Tax</div>
              <div className="number-display text-3xl font-bold text-accent-red">{formatCurrency(totalTax)}</div>
            </Card>
            <Card delay={0.2}>
              <div className="text-text-secondary text-xs uppercase tracking-wider mb-1">Effective Tax Rate</div>
              <div className="number-display text-3xl font-bold text-accent-amber">{effectiveRate.toFixed(1)}%</div>
              <div className="text-text-secondary text-xs mt-1">Take-home: {formatCurrency(totalIncome - totalTax)}</div>
            </Card>
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card delay={0.25}>
              <h3 className="section-title">Income Breakdown</h3>
              <BreakdownBar items={aggregatedIncome} total={totalIncome} colors={INCOME_COLORS} />
              <div className="mt-4">
                <BreakdownTable items={aggregatedIncome} labels={INCOME_LABELS} colors={INCOME_COLORS} />
              </div>
            </Card>

            <Card delay={0.3}>
              <h3 className="section-title">Tax & Deductions Breakdown</h3>
              <BreakdownBar items={aggregatedTax} total={totalTax} colors={TAX_COLORS} />
              <div className="mt-4">
                <BreakdownTable items={aggregatedTax} labels={TAX_LABELS} colors={TAX_COLORS} />
              </div>
            </Card>
          </div>

          {/* Documents List */}
          <Card delay={0.35}>
            <h3 className="section-title">Uploaded Documents</h3>
            <div className="space-y-3">
              {records.map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-4 p-3 rounded-lg bg-bg-elevated/50 border border-border/50"
                >
                  <div className="w-10 h-10 rounded-lg bg-accent/20 text-accent flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {r.document_type === 'w2' ? 'W2' : r.document_type.toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-text-primary text-sm font-medium truncate">
                      {r.employer || r.filename}
                    </div>
                    <div className="text-text-secondary text-xs">
                      {r.document_type.toUpperCase()} · Tax Year {r.tax_year} · {r.extraction_confidence}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="number-display text-text-primary text-sm">{formatCurrency(r.total_income)}</div>
                    <div className="number-display text-accent-red text-xs">-{formatCurrency(r.total_tax)}</div>
                  </div>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-text-secondary hover:text-accent-red text-xs transition-colors"
                  >
                    Delete
                  </button>
                </motion.div>
              ))}
            </div>
          </Card>

          {/* AI Analysis */}
          <AIAnalysis
            type="income_tax"
            onAnalyze={handleAnalyze}
            ready={records.length > 0}
          />
        </>
      )}

      {/* Disclaimer */}
      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
      </div>
    </div>
  );
}
