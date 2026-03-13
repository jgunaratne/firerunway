export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { saveAnalysis, getAnalysis } from '@/lib/supabase-db';
import { analyzeWithGemini } from '@/lib/gemini-pdf';
import { extractUserId, resolveUserId } from '@/lib/auth-helpers';
import { createServerClient } from '@/lib/supabase';
import { listAccounts, getAccountPositions, getAccountBalances } from '@/lib/snaptrade';

interface Position {
  ticker: string;
  name: string;
  shares: number;
  price: number;
  value: number;
  accountName: string;
  institutionName: string;
}

export async function POST(request: Request) {
  try {
    const uid = await extractUserId(request);
    const userId = await resolveUserId(uid);
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const supabase = createServerClient();
    const { data: userRow } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // Fetch SnapTrade holdings using per-account API (more reliable)
    const positions: Position[] = [];
    let totalValue = 0;

    if (userRow?.snaptrade_user_secret) {
      try {
        const snapUserId = userRow.snaptrade_user_id ?? '';
        const snapSecret = userRow.snaptrade_user_secret as string;

        // List all accounts, then fetch positions + balances per account
        const accounts = await listAccounts(snapUserId, snapSecret);
        if (Array.isArray(accounts)) {
          const results = await Promise.allSettled(
            accounts.map(async (acct) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const acctObj = acct as Record<string, any>;
              const accountId = String(acctObj.id || '');
              const [acctPositions, balances] = await Promise.all([
                getAccountPositions(snapUserId, snapSecret, accountId).catch(() => []),
                getAccountBalances(snapUserId, snapSecret, accountId).catch(() => []),
              ]);
              return { acctObj, accountId, acctPositions, balances };
            })
          );

          for (const result of results) {
            if (result.status !== 'fulfilled') continue;
            const { acctObj, acctPositions, balances } = result.value;
            const institutionName = String(acctObj.institution_name || acctObj.name || 'Unknown');
            const acctName = String(acctObj.name || institutionName);

            if (Array.isArray(acctPositions)) {
              for (const pos of acctPositions) {
                const value = (pos.units || 0) * (pos.price || 0);
                totalValue += value;
                const sym = pos.symbol as Record<string, unknown> | string | undefined;
                let ticker = 'N/A';
                let name = 'Unknown';
                if (typeof sym === 'string') {
                  ticker = sym;
                  name = sym;
                } else if (sym) {
                  const rawTicker = sym.symbol;
                  ticker = typeof rawTicker === 'string' ? rawTicker
                    : (typeof rawTicker === 'object' && rawTicker !== null && 'symbol' in rawTicker)
                      ? String((rawTicker as Record<string, unknown>).symbol)
                      : String(rawTicker || sym.description || 'N/A');
                  name = typeof sym.description === 'string' ? sym.description
                    : typeof sym.name === 'string' ? sym.name : ticker;
                }
                positions.push({ ticker, name, shares: pos.units || 0, price: pos.price || 0, value, accountName: acctName, institutionName });
              }
            }
            if (Array.isArray(balances)) {
              for (const bal of balances) {
                totalValue += (bal as Record<string, unknown>).cash as number || 0;
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Portfolio Analyze] SnapTrade fetch failed:', err);
      }
    }

    if (positions.length === 0) {
      return NextResponse.json({ analysis: 'No portfolio data available. Connect a brokerage account first.' });
    }

    // Sort by value descending and take top 25
    positions.sort((a, b) => b.value - a.value);
    const topPositions = positions.slice(0, 25);

    // Group by institution
    const byInstitution: Record<string, number> = {};
    for (const p of positions) {
      byInstitution[p.institutionName] = (byInstitution[p.institutionName] ?? 0) + p.value;
    }

    const dataSummary = `
Portfolio Overview:
  Total Portfolio Value: $${totalValue.toLocaleString()}
  Number of Positions: ${positions.length}

By Institution:
${Object.entries(byInstitution).map(([inst, val]) => `  ${inst}: $${val.toLocaleString()} (${totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : 0}%)`).join('\n')}

Top Holdings (by value):
${topPositions.map(p => `  ${p.ticker} (${p.name}) — $${p.value.toLocaleString()} (${totalValue > 0 ? ((p.value / totalValue) * 100).toFixed(1) : '0'}%) @ ${p.institutionName}`).join('\n')}`;

    const prompt = `You are an investment advisor for a tech worker pursuing financial independence.
Analyze the following portfolio data and provide actionable insights organized with these emoji-prefixed headers:

📊 PORTFOLIO SUMMARY — total value, number of positions, and key composition
💪 STRENGTHS — good diversification choices, low-cost holdings, appropriate allocation
⚠️ RISKS — concentration risk, sector overweight, missing asset classes, high-cost funds
⚡ ACTION ITEMS — top 3 specific rebalancing or optimization moves
🎯 BOTTOM LINE — overall portfolio health assessment

Use bullet points. Be specific with dollar amounts and percentages.
Reference their actual holdings by ticker.

Data:
${dataSummary}`;

    const analysis = await analyzeWithGemini(prompt);
    try { await saveAnalysis(userId, 'portfolio', analysis, { positions: positions.length, totalValue }); } catch (saveErr) { console.warn('[Portfolio Analyze] Save failed (non-blocking):', saveErr); }
    return NextResponse.json({ analysis });
  } catch (e) {
    console.error('[Portfolio Analyze] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const uid = await extractUserId(request);
    const userId = await resolveUserId(uid);
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const result = await getAnalysis(userId, 'portfolio');
    if (!result) return NextResponse.json({ analysis: null, createdAt: null });
    return NextResponse.json({ analysis: result.content, createdAt: result.created_at });
  } catch (e) {
    console.error('[Portfolio Analyze] Saved error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
