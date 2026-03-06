export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getClient, MODEL } from '@/lib/gemini-pdf';

const SPENDING_EXTRACTION_PROMPT = `Analyze this financial document and extract spending by category.

Return ONLY compact JSON (no markdown, no explanation) matching this schema:
{"period":"monthly"|"annual","grossIncome":number|null,"netIncome":number|null,"categories":{"rent_mortgage":0,"utilities":0,"transportation":0,"groceries":0,"dining_out":0,"insurance":0,"medical":0,"subscriptions":0,"clothing":0,"personal_care":0,"entertainment":0,"travel":0,"education":0,"debt_payments":0,"savings_investments":0,"gifts_donations":0,"home_maintenance":0,"childcare":0,"other":0},"notes":"brief summary"}

Rules: Use 0 for unfound categories. Use annual/monthly based on source data. Combine similar items (electric+gas+water=utilities). Be conservative. Return ONLY the JSON object.`;

const DEFAULT_CATEGORIES: Record<string, number> = {
  rent_mortgage: 0, utilities: 0, transportation: 0, groceries: 0,
  dining_out: 0, insurance: 0, medical: 0, subscriptions: 0,
  clothing: 0, personal_care: 0, entertainment: 0, travel: 0,
  education: 0, debt_payments: 0, savings_investments: 0,
  gifts_donations: 0, home_maintenance: 0, childcare: 0, other: 0,
};

function repairAndParseJson(text: string): Record<string, unknown> | null {
  // Strip any markdown wrapping
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Attempt 1: Direct parse
  try { return JSON.parse(cleaned); } catch { /* continue */ }

  // Attempt 2: Extract first JSON object using brace matching
  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  cleaned = cleaned.slice(start);

  // Attempt 3: Find the matching closing brace by tracking depth
  let depth = 0;
  let inString = false;
  let escape = false;
  let endIdx = -1;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
  }

  if (endIdx > 0) {
    try { return JSON.parse(cleaned.slice(0, endIdx + 1)); } catch { /* continue */ }
  }

  // Attempt 4: Truncated JSON — trim to last complete value, close braces
  // Find the last successfully parseable key-value
  const lastGoodComma = cleaned.lastIndexOf(',\n');
  const lastGoodComma2 = cleaned.lastIndexOf(',');
  const cutPoint = Math.max(lastGoodComma, lastGoodComma2);

  if (cutPoint > 0) {
    let repaired = cleaned.slice(0, cutPoint);
    // Recount braces after trim
    const opens = (repaired.match(/\{/g) || []).length;
    const closes = (repaired.match(/\}/g) || []).length;
    for (let i = 0; i < opens - closes; i++) repaired += '\n}';
    try { return JSON.parse(repaired); } catch { /* continue */ }
  }

  // Attempt 5: Aggressively close — just keep adding }
  let aggressive = cleaned;
  for (let attempt = 0; attempt < 5; attempt++) {
    aggressive += '}';
    try { return JSON.parse(aggressive); } catch { /* continue */ }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const hasKey = process.env.GCP_PROJECT_ID || process.env.GEMINI_API_KEY;

  if (!hasKey) {
    return NextResponse.json(
      { error: 'AI is not configured. Set GEMINI_API_KEY or GCP_PROJECT_ID.' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`[Spending] Processing: ${file.name} (${(file.size / 1024).toFixed(0)}KB)`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'application/pdf';
    const isTextFormat = file.name.endsWith('.csv') || mimeType === 'text/csv';

    const client = getClient();
    const t0 = Date.now();

    // For CSV: send as text content; for PDF/Excel/images: send as binary
    const contentParts = isTextFormat
      ? [{ text: `Here is the spending data in CSV format:\n\n${buffer.toString('utf-8')}\n\n${SPENDING_EXTRACTION_PROMPT}` }]
      : [
        { inlineData: { data: buffer.toString('base64'), mimeType } },
        { text: SPENDING_EXTRACTION_PROMPT },
      ];

    const response = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: contentParts }],
      config: {
        maxOutputTokens: 16384,
        temperature: 0.1,
      },
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const rawText = response.text ?? '';
    console.log(`[Spending] Gemini responded in ${elapsed}s (${rawText.length} chars)`);

    if (!rawText) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
    }

    const data = repairAndParseJson(rawText);
    if (!data) {
      console.error('[Spending] All parse attempts failed. Raw response:', rawText.slice(0, 1000));
      return NextResponse.json({ error: 'Could not parse spending data from this document' }, { status: 500 });
    }

    // Ensure categories has all default keys
    const categories = { ...DEFAULT_CATEGORIES, ...(data.categories as Record<string, number> || {}) };
    const result = {
      period: data.period || 'annual',
      grossIncome: data.grossIncome ?? null,
      netIncome: data.netIncome ?? null,
      categories,
      notes: data.notes || 'Spending data extracted from uploaded document',
    };

    console.log(`[Spending] ✅ Extracted ${Object.keys(categories).filter(k => categories[k] > 0).length} non-zero categories, period=${result.period}`);
    return NextResponse.json({ result });
  } catch (error) {
    console.error('[Spending] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process spending statement' },
      { status: 500 }
    );
  }
}
