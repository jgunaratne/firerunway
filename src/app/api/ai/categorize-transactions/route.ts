export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getClient, MODEL } from '@/lib/gemini-pdf';

const VALID_CATEGORIES = [
  'RENT_AND_UTILITIES',
  'HOME_IMPROVEMENT',
  'TRANSPORTATION',
  'LOAN_PAYMENTS',
  'MEDICAL',
  'PERSONAL_CARE',
  'GENERAL_SERVICES',
  'FOOD_AND_DRINK',
  'GENERAL_MERCHANDISE',
  'ENTERTAINMENT',
  'TRANSFER',
  'INCOME',
  'OTHER',
];

const PROMPT = `You are a financial categorization expert. Given a list of bank/credit card transactions, assign each one to the BEST spending category.

Available categories:
- FOOD_AND_DRINK — groceries, restaurants, coffee shops, fast food, bakeries, supermarkets (Fred Meyer, Walmart, Costco, Target, Safeway, Kroger)
- RENT_AND_UTILITIES — rent, mortgage, electric, gas, water, internet, phone
- TRANSPORTATION — gas stations, car payments, parking, tolls, transit, rideshare
- GENERAL_MERCHANDISE — clothing stores, electronics, online shopping (NOT grocery stores)
- ENTERTAINMENT — streaming, movies, concerts, games, subscriptions
- MEDICAL — doctors, dentists, pharmacy prescriptions, health insurance
- PERSONAL_CARE — haircuts, gym, spa, beauty
- HOME_IMPROVEMENT — hardware stores, home repairs, furniture
- GENERAL_SERVICES — childcare, dry cleaning, professional services
- LOAN_PAYMENTS — student loans, credit card payments, other debt
- TRANSFER — transfers between accounts, Venmo, Zelle (not spending)
- INCOME — paychecks, refunds, deposits (not spending)
- OTHER — anything that doesn't clearly fit above

Return ONLY a JSON object mapping transaction index to category, like:
{"0":"FOOD_AND_DRINK","1":"ENTERTAINMENT","2":"TRANSPORTATION"}

IMPORTANT: Only include entries where your category DIFFERS from the original. If the original category is correct, do NOT include it.

Here are the transactions:
`;

export async function POST(request: NextRequest) {
  const hasKey = process.env.GCP_PROJECT_ID || process.env.GEMINI_API_KEY;
  if (!hasKey) {
    return NextResponse.json(
      { error: 'AI is not configured. Set GEMINI_API_KEY or GCP_PROJECT_ID.' },
      { status: 500 }
    );
  }

  try {
    const { transactions } = await request.json();

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 });
    }

    // Build a compact representation for the prompt
    const txList = transactions.map((tx: { name: string; merchantName: string | null; amount: number; personalFinanceCategory: string | null; date: string }, i: number) =>
      `${i}. "${tx.merchantName || tx.name}" — $${tx.amount.toFixed(2)} on ${tx.date} [current: ${tx.personalFinanceCategory || 'OTHER'}]`
    ).join('\n');

    const client = getClient();
    const t0 = Date.now();

    const response = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: PROMPT + txList }] }],
      config: {
        maxOutputTokens: 4096,
        temperature: 0.1,
      },
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const rawText = response.text ?? '';
    console.log(`[Categorize] Gemini responded in ${elapsed}s (${rawText.length} chars)`);

    if (!rawText) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
    }

    // Parse the JSON response
    const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    let corrections: Record<string, string>;
    try {
      corrections = JSON.parse(cleaned);
    } catch {
      // Try to extract JSON object
      const match = cleaned.match(/\{[^}]+\}/);
      if (match) {
        corrections = JSON.parse(match[0]);
      } else {
        return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 });
      }
    }

    // Validate categories
    const validCorrections: Record<string, string> = {};
    for (const [idx, cat] of Object.entries(corrections)) {
      if (VALID_CATEGORIES.includes(cat as string)) {
        validCorrections[idx] = cat as string;
      }
    }

    const count = Object.keys(validCorrections).length;
    console.log(`[Categorize] ✅ ${count} corrections out of ${transactions.length} transactions`);

    return NextResponse.json({ corrections: validCorrections, total: transactions.length, changed: count });
  } catch (error) {
    console.error('[Categorize] Error:', error);
    return NextResponse.json(
      { error: 'Failed to categorize transactions' },
      { status: 500 }
    );
  }
}
