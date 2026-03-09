-- Household Links table for shared spending plans
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS household_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id_1 UUID REFERENCES users(id) NOT NULL,
  user_id_2 UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id_1, user_id_2)
);

-- Index for fast lookups from either side
CREATE INDEX IF NOT EXISTS idx_household_user1 ON household_links(user_id_1);
CREATE INDEX IF NOT EXISTS idx_household_user2 ON household_links(user_id_2);
