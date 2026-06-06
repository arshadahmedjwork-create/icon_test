-- ═══════════════════════════════════════════════════════════
-- MIDAS Certificate Generation System Migration
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Create certificate_audit_logs table for logging certificate activity
CREATE TABLE IF NOT EXISTS "certificate_audit_logs" (
    "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId"      UUID NOT NULL,
    "sessionId"   UUID,
    "action"      TEXT NOT NULL, -- 'GENERATED', 'DOWNLOADED', 'EMAILED', 'RESENT'
    "timestamp"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "details"     TEXT
);

-- 2. Add columns to certificates table to support proper metadata storage
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "user_id" UUID;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "session_id" UUID;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "role" TEXT; -- 'student', 'judge'
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "email_sent" BOOLEAN DEFAULT FALSE;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "rank" INTEGER;

-- 3. Relax older constraints so we can support on-demand generation and new fields
ALTER TABLE "certificates" ALTER COLUMN "eventStudentId" DROP NOT NULL;
ALTER TABLE "certificates" ALTER COLUMN "eventId" DROP NOT NULL;
ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_eventId_fkey";
ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_eventStudentId_fkey";

-- 4. Re-enable RLS for new tables & setup full access for development
ALTER TABLE "certificate_audit_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access" ON "certificate_audit_logs";
CREATE POLICY "Allow full access" ON "certificate_audit_logs" FOR ALL USING (true) WITH CHECK (true);

-- 5. Add JUDGE to CertificateType enum
ALTER TYPE "CertificateType" ADD VALUE IF NOT EXISTS 'JUDGE';
