import { NextRequest, NextResponse } from 'next/server';
import { generateConnectionPortalUrl } from '@/lib/snaptrade';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/snaptrade/connect
 * Generate a SnapTrade Connection Portal URL for the user.
 * The frontend opens this URL in a popup/new tab for the user to connect their brokerage.
 */
export async function POST(req: NextRequest) {
  try {
    const { clerkId, broker } = await req.json();
    if (!clerkId) {
      return NextResponse.json({ error: 'clerkId required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Get the user's SnapTrade secret
    const { data: user } = await supabase
      .from('users')
      .select('snaptrade_user_secret')
      .eq('clerk_id', clerkId)
      .single();

    if (!user?.snaptrade_user_secret) {
      return NextResponse.json(
        { error: 'User not registered with SnapTrade. Call /api/snaptrade/register first.' },
        { status: 400 }
      );
    }

    const result = await generateConnectionPortalUrl(
      clerkId,
      user.snaptrade_user_secret,
      { broker }
    );

    return NextResponse.json({
      redirectURI: result.redirectURI || result.loginLink,
    });
  } catch (err) {
    console.error('SnapTrade connect error:', err);
    return NextResponse.json(
      { error: 'Failed to generate connection portal URL' },
      { status: 500 }
    );
  }
}
