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

    // Build the callback URL for after connection
    const origin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/[^/]*$/, '') || 'http://localhost:3000';
    const customRedirect = `${origin}/snaptrade-callback`;

    const result = await generateConnectionPortalUrl(
      clerkId,
      user.snaptrade_user_secret,
      { broker, customRedirect }
    );
    // The SDK returns a union type; extract redirectURI from the response
    const loginResult = result as Record<string, unknown>;
    const redirectURI = loginResult.redirectURI || loginResult.loginLink;

    return NextResponse.json({
      redirectURI,
    });
  } catch (err: unknown) {
    console.error('SnapTrade connect error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to generate connection portal URL: ${message}` },
      { status: 500 }
    );
  }
}
