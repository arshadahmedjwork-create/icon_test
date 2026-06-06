-- Fix evaluations table structure to match the frontend expectations
-- 1. Add missing snake_case columns
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "session_id" UUID;
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "judge_id" UUID;
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "student_id" UUID;
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "scores" JSONB;
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "total_score" DOUBLE PRECISION;
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "feedback" TEXT;

-- 2. Make old camelCase columns optional (to avoid NOT NULL violations)
-- These were likely created by the initial schema.sql but aren't used by the new service logic
ALTER TABLE "evaluations" ALTER COLUMN "judgeId" DROP NOT NULL;
ALTER TABLE "evaluations" ALTER COLUMN "participantId" DROP NOT NULL;
ALTER TABLE "evaluations" ALTER COLUMN "eventStudentId" DROP NOT NULL;
ALTER TABLE "evaluations" ALTER COLUMN "criteriaId" DROP NOT NULL;
ALTER TABLE "evaluations" ALTER COLUMN "score" DROP NOT NULL;

-- 3. Cleanup: Remove any existing duplicate evaluations
DELETE FROM "evaluations" a USING "evaluations" b
WHERE a.id < b.id 
  AND a.session_id = b.session_id 
  AND a.judge_id = b.judge_id 
  AND a.student_id = b.student_id;

-- 4. Ensure evaluations table has a unique constraint for upsert
ALTER TABLE "evaluations" DROP CONSTRAINT IF EXISTS unique_session_judge_student;
ALTER TABLE "evaluations" ADD CONSTRAINT unique_session_judge_student UNIQUE (session_id, judge_id, student_id);
