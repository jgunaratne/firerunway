import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// POST /api/scenarios
// Save a Monte Carlo scenario to Supabase
export async function POST(request: NextRequest) {
  try {
    const { clerkId, name, params, resultSummary } = await request.json();

    if (!clerkId || !name) {
      return NextResponse.json({ error: 'clerkId and name are required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Get user ID
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: scenario, error } = await supabase
      .from('scenarios')
      .insert({
        user_id: user.id,
        name,
        params,
        result_summary: resultSummary,
      })
      .select('id, name, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ scenario });
  } catch (error) {
    console.error('Save scenario error:', error);
    return NextResponse.json({ error: 'Failed to save scenario' }, { status: 500 });
  }
}

// GET /api/scenarios?clerkId=xxx
// List all saved scenarios for a user
export async function GET(request: NextRequest) {
  const clerkId = request.nextUrl.searchParams.get('clerkId');

  if (!clerkId) {
    return NextResponse.json({ error: 'clerkId is required' }, { status: 400 });
  }

  try {
    const supabase = createServerClient();

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: scenarios, error } = await supabase
      .from('scenarios')
      .select('id, name, params, result_summary, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ scenarios: scenarios ?? [] });
  } catch (error) {
    console.error('List scenarios error:', error);
    return NextResponse.json({ error: 'Failed to list scenarios' }, { status: 500 });
  }
}
