export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { saveAnalysis, getAnalysis } from '@/lib/supabase-db';
import { analyzeWithGemini } from '@/lib/gemini-pdf';
import { extractClerkId, resolveUserId } from '@/lib/auth-helpers';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const clerkId = extractClerkId(request);
    const userId = await resolveUserId(clerkId);
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const supabase = createServerClient();
    const { data: properties, error } = await supabase
      .from('real_estate_properties')
      .select('*')
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to fetch properties: ${error.message}`);

    if (!properties || properties.length === 0) {
      return NextResponse.json({ analysis: 'No real estate properties found. Add a property first.' });
    }

    const totalValue = properties.reduce((s, p) => s + (p.current_value ?? 0), 0);
    const totalMortgage = properties.reduce((s, p) => s + (p.mortgage_balance ?? 0), 0);
    const totalEquity = totalValue - totalMortgage;
    const ltv = totalValue > 0 ? (totalMortgage / totalValue) * 100 : 0;

    const propertyLines = properties.map(p => {
      const equity = (p.current_value ?? 0) - (p.mortgage_balance ?? 0);
      const appreciation = p.purchase_price > 0 ? ((p.current_value - p.purchase_price) / p.purchase_price * 100).toFixed(1) : 'N/A';
      return `
  ${p.address} (${p.property_type})
    Current Value: $${(p.current_value ?? 0).toLocaleString()}
    Purchase Price: $${(p.purchase_price ?? 0).toLocaleString()}${p.purchase_date ? ` (${p.purchase_date})` : ''}
    Appreciation: ${appreciation}%
    Mortgage Balance: $${(p.mortgage_balance ?? 0).toLocaleString()}
    Interest Rate: ${p.mortgage_rate ?? 'N/A'}%
    Monthly Payment: $${(p.monthly_payment ?? 0).toLocaleString()}/mo
    Equity: $${equity.toLocaleString()}
    ${p.monthly_rent ? `Monthly Rent: $${p.monthly_rent.toLocaleString()}/mo` : 'No rental income'}`;
    });

    const prompt = `You are a real estate advisor for a tech worker pursuing financial independence.
Analyze the following real estate portfolio and provide actionable insights organized with these emoji-prefixed headers:

📊 PROPERTY SUMMARY — portfolio overview, total equity, and composition
💰 MORTGAGE ANALYSIS — rate comparison to current market, refi opportunities, payoff timeline
⚠️ RISKS — leverage ratio (LTV), concentration, market exposure, liquidity constraints
⚡ ACTION ITEMS — top 3 specific actions (extra payments, refi, rent optimization)
🎯 BOTTOM LINE — real estate health assessment

Use bullet points. Be specific with dollar amounts.
Reference their actual properties by address.

Current average 30yr mortgage rate: ~6.5%

Data:
Real Estate Portfolio Summary:
  Total Property Value: $${totalValue.toLocaleString()}
  Total Mortgage Debt: $${totalMortgage.toLocaleString()}
  Total Equity: $${totalEquity.toLocaleString()}
  Loan-to-Value Ratio: ${ltv.toFixed(1)}%
  Number of Properties: ${properties.length}

Properties:${propertyLines.join('\n')}`;

    const analysis = await analyzeWithGemini(prompt);
    try { await saveAnalysis(userId, 'real_estate', analysis, { properties: properties.length, totalEquity }); } catch (saveErr) { console.warn('[Real Estate Analyze] Save failed (non-blocking):', saveErr); }
    return NextResponse.json({ analysis });
  } catch (e) {
    console.error('[Real Estate Analyze] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const clerkId = extractClerkId(request);
    const userId = await resolveUserId(clerkId);
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const result = await getAnalysis(userId, 'real_estate');
    if (!result) return NextResponse.json({ analysis: null, createdAt: null });
    return NextResponse.json({ analysis: result.content, createdAt: result.created_at });
  } catch (e) {
    console.error('[Real Estate Analyze] Saved error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
