export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { listIncomeTax, saveAnalysis, getAnalysis } from '@/lib/supabase-db';
import { analyzeWithGemini } from '@/lib/gemini-pdf';
import { extractClerkId, resolveUserId } from '@/lib/auth-helpers';

export async function POST(request: Request) {
  try {
    const clerkId = extractClerkId(request);
    const userId = await resolveUserId(clerkId);
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const records = await listIncomeTax(userId);
    if (records.length === 0) {
      return NextResponse.json({ analysis: 'No income/tax data available. Upload a W-2 or tax document first.' });
    }

    const summaryLines = records.map(r => {
      const income = r.total_income as number;
      const tax = r.total_tax as number;
      const rate = r.effective_tax_rate as number;
      return `Tax Year ${r.tax_year} — ${(r.document_type as string).toUpperCase()} from ${r.employer}
  Total Income: $${income.toLocaleString()}
  Income Breakdown: ${JSON.stringify(r.income_breakdown)}
  Total Tax: $${tax.toLocaleString()}
  Tax Breakdown: ${JSON.stringify(r.tax_breakdown)}
  Effective Tax Rate: ${(rate * 100).toFixed(1)}%`;
    });

    const prompt = `You are a personal tax advisor. Analyze the following income and tax data,
then provide actionable suggestions organized with these emoji-prefixed headers:

📊 INCOME SUMMARY — key income figures and year-over-year trends
💰 TAX EFFICIENCY — current effective rate vs marginal rate analysis
⚠️ OPTIMIZATION OPPORTUNITIES — specific, actionable tax reduction strategies:
  - Pre-tax retirement contribution optimization (401k, IRA)
  - HSA maximization strategies
  - Tax-loss harvesting opportunities
  - Roth conversion ladder considerations
  - Charitable giving strategies (donor-advised funds)
  - State tax optimization
⚡ ACTION ITEMS — top 3 immediate actions ranked by impact
🎯 BOTTOM LINE — net savings potential

Use bullet points. Be specific with dollar amounts, not vague percentages.
Reference specific line items from their data.

Data:
${summaryLines.join('\n\n')}`;

    const analysis = await analyzeWithGemini(prompt);
    try { await saveAnalysis(userId, 'income_tax', analysis, { records: records.length }); } catch (saveErr) { console.warn('[Tax Analyze] Save failed (non-blocking):', saveErr); }
    return NextResponse.json({ analysis });
  } catch (e) {
    console.error('[Tax Analyze] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const clerkId = extractClerkId(request);
    const userId = await resolveUserId(clerkId);
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const result = await getAnalysis(userId, 'income_tax');
    if (!result) return NextResponse.json({ analysis: null, createdAt: null });
    return NextResponse.json({ analysis: result.content, createdAt: result.created_at });
  } catch (e) {
    console.error('[Tax Analyze] Saved error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
