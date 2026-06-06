-- ─── ADD PROGRAM SUPPORT ────────────────────────────────

-- 1. Create Program Enum
DO $$ BEGIN
    CREATE TYPE "ProgramType" AS ENUM ('MIDAS', 'ICON');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add program column to major tables
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "program" "ProgramType" DEFAULT 'MIDAS';
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "program" "ProgramType" DEFAULT 'MIDAS';
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "program" "ProgramType" DEFAULT 'MIDAS';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "program" "ProgramType" DEFAULT 'MIDAS';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "program" "ProgramType" DEFAULT 'MIDAS';
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "program" "ProgramType" DEFAULT 'MIDAS';
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "program" "ProgramType" DEFAULT 'MIDAS';
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "program" "ProgramType" DEFAULT 'MIDAS';
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "program" "ProgramType" DEFAULT 'MIDAS';
ALTER TABLE "evaluation_criteria" ADD COLUMN IF NOT EXISTS "program" "ProgramType" DEFAULT 'MIDAS';
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "program" "ProgramType" DEFAULT 'MIDAS';
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "program" "ProgramType" DEFAULT 'MIDAS';
ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "program" "ProgramType" DEFAULT 'MIDAS';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "program" "ProgramType" DEFAULT 'MIDAS';

-- 3. Add ICON specific columns to event_students
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "delegateType" TEXT;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "dciNumber" TEXT;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "speciality" TEXT;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "yearsOfPractice" INTEGER;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "teachingExperience" TEXT;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "academicPosition" TEXT;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "qualification" TEXT;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "dciCertificateUrl" TEXT;
ALTER TABLE "event_students" ADD COLUMN IF NOT EXISTS "iconId" TEXT UNIQUE;

-- 4. Add ICON specific columns to submissions (abstracts)
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "keywords" TEXT[];
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "hodName" TEXT;

-- 5. Indexes for program filtering
CREATE INDEX IF NOT EXISTS idx_members_program ON "members"("program");
CREATE INDEX IF NOT EXISTS idx_event_students_program ON "event_students"("program");
CREATE INDEX IF NOT EXISTS idx_events_program ON "events"("program");
CREATE INDEX IF NOT EXISTS idx_submissions_program ON "submissions"("program");
CREATE INDEX IF NOT EXISTS idx_sessions_program ON "sessions"("program");
