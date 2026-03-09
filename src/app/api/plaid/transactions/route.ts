export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTransactions } from '@/lib/plaid';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/plaid/transactions?uid=xxx&months=3&includePartner=true
 * Fetch transactions from all Plaid items for the given time range.
 * When includePartner=true, also fetches the linked partner's transactions.
 */
export async function GET(req: NextRequest) {
  try {
    const uid = req.nextUrl.searchParams.get('uid');
    const months = parseInt(req.nextUrl.searchParams.get('months') || '3', 10);
    const includePartner = req.nextUrl.searchParams.get('includePartner') === 'true';

    if (!uid) {
      return NextResponse.json({ error: 'uid required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('firebase_uid', uid)
      .single();

    if (!user?.id) {
      return NextResponse.json({ transactions: [] });
    }

    // Get the user's display name
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('first_name')
      .eq('user_id', user.id)
      .single();

    const userName = userProfile?.first_name || user.email?.split('@')[0] || 'Me';

    // Build list of users to fetch items for
    const usersToFetch: { userId: string; ownerName: string }[] = [
      { userId: user.id, ownerName: userName },
    ];

    // If includePartner, find household link
    if (includePartner) {
      const { data: link } = await supabase
        .from('household_links')
        .select('user_id_1, user_id_2')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
        .single();

      if (link) {
        const partnerId = link.user_id_1 === user.id ? link.user_id_2 : link.user_id_1;
        const { data: partner } = await supabase
          .from('users')
          .select('id, email')
          .eq('id', partnerId)
          .single();

        if (partner) {
          const { data: partnerProfile } = await supabase
            .from('user_profiles')
            .select('first_name')
            .eq('user_id', partnerId)
            .single();

          usersToFetch.push({
            userId: partner.id,
            ownerName: partnerProfile?.first_name || partner.email?.split('@')[0] || 'Partner',
          });
        }
      }
    }

    // Date range
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    interface TransactionItem {
      id: string;
      date: string;
      name: string;
      merchantName: string | null;
      amount: number;
      category: string[];
      personalFinanceCategory: string | null;
      personalFinanceCategoryDetailed: string | null;
      accountId: string;
      institutionName: string;
      pending: boolean;
      ownerName: string;
    }

    const allTransactions: TransactionItem[] = [];

    // Fetch items for each user
    for (const { userId, ownerName } of usersToFetch) {
      const { data: items } = await supabase
        .from('plaid_items')
        .select('access_token, institution_name')
        .eq('user_id', userId);

      if (!items || items.length === 0) continue;

      for (const item of items) {
        try {
          const data = await getTransactions(item.access_token, startDate, endDate);
          for (const tx of data.transactions) {
            allTransactions.push({
              id: tx.transaction_id,
              date: tx.date,
              name: tx.name,
              merchantName: tx.merchant_name || null,
              amount: tx.amount,
              category: tx.category || [],
              personalFinanceCategory: tx.personal_finance_category?.primary || null,
              personalFinanceCategoryDetailed: tx.personal_finance_category?.detailed || null,
              accountId: tx.account_id,
              institutionName: item.institution_name || 'Unknown',
              pending: tx.pending,
              ownerName,
            });
          }
        } catch (err) {
          console.error(`Plaid transactions error for ${item.institution_name}:`, err);
        }
      }
    }

    // Sort by date descending
    allTransactions.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ transactions: allTransactions });
  } catch (err) {
    console.error('Plaid transactions error:', err);
    return NextResponse.json({ transactions: [], error: 'Failed to fetch transactions' });
  }
}
