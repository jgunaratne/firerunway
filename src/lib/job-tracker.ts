/**
 * In-memory job tracker for statement upload processing.
 * Shared between upload and jobs API routes.
 */

interface Job {
  filename: string;
  status: 'queued' | 'parsing' | 'storing' | 'done' | 'error';
  result: Record<string, unknown> | null;
}

const processingJobs = new Map<string, Job>();

export { processingJobs };
export type { Job };
