export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { deleteIncomeTax } from '@/lib/supabase-db';
import { extractUserId, resolveUserId } from '@/lib/auth-helpers';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const uid = await extractUserId(request);
  const userId = await resolveUserId(uid);
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { id } = params;
  const deleted = await deleteIncomeTax(userId, id);
  return NextResponse.json({ deleted });
}
