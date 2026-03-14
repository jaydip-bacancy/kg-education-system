-- Remove organizations: make centers the top-level entity
-- Run after 20260314000000 and 20260314000001

-- =============================================================================
-- 1. Create admin_centers (admins manage centers directly)
-- =============================================================================
CREATE TABLE IF NOT EXISTS admin_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_profile_id UUID NOT NULL REFERENCES admin_profiles(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(admin_profile_id, center_id)
);
CREATE INDEX IF NOT EXISTS idx_admin_centers_admin ON admin_centers(admin_profile_id);
CREATE INDEX IF NOT EXISTS idx_admin_centers_center ON admin_centers(center_id);

-- Migrate: link existing admins to their org's centers
INSERT INTO admin_centers (admin_profile_id, center_id)
SELECT ap.id, c.id
FROM admin_profiles ap
JOIN centers c ON c.organization_id = ap.organization_id
ON CONFLICT (admin_profile_id, center_id) DO NOTHING;

-- =============================================================================
-- 2. Add center_id to compliance_records and documents (replace organization_id)
-- =============================================================================
ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES centers(id) ON DELETE CASCADE;

-- Populate center_id from entity
UPDATE compliance_records cr SET center_id = (
  SELECT sc.center_id FROM staff_centers sc WHERE sc.staff_profile_id = cr.entity_id LIMIT 1
) WHERE cr.entity_type = 'STAFF' AND cr.center_id IS NULL;

UPDATE compliance_records cr SET center_id = (
  SELECT ch.center_id FROM children ch WHERE ch.id = cr.entity_id LIMIT 1
) WHERE cr.entity_type = 'CHILD' AND cr.center_id IS NULL;

UPDATE compliance_records cr SET center_id = cr.entity_id
WHERE cr.entity_type = 'CENTER' AND cr.center_id IS NULL;

-- For any remaining NULL, use first available center (fallback for orphaned rows)
UPDATE compliance_records cr SET center_id = (SELECT id FROM centers LIMIT 1)
WHERE cr.center_id IS NULL;

ALTER TABLE compliance_records ALTER COLUMN center_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_center ON compliance_records(center_id);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES centers(id) ON DELETE CASCADE;

-- Populate documents center_id from entity
UPDATE documents d SET center_id = (
  SELECT ch.center_id FROM children ch WHERE ch.id = d.entity_id LIMIT 1
) WHERE LOWER(d.entity_type) = 'child' AND d.center_id IS NULL;

UPDATE documents d SET center_id = (
  SELECT sc.center_id FROM staff_centers sc
  JOIN staff_profiles sp ON sp.id = sc.staff_profile_id
  WHERE sp.id = d.entity_id LIMIT 1
) WHERE LOWER(d.entity_type) = 'staff' AND d.center_id IS NULL;

UPDATE documents d SET center_id = d.entity_id
WHERE LOWER(d.entity_type) = 'center' AND d.center_id IS NULL;

UPDATE documents d SET center_id = (SELECT id FROM centers LIMIT 1)
WHERE d.center_id IS NULL;

ALTER TABLE documents ALTER COLUMN center_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_center ON documents(center_id);

-- =============================================================================
-- 3. Drop organization_id from all tables
-- =============================================================================
ALTER TABLE admin_profiles DROP COLUMN IF EXISTS organization_id;
ALTER TABLE staff_profiles DROP COLUMN IF EXISTS organization_id;
ALTER TABLE parent_profiles DROP COLUMN IF EXISTS organization_id;
ALTER TABLE children DROP COLUMN IF EXISTS organization_id;
ALTER TABLE users DROP COLUMN IF EXISTS organization_id;
ALTER TABLE invoices DROP COLUMN IF EXISTS organization_id;
ALTER TABLE compliance_records DROP COLUMN IF EXISTS organization_id;
ALTER TABLE documents DROP COLUMN IF EXISTS organization_id;

-- Drop old compliance/documents org index if exists
DROP INDEX IF EXISTS idx_compliance_org;

-- =============================================================================
-- 4. Drop organization_id from centers, drop organizations table
-- =============================================================================
ALTER TABLE centers DROP COLUMN IF EXISTS organization_id;
DROP INDEX IF EXISTS idx_centers_organization;
DROP INDEX IF EXISTS idx_users_organization;
DROP INDEX IF EXISTS idx_children_organization;

DROP TABLE IF EXISTS organizations CASCADE;
