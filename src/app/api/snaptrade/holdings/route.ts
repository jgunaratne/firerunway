import { NextRequest, NextResponse } from 'next/server';
import { getAllHoldings } from '@/lib/snaptrade';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/snaptrade/holdings?clerkId=xxx
 * Fetch all holdings across connected brokerage accounts.
 */
export async function GET(req: NextRequest) {
  try {
    const clerkId = req.nextUrl.searchParams.get('clerkId');
    if (!clerkId) {
      return NextResponse.json({ error: 'clerkId required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: user } = await supabase
      .from('users')
      .select('snaptrade_user_secret')
      .eq('clerk_id', clerkId)
      .single();

    if (!user?.snaptrade_user_secret) {
      return NextResponse.json({ holdings: [] });
    }

    const holdings = await getAllHoldings(clerkId, user.snaptrade_user_secret);

    // Save a snapshot to Supabase for historical tracking
    if (Array.isArray(holdings) && holdings.length > 0) {
      // Get total value across all accounts
      let totalInvestment = 0;
      const allPositions: Array<{
        ticker: string;
        name: string;
        shares: number;
        price: number;
        value: number;
        accountName: string;
        accountType: string;
      }> = [];

      for (const account of holdings) {
        const acctName = account.account?.name || 'Unknown';
        const acctType = account.account?.type || 'unknown';
        if (Array.isArray(account.positions)) {
          for (const pos of account.positions) {
            const value = (pos.units || 0) * (pos.price || 0);
            totalInvestment += value;
            allPositions.push({
              ticker: pos.symbol?.symbol || pos.symbol?.description || 'N/A',
              name: pos.symbol?.description || pos.symbol?.symbol || 'Unknown',
              shares: pos.units || 0,
              price: pos.price || 0,
              value,
              accountName: acctName,
              accountType: acctType,
            });
          }
        }
        if (Array.isArray(account.balances)) {
          for (const bal of account.balances) {
            totalInvestment += bal.cash || 0;
          }
        }
      }

      // Upsert account snapshot
      const today = new Date().toISOString().split('T')[0];
      const { data: userId } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', clerkId)
        .single();

      if (userId?.id) {
        await supabase
          .from('account_snapshots')
          .upsert({
            user_id: userId.id,
            snapshot_date: today,
            total_investment: Math.round(totalInvestment),
            positions: allPositions,
          }, { onConflict: 'user_id,snapshot_date' });
      }

      return NextResponse.json({ holdings, positions: allPositions, totalInvestment });
    }

    return NextResponse.json({ holdings, positions: [], totalInvestment: 0 });
  } catch (err) {
    console.error('SnapTrade holdings error:', err);
    return NextResponse.json({ holdings: [], positions: [], error: 'Failed to fetch holdings' });
  }
}
