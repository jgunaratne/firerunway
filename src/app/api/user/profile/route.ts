export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// PUT /api/user/profile — Update or create user profile fields
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, ...fields } = body;

    if (!uid) {
      return NextResponse.json({ error: 'uid is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', uid)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Upsert profile (insert if not exists, update if exists)
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: user.id, ...fields, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Profile upsert error:', error);
      return NextResponse.json(
        { error: `Failed to update profile: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
