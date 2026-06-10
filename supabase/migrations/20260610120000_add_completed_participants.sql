-- Add completed_participants column to sessions table to track non-competitive session participant completion
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "completed_participants" JSONB DEFAULT '[]'::jsonb;
