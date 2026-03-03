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
    const { clerkId } = await req.json();
    if (!clerkId) {
      return NextResponse.json({ error: 'clerkId required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Check if user already has a SnapTrade secret stored locally
    const { data: existing } = await supabase
      .from('users')
      .select('snaptrade_user_secret')
      .eq('clerk_id', clerkId)
      .single();

    if (existing?.snaptrade_user_secret) {
      return NextResponse.json({
        userId: clerkId,
        userSecret: existing.snaptrade_user_secret,
        alreadyRegistered: true,
      });
    }

    // Try to register with SnapTrade
    let userSecret: string;
    try {
      const result = await registerUser(clerkId);
      userSecret = result.userSecret as string;
    } catch (regErr: unknown) {
      // If user already exists on SnapTrade (code 1010), delete and re-register
      const errBody = (regErr as { responseBody?: { code?: string } })?.responseBody;
      if (errBody?.code === '1010') {
        console.log('User already exists on SnapTrade, deleting and re-registering...');
        await deleteUser(clerkId);
        const result = await registerUser(clerkId);
        userSecret = result.userSecret as string;
      } else {
        throw regErr;
      }
    }

    // Store secret in Supabase (upsert in case user row doesn't exist yet)
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        { clerk_id: clerkId, snaptrade_user_secret: userSecret },
        { onConflict: 'clerk_id' }
      );

    if (upsertError) {
      console.error('Failed to store SnapTrade secret in Supabase:', upsertError);
    }

    return NextResponse.json({ userId: clerkId, userSecret });
  } catch (err: unknown) {
    console.error('SnapTrade register error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to register SnapTrade user: ${message}` },
      { status: 500 }
    );
  }
}
