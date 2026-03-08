export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getStatement, deleteStatement, getHoldingsForStatement } from '@/lib/supabase-db';
import { extractUserId, resolveUserId } from '@/lib/auth-helpers';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const uid = await extractUserId(request);
  const userId = await resolveUserId(uid);
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { id } = params;
  const statement = await getStatement(userId, id);
  if (!statement) return NextResponse.json({ detail: 'Statement not found' }, { status: 404 });
  const holdings = await getHoldingsForStatement(id);
  return NextResponse.json({ ...statement, holdings });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const uid = await extractUserId(request);
  const userId = await resolveUserId(uid);
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { id } = params;
  const deleted = await deleteStatement(userId, id);
  if (!deleted) return NextResponse.json({ detail: 'Statement not found' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
