export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { saveAnalysis, getAnalysis } from '@/lib/supabase-db';
import { analyzeWithGemini } from '@/lib/gemini-pdf';
import { extractClerkId, resolveUserId } from '@/lib/auth-helpers';

export async function POST(request: Request) {
  try {
    const clerkId = extractClerkId(request);
    const userId = await resolveUserId(clerkId);
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    // Simulation data comes from the client since Monte Carlo runs in the browser
    const body = await request.json();
    const { params, result, fireYear, conservativeFireYear, lifeEvents } = body;

    if (!params || !result) {
      return NextResponse.json({ analysis: 'Run a simulation first.' });
    }

    const eventLines = (lifeEvents || []).length > 0
      ? (lifeEvents as Array<{ emoji: string; label: string; year: number }>)
          .map((e: { emoji: string; label: string; year: number }) => `  ${e.emoji} ${e.label} in ${e.year}`)
          .join('\n')
      : '  None';

    const dataSummary = `
Monte Carlo Simulation Results (2,000 runs):

Input Parameters:
  Starting Portfolio: $${(params.startingPortfolio ?? 0).toLocaleString()}
  Annual Contribution: $${(params.annualContribution ?? 0).toLocaleString()}
  Current Annual Spend: $${(params.annualSpend ?? 0).toLocaleString()}
  Retirement Spend: $${(params.retirementSpend ?? 0).toLocaleString()}
  Asset Allocation: ${Math.round((params.equityPct ?? 0.8) * 100)}% equity / ${Math.round((params.bondPct ?? 0.2) * 100)}% bonds
  Inflation Assumption: ${((params.inflationRate ?? 0.03) * 100).toFixed(1)}%
  Projection Period: ${params.years ?? 25} years
  FIRE Number: $${(params.fireNumber ?? 0).toLocaleString()}
  Real Estate Equity Included: ${params.includeRealEstate ? 'Yes' : 'No'}

Simulation Outcomes:
  Success Rate: ${(result.successRate * 100).toFixed(1)}%
  Median Portfolio at Year ${params.years}: $${(result.medianFinalValue ?? 0).toLocaleString()}
  10th Percentile (worst case): $${(result.p10End ?? 0).toLocaleString()}
  25th Percentile (conservative): $${(result.p25End ?? 0).toLocaleString()}
  75th Percentile (optimistic): $${(result.p75End ?? 0).toLocaleString()}
  90th Percentile (best case): $${(result.p90End ?? 0).toLocaleString()}
  Base Case FI Year: ${fireYear ?? 'Not reached in projection period'}
  Conservative FI Year: ${conservativeFireYear ?? 'Not reached in projection period'}

Life Events Modeled:
${eventLines}`;

    const prompt = `You are a financial planner interpreting Monte Carlo retirement simulation results for a tech worker pursuing FIRE.
Analyze the following simulation data and provide actionable insights organized with these emoji-prefixed headers:

📊 SIMULATION SUMMARY — success rate assessment, key outcomes, and what the numbers mean in plain English
💪 STRENGTHS — positive indicators from the simulation (high success rate, strong median, early FI year)
⚠️ RISKS — what the worst-case scenarios reveal, sequence-of-returns risk, inflation impact
⚡ ACTION ITEMS — top 3 specific levers to improve outcomes (increase savings, adjust allocation, delay retirement)
🎯 BOTTOM LINE — one-sentence verdict on retirement readiness

Use bullet points. Be specific with dollar amounts and years.
Reference the actual simulation percentiles.
If life events are modeled, comment on their impact.

Data:
${dataSummary}`;

    const analysis = await analyzeWithGemini(prompt);
    try { await saveAnalysis(userId, 'monte_carlo', analysis, { successRate: result.successRate, years: params.years }); } catch (saveErr) { console.warn('[Monte Carlo Analyze] Save failed (non-blocking):', saveErr); }
    return NextResponse.json({ analysis });
  } catch (e) {
    console.error('[Monte Carlo Analyze] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const clerkId = extractClerkId(request);
    const userId = await resolveUserId(clerkId);
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const result = await getAnalysis(userId, 'monte_carlo');
    if (!result) return NextResponse.json({ analysis: null, createdAt: null });
    return NextResponse.json({ analysis: result.content, createdAt: result.created_at });
  } catch (e) {
    console.error('[Monte Carlo Analyze] Saved error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
