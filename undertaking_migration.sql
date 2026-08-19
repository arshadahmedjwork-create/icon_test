-- ═══════════════════════════════════════════════════════════
-- MIDAS Migration: Undertaking & Declaration, Terms, Refund Policy & Student Profile Fields
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Add fields for ID Card, Gender, Passport Photo, and Undertaking Acceptance to event_students
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "idCardNumber" TEXT;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "passportPhotoUrl" TEXT;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "declarationAccepted" BOOLEAN DEFAULT FALSE;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "termsAccepted" BOOLEAN DEFAULT FALSE;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "refundPolicyAccepted" BOOLEAN DEFAULT FALSE;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT DEFAULT '1.0';
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "refundPolicyVersion" TEXT DEFAULT '1.0';
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMPTZ;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;

-- Index for ID Card Number lookups & duplicate checks
CREATE INDEX IF NOT EXISTS idx_event_students_idCardNumber ON "event_students"("idCardNumber");

-- 2. Create undertaking_acceptances audit table for legal verification
CREATE TABLE IF NOT EXISTS "undertaking_acceptances" (
    "id"                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "eventStudentId"       UUID REFERENCES "event_students"("id") ON DELETE CASCADE,
    "idCardNumber"         TEXT NOT NULL,
    "declarationAccepted"  BOOLEAN NOT NULL DEFAULT TRUE,
    "termsAccepted"        BOOLEAN NOT NULL DEFAULT TRUE,
    "refundPolicyAccepted" BOOLEAN NOT NULL DEFAULT TRUE,
    "termsVersion"         TEXT NOT NULL DEFAULT '1.0',
    "refundPolicyVersion"  TEXT NOT NULL DEFAULT '1.0',
    "ipAddress"            TEXT,
    "paymentReference"     TEXT,
    "acceptedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_undertaking_acceptances_student ON "undertaking_acceptances"("eventStudentId");
CREATE INDEX IF NOT EXISTS idx_undertaking_acceptances_idCard ON "undertaking_acceptances"("idCardNumber");

-- 3. Enable RLS and add public policy for dev access
ALTER TABLE "undertaking_acceptances" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access" ON "undertaking_acceptances";
CREATE POLICY "Allow full access" ON "undertaking_acceptances" FOR ALL USING (true) WITH CHECK (true);
