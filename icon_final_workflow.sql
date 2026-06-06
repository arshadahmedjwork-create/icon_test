-- ═══════════════════════════════════════════════════════════
-- ICON Final Session Closing & Judge Finalization Migration
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Add session_status column to sessions table
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "session_status" TEXT DEFAULT 'ACTIVE';

-- 2. Add judge_finalized and finalized_at columns to session_judges table
ALTER TABLE "session_judges" ADD COLUMN IF NOT EXISTS "judge_finalized" BOOLEAN DEFAULT FALSE;
ALTER TABLE "session_judges" ADD COLUMN IF NOT EXISTS "finalized_at" TIMESTAMPTZ;
