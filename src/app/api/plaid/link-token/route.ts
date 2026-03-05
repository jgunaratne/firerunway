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
  } catch (err) {
    console.error('Plaid link-token error:', err);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
