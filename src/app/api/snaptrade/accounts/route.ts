import { NextRequest, NextResponse } from 'next/server';
import { listAccounts, deleteBrokerageAuthorization } from '@/lib/snaptrade';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/snaptrade/accounts?clerkId=xxx
 * List all connected brokerage accounts.
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
      return NextResponse.json({ accounts: [] });
    }

    const accounts = await listAccounts(clerkId, user.snaptrade_user_secret);
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
    const { clerkId, authorizationId } = await req.json();
    if (!clerkId || !authorizationId) {
      return NextResponse.json({ error: 'clerkId and authorizationId required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: user } = await supabase
      .from('users')
      .select('snaptrade_user_secret')
      .eq('clerk_id', clerkId)
      .single();

    if (!user?.snaptrade_user_secret) {
      return NextResponse.json({ error: 'User not registered' }, { status: 400 });
    }

    await deleteBrokerageAuthorization(clerkId, user.snaptrade_user_secret, authorizationId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('SnapTrade disconnect error:', err);
    return NextResponse.json({ error: 'Failed to disconnect account' }, { status: 500 });
  }
}
