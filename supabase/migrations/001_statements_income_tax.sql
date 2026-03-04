-- Migration: Add statements, holdings, snapshots, income_tax, and analyses tables
-- All tables scoped to user_id for multi-user support

CREATE TABLE IF NOT EXISTS statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    broker TEXT NOT NULL DEFAULT 'unknown',
    account_number TEXT NOT NULL DEFAULT '',
    account_type TEXT NOT NULL DEFAULT '',
    statement_date TEXT NOT NULL,
    total_value DOUBLE PRECISION NOT NULL DEFAULT 0,
    cash_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    extraction_confidence TEXT NOT NULL DEFAULT 'low',
    extraction_notes TEXT,
    pdf_storage_path TEXT
);

CREATE TABLE IF NOT EXISTS holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    asset_class TEXT NOT NULL DEFAULT 'other',
    type TEXT NOT NULL DEFAULT 'stock',
    quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
    price DOUBLE PRECISION NOT NULL DEFAULT 0,
    market_value DOUBLE PRECISION NOT NULL DEFAULT 0,
    cost_basis DOUBLE PRECISION,
    unrealized_gain_loss DOUBLE PRECISION,
    percent_of_account DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    total_net_worth DOUBLE PRECISION NOT NULL,
    by_broker JSONB NOT NULL DEFAULT '{}',
    by_account_type JSONB NOT NULL DEFAULT '{}',
    by_asset_class JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS income_tax (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tax_year INTEGER NOT NULL,
    filename TEXT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'w2',
    employer TEXT NOT NULL DEFAULT '',
    income_breakdown JSONB NOT NULL DEFAULT '{}',
    total_income DOUBLE PRECISION NOT NULL DEFAULT 0,
    tax_breakdown JSONB NOT NULL DEFAULT '{}',
    total_tax DOUBLE PRECISION NOT NULL DEFAULT 0,
    effective_tax_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    extraction_confidence TEXT NOT NULL DEFAULT 'low',
    extraction_notes TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    pdf_storage_path TEXT
);

CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    context_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, type)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_statements_user_id ON statements(user_id);
CREATE INDEX IF NOT EXISTS idx_statements_date ON statements(user_id, statement_date DESC);
CREATE INDEX IF NOT EXISTS idx_holdings_statement_id ON holdings(statement_id);
CREATE INDEX IF NOT EXISTS idx_income_tax_user_id ON income_tax(user_id);
CREATE INDEX IF NOT EXISTS idx_income_tax_year ON income_tax(user_id, tax_year DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_user_type ON analyses(user_id, type);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_id ON portfolio_snapshots(user_id);

-- Create storage bucket for PDFs (run via Supabase dashboard or API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('statement-pdfs', 'statement-pdfs', false);
