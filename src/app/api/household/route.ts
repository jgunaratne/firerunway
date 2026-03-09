export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/household?uid=xxx
 * Returns the linked partner (if any) for the given user.
 */
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get('uid');
  if (!uid) {
    return NextResponse.json({ error: 'uid required' }, { status: 400 });
  }

  try {
    const supabase = createServerClient();

    // Look up user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', uid)
      .single();

    if (!user?.id) {
      return NextResponse.json({ partner: null });
    }

    // Find household link (user could be on either side)
    const { data: link } = await supabase
      .from('household_links')
      .select('id, user_id_1, user_id_2')
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
      .single();

    if (!link) {
      return NextResponse.json({ partner: null });
    }

    // Get partner info
    const partnerId = link.user_id_1 === user.id ? link.user_id_2 : link.user_id_1;
    const { data: partner } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', partnerId)
      .single();

    // Try to get partner's display name from profile
    const { data: partnerProfile } = await supabase
      .from('user_profiles')
      .select('first_name')
      .eq('user_id', partnerId)
      .single();

    return NextResponse.json({
      partner: partner ? {
        id: partner.id,
        email: partner.email,
        name: partnerProfile?.first_name || partner.email?.split('@')[0] || 'Partner',
      } : null,
      linkId: link.id,
    });
  } catch (err) {
    console.error('Household GET error:', err);
    return NextResponse.json({ partner: null });
  }
}

/**
 * POST /api/household
 * Link two users by email.
 * Body: { uid, partnerEmail }
 */
export async function POST(req: NextRequest) {
  try {
    const { uid, partnerEmail } = await req.json();
    if (!uid || !partnerEmail) {
      return NextResponse.json({ error: 'uid and partnerEmail required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Look up current user
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('firebase_uid', uid)
      .single();

    if (!user?.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent self-linking
    if (user.email?.toLowerCase() === partnerEmail.toLowerCase()) {
      return NextResponse.json({ error: 'Cannot link to yourself' }, { status: 400 });
    }

    // Look up partner by email
    const { data: partner } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', partnerEmail.toLowerCase())
      .single();

    if (!partner?.id) {
      return NextResponse.json({ error: 'No user found with that email. They need to sign up first.' }, { status: 404 });
    }

    // Check if either user already has a link
    const { data: existingLink } = await supabase
      .from('household_links')
      .select('id')
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id},user_id_1.eq.${partner.id},user_id_2.eq.${partner.id}`)
      .single();

    if (existingLink) {
      return NextResponse.json({ error: 'One of the users is already linked to a household' }, { status: 409 });
    }

    // Create link (always store lower ID first for consistency)
    const [id1, id2] = user.id < partner.id ? [user.id, partner.id] : [partner.id, user.id];
    const { error: insertError } = await supabase
      .from('household_links')
      .insert({ user_id_1: id1, user_id_2: id2 });

    if (insertError) {
      console.error('Household link insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create household link' }, { status: 500 });
    }

    // Get partner display name
    const { data: partnerProfile } = await supabase
      .from('user_profiles')
      .select('first_name')
      .eq('user_id', partner.id)
      .single();

    return NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        email: partner.email,
        name: partnerProfile?.first_name || partner.email?.split('@')[0] || 'Partner',
      },
    });
  } catch (err) {
    console.error('Household POST error:', err);
    return NextResponse.json({ error: 'Failed to link household' }, { status: 500 });
  }
}

/**
 * DELETE /api/household
 * Remove household link.
 * Body: { uid }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { uid } = await req.json();
    if (!uid) {
      return NextResponse.json({ error: 'uid required' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', uid)
      .single();

    if (!user?.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await supabase
      .from('household_links')
      .delete()
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Household DELETE error:', err);
    return NextResponse.json({ error: 'Failed to unlink household' }, { status: 500 });
  }
}
