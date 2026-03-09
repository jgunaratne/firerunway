export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { exchangePublicToken } from '@/lib/plaid';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/plaid/exchange-token
 * Exchanges a public token from Plaid Link for a permanent access token.
 * Stores the access token in Supabase.
 */
export async function POST(req: NextRequest) {
  try {
    const { uid, publicToken, institutionName } = await req.json();
    if (!uid || !publicToken) {
      return NextResponse.json({ error: 'uid and publicToken required' }, { status: 400 });
    }

    // Exchange public token for access token
    const data = await exchangePublicToken(publicToken);
    const accessToken = data.access_token;
    const itemId = data.item_id;

    // Ensure user row exists (upsert for new users who haven't completed onboarding)
    const supabase = createServerClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({ firebase_uid: uid }, { onConflict: 'firebase_uid' })
      .select('id')
      .single();

    if (userError || !user?.id) {
      console.error('Failed to upsert user:', userError);
      return NextResponse.json({ error: 'Failed to resolve user' }, { status: 500 });
    }

    // Store access token
    await supabase.from('plaid_items').upsert({
      user_id: user.id,
      plaid_item_id: itemId,
      access_token: accessToken,
      institution_name: institutionName || 'Unknown',
    }, { onConflict: 'user_id,plaid_item_id' });

    return NextResponse.json({ success: true, itemId });
  } catch (err) {
    console.error('Plaid exchange-token error:', err);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
