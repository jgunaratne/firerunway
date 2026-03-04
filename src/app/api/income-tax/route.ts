export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { listIncomeTax } from '@/lib/supabase-db';
import { extractClerkId, resolveUserId } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  try {
    const clerkId = extractClerkId(request);
    const userId = await resolveUserId(clerkId);
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const records = await listIncomeTax(userId);
    return NextResponse.json({ records });
  } catch (e) {
    console.error('[Income Tax] List error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
