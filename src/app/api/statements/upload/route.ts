export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { parsePdf } from '@/lib/gemini-pdf';
import { validateExtraction } from '@/lib/validator';
import { aggregatePortfolio } from '@/lib/aggregator';
import { insertStatement, insertHoldings, getAllHoldings, insertSnapshot } from '@/lib/supabase-db';
import { processingJobs } from '@/lib/job-tracker';
import { extractUserId, resolveUserId } from '@/lib/auth-helpers';

async function processStatement(userId: string, jobId: string, filename: string, pdfBytes: Buffer): Promise<void> {
  const job = processingJobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'parsing';
    const extraction = await parsePdf(pdfBytes, filename);
    const { confidence, notes } = validateExtraction(extraction);
    extraction.extractionConfidence = confidence;
    if (notes) extraction.extractionNotes = notes;

    job.status = 'storing';
    const statementId = await insertStatement(userId, {
      filename,
      broker: (extraction.broker as string) ?? 'unknown',
      accountNumber: (extraction.accountNumber as string) ?? '',
      accountType: (extraction.accountType as string) ?? '',
      statementDate: (extraction.statementDate as string) ?? '',
      totalValue: (extraction.totalValue as number) ?? 0,
      cashBalance: (extraction.cashBalance as number) ?? 0,
      extractionConfidence: confidence,
      extractionNotes: notes,
      pdfData: pdfBytes,
    });

    const holdings = (extraction.holdings as Record<string, unknown>[]) ?? [];
    await insertHoldings(statementId, holdings);

    const allHoldings = await getAllHoldings(userId);
    const portfolio = aggregatePortfolio(allHoldings);
    await insertSnapshot(userId, {
      date: (extraction.statementDate as string) ?? '',
      totalNetWorth: portfolio.totalNetWorth,
      byBroker: portfolio.byBroker,
      byAccountType: portfolio.byAccountType,
      byAssetClass: portfolio.byAssetClass,
    });

    job.status = 'done';
    job.result = {
      filename,
      statementId,
      broker: extraction.broker,
      accountType: extraction.accountType,
      statementDate: extraction.statementDate,
      totalValue: extraction.totalValue,
      holdingsCount: holdings.length,
      extractionConfidence: confidence,
      extractionNotes: notes,
    };
  } catch (e) {
    console.error(`[Upload] Background processing failed for ${filename}:`, e);
    job.status = 'error';
    job.result = { filename, error: String(e) };
  }
}

export async function POST(request: Request) {
  try {
    const uid = await extractUserId(request);
    const userId = await resolveUserId(uid);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const jobs: Record<string, unknown>[] = [];

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        jobs.push({ filename: file.name, status: 'error', error: 'Not a PDF file' });
        continue;
      }

      const jobId = `${file.name}_${Date.now()}`;
      processingJobs.set(jobId, { filename: file.name, status: 'queued', result: null });

      const arrayBuffer = await file.arrayBuffer();
      const pdfBytes = Buffer.from(arrayBuffer);

      processStatement(userId, jobId, file.name, pdfBytes);
      jobs.push({ filename: file.name, jobId, status: 'queued' });
    }

    return NextResponse.json({ jobs });
  } catch (e) {
    console.error('[Upload] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
