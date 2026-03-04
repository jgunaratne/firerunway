'use client';

import { useUpload } from './UploadProvider';

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  parsing: 'Parsing with Gemini...',
  storing: 'Saving results...',
  done: 'Complete',
  error: 'Failed',
};

export default function UploadNotification() {
  const { jobs, dismiss, clearAll } = useUpload();

  if (jobs.length === 0) return null;

  const hasPending = jobs.some((j) => j.status !== 'done' && j.status !== 'error');
  const allDone = !hasPending;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 space-y-2 animate-fade-in">
      {/* Header bar */}
      <div className="glass-card p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasPending && (
            <span className="inline-block w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          )}
          <span className="text-sm font-medium text-text-primary">
            {hasPending
              ? `Processing ${jobs.filter((j) => j.status !== 'done' && j.status !== 'error').length} file(s)...`
              : `${jobs.length} file(s) processed`}
          </span>
        </div>
        {allDone && (
          <button
            onClick={clearAll}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Dismiss all
          </button>
        )}
      </div>

      {/* Individual job cards */}
      {jobs.map((job) => (
        <div
          key={job.jobId ?? job.filename}
          className={`glass-card p-3 transition-all duration-300 ${job.status === 'done' ? 'border-accent-green/30' :
              job.status === 'error' ? 'border-accent-red/30' : ''
            }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary truncate">
                {job.status === 'done' ? '✅' : job.status === 'error' ? '❌' : '📄'} {job.filename}
              </div>
              <div className="text-xs text-text-secondary mt-0.5">
                {job.status === 'done' && job.result ? (
                  <span>
                    {job.result.broker} — ${(job.result.totalValue ?? 0).toLocaleString()} • {job.result.holdingsCount} holdings
                  </span>
                ) : job.status === 'error' ? (
                  <span className="text-accent-red">{job.result?.error ?? job.error ?? 'Processing failed'}</span>
                ) : (
                  STATUS_LABELS[job.status] ?? job.status
                )}
              </div>
            </div>
            {(job.status === 'done' || job.status === 'error') && job.jobId && (
              <button
                onClick={() => dismiss(job.jobId!)}
                className="text-text-secondary hover:text-text-primary text-xs transition-colors shrink-0"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
