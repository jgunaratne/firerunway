-- FireRunway V1 Database Schema
-- Run this against your Supabase project's SQL editor

-- Users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id text UNIQUE NOT NULL,
  email text,
  created_at timestamptz DEFAULT now()
);

-- Financial profile (inputs)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  annual_income numeric,
  annual_spend numeric,
  retirement_spend numeric,
  state_of_residence text,
  filing_status text CHECK (filing_status IN ('single', 'mfj')),
  fire_number numeric,
  fire_target_year int,
  swr numeric DEFAULT 0.04,
  social_security_estimate numeric,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- RSU grants
CREATE TABLE IF NOT EXISTS rsu_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  company_ticker text NOT NULL,
  grant_date date,
  total_shares int,
  vested_shares int DEFAULT 0,
  cliff_months int DEFAULT 12,
  vest_period_months int DEFAULT 48,
  vest_frequency text DEFAULT 'quarterly' CHECK (vest_frequency IN ('monthly', 'quarterly', 'annual')),
  created_at timestamptz DEFAULT now()
);

-- Monte Carlo saved scenarios
CREATE TABLE IF NOT EXISTS scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  params jsonb,
  result_summary jsonb,
  created_at timestamptz DEFAULT now()
);

-- Life events (attached to scenarios or standalone)
CREATE TABLE IF NOT EXISTS life_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  scenario_id uuid REFERENCES scenarios(id) ON DELETE CASCADE,
  type text CHECK (type IN ('quit', 'layoff', 'college', 'purchase', 'windfall', 'expense')),
  year int,
  params jsonb,
  created_at timestamptz DEFAULT now()
);

-- Cached account data (refreshed from SnapTrade)
CREATE TABLE IF NOT EXISTS account_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  snaptrade_account_id text,
  account_type text CHECK (account_type IN ('brokerage', '401k', 'ira', 'roth')),
  total_value numeric,
  holdings jsonb,
  synced_at timestamptz DEFAULT now()
);

-- Real estate properties
CREATE TABLE IF NOT EXISTS real_estate_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  address text,
  property_type text CHECK (property_type IN ('primary', 'rental', 'vacation')),
  purchase_price numeric,
  purchase_date date,
  current_value numeric,
  last_value_update timestamptz,
  original_loan_amount numeric,
  mortgage_balance numeric,
  mortgage_rate numeric,
  mortgage_term_months int,
  mortgage_start_date date,
  monthly_payment numeric,
  monthly_rent numeric,
  include_equity_in_fire boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Property value history (snapshot on each Zillow refresh)
CREATE TABLE IF NOT EXISTS property_value_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES real_estate_properties(id) ON DELETE CASCADE,
  estimated_value numeric,
  source text CHECK (source IN ('zillow', 'manual')),
  recorded_at timestamptz DEFAULT now()
);

-- Net worth daily snapshots (for historical chart)
CREATE TABLE IF NOT EXISTS net_worth_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  total_net_worth numeric,
  investment_value numeric,
  retirement_value numeric,
  rsu_value numeric,
  real_estate_equity numeric,
  mortgage_balance numeric,
  cash_other numeric,
  recorded_date date,
  UNIQUE(user_id, recorded_date)
);

-- Row Level Security policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsu_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_value_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE net_worth_history ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should be configured based on your auth setup.
-- The service role key (used in API routes) bypasses RLS.
-- For client-side access, add policies that check auth.uid() matches user_id.
