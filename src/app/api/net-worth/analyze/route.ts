export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { saveAnalysis, getAnalysis } from '@/lib/supabase-db';
import { analyzeWithGemini } from '@/lib/gemini-pdf';
import { extractUserId, resolveUserId } from '@/lib/auth-helpers';
import { createServerClient } from '@/lib/supabase';
import { listAccounts as snapListAccounts } from '@/lib/snaptrade';

export async function POST(request: Request) {
  try {
    const uid = await extractUserId(request);
    const userId = await resolveUserId(uid);
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const supabase = createServerClient();

    // Query snaptrade secret separately so profile column issues don't block it
    const { data: secretRow } = await supabase
      .from('users')
      .select('snaptrade_user_secret')
      .eq('id', userId)
      .single();

    let userProfile: Record<string, unknown> | null = null;
    try {
      const { data } = await supabase.from('users').select('*').eq('id', userId).single();
      userProfile = data;
    } catch { /* profile columns may vary */ }

    // Fetch SnapTrade brokerage accounts (real investment data)
    let snapTradeTotal = 0;
    let snapAccounts: { name: string; institution: string; balance: number }[] = [];
    if (secretRow?.snaptrade_user_secret) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accounts: any[] = await snapListAccounts(uid!, secretRow.snaptrade_user_secret as string);
        snapAccounts = accounts.map(a => ({
          name: a.name || '',
          institution: a.institution_name || '',
          balance: a.balance?.total?.amount ?? 0,
        }));
        snapTradeTotal = snapAccounts.reduce((s, a) => s + a.balance, 0);
      } catch (err) {
        console.warn('[Net Worth Analyze] SnapTrade fetch failed:', err);
      }
    }

    // Fetch real estate properties
    let properties: Record<string, unknown>[] = [];
    try {
      const { data } = await supabase.from('real_estate_properties').select('*').eq('user_id', userId);
      properties = data ?? [];
    } catch { /* table may not exist */ }

    const totalPropertyValue = properties.reduce((s, p) => s + ((p.current_value as number) ?? 0), 0);
    const totalMortgage = properties.reduce((s, p) => s + ((p.mortgage_balance as number) ?? 0), 0);
    const realEstateEquity = totalPropertyValue - totalMortgage;

    // Fetch RSU data for complete net worth
    let rsuValue = 0;
    try {
      const { data: grants } = await supabase.from('rsu_grants').select('vested_shares, company_ticker').eq('user_id', userId);
      if (grants && grants.length > 0) {
        // Use a rough stock price estimate; the exact value comes from the live price on the client
        rsuValue = grants.reduce((s: number, g: { vested_shares: number }) => s + (g.vested_shares ?? 0) * 190, 0);
      }
    } catch { /* rsu_grants table may not exist */ }

    const netWorth = snapTradeTotal + rsuValue + realEstateEquity;

    if (netWorth === 0 && !userProfile) {
      return NextResponse.json({ analysis: 'No financial data available yet. Connect a brokerage account or add real estate properties first.' });
    }

    const accountLines = snapAccounts
      .filter(a => a.balance > 0)
      .map(a => `  ${a.institution} — ${a.name}: $${a.balance.toLocaleString()}`)
      .join('\n');

    const dataSummary = `
Net Worth Snapshot:
  Total Net Worth: $${netWorth.toLocaleString()}
  Investment / Brokerage Accounts: $${snapTradeTotal.toLocaleString()} (${netWorth > 0 ? ((snapTradeTotal / netWorth) * 100).toFixed(1) : 0}%)
  RSU / Employer Stock: $${rsuValue.toLocaleString()} (${netWorth > 0 ? ((rsuValue / netWorth) * 100).toFixed(1) : 0}%)
  Real Estate Equity: $${realEstateEquity.toLocaleString()} (${netWorth > 0 ? ((realEstateEquity / netWorth) * 100).toFixed(1) : 0}%)
  Total Property Value: $${totalPropertyValue.toLocaleString()}
  Total Mortgage Debt: $${totalMortgage.toLocaleString()}
  Number of Brokerage Accounts: ${snapAccounts.length}
  Number of Properties: ${properties.length}

Brokerage Account Breakdown:
${accountLines || '  No connected accounts'}
${userProfile ? `
User Profile:
  Annual Income: $${((userProfile.annual_income as number) ?? 0).toLocaleString()}
  Annual Spend: $${((userProfile.annual_spend as number) ?? 0).toLocaleString()}
  FIRE Number: $${((userProfile.fire_number as number) ?? 0).toLocaleString()}
  Target FIRE Year: ${userProfile.fire_target_year ?? 'Not set'}
  Safe Withdrawal Rate: ${(userProfile.swr ?? 4)}%` : ''}`;

    const prompt = `You are a financial advisor for a tech worker pursuing financial independence.
Analyze the following net worth data and provide actionable insights organized with these emoji-prefixed headers:

📊 NET WORTH SUMMARY — current snapshot, composition, and what stands out
💪 STRENGTHS — diversification, growth trajectory, positive trends
⚠️ RISKS — concentration, leverage ratio, gaps in the financial picture
⚡ ACTION ITEMS — top 3 specific actions to grow net worth faster
🎯 BOTTOM LINE — one-sentence overall assessment

Use bullet points. Be specific with dollar amounts.
Reference the actual numbers from their data.

Data:
${dataSummary}`;

    const analysis = await analyzeWithGemini(prompt);
    try { await saveAnalysis(userId, 'net_worth', analysis, { netWorth, accounts: snapAccounts.length, properties: properties.length }); } catch (saveErr) { console.warn('[Net Worth Analyze] Save failed (non-blocking):', saveErr); }
    return NextResponse.json({ analysis });
  } catch (e) {
    console.error('[Net Worth Analyze] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const uid = await extractUserId(request);
    const userId = await resolveUserId(uid);
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const result = await getAnalysis(userId, 'net_worth');
    if (!result) return NextResponse.json({ analysis: null, createdAt: null });
    return NextResponse.json({ analysis: result.content, createdAt: result.created_at });
  } catch (e) {
    console.error('[Net Worth Analyze] Saved error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
