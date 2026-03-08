export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { listAccounts, deleteBrokerageAuthorization } from '@/lib/snaptrade';
import { createServerClient } from '@/lib/supabase';
import { maskAccountNumber } from '@/lib/mask-utils';

/**
 * GET /api/snaptrade/accounts?uid=xxx
 * List all connected brokerage accounts.
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
      .select('snaptrade_user_id, snaptrade_user_secret')
      .eq('firebase_uid', uid)
      .single();

    if (!user?.snaptrade_user_secret || !user?.snaptrade_user_id) {
      return NextResponse.json({ accounts: [] });
    }

    const rawAccounts = await listAccounts(user.snaptrade_user_id, user.snaptrade_user_secret);
    // Mask account numbers before sending to client — full numbers never leave the server
    const accounts = (rawAccounts || []).map((a: Record<string, unknown>) => ({
      ...a,
      number: maskAccountNumber(String(a.number || '')),
    }));
    return NextResponse.json({ accounts });
  } catch (err) {
    console.error('SnapTrade accounts error:', err);
    return NextResponse.json({ accounts: [], error: 'Failed to fetch accounts' });
  }
}

/**
 * DELETE /api/snaptrade/accounts
 * Disconnect a brokerage authorization.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { uid, authorizationId } = await req.json();
    if (!uid || !authorizationId) {
      return NextResponse.json({ error: 'uid and authorizationId required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: user } = await supabase
      .from('users')
      .select('snaptrade_user_id, snaptrade_user_secret')
      .eq('firebase_uid', uid)
      .single();

    if (!user?.snaptrade_user_secret || !user?.snaptrade_user_id) {
      return NextResponse.json({ error: 'User not registered' }, { status: 400 });
    }

    await deleteBrokerageAuthorization(user.snaptrade_user_id, user.snaptrade_user_secret, authorizationId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('SnapTrade disconnect error:', err);
    return NextResponse.json({ error: 'Failed to disconnect account' }, { status: 500 });
  }
}
