export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { parseTaxPdf } from '@/lib/gemini-pdf';
import { saveIncomeTax } from '@/lib/supabase-db';
import { extractUserId, resolveUserId } from '@/lib/auth-helpers';

export async function POST(request: Request) {
  try {
    const uid = await extractUserId(request);
    const userId = await resolveUserId(uid);
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const pdfBytes = Buffer.from(arrayBuffer);
    const filename = file.name ?? 'tax_document.pdf';

    const data = await parseTaxPdf(pdfBytes, filename);
    if (data.error) return NextResponse.json(data);

    const recId = await saveIncomeTax(userId, {
      taxYear: data.taxYear,
      filename,
      documentType: data.documentType,
      employer: data.employer,
      incomeBreakdown: data.incomeBreakdown,
      totalIncome: data.totalIncome,
      taxBreakdown: data.taxBreakdown,
      totalTax: data.totalTax,
      effectiveTaxRate: data.effectiveTaxRate,
      extractionConfidence: data.extractionConfidence,
      extractionNotes: data.extractionNotes,
      pdfData: pdfBytes,
    });

    return NextResponse.json({
      id: recId,
      taxYear: data.taxYear,
      documentType: data.documentType,
      employer: data.employer,
      totalIncome: data.totalIncome ?? 0,
      totalTax: data.totalTax ?? 0,
      effectiveTaxRate: data.effectiveTaxRate ?? 0,
      confidence: data.extractionConfidence,
    });
  } catch (e) {
    console.error('[Tax Upload] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
