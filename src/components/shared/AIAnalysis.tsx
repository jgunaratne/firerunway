'use client';

import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/shared/Card';
import { useUserData } from '@/lib/UserDataContext';
import { Sparkles } from 'lucide-react';

interface AIAnalysisProps {
  type: 'portfolio' | 'fire' | 'income_tax' | 'net_worth' | 'real_estate' | 'monte_carlo';
  onAnalyze: () => Promise<{ analysis: string }>;
  ready: boolean;
}

interface AnalysisSection {
  header: string;
  bullets: string[];
}

function parseAnalysis(text: string): AnalysisSection[] {
  const sections: AnalysisSection[] = [];
  const lines = text.split('\n');
  let currentSection: AnalysisSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const headerMatch = trimmed.match(/^([^\x00-\x7F]+)\s*(.+)/);
    if (headerMatch && !trimmed.startsWith('•') && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
      if (currentSection) sections.push(currentSection);
      currentSection = { header: trimmed, bullets: [] };
    } else if (currentSection) {
      const bullet = trimmed.replace(/^[•\-\*]\s*/, '');
      if (bullet) currentSection.bullets.push(bullet);
    } else {
      currentSection = { header: 'Overview', bullets: [trimmed.replace(/^[•\-\*]\s*/, '')] };
    }
  }
  if (currentSection) sections.push(currentSection);

  if (sections.length === 0) {
    const paragraphs = text.split('\n\n').filter(Boolean);
    const labels = ['Insight', 'Insight', 'Insight', 'Insight'];
    return paragraphs.map((p, i) => ({
      header: labels[i % labels.length],
      bullets: [p.trim()],
    }));
  }

  return sections;
}

const SECTION_STYLES: Record<string, string> = {
  'SUMMARY': 'border-accent/30 bg-accent/5',
  'STRENGTHS': 'border-accent-green/30 bg-accent-green/5',
  'EFFICIENCY': 'border-accent-green/30 bg-accent-green/5',
  'RISKS': 'border-accent-amber/30 bg-accent-amber/5',
  'OPPORTUNITIES': 'border-accent-amber/30 bg-accent-amber/5',
  'ACTION': 'border-accent/30 bg-accent/5',
  'BOTTOM': 'border-accent-green/30 bg-accent-green/5',
};

function getSectionStyle(header: string): string {
  for (const [key, style] of Object.entries(SECTION_STYLES)) {
    if (header.toUpperCase().includes(key)) return style;
  }
  return 'border-border/50 bg-bg-elevated/50';
}

export default function AIAnalysis({ type, onAnalyze, ready }: AIAnalysisProps) {
  const { clerkId } = useUserData();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clerkId) return;
    let cancelled = false;
    async function loadSaved() {
      try {
        const prefixMap: Record<string, string> = {
          portfolio: '/api/portfolio/analyze',
          fire: '/api/fire/analyze',
          income_tax: '/api/income-tax/analyze',
          net_worth: '/api/net-worth/analyze',
          real_estate: '/api/real-estate/analyze',
          monte_carlo: '/api/monte-carlo/analyze',
        };
        const res = await fetch(`${prefixMap[type]}?clerkId=${clerkId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.analysis) {
            setAnalysis(data.analysis);
            setSavedAt(data.createdAt);
          }
        }
      } catch {
        // No saved analysis
      }
    }
    loadSaved();
    return () => { cancelled = true; };
  }, [type, clerkId]);

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await onAnalyze();
      setAnalysis(res.analysis);
      setSavedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [onAnalyze]);

  const labelMap: Record<string, string> = { portfolio: 'Portfolio', fire: 'Retirement', income_tax: 'Income & Tax', net_worth: 'Net Worth', real_estate: 'Real Estate', monte_carlo: 'Monte Carlo' };
  const label = labelMap[type] ?? type;
  const sections = analysis ? parseAnalysis(analysis) : [];

  return (
    <Card delay={0.3}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-text-primary text-base font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-accent" />
            AI {label} Analysis
          </h3>
          {savedAt && analysis && (
            <div className="text-sm text-text-secondary mt-0.5">
              Last analyzed: {new Date(savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading || !ready}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
            bg-accent/10 text-accent border border-accent/30
            hover:bg-accent/20 hover:border-accent/50
            disabled:opacity-50 disabled:cursor-wait"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              Analyzing...
            </span>
          ) : analysis ? 'Re-analyze' : 'Analyze'}
        </button>
      </div>

      {error && (
        <div className="text-accent-red text-sm bg-accent-red/10 rounded-lg p-3 mb-4">{error}</div>
      )}

      {!analysis && !loading && !error && (
        <p className="text-text-secondary text-sm">
          {ready
            ? `Click "Analyze" to get a personalized AI review of your ${label.toLowerCase()} data.`
            : 'Upload statements first to enable AI analysis.'}
        </p>
      )}

      {analysis && (
        <div className="space-y-3">
          {sections.map((section, i) => (
            <div
              key={i}
              className={`rounded-lg border p-4 ${getSectionStyle(section.header)}`}
            >
              <div className="text-sm font-semibold text-text-primary mb-2">
                {section.header}
              </div>
              <ul className="space-y-1.5">
                {section.bullets.map((bullet, j) => (
                  <li key={j} className="flex gap-2 text-sm text-text-primary leading-relaxed">
                    <span className="text-text-secondary mt-1 flex-shrink-0">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
