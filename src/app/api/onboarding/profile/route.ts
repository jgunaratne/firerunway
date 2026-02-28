import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// POST /api/onboarding/profile
// Persists user profile, RSU grants, and real estate from onboarding flow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clerkId, email, profile, rsuGrants, realEstate } = body;

    if (!clerkId) {
      return NextResponse.json({ error: 'clerkId is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // 1. Upsert user
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({ clerk_id: clerkId, email }, { onConflict: 'clerk_id' })
      .select('id')
      .single();

    if (userError || !user) {
      throw new Error(`Failed to create user: ${userError?.message}`);
    }

    const userId = user.id;

    // 2. Upsert user profile
    if (profile) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          annual_income: profile.annualIncome,
          annual_spend: profile.annualSpend,
          retirement_spend: profile.retirementSpend,
          state_of_residence: profile.stateOfResidence,
          filing_status: profile.filingStatus,
          fire_number: profile.fireNumber,
          fire_target_year: profile.fireTargetYear,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (profileError) {
        console.error('Profile upsert error:', profileError);
      }
    }

    // 3. Insert RSU grants (delete existing, then insert fresh)
    if (rsuGrants && rsuGrants.length > 0) {
      await supabase
        .from('rsu_grants')
        .delete()
        .eq('user_id', userId);

      const grantsToInsert = rsuGrants.map((grant: {
        companyTicker: string;
        grantDate: string;
        totalShares: number;
        vestedShares: number;
        cliffMonths: number;
        vestPeriodMonths: number;
        vestFrequency: string;
      }) => ({
        user_id: userId,
        company_ticker: grant.companyTicker,
        grant_date: grant.grantDate,
        total_shares: grant.totalShares,
        vested_shares: grant.vestedShares,
        cliff_months: grant.cliffMonths,
        vest_period_months: grant.vestPeriodMonths,
        vest_frequency: grant.vestFrequency,
      }));

      const { error: grantsError } = await supabase
        .from('rsu_grants')
        .insert(grantsToInsert);

      if (grantsError) {
        console.error('RSU grants insert error:', grantsError);
      }
    }

    // 4. Insert real estate properties (delete existing, then insert fresh)
    if (realEstate && realEstate.length > 0) {
      await supabase
        .from('real_estate_properties')
        .delete()
        .eq('user_id', userId);

      const propertiesToInsert = realEstate.map((prop: {
        address: string;
        propertyType: string;
        purchasePrice: number;
        purchaseDate: string;
        currentValue: number;
        originalLoanAmount: number;
        mortgageBalance: number;
        mortgageRate: number;
        mortgageTermMonths: number;
        mortgageStartDate: string;
        monthlyPayment: number;
        monthlyRent?: number;
        includeEquityInFire?: boolean;
      }) => ({
        user_id: userId,
        address: prop.address,
        property_type: prop.propertyType,
        purchase_price: prop.purchasePrice,
        purchase_date: prop.purchaseDate,
        current_value: prop.currentValue,
        original_loan_amount: prop.originalLoanAmount,
        mortgage_balance: prop.mortgageBalance,
        mortgage_rate: prop.mortgageRate,
        mortgage_term_months: prop.mortgageTermMonths,
        mortgage_start_date: prop.mortgageStartDate,
        monthly_payment: prop.monthlyPayment,
        monthly_rent: prop.monthlyRent ?? null,
        include_equity_in_fire: prop.includeEquityInFire ?? false,
        updated_at: new Date().toISOString(),
      }));

      const { error: propError } = await supabase
        .from('real_estate_properties')
        .insert(propertiesToInsert);

      if (propError) {
        console.error('Real estate insert error:', propError);
      }
    }

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    console.error('Onboarding save error:', error);
    return NextResponse.json(
      { error: 'Failed to save onboarding data' },
      { status: 500 }
    );
  }
}
