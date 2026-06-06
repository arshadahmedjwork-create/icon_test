-- Add missing columns to sessions table to support winners and criteria overrides
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "winners" JSONB;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "criterias" JSONB;

-- Update currentPresenterId to be UUID if possible (schema.sql uses UUID for many IDs)
-- But the previous migration added it as TEXT, which is safer for mixed data.
-- Adding winners column is the priority for fixing results retrieval.

-- Add index for status and eventId for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_status ON "sessions"("status");
CREATE INDEX IF NOT EXISTS idx_sessions_eventId ON "sessions"("eventId");
