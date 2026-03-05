export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createLinkToken } from '@/lib/plaid';

/**
 * POST /api/plaid/link-token
 * Creates a Plaid Link token for the frontend.
 */
export async function POST(req: NextRequest) {
  try {
    const { clerkId } = await req.json();
    if (!clerkId) {
      return NextResponse.json({ error: 'clerkId required' }, { status: 400 });
    }

    const data = await createLinkToken(clerkId);
    return NextResponse.json({ linkToken: data.link_token });
  } catch (err: unknown) {
    const plaidError = err as { response?: { data?: { error_code?: string; error_message?: string; error_type?: string } } };
    if (plaidError.response?.data) {
      console.error('Plaid link-token error:', JSON.stringify(plaidError.response.data));
    } else {
      console.error('Plaid link-token error:', err);
    }
    const msg = plaidError.response?.data?.error_message || 'Failed to create link token';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
