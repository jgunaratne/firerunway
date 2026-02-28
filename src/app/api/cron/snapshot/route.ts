import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// POST /api/cron/snapshot
// Daily net worth snapshot — called by system cron
// Protected by CRON_SECRET bearer token
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServerClient();

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id');

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    const today = new Date().toISOString().split('T')[0];
    let snapshotCount = 0;

    for (const user of users ?? []) {
      // Fetch latest account snapshots for this user
      const { data: accounts } = await supabase
        .from('account_snapshots')
        .select('account_type, total_value')
        .eq('user_id', user.id);

      // Fetch real estate for this user
      const { data: properties } = await supabase
        .from('real_estate_properties')
        .select('current_value, mortgage_balance')
        .eq('user_id', user.id);

      // TODO: Fetch RSU grants and current stock prices from Polygon.io
      //       to calculate RSU value for net worth snapshot
      // Calculate totals
      const investmentValue = accounts
        ?.filter(a => a.account_type === 'brokerage')
        .reduce((sum, a) => sum + (a.total_value || 0), 0) ?? 0;

      const retirementValue = accounts
        ?.filter(a => ['401k', 'ira', 'roth'].includes(a.account_type))
        .reduce((sum, a) => sum + (a.total_value || 0), 0) ?? 0;

      const realEstateEquity = properties
        ?.reduce((sum, p) => sum + ((p.current_value || 0) - (p.mortgage_balance || 0)), 0) ?? 0;

      const mortgageBalance = properties
        ?.reduce((sum, p) => sum + (p.mortgage_balance || 0), 0) ?? 0;

      // RSU value would need current stock price — simplified for now
      const rsuValue = 0; // TODO: fetch from Polygon.io

      const totalNetWorth = investmentValue + retirementValue + realEstateEquity + rsuValue;

      // Upsert snapshot (one per user per day)
      const { error: snapshotError } = await supabase
        .from('net_worth_history')
        .upsert({
          user_id: user.id,
          recorded_date: today,
          total_net_worth: totalNetWorth,
          investment_value: investmentValue,
          retirement_value: retirementValue,
          rsu_value: rsuValue,
          real_estate_equity: realEstateEquity,
          mortgage_balance: mortgageBalance,
          cash_other: 0,
        }, {
          onConflict: 'user_id,recorded_date',
        });

      if (!snapshotError) snapshotCount++;
    }

    return NextResponse.json({
      success: true,
      snapshots: snapshotCount,
      date: today,
    });
  } catch (error) {
    console.error('Cron snapshot error:', error);
    return NextResponse.json(
      { error: 'Failed to create snapshots' },
      { status: 500 }
    );
  }
}
