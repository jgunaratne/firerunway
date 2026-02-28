import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/snaptrade';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/snaptrade/register
 * Register a SnapTrade user and store the userSecret in Supabase.
 */
export async function POST(req: NextRequest) {
  try {
    const { clerkId } = await req.json();
    if (!clerkId) {
      return NextResponse.json({ error: 'clerkId required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Check if user already has a SnapTrade secret
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

    // Register with SnapTrade
    const result = await registerUser(clerkId);
    const userSecret = result.userSecret;

    // Store secret in Supabase
    await supabase
      .from('users')
      .update({ snaptrade_user_secret: userSecret })
      .eq('clerk_id', clerkId);

    return NextResponse.json({ userId: clerkId, userSecret });
  } catch (err) {
    console.error('SnapTrade register error:', err);
    return NextResponse.json(
      { error: 'Failed to register SnapTrade user' },
      { status: 500 }
    );
  }
}
