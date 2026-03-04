export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { listStatements } from '@/lib/supabase-db';
import { extractClerkId, resolveUserId } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  try {
    const clerkId = extractClerkId(request);
    const userId = await resolveUserId(clerkId);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const statements = await listStatements(userId);
    return NextResponse.json({ statements });
  } catch (e) {
    console.error('[Statements] List error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
