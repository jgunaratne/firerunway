export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { deleteIncomeTax } from '@/lib/supabase-db';
import { extractClerkId, resolveUserId } from '@/lib/auth-helpers';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const clerkId = extractClerkId(request);
  const userId = await resolveUserId(clerkId);
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { id } = params;
  const deleted = await deleteIncomeTax(userId, id);
  return NextResponse.json({ deleted });
}
