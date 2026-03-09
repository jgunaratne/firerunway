export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAccountBalances, removeItem } from '@/lib/plaid';
import { createServerClient } from '@/lib/supabase';

interface PlaidAccountResponse {
  itemId: string;
  institutionName: string;
  accounts: Array<{
    id: string;
    name: string;
    officialName: string | null;
    type: string;
    subtype: string | null;
    mask: string | null;
    currentBalance: number | null;
    availableBalance: number | null;
    limit: number | null;
  }>;
}

/**
 * GET /api/plaid/accounts?uid=xxx
 * Fetch all Plaid-connected accounts with balances.
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
      .upsert({ firebase_uid: uid }, { onConflict: 'firebase_uid' })
      .select('id')
      .single();

    if (!user?.id) {
      return NextResponse.json({ plaidAccounts: [] });
    }

    // Get all Plaid items for this user
    const { data: items } = await supabase
      .from('plaid_items')
      .select('plaid_item_id, access_token, institution_name')
      .eq('user_id', user.id);

    if (!items || items.length === 0) {
      return NextResponse.json({ plaidAccounts: [] });
    }

    // Fetch accounts from each Plaid item
    const allAccounts: PlaidAccountResponse[] = [];

    for (const item of items) {
      try {
        const data = await getAccountBalances(item.access_token);
        const accounts = data.accounts.map((acct: { account_id: string; name: string; official_name: string | null; type: string; subtype: string | null; mask: string | null; balances: { current: number | null; available: number | null; limit: number | null } }) => ({
          id: acct.account_id,
          name: acct.name,
          officialName: acct.official_name,
          type: acct.type,
          subtype: acct.subtype,
          mask: acct.mask,
          currentBalance: acct.balances.current,
          availableBalance: acct.balances.available,
          limit: acct.balances.limit,
        }));
        allAccounts.push({
          itemId: item.plaid_item_id,
          institutionName: item.institution_name || 'Unknown',
          accounts,
        });
      } catch (err) {
        console.error(`Plaid error for item ${item.plaid_item_id}:`, err);
        // Skip failed items but continue with others
      }
    }

    return NextResponse.json({ plaidAccounts: allAccounts });
  } catch (err) {
    console.error('Plaid accounts error:', err);
    return NextResponse.json({ plaidAccounts: [], error: 'Failed to fetch accounts' });
  }
}

/**
 * DELETE /api/plaid/accounts
 * Remove a Plaid connection.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { uid, itemId } = await req.json();
    if (!uid || !itemId) {
      return NextResponse.json({ error: 'uid and itemId required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', uid)
      .single();

    if (!user?.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get access token to remove item from Plaid
    const { data: item } = await supabase
      .from('plaid_items')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('plaid_item_id', itemId)
      .single();

    if (item?.access_token) {
      try {
        await removeItem(item.access_token);
      } catch {
        // Item may already be removed from Plaid, continue with DB removal
      }
    }

    // Remove from database
    await supabase
      .from('plaid_items')
      .delete()
      .eq('user_id', user.id)
      .eq('plaid_item_id', itemId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Plaid disconnect error:', err);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
