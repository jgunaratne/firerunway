export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTransactions } from '@/lib/plaid';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/plaid/transactions?uid=xxx&months=3
 * Fetch transactions from all Plaid items for the given time range.
 */
export async function GET(req: NextRequest) {
  try {
    const uid = req.nextUrl.searchParams.get('uid');
    const months = parseInt(req.nextUrl.searchParams.get('months') || '3', 10);

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
      return NextResponse.json({ transactions: [] });
    }

    const { data: items } = await supabase
      .from('plaid_items')
      .select('access_token, institution_name')
      .eq('user_id', user.id);

    if (!items || items.length === 0) {
      return NextResponse.json({ transactions: [] });
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
      accountId: string;
      institutionName: string;
      pending: boolean;
    }

    const allTransactions: TransactionItem[] = [];

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
            accountId: tx.account_id,
            institutionName: item.institution_name || 'Unknown',
            pending: tx.pending,
          });
        }
      } catch (err) {
        console.error(`Plaid transactions error for ${item.institution_name}:`, err);
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
