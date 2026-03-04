export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getStatement, getStatementPdf, deleteHoldingsForStatement, insertHoldings, updateStatementMetadata } from '@/lib/supabase-db';
import { parsePdf } from '@/lib/gemini-pdf';
import { validateExtraction } from '@/lib/validator';
import { extractClerkId, resolveUserId } from '@/lib/auth-helpers';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const clerkId = extractClerkId(request);
  const userId = await resolveUserId(clerkId);
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { id } = params;
  const pdfData = await getStatementPdf(userId, id);
  if (!pdfData) return NextResponse.json({ detail: 'Statement not found or no PDF stored' }, { status: 404 });

  const statement = await getStatement(userId, id);
  if (!statement) return NextResponse.json({ detail: 'Statement not found' }, { status: 404 });

  const extraction = await parsePdf(pdfData, (statement.filename as string) ?? '');
  const { confidence, notes } = validateExtraction(extraction);

  await deleteHoldingsForStatement(id);
  await insertHoldings(id, (extraction.holdings as Record<string, unknown>[]) ?? []);

  await updateStatementMetadata(userId, id, {
    broker: (extraction.broker as string) ?? 'unknown',
    accountNumber: (extraction.accountNumber as string) ?? '',
    accountType: (extraction.accountType as string) ?? '',
    statementDate: (extraction.statementDate as string) ?? '',
    totalValue: (extraction.totalValue as number) ?? 0,
    cashBalance: (extraction.cashBalance as number) ?? 0,
    extractionConfidence: confidence,
    extractionNotes: notes,
  });

  return NextResponse.json({
    statementId: id,
    broker: extraction.broker,
    totalValue: extraction.totalValue,
    holdingsCount: ((extraction.holdings as unknown[]) ?? []).length,
    extractionConfidence: confidence,
    extractionNotes: notes,
  });
}
