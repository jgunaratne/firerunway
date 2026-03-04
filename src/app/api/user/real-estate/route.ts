export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// POST /api/user/real-estate — add a property
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clerkId, ...property } = body;

    if (!clerkId) {
      return NextResponse.json({ error: 'clerkId is required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('real_estate_properties')
      .insert({
        user_id: user.id,
        address: property.address,
        property_type: property.property_type,
        purchase_price: property.purchase_price,
        purchase_date: property.purchase_date,
        current_value: property.current_value,
        original_loan_amount: property.original_loan_amount,
        mortgage_balance: property.mortgage_balance,
        mortgage_rate: property.mortgage_rate,
        mortgage_term_months: property.mortgage_term_months,
        mortgage_start_date: property.mortgage_start_date,
        monthly_payment: property.monthly_payment,
        monthly_rent: property.monthly_rent || null,
        include_equity_in_fire: property.include_equity_in_fire || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json(
        { error: `Failed to add property: ${error.message || error.code || 'Unknown error'}`, details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ property: data });
  } catch (error) {
    console.error('Real estate API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/user/real-estate?clerkId=xxx&propertyId=xxx
export async function DELETE(request: NextRequest) {
  const clerkId = request.nextUrl.searchParams.get('clerkId');
  const propertyId = request.nextUrl.searchParams.get('propertyId');

  if (!clerkId || !propertyId) {
    return NextResponse.json({ error: 'clerkId and propertyId required' }, { status: 400 });
  }

  try {
    const supabase = createServerClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('real_estate_properties')
      .delete()
      .eq('id', propertyId)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Real estate delete error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
