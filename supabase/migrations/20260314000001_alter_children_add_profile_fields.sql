-- Add Child Profile fields (allergies, medical, dietary) to existing children table
-- Safe to run - uses IF NOT EXISTS for idempotency

ALTER TABLE children ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS medical_notes TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT;
