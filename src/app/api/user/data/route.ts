export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET /api/user/data?uid=xxx
// Fetches all user financial data from Supabase for dashboard rendering
export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get('uid');

  if (!uid) {
    return NextResponse.json({ error: 'uid is required' }, { status: 400 });
  }

  try {
    const supabase = createServerClient();
    const email = request.nextUrl.searchParams.get('email');

    let user: { id: string } | null = null;

    // Try 1: Look up by firebase_uid
    try {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('firebase_uid', uid)
        .single();
      if (data) user = data;
    } catch {
      // Column may not exist yet — that's fine
    }

    // Try 2: Look up by email (migration from Clerk)
    if (!user && email) {
      const { data: emailUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (emailUser) {
        user = emailUser;
        // Try to auto-link firebase_uid (non-fatal if column doesn't exist)
        try {
          await supabase
            .from('users')
            .update({ firebase_uid: uid })
            .eq('id', emailUser.id);
          console.log(`[Auth] Auto-linked firebase_uid to user ${emailUser.id}`);
        } catch {
          console.log(`[Auth] Could not auto-link firebase_uid (column may not exist)`);
        }
      }
    }

    // Try 3: Fall back to snaptrade_user_id column (treats uid as snaptrade_user_id)
    if (!user) {
      const { data: legacyUser } = await supabase
        .from('users')
        .select('id')
        .eq('snaptrade_user_id', uid)
        .single();
      if (legacyUser) user = legacyUser;
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = user.id;

    // Fetch real estate separately to avoid any potential interference
    const { data: properties } = await supabase
      .from('real_estate_properties')
      .select('*')
      .eq('user_id', userId);




    // Fetch remaining data in parallel
    const [profileRes, grantsRes, accountsRes, historyRes, incomeRes] = await Promise.all([
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
      supabase
        .from('income_tax')
        .select('*')
        .eq('user_id', userId)
        .order('tax_year', { ascending: false }),
    ]);

    const response = NextResponse.json({
      profile: profileRes.data,
      rsuGrants: grantsRes.data ?? [],
      realEstate: properties ?? [],
      accounts: accountsRes.data ?? [],
      netWorthHistory: historyRes.data ?? [],
      incomeTaxRecords: incomeRes.data ?? [],
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
