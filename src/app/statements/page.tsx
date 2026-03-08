'use client';

import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/shared/Card';
import UploadZone from '@/components/upload/UploadZone';
import { formatCurrency } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { FileText, AlertTriangle } from 'lucide-react';

interface Statement {
  id: string;
  filename: string;
  broker: string;
  account_number: string;
  account_type: string;
  statement_date: string;
  total_value: number;
  cash_balance: number;
  uploaded_at: string;
  extraction_confidence: string;
  extraction_notes?: string;
}

const BROKER_COLORS: Record<string, string> = {
  fidelity: '#4CAF50',
  schwab: '#2196F3',
  vanguard: '#8B1538',
  webull: '#FF9800',
  unknown: '#636e7b',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: '#10b981',
  medium: '#f59e0b',
  low: '#ef4444',
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function StatementsPage() {
  const { uid } = useUserData();
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/statements?uid=${uid}`);
      const data = await res.json();
      setStatements(data.statements ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statements');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this statement? Holdings will also be removed.')) return;
    try {
      await fetch(`/api/statements/${id}?uid=${uid}`, { method: 'DELETE' });
      setStatements((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      await fetch(`/api/statements/${id}/reprocess?uid=${uid}`, { method: 'POST' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reprocess failed');
    }
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div
      >
        <h1 className="page-title">Manage Statements</h1>
        <p className="page-subtitle">Upload and manage your brokerage PDF statements</p>
      </div>

      {/* Upload zone */}
      <UploadZone />

      {/* Error */}
      {error && (
        <div
          className="glass-card p-4 border-accent-red/50"
        >
          <span className="text-accent-red text-sm">{error}</span>
        </div>
      )}

      {/* Refresh button */}
      <div className="flex justify-end">
        <button
          onClick={refresh}
          className="text-sm text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg border border-border hover:border-accent/30 transition-all"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Statements list */}
      <Card>
        <h3 className="text-sm font-medium text-text-secondary mb-4">
          Uploaded Statements ({statements.length})
        </h3>

        {loading && (
          <div className="text-text-secondary text-sm py-8 text-center">Loading...</div>
        )}

        {!loading && statements.length === 0 && (
          <div className="text-center py-12">
            <FileText size={40} className="text-text-secondary/40 mx-auto mb-4" />
            <p className="text-text-primary text-lg font-medium">No statements uploaded yet</p>
            <p className="text-text-secondary text-sm mt-1">Upload a PDF statement above to get started</p>
          </div>
        )}

        <div className="space-y-3">
          {statements.map((stmt) => (
            <div
              key={stmt.id}
              className="bg-bg-elevated rounded-lg p-4 flex items-center gap-4 hover:bg-bg-elevated/80 transition-colors"
            >
              {/* Broker badge */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold uppercase flex-shrink-0"
                style={{ backgroundColor: BROKER_COLORS[stmt.broker] ?? '#636e7b' }}
              >
                {stmt.broker.slice(0, 2)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-text-primary font-medium text-sm capitalize">{stmt.broker}</span>
                  <span className="text-text-secondary text-sm">•</span>
                  <span className="text-text-secondary text-sm">{stmt.account_type || 'Unknown'}</span>
                  {stmt.account_number && (
                    <>
                      <span className="text-text-secondary text-sm">•</span>
                      <span className="text-text-secondary text-sm font-mono">{stmt.account_number}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="number-display text-text-primary text-sm">{formatCurrency(stmt.total_value)}</span>
                  <span className="text-text-secondary text-sm">{formatDate(stmt.statement_date)}</span>
                  <span
                    className="text-sm px-1.5 py-0.5 rounded font-medium"
                    style={{ color: CONFIDENCE_COLORS[stmt.extraction_confidence] ?? '#8b949e' }}
                  >
                    {stmt.extraction_confidence}
                  </span>
                </div>
                {stmt.extraction_notes && stmt.extraction_confidence !== 'high' && (
                  <div className="text-sm text-accent-amber mt-1 truncate">
                    <AlertTriangle size={14} className="text-accent-amber inline mr-1" /> {stmt.extraction_notes}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleReprocess(stmt.id)}
                  className="text-sm text-accent hover:text-accent/80 px-2 py-1 rounded hover:bg-accent/10 transition-colors"
                >
                  Reprocess
                </button>
                <button
                  onClick={() => handleDelete(stmt.id)}
                  className="text-sm text-accent-red hover:text-accent-red/80 px-2 py-1 rounded hover:bg-accent-red/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Disclaimer */}
      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
      </div>
    </div>
  );
}
