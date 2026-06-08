ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "dciVerificationStatus" TEXT DEFAULT 'PENDING';
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "dciVerificationDetails" JSONB DEFAULT '{}'::jsonb;
