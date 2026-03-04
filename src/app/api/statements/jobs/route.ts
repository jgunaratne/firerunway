export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { processingJobs } from '@/lib/job-tracker';

export async function GET() {
  const jobs = Array.from(processingJobs.entries()).map(([jobId, job]) => ({
    jobId, filename: job.filename, status: job.status, result: job.result,
  }));
  return NextResponse.json({ jobs });
}

export async function DELETE() {
  let cleared = 0;
  processingJobs.forEach((job, id) => {
    if (job.status === 'done' || job.status === 'error') {
      processingJobs.delete(id);
      cleared++;
    }
  });
  return NextResponse.json({ cleared });
}
