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
    const { uid, publicToken, institutionName, email } = await req.json();
    if (!uid || !publicToken) {
      return NextResponse.json({ error: 'uid and publicToken required' }, { status: 400 });
    }

    // Exchange public token for access token
    const data = await exchangePublicToken(publicToken);
    const accessToken = data.access_token;
    const itemId = data.item_id;

    // Look up user, creating a row if needed (new users may not have completed onboarding)
    const supabase = createServerClient();
    let userId: string;

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', uid)
      .single();

    if (existingUser?.id) {
      userId = existingUser.id;
    } else {
      // Create user row for first-time Plaid connector
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({ firebase_uid: uid, email: email || null })
        .select('id')
        .single();

      if (insertError || !newUser?.id) {
        console.error('Failed to create user for Plaid:', insertError);
        return NextResponse.json({ error: 'Failed to resolve user' }, { status: 500 });
      }
      userId = newUser.id;
    }

    // Store access token
    await supabase.from('plaid_items').upsert({
      user_id: userId,
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
