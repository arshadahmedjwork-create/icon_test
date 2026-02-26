-- ═══════════════════════════════════════════════════════════
-- MIDAS Latest Migration — Add missing columns to event_students
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Add fields for Registration and Payment Flow
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "qrCodeUrl" TEXT;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "midasId" TEXT;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "paymentId" TEXT;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT DEFAULT 'PENDING';

-- 2. Add fields for Staff Approval and Login
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT DEFAULT 'PENDING';
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "idProofUrl" TEXT;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "password" TEXT;

-- 3. Add fields to members table if judges need login and roles
-- (Note: 'members' table holds all Admin/Staff/Core Team/Judges)
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "college" TEXT;
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- 4. Make sure 'judges' table has time_slots
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "time_slots" JSONB DEFAULT '[]'::jsonb;

-- 5. Fix RLS for login and auth tables (Allow full access for dev / unauthenticated login queries)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY['event_students', 'members', 'judges'])
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow full access" ON %I', tbl);
        EXECUTE format('CREATE POLICY "Allow full access" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;

-- 6. Create Storage Buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to the documents bucket
CREATE POLICY "Public Access" ON storage.objects FOR ALL
USING (bucket_id = 'documents') WITH CHECK (bucket_id = 'documents');
