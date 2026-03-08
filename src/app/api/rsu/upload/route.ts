export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { parseRsuPdf, parseRsuText } from '@/lib/gemini-pdf';
import { createServerClient } from '@/lib/supabase';
import { extractUserId, resolveUserId } from '@/lib/auth-helpers';

interface ExtractedGrant {
  company_ticker: string;
  grant_date: string;
  total_shares: number;
  vested_shares: number;
  vest_period_months: number;
  vest_frequency: string;
  cliff_months: number;
}

// POST /api/rsu/upload?uid=xxx&action=extract|save
// action=extract: Parse PDF, return grants for preview (does NOT save)
// action=save: Save grants directly to database
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'extract';

    const uid = await extractUserId(request);
    const userId = await resolveUserId(uid);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (action === 'save') {
      // Save pre-reviewed grants from the UI
      const body = await request.json();
      const grants = body.grants as ExtractedGrant[];

      if (!grants || grants.length === 0) {
        return NextResponse.json({ error: 'No grants provided' }, { status: 400 });
      }

      const supabase = createServerClient();
      const rows = grants.map((g) => ({
        user_id: userId,
        company_ticker: g.company_ticker?.toUpperCase() || 'UNKNOWN',
        grant_date: g.grant_date || null,
        total_shares: g.total_shares || 0,
        vested_shares: g.vested_shares || 0,
        cliff_months: g.cliff_months || 12,
        vest_period_months: g.vest_period_months || 48,
        vest_frequency: g.vest_frequency || 'quarterly',
      }));

      const { error: dbError } = await supabase.from('rsu_grants').insert(rows);
      if (dbError) {
        console.error('[RSU Upload] DB insert error:', dbError);
        return NextResponse.json({ error: `Database error: ${dbError.message}` }, { status: 500 });
      }

      return NextResponse.json({ success: true, grantsInserted: rows.length });
    }

    if (action === 'extract-text') {
      // Parse pasted text and return grants for preview
      const body = await request.json();
      const text = body.text as string;
      if (!text || text.trim().length === 0) {
        return NextResponse.json({ error: 'No text provided' }, { status: 400 });
      }

      const result = await parseRsuText(text);
      const grants = (result.grants as ExtractedGrant[]) ?? [];

      return NextResponse.json({
        success: true,
        grants,
        extractionConfidence: result.extractionConfidence || '',
        extractionNotes: result.extractionNotes || '',
        errors: result.error ? [result.error as string] : undefined,
      });
    }

    // action=extract: Parse PDF and return for preview
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const allGrants: ExtractedGrant[] = [];
    const errors: string[] = [];

    let extractionConfidence = '';
    let extractionNotes = '';

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        errors.push(`${file.name}: Not a PDF file`);
        continue;
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdfBytes = Buffer.from(arrayBuffer);
      const result = await parseRsuPdf(pdfBytes, file.name);

      if (result.error) {
        errors.push(`${file.name}: ${result.error}`);
        continue;
      }

      extractionConfidence = (result.extractionConfidence as string) || '';
      extractionNotes = (result.extractionNotes as string) || '';

      const grants = (result.grants as ExtractedGrant[]) ?? [];
      if (grants.length === 0) {
        errors.push(`${file.name}: No RSU grants found in document`);
        continue;
      }

      allGrants.push(...grants);
    }

    return NextResponse.json({
      success: true,
      grants: allGrants,
      extractionConfidence,
      extractionNotes,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error('[RSU Upload] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/rsu/upload?uid=xxx — Delete all RSU grants for the user
export async function DELETE(request: Request) {
  try {
    const uid = await extractUserId(request);
    const userId = await resolveUserId(uid);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from('rsu_grants')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[RSU] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[RSU] Delete error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
