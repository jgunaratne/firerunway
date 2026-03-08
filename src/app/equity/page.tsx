'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { formatCurrency } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { useBrokerageData } from '@/lib/BrokerageDataContext';
import { Upload, AlertTriangle, Pencil, X, Trash2 } from 'lucide-react';

function ConcentrationGauge({ pct, size = 220 }: { pct: number; size?: number }) {
  const radius = (size - 28) / 2;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - Math.min(pct / 50, 1));
  const color = pct <= 15 ? '#10b981' : pct <= 25 ? '#f59e0b' : '#ef4444';
  const glowColor = pct <= 15 ? 'rgba(16,185,129,0.4)' : pct <= 25 ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)';
  const label = pct <= 15 ? 'Well diversified' : pct <= 25 ? 'Moderate concentration' : 'High concentration risk';

  return (
    <div className="flex flex-col items-center relative">
      {/* Ambient glow */}
      <div
        className="absolute top-0 w-40 h-24 rounded-full blur-3xl opacity-25 pulse-glow"
        style={{ background: glowColor }}
      />
      <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
        <path
          d={`M 14,${size / 2 + 14} A ${radius},${radius} 0 0,1 ${size - 14},${size / 2 + 14}`}
          fill="none" stroke="var(--overlay-separator)" strokeWidth="8" strokeLinecap="round"
        />
        <path
          d={`M 14,${size / 2 + 14} A ${radius},${radius} 0 0,1 ${size - 14},${size / 2 + 14}`}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 10px ${glowColor})` }}
        />
        <text x={size / 2} y={size / 2 - 5} textAnchor="middle" className="number-display" fill={color} fontSize="38" fontWeight="bold">
          {pct.toFixed(0)}%
        </text>
        <text x={size / 2} y={size / 2 + 18} textAnchor="middle" fill="var(--text-secondary)" fontSize="12" fontWeight="500">
          of net worth
        </text>
      </svg>
      <p className="text-sm mt-1 font-medium" style={{ color }}>{label}</p>
    </div>
  );
}

export default function EquityPage() {
  const { rsuGrants, realEstate, clerkId: userId, refresh } = useUserData();
  const { totalInvestment } = useBrokerageData();
  const [priceAdjust, setPriceAdjust] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(190);

  // Upload & preview state
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  interface PreviewGrant {
    company_ticker: string;
    grant_date: string;
    total_shares: number;
    vested_shares: number;
    vest_period_months: number;
    vest_frequency: string;
    cliff_months: number;
  }
  const [previewGrants, setPreviewGrants] = useState<PreviewGrant[] | null>(null);
  const [extractionNotes, setExtractionNotes] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'text' | 'pdf'>('text');
  const [pastedText, setPastedText] = useState('');

  // Use first grant's ticker for price lookup
  const ticker = rsuGrants[0]?.company_ticker || '';

  // Fetch real stock price from our API
  useEffect(() => {
    if (!ticker) return;
    (async () => {
      try {
        const res = await fetch(`/api/stock/${ticker}`);
        const data = await res.json();
        if (data.price) setCurrentPrice(data.price);
      } catch {
        // Fall back to default price
      }
    })();
  }, [ticker]);

  const adjustedPrice = currentPrice * (1 + priceAdjust / 100);

  const totalVestedShares = rsuGrants.reduce((s, g) => s + g.vested_shares, 0);
  const totalUnvestedShares = rsuGrants.reduce((s, g) => s + (g.total_shares - g.vested_shares), 0);
  const vestedValue = totalVestedShares * adjustedPrice;
  const unvestedValue = totalUnvestedShares * adjustedPrice;
  const totalRSUValue = vestedValue + unvestedValue;
  const realEstateEquity = realEstate.reduce((sum, p) => sum + (p.current_value - p.mortgage_balance), 0);
  // Include SnapTrade portfolio in net worth for concentration calc
  const netWorth = totalRSUValue + realEstateEquity + totalInvestment;
  const concentrationPct = netWorth > 0 ? (totalRSUValue / netWorth) * 100 : 0;

  // Estimate FIRE date delta
  const monthsDelta = Math.round(priceAdjust * 0.3);

  // Compute vesting events from actual RSU grants
  const adjustedEvents = useMemo(() => {
    const events: { date: string; shares: number; grossValue: number; afterTaxValue: number }[] = [];
    const now = new Date();
    for (const grant of rsuGrants) {
      const unvested = grant.total_shares - grant.vested_shares;
      if (unvested <= 0) continue;
      const freq = grant.vest_frequency === 'monthly' ? 1 : 3;
      const sharesPerVest = Math.round(grant.total_shares / (grant.vest_period_months / freq));
      for (let i = 0; i < 8; i++) {
        const vestDate = new Date(now);
        vestDate.setMonth(vestDate.getMonth() + (i * freq));
        if (sharesPerVest <= 0) break;
        events.push({
          date: vestDate.toISOString().split('T')[0],
          shares: sharesPerVest,
          grossValue: sharesPerVest * adjustedPrice,
          afterTaxValue: sharesPerVest * adjustedPrice * 0.557,
        });
      }
    }
    return events.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  }, [rsuGrants, adjustedPrice]);

  const taxRate = {
    federal: 35,
    state: 9.3,
    total: 44.3,
  };

  // Step 1: Extract grants from PDF (preview only, no save)
  const handleExtract = useCallback(async (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) return;

    setUploading(true);
    setUploadError(null);
    setPreviewGrants(null);

    try {
      const formData = new FormData();
      pdfFiles.forEach(f => formData.append('files', f));

      const res = await fetch(`/api/rsu/upload?clerkId=${userId}&action=extract`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || 'Extraction failed');
        return;
      }

      if (!data.grants || data.grants.length === 0) {
        setUploadError(data.errors?.join('; ') || 'No RSU grants found in the document');
        return;
      }

      setPreviewGrants(data.grants);
      setExtractionNotes(data.extractionNotes || null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [userId]);

  // Extract grants from pasted text
  const handleExtractText = useCallback(async () => {
    if (!pastedText.trim()) return;

    setUploading(true);
    setUploadError(null);
    setPreviewGrants(null);

    try {
      const res = await fetch(`/api/rsu/upload?clerkId=${userId}&action=extract-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pastedText }),
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || 'Extraction failed');
        return;
      }

      if (!data.grants || data.grants.length === 0) {
        setUploadError(data.errors?.join('; ') || 'No RSU grants found in the text');
        return;
      }

      setPreviewGrants(data.grants);
      setExtractionNotes(data.extractionNotes || null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setUploading(false);
    }
  }, [userId, pastedText]);

  // Step 2: Save reviewed grants to database
  const handleSaveGrants = useCallback(async () => {
    if (!previewGrants || previewGrants.length === 0) return;

    setSaving(true);
    setUploadError(null);

    try {
      const res = await fetch(`/api/rsu/upload?clerkId=${userId}&action=save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grants: previewGrants }),
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'Save failed');
        return;
      }

      setPreviewGrants(null);
      await refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [previewGrants, userId, refresh]);

  // Update a field in a preview grant
  const updatePreviewGrant = useCallback((idx: number, field: keyof PreviewGrant, value: string | number) => {
    setPreviewGrants(prev => {
      if (!prev) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  }, []);

  // Reset all grants
  const [resetting, setResetting] = useState(false);
  const handleResetGrants = useCallback(async () => {
    if (!confirm('Delete all RSU grants and start fresh? This cannot be undone.')) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/rsu/upload?clerkId=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        await refresh();
        setPreviewGrants(null);
        setUploadError(null);
      }
    } catch (err) {
      console.error('Reset failed:', err);
    } finally {
      setResetting(false);
    }
  }, [userId, refresh]);

  return (
    <div className="space-y-8">
      <div
      >
        <h1 className="page-title">Equity / RSUs</h1>
        <p className="page-subtitle">Equity compensation — vesting, concentration, and scenarios</p>
      </div>

      {/* Concentration Gauge — only show when grants exist */}
      {rsuGrants.length > 0 && <Card className="text-center py-10 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-accent-amber/[0.04] rounded-full blur-3xl pointer-events-none" />
        <p className="stat-label mb-4 relative z-10">Employer Stock Concentration</p>
        <ConcentrationGauge pct={concentrationPct} />
        <div className="flex justify-center gap-10 mt-5 text-sm relative z-10">
          <div>
            <p className="stat-label">Unvested Value</p>
            <p className="number-display font-bold text-accent-amber glow-text-amber mt-1">
              <AnimatedNumber value={Math.round(unvestedValue)} format={(n) => formatCurrency(n)} />
            </p>
          </div>
          <div>
            <p className="stat-label">Vested Unsold</p>
            <p className="number-display font-bold text-text-primary glow-text mt-1">
              <AnimatedNumber value={Math.round(vestedValue)} format={(n) => formatCurrency(n)} />
            </p>
          </div>
        </div>
      </Card>}

      {/* Stock Price Scenario Slider — only show when grants exist */}
      {rsuGrants.length > 0 &&
      <Card>
        <h3 className="section-title">Stock Price Scenario</h3>
        <p className="text-sm text-text-secondary mb-4">Drag to see how price changes affect your finances</p>

        <div className="flex items-center justify-between text-sm text-text-secondary mb-2">
          <span>-50%</span>
          <span className="number-display text-lg font-bold text-text-primary">
              {ticker} ${adjustedPrice.toFixed(2)}
            {priceAdjust !== 0 && (
              <span className={priceAdjust > 0 ? 'text-emerald-400 ml-2' : 'text-red-400 ml-2'}>
                ({priceAdjust > 0 ? '+' : ''}{priceAdjust}%)
              </span>
            )}
          </span>
          <span>+50%</span>
        </div>
        <input
          type="range"
          min={-50}
          max={50}
          step={1}
          value={priceAdjust}
          onChange={(e) => setPriceAdjust(Number(e.target.value))}
          className="w-full accent-accent"
        />

        {priceAdjust !== 0 && (
          <div
            className="mt-4 grid grid-cols-3 gap-4 text-center"
          >
            <div className="glass-card p-3 rounded-lg">
              <p className="text-sm text-text-secondary">Unvested Value</p>
              <p className="number-display text-sm font-bold text-text-primary">{formatCurrency(unvestedValue)}</p>
            </div>
            <div className="glass-card p-3 rounded-lg">
              <p className="text-sm text-text-secondary">Concentration</p>
              <p className="number-display text-sm font-bold" style={{ color: concentrationPct > 25 ? '#ef4444' : concentrationPct > 15 ? '#f59e0b' : '#10b981' }}>
                {concentrationPct.toFixed(1)}%
              </p>
            </div>
            <div className="glass-card p-3 rounded-lg">
              <p className="text-sm text-text-secondary">FIRE Date Delta</p>
              <p className={`number-display text-sm font-bold ${monthsDelta <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {monthsDelta <= 0 ? '' : '+'}{monthsDelta} months
              </p>
            </div>
          </div>
        )}
        </Card>}

      {/* Vesting Timeline — only show when grants exist */}
      {rsuGrants.length > 0 && <Card>
        <h3 className="section-title">Vesting Timeline — Next 24 Months</h3>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {adjustedEvents.map((event, i) => (
            <div
              key={i}
              className="glass-card p-4 min-w-[180px] flex-shrink-0"
            >
              <p className="text-sm text-text-secondary">
                {new Date(event.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
              <p className="number-display text-lg font-bold text-text-primary mt-1">{event.shares} shares</p>
              <div className="border-t border-border mt-2 pt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Gross</span>
                  <span className="number-display text-text-primary">{formatCurrency(event.grossValue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">After tax</span>
                  <span className="number-display text-emerald-400">{formatCurrency(event.afterTaxValue)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-text-secondary mt-4 border-t border-border pt-3">
          RSUs are taxed as ordinary income at vest. Estimated federal withholding at your bracket: {taxRate.federal}%. State: {taxRate.state}%.
        </p>
      </Card>}

      {/* Grant Summary Table — only show when grants exist */}
      {rsuGrants.length > 0 && <Card>
        <h3 className="section-title">Grant Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-sm text-text-secondary border-b border-border">
                <th className="text-left pb-2 font-medium">Grant</th>
                <th className="text-left pb-2 font-medium">Date</th>
                <th className="text-right pb-2 font-medium">Total</th>
                <th className="text-right pb-2 font-medium">Vested</th>
                <th className="text-right pb-2 font-medium">Unvested</th>
                <th className="text-right pb-2 font-medium">Unvested Value</th>
              </tr>
            </thead>
            <tbody>
              {rsuGrants.map((grant, idx) => {
                const unvested = grant.total_shares - grant.vested_shares;
                return (
                  <tr key={grant.id} className="border-b border-border/50">
                    <td className="py-2 font-medium text-text-primary">Grant {String.fromCharCode(65 + idx)}</td>
                    <td className="py-2 text-text-secondary">
                      {new Date(grant.grant_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-2 text-right number-display">{grant.total_shares.toLocaleString()}</td>
                    <td className="py-2 text-right number-display">{grant.vested_shares.toLocaleString()}</td>
                    <td className="py-2 text-right number-display">{unvested.toLocaleString()}</td>
                    <td className="py-2 text-right number-display font-bold text-accent-amber">
                      {formatCurrency(unvested * adjustedPrice)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rsuGrants.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border flex justify-end">
            <button
              onClick={handleResetGrants}
              disabled={resetting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              {resetting ? 'Deleting...' : 'Reset All Grants'}
            </button>
          </div>
        )}
      </Card>}

      {/* RSU Import */}
      <Card>
        <h3 className="section-title">Import RSU Grants</h3>
        <p className="text-sm text-text-secondary mb-4">Paste text from your equity awards page or upload a PDF — review and edit before saving</p>

        {/* Import mode tabs — only show when no preview */}
        {!previewGrants && (
          <>
            <div className="flex gap-1 mb-4 p-1 rounded-lg bg-bg-elevated w-fit">
              <button
                onClick={() => setImportMode('text')}
                className={`px-3 py-1.5 text-sm rounded-md transition-all ${importMode === 'text' ? 'bg-bg-card text-text-primary font-medium shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Paste Text
              </button>
              <button
                onClick={() => setImportMode('pdf')}
                className={`px-3 py-1.5 text-sm rounded-md transition-all ${importMode === 'pdf' ? 'bg-bg-card text-text-primary font-medium shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Upload PDF
              </button>
            </div>

            {importMode === 'text' ? (
              <div className="space-y-3">
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Go to your Schwab Equity Awards page → Select All (Cmd+A) → Copy (Cmd+C) → Paste here (Cmd+V)"
                  className="w-full h-40 p-3 rounded-lg bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-secondary/50 resize-y focus:outline-none focus:border-accent/50"
                  disabled={uploading}
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">
                    {pastedText.length > 0 ? `${pastedText.length.toLocaleString()} characters` : 'Supports Schwab, E*Trade, Fidelity, Morgan Stanley'}
                  </span>
                  <button
                    onClick={handleExtractText}
                    disabled={uploading || pastedText.trim().length === 0}
                    className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Extracting...
                      </>
                    ) : 'Extract Grants'}
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!uploading) setIsDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); }}
                onDrop={(e) => {
                  e.preventDefault(); e.stopPropagation(); setIsDragActive(false);
                  if (!uploading && e.dataTransfer.files.length > 0) handleExtract(e.dataTransfer.files);
                }}
                onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
                className={`
                  p-8 text-center cursor-pointer rounded-lg border-2 border-dashed transition-all duration-200
                  ${isDragActive ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'}
                  ${uploading ? 'opacity-60 cursor-wait' : ''}
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={(e) => { if (e.target.files?.length) { handleExtract(e.target.files); e.target.value = ''; } }}
                  className="hidden"
                  disabled={uploading}
                />

                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <span className="inline-block w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    <p className="text-sm text-text-secondary">Extracting RSU data with AI...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload size={32} className="text-text-secondary" />
                    <p className="text-sm text-text-primary font-medium">
                      {isDragActive ? 'Drop your RSU PDFs here' : 'Drop RSU PDFs here or click to browse'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Preview/Edit table */}
        {previewGrants && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/5 border border-accent/20">
              <Pencil size={16} className="text-accent" />
              <span className="text-sm text-text-primary">Review extracted data — click any value to edit before saving</span>
            </div>

            {extractionNotes && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-bg-elevated text-sm text-text-secondary">
                <span className="font-medium text-text-primary shrink-0">AI notes:</span>
                <span>{extractionNotes}</span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-sm text-text-secondary border-b border-border">
                    <th className="text-left pb-2 font-medium">Ticker</th>
                    <th className="text-left pb-2 font-medium">Grant Date</th>
                    <th className="text-right pb-2 font-medium">Total Shares</th>
                    <th className="text-right pb-2 font-medium">Vested</th>
                    <th className="text-right pb-2 font-medium">Frequency</th>
                    <th className="text-right pb-2 font-medium">Period</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {previewGrants.map((g, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5">
                        <input
                          className="w-20 bg-bg-elevated border border-border rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent"
                          value={g.company_ticker}
                          onChange={(e) => updatePreviewGrant(i, 'company_ticker', e.target.value.toUpperCase())}
                        />
                      </td>
                      <td className="py-1.5">
                        <input
                          type="date"
                          className="bg-bg-elevated border border-border rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent"
                          value={g.grant_date}
                          onChange={(e) => updatePreviewGrant(i, 'grant_date', e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 text-right">
                        <input
                          type="number"
                          className="w-24 bg-bg-elevated border border-border rounded px-2 py-1 text-sm text-text-primary text-right focus:outline-none focus:border-accent"
                          value={g.total_shares}
                          onChange={(e) => updatePreviewGrant(i, 'total_shares', parseInt(e.target.value) || 0)}
                        />
                      </td>
                      <td className="py-1.5 text-right">
                        <input
                          type="number"
                          className="w-24 bg-bg-elevated border border-border rounded px-2 py-1 text-sm text-text-primary text-right focus:outline-none focus:border-accent"
                          value={g.vested_shares}
                          onChange={(e) => updatePreviewGrant(i, 'vested_shares', parseInt(e.target.value) || 0)}
                        />
                      </td>
                      <td className="py-1.5 text-right">
                        <select
                          className="bg-bg-elevated border border-border rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent"
                          value={g.vest_frequency}
                          onChange={(e) => updatePreviewGrant(i, 'vest_frequency', e.target.value)}
                        >
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="annual">Annual</option>
                        </select>
                      </td>
                      <td className="py-1.5 text-right">
                        <input
                          type="number"
                          className="w-16 bg-bg-elevated border border-border rounded px-2 py-1 text-sm text-text-primary text-right focus:outline-none focus:border-accent"
                          value={g.vest_period_months}
                          onChange={(e) => updatePreviewGrant(i, 'vest_period_months', parseInt(e.target.value) || 48)}
                        />
                      </td>
                      <td className="py-1.5">
                        <button
                          onClick={() => setPreviewGrants(prev => prev ? prev.filter((_, j) => j !== i) : null)}
                          className="text-text-secondary hover:text-red-400 transition-colors p-1"
                          title="Remove grant"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setPreviewGrants(null); setUploadError(null); }}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGrants}
                disabled={saving || previewGrants.length === 0}
                className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : `Save ${previewGrants.length} Grant${previewGrants.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )
        }

        {/* Error feedback */}
        {
          uploadError && (
            <div className="mt-3 flex items-center gap-2 p-3 rounded-lg text-sm bg-accent-red/10 text-accent-red">
              <AlertTriangle size={16} />
              {uploadError}
            </div>
          )
        }
      </Card >

      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
      </div>
    </div>
  );
}


