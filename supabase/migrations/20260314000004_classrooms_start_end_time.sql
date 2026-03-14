-- Add start_time and end_time to classrooms
ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS end_time TIME;
