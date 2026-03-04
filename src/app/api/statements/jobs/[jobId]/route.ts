export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { processingJobs } from '@/lib/job-tracker';

export async function DELETE(
  _request: Request,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;
  processingJobs.delete(jobId);
  return NextResponse.json({ dismissed: true });
}
