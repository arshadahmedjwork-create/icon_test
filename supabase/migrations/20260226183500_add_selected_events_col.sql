ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "selectedEvents" JSONB DEFAULT '[]'::jsonb;
