-- Pricing & billing cycle for per-child flat rates
-- Run after 20260314000002

-- =============================================================================
-- 1. Center rates (monthly, quarterly, annual per child)
-- =============================================================================
CREATE TABLE IF NOT EXISTS center_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('MONTHLY', 'QUARTERLY', 'ANNUAL')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(center_id, period)
);

CREATE INDEX IF NOT EXISTS idx_center_rates_center ON center_rates(center_id);

-- =============================================================================
-- 2. Add billing_cycle to children (parent selects per child at registration)
-- =============================================================================
ALTER TABLE children ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY'
  CHECK (billing_cycle IN ('MONTHLY', 'QUARTERLY', 'ANNUAL'));

-- =============================================================================
-- 3. Add billing_cycle to invoices (for clarity)
-- =============================================================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_cycle TEXT;
