/**
 * Supabase database layer for statements, holdings, income/tax, and analyses.
 * Replaces the SQLite lite-db.ts — all functions scoped by userId.
 */

import { createServerClient } from '@/lib/supabase';

// ── Statements ────────────────────────────────────────────────────────

export async function insertStatement(userId: string, opts: {
  filename: string;
  broker: string;
  accountNumber: string;
  accountType: string;
  statementDate: string;
  totalValue: number;
  cashBalance: number;
  extractionConfidence: string;
  extractionNotes: string | null;
  pdfData: Buffer | null;
}): Promise<string> {
  const supabase = createServerClient();

  // Upload PDF to storage if present
  let pdfStoragePath: string | null = null;
  if (opts.pdfData) {
    const path = `${userId}/${Date.now()}_${opts.filename}`;
    const { error: uploadError } = await supabase.storage
      .from('statement-pdfs')
      .upload(path, opts.pdfData, { contentType: 'application/pdf' });
    if (!uploadError) pdfStoragePath = path;
  }

  const { data, error } = await supabase
    .from('statements')
    .insert({
      user_id: userId,
      filename: opts.filename,
      broker: opts.broker,
      account_number: opts.accountNumber,
      account_type: opts.accountType,
      statement_date: opts.statementDate,
      total_value: opts.totalValue,
      cash_balance: opts.cashBalance,
      extraction_confidence: opts.extractionConfidence,
      extraction_notes: opts.extractionNotes,
      pdf_storage_path: pdfStoragePath,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Insert statement failed: ${error.message}`);
  return data.id;
}

export async function listStatements(userId: string): Promise<Record<string, unknown>[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('statements')
    .select('id, filename, broker, account_number, account_type, statement_date, total_value, cash_balance, uploaded_at, extraction_confidence, extraction_notes')
    .eq('user_id', userId)
    .order('statement_date', { ascending: false });

  if (error) throw new Error(`List statements failed: ${error.message}`);
  return data ?? [];
}

export async function getStatement(userId: string, statementId: string): Promise<Record<string, unknown> | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('statements')
    .select('id, filename, broker, account_number, account_type, statement_date, total_value, cash_balance, uploaded_at, extraction_confidence, extraction_notes, pdf_storage_path')
    .eq('id', statementId)
    .eq('user_id', userId)
    .single();

  if (error) return null;
  return data;
}

export async function getStatementPdf(userId: string, statementId: string): Promise<Buffer | null> {
  const supabase = createServerClient();
  const { data: stmt } = await supabase
    .from('statements')
    .select('pdf_storage_path')
    .eq('id', statementId)
    .eq('user_id', userId)
    .single();

  if (!stmt?.pdf_storage_path) return null;

  const { data, error } = await supabase.storage
    .from('statement-pdfs')
    .download(stmt.pdf_storage_path);

  if (error || !data) return null;
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function deleteStatement(userId: string, statementId: string): Promise<boolean> {
  const supabase = createServerClient();

  // Get PDF path before deleting
  const { data: stmt } = await supabase
    .from('statements')
    .select('pdf_storage_path')
    .eq('id', statementId)
    .eq('user_id', userId)
    .single();

  // Delete holdings first (cascade should handle this, but be explicit)
  await supabase.from('holdings').delete().eq('statement_id', statementId);

  // Delete statement
  const { error } = await supabase
    .from('statements')
    .delete()
    .eq('id', statementId)
    .eq('user_id', userId);

  // Clean up PDF from storage
  if (stmt?.pdf_storage_path) {
    await supabase.storage.from('statement-pdfs').remove([stmt.pdf_storage_path]);
  }

  return !error;
}

export async function updateStatementMetadata(userId: string, statementId: string, opts: {
  broker: string;
  accountNumber: string;
  accountType: string;
  statementDate: string;
  totalValue: number;
  cashBalance: number;
  extractionConfidence: string;
  extractionNotes: string | null;
}): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('statements')
    .update({
      broker: opts.broker,
      account_number: opts.accountNumber,
      account_type: opts.accountType,
      statement_date: opts.statementDate,
      total_value: opts.totalValue,
      cash_balance: opts.cashBalance,
      extraction_confidence: opts.extractionConfidence,
      extraction_notes: opts.extractionNotes,
    })
    .eq('id', statementId)
    .eq('user_id', userId);

  if (error) throw new Error(`Update statement failed: ${error.message}`);
}

// ── Holdings ──────────────────────────────────────────────────────────

export async function insertHoldings(statementId: string, holdings: Record<string, unknown>[]): Promise<void> {
  if (holdings.length === 0) return;
  const supabase = createServerClient();

  const rows = holdings.map(h => ({
    statement_id: statementId,
    symbol: (h.symbol as string) ?? '',
    name: (h.name as string) ?? '',
    asset_class: (h.assetClass as string) ?? (h.asset_class as string) ?? 'other',
    type: (h.type as string) ?? 'stock',
    quantity: (h.quantity as number) ?? 0,
    price: (h.price as number) ?? 0,
    market_value: (h.marketValue as number) ?? (h.market_value as number) ?? 0,
    cost_basis: (h.costBasis as number | null) ?? null,
    unrealized_gain_loss: (h.unrealizedGainLoss as number | null) ?? null,
    percent_of_account: (h.percentOfAccount as number) ?? 0,
  }));

  const { error } = await supabase.from('holdings').insert(rows);
  if (error) throw new Error(`Insert holdings failed: ${error.message}`);
}

export async function getHoldingsForStatement(statementId: string): Promise<Record<string, unknown>[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('holdings')
    .select('*')
    .eq('statement_id', statementId)
    .order('market_value', { ascending: false });

  if (error) throw new Error(`Get holdings failed: ${error.message}`);
  return data ?? [];
}

export async function getAllHoldings(userId: string): Promise<Record<string, unknown>[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('holdings')
    .select('*, statements!inner(broker, account_type, account_number, statement_date)')
    .eq('statements.user_id', userId)
    .order('market_value', { ascending: false });

  if (error) throw new Error(`Get all holdings failed: ${error.message}`);
  // Flatten the joined data
  return (data ?? []).map(row => {
    const stmt = row.statements as Record<string, unknown>;
    return {
      ...row,
      broker: stmt?.broker,
      account_type: stmt?.account_type,
      account_number: stmt?.account_number,
      statement_date: stmt?.statement_date,
      statements: undefined,
    };
  });
}

export async function deleteHoldingsForStatement(statementId: string): Promise<void> {
  const supabase = createServerClient();
  await supabase.from('holdings').delete().eq('statement_id', statementId);
}

// ── Snapshots ─────────────────────────────────────────────────────────

export async function insertSnapshot(userId: string, opts: {
  date: string;
  totalNetWorth: number;
  byBroker: Record<string, number>;
  byAccountType: Record<string, number>;
  byAssetClass: Record<string, number>;
}): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from('portfolio_snapshots').insert({
    user_id: userId,
    date: opts.date,
    total_net_worth: opts.totalNetWorth,
    by_broker: opts.byBroker,
    by_account_type: opts.byAccountType,
    by_asset_class: opts.byAssetClass,
  });
  if (error) throw new Error(`Insert snapshot failed: ${error.message}`);
}

// ── Analyses ──────────────────────────────────────────────────────────

export async function saveAnalysis(userId: string, analysisType: string, content: string, contextJson: Record<string, unknown> = {}): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('analyses')
    .upsert({
      user_id: userId,
      type: analysisType,
      content,
      context_json: contextJson,
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_id,type' });

  if (error) throw new Error(`Save analysis failed: ${error.message}`);
}

export async function getAnalysis(userId: string, analysisType: string): Promise<{ content: string; created_at: string } | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('analyses')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('type', analysisType)
    .single();

  if (error || !data) return null;
  return data;
}

// ── Income / Tax ──────────────────────────────────────────────────────

export async function saveIncomeTax(userId: string, record: Record<string, unknown>): Promise<string> {
  const supabase = createServerClient();

  // Upload PDF to storage if present
  let pdfStoragePath: string | null = null;
  if (record.pdfData) {
    const path = `${userId}/tax_${Date.now()}_${record.filename}`;
    const { error: uploadError } = await supabase.storage
      .from('statement-pdfs')
      .upload(path, record.pdfData as Buffer, { contentType: 'application/pdf' });
    if (!uploadError) pdfStoragePath = path;
  }

  const { data, error } = await supabase
    .from('income_tax')
    .insert({
      user_id: userId,
      tax_year: record.taxYear ?? 0,
      filename: record.filename ?? '',
      document_type: record.documentType ?? 'w2',
      employer: record.employer ?? '',
      income_breakdown: record.incomeBreakdown ?? {},
      total_income: record.totalIncome ?? 0,
      tax_breakdown: record.taxBreakdown ?? {},
      total_tax: record.totalTax ?? 0,
      effective_tax_rate: record.effectiveTaxRate ?? 0,
      extraction_confidence: record.extractionConfidence ?? 'low',
      extraction_notes: record.extractionNotes ?? null,
      pdf_storage_path: pdfStoragePath,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Save income tax failed: ${error.message}`);
  return data.id;
}

export async function listIncomeTax(userId: string): Promise<Record<string, unknown>[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('income_tax')
    .select('id, tax_year, filename, document_type, employer, income_breakdown, total_income, tax_breakdown, total_tax, effective_tax_rate, extraction_confidence, extraction_notes, created_at')
    .eq('user_id', userId)
    .order('tax_year', { ascending: false });

  if (error) throw new Error(`List income tax failed: ${error.message}`);
  return data ?? [];
}

export async function deleteIncomeTax(userId: string, recId: string): Promise<boolean> {
  const supabase = createServerClient();

  // Get PDF path before deleting
  const { data: rec } = await supabase
    .from('income_tax')
    .select('pdf_storage_path')
    .eq('id', recId)
    .eq('user_id', userId)
    .single();

  const { error } = await supabase
    .from('income_tax')
    .delete()
    .eq('id', recId)
    .eq('user_id', userId);

  if (rec?.pdf_storage_path) {
    await supabase.storage.from('statement-pdfs').remove([rec.pdf_storage_path]);
  }

  return !error;
}
