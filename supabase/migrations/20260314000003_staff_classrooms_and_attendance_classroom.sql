-- Staff-to-classroom assignments and classroom-scoped attendance

-- =============================================================================
-- 1. Staff classrooms (assign staff to classes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS staff_classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  role_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_profile_id, classroom_id)
);
CREATE INDEX IF NOT EXISTS idx_staff_classrooms_staff ON staff_classrooms(staff_profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_classrooms_classroom ON staff_classrooms(classroom_id);

-- =============================================================================
-- 2. Add classroom_id to attendance (optional - for class-scoped check-in)
-- =============================================================================
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_classroom ON attendance(classroom_id);
