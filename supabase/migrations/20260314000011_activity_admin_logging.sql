-- Allow admin to log activities (staff_profile_id optional, add logged_by_user_id)
ALTER TABLE activity_logs ALTER COLUMN staff_profile_id DROP NOT NULL;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS logged_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_logged_by ON activity_logs(logged_by_user_id);
