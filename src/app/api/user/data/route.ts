export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET /api/user/data?clerkId=xxx
// Fetches all user financial data from Supabase for dashboard rendering
export async function GET(request: NextRequest) {
  const clerkId = request.nextUrl.searchParams.get('clerkId');

  if (!clerkId) {
    return NextResponse.json({ error: 'clerkId is required' }, { status: 400 });
  }

  try {
    const supabase = createServerClient();

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = user.id;

    // Fetch real estate separately to avoid any potential interference
    const { data: properties, error: propError } = await supabase
      .from('real_estate_properties')
      .select('*')
      .eq('user_id', userId);




    // Fetch remaining data in parallel
    const [profileRes, grantsRes, accountsRes, historyRes] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single(),
      supabase
        .from('rsu_grants')
        .select('*')
        .eq('user_id', userId),
      supabase
        .from('account_snapshots')
        .select('*')
        .eq('user_id', userId),
      supabase
        .from('net_worth_history')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_date', { ascending: true })
        .limit(365),
    ]);

    const response = NextResponse.json({
      profile: profileRes.data,
      rsuGrants: grantsRes.data ?? [],
      realEstate: properties ?? [],
      accounts: accountsRes.data ?? [],
      netWorthHistory: historyRes.data ?? [],
    });

    // Prevent ALL caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    return response;
  } catch (error) {
    console.error('User data fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}
