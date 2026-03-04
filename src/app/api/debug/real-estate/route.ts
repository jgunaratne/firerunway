export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET /api/debug/real-estate?clerkId=xxx
// Diagnostic endpoint to check what's in the database
export async function GET(request: NextRequest) {
  const clerkId = request.nextUrl.searchParams.get('clerkId');
  if (!clerkId) {
    return NextResponse.json({ error: 'clerkId required' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Check how many user rows exist for this clerk_id
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', clerkId);

  // Get ALL properties for ALL matching user IDs
  const userIds = (users || []).map(u => u.id);
  let properties: unknown[] = [];
  let propErr = null;

  if (userIds.length > 0) {
    const { data, error } = await supabase
      .from('real_estate_properties')
      .select('id, user_id, address, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false });
    properties = data ?? [];
    propErr = error;
  }

  // Also get total count of properties in entire table
  const { count: totalCount } = await supabase
    .from('real_estate_properties')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({
    clerkId,
    userRows: users?.length ?? 0,
    userIds,
    usersErr,
    propertiesForUser: properties,
    propErr,
    totalPropertiesInTable: totalCount,
  });
}
