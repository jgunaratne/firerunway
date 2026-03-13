export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { listAccounts, getAccountPositions, getAccountBalances } from '@/lib/snaptrade';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/snaptrade/holdings?uid=xxx
 * Fetch all holdings across connected brokerage accounts.
 *
 * Uses the recommended per-account getUserAccountPositions API instead of
 * the deprecated getAllUserHoldings endpoint, which was unreliably returning
 * incomplete position data.
 */
export async function GET(req: NextRequest) {
  try {
    const uid = req.nextUrl.searchParams.get('uid');
    if (!uid) {
      return NextResponse.json({ error: 'uid required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: user } = await supabase
      .from('users')
      .select('id, snaptrade_user_id, snaptrade_user_secret')
      .eq('firebase_uid', uid)
      .single();

    if (!user?.snaptrade_user_secret || !user?.snaptrade_user_id) {
      return NextResponse.json({ holdings: [] });
    }

    const userId = user.snaptrade_user_id;
    const userSecret = user.snaptrade_user_secret;

    // Step 1: List all accounts
    const accounts = await listAccounts(userId, userSecret);
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return NextResponse.json({ holdings: [], positions: [], totalInvestment: 0 });
    }

    // Step 2: Fetch positions and balances for each account in parallel
    const accountResults = await Promise.allSettled(
      accounts.map(async (acct) => {
        const acctObj = acct as Record<string, unknown>;
        const accountId = String(acctObj.id || '');
        const [positions, balances] = await Promise.all([
          getAccountPositions(userId, userSecret, accountId).catch(() => []),
          getAccountBalances(userId, userSecret, accountId).catch(() => []),
        ]);
        return { acctObj, accountId, positions, balances };
      })
    );

    // Step 3: Build flattened positions list
    let totalInvestment = 0;
    const allPositions: Array<{
      ticker: string;
      name: string;
      shares: number;
      price: number;
      value: number;
      openPnl: number | null;
      averagePurchasePrice: number | null;
      accountId: string;
      accountName: string;
      accountType: string;
      institutionName: string;
    }> = [];

    for (const result of accountResults) {
      if (result.status !== 'fulfilled') continue;
      const { acctObj, accountId, positions, balances } = result.value;

      const institutionName = String(acctObj.institution_name || acctObj.name || 'Unknown');
      const acctName = String(acctObj.name || institutionName);
      const acctType = String((acctObj.meta as Record<string, unknown>)?.type || acctObj.type || 'unknown');

      if (Array.isArray(positions)) {
        for (const pos of positions) {
          const value = (pos.units || 0) * (pos.price || 0);
          totalInvestment += value;

          // Extract ticker and name from potentially nested symbol objects
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
              : typeof sym.name === 'string' ? sym.name
                : ticker;
          }

          allPositions.push({
            ticker,
            name,
            shares: pos.units || 0,
            price: pos.price || 0,
            value,
            openPnl: pos.open_pnl ?? null,
            averagePurchasePrice: pos.average_purchase_price ?? null,
            accountId,
            accountName: acctName,
            accountType: acctType,
            institutionName,
          });
        }
      }

      if (Array.isArray(balances)) {
        for (const bal of balances) {
          totalInvestment += (bal as Record<string, unknown>).cash as number || 0;
        }
      }
    }

    // Upsert account snapshot to Supabase for historical tracking
    if (allPositions.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('firebase_uid', uid)
        .single();

      if (userRow?.id) {
        await supabase
          .from('account_snapshots')
          .upsert({
            user_id: userRow.id,
            snapshot_date: today,
            total_investment: Math.round(totalInvestment),
            positions: allPositions,
          }, { onConflict: 'user_id,snapshot_date' });
      }
    }

    return NextResponse.json({ holdings: accounts, positions: allPositions, totalInvestment });
  } catch (err) {
    console.error('SnapTrade holdings error:', err);
    return NextResponse.json({ holdings: [], positions: [], error: 'Failed to fetch holdings' });
  }
}
