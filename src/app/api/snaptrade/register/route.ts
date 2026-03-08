export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { registerUser, deleteUser } from '@/lib/snaptrade';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/snaptrade/register
 * Register a SnapTrade user and store the userSecret in Supabase.
 * If the user already exists on SnapTrade, delete and re-register.
 */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await req.json();
    if (!uid) {
      return NextResponse.json({ error: 'uid required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Check if user already has a SnapTrade secret stored locally
    const { data: existing } = await supabase
      .from('users')
      .select('snaptrade_user_secret')
      .eq('firebase_uid', uid)
      .single();

    if (existing?.snaptrade_user_secret) {
      return NextResponse.json({
        userId: uid,
        userSecret: existing.snaptrade_user_secret,
        alreadyRegistered: true,
      });
    }

    // Try to register with SnapTrade
    let userSecret: string;
    try {
      const result = await registerUser(uid);
      userSecret = result.userSecret as string;
    } catch (regErr: unknown) {
      // If user already exists on SnapTrade (code 1010), delete and re-register
      const errBody = (regErr as { responseBody?: { code?: string } })?.responseBody;
      if (errBody?.code === '1010') {
        console.log('User already exists on SnapTrade, deleting and re-registering...');
        await deleteUser(uid);
        const result = await registerUser(uid);
        userSecret = result.userSecret as string;
      } else {
        throw regErr;
      }
    }

    // Store secret in Supabase (upsert in case user row doesn't exist yet)
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        { firebase_uid: uid, snaptrade_user_secret: userSecret },
        { onConflict: 'firebase_uid' }
      );

    if (upsertError) {
      console.error('Failed to store SnapTrade secret in Supabase:', upsertError);
    }

    return NextResponse.json({ userId: uid, userSecret });
  } catch (err: unknown) {
    console.error('SnapTrade register error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to register SnapTrade user: ${message}` },
      { status: 500 }
    );
  }
}
