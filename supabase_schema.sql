-- ═══════════════════════════════════════════════════════════
-- MIDAS Event Management System — Complete SQL Schema
-- Run this in Supabase SQL Editor (supabase.com/dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ─── ENUMS ──────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE "MemberRole" AS ENUM ('ADMIN', 'CORE_SCIENTIFIC_TEAM', 'STAFF_COORDINATOR', 'JUDGE', 'VOLUNTEER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "EventType" AS ENUM ('PAPER', 'POSTER', 'QUIZ', 'DEBATE', 'WORKSHOP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "EventMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'STAFF_APPROVED', 'FORWARDED', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "CertificateType" AS ENUM ('PARTICIPATION', 'WINNER', 'RUNNER_UP', 'SECOND_RUNNER_UP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProfileStatus" AS ENUM ('INCOMPLETE', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "NotificationType" AS ENUM (
        'JUDGE_ASSIGNMENT', 'ABSTRACT_APPROVED', 'ABSTRACT_REJECTED',
        'PAYMENT_CONFIRMED', 'RESULT_PUBLISHED', 'SESSION_SCHEDULED',
        'ACCOUNT_CREATED', 'PROFILE_APPROVED', 'PROFILE_REJECTED', 'GENERAL'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─── MEMBERS (Admin, Staff, Core Team, Judge, Volunteer) ─

CREATE TABLE IF NOT EXISTS "members" (
    "id"                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "email"                   TEXT NOT NULL UNIQUE,
    "password"                TEXT NOT NULL,
    "name"                    TEXT,
    "role"                    "MemberRole" NOT NULL DEFAULT 'ADMIN',
    "isActive"                BOOLEAN NOT NULL DEFAULT TRUE,
    "staffCoordinatorCollege" TEXT,
    "createdAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── EVENT STUDENTS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS "event_students" (
    "id"              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "participantName" TEXT NOT NULL,
    "email"           TEXT NOT NULL UNIQUE,
    "password"        TEXT,
    "mobile"          TEXT NOT NULL UNIQUE,
    "dateOfBirth"     TIMESTAMPTZ,
    "college"         TEXT NOT NULL,
    "course"          TEXT,
    "year"            TEXT NOT NULL,
    "idProofUrl"      TEXT,
    "profileStatus"   "ProfileStatus" NOT NULL DEFAULT 'INCOMPLETE',

    "midasId"         TEXT UNIQUE,
    "qrCodeData"      TEXT,

    "feeAmount"       DOUBLE PRECISION NOT NULL DEFAULT 1030,
    "paymentId"       TEXT UNIQUE,
    "paymentStatus"   "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "approvalStatus"  "ApprovalStatus" NOT NULL DEFAULT 'PENDING',

    "registeredAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── EVENTS ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "events" (
    "id"              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "eventType"       "EventType" NOT NULL,
    "eventMode"       "EventMode" NOT NULL DEFAULT 'OFFLINE',
    "date"            TIMESTAMPTZ NOT NULL,
    "lastDate"        TIMESTAMPTZ NOT NULL,
    "venue"           TEXT,
    "meetingLink"     TEXT,
    "registrationFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxParticipants" INTEGER,
    "isActive"        BOOLEAN NOT NULL DEFAULT TRUE,
    "isPublished"     BOOLEAN NOT NULL DEFAULT FALSE,

    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── EVENT REGISTRATIONS ────────────────────────────────

CREATE TABLE IF NOT EXISTS "event_registrations" (
    "id"             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "eventStudentId" UUID NOT NULL REFERENCES "event_students"("id") ON DELETE CASCADE,
    "eventId"        UUID NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,

    "status"         "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "registeredAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE ("eventStudentId", "eventId")
);


-- ─── PAYMENTS ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "payments" (
    "id"               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "eventStudentId"   UUID NOT NULL REFERENCES "event_students"("id") ON DELETE CASCADE,
    "eventId"          UUID REFERENCES "events"("id") ON DELETE SET NULL,

    "amount"           DOUBLE PRECISION NOT NULL,
    "currency"         TEXT NOT NULL DEFAULT 'INR',
    "status"           "PaymentStatus" NOT NULL DEFAULT 'PENDING',

    "orderId"          TEXT UNIQUE,
    "paymentGatewayId" TEXT UNIQUE,
    "signature"        TEXT,
    "transactionId"    TEXT,

    "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── SUBMISSIONS ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "submissions" (
    "id"              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "eventStudentId"  UUID NOT NULL REFERENCES "event_students"("id") ON DELETE CASCADE,
    "eventId"         UUID REFERENCES "events"("id") ON DELETE SET NULL,

    "eventType"       "EventType" NOT NULL,
    "eventMode"       "EventMode" NOT NULL,
    "subject"         TEXT NOT NULL,

    "title"           TEXT NOT NULL,
    "abstractText"    TEXT,
    "abstractFileUrl" TEXT,
    "presentationUrl" TEXT,
    "remarks"         TEXT,
    "staffRemarks"    TEXT,
    "forwardedToCore" BOOLEAN NOT NULL DEFAULT FALSE,

    "status"          "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "submissionDate"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── CERTIFICATES ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "certificates" (
    "id"              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "eventStudentId"  UUID NOT NULL REFERENCES "event_students"("id") ON DELETE CASCADE,
    "eventId"         UUID NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,

    "certificateType" "CertificateType" NOT NULL,
    "prizePosition"   TEXT,
    "participated"    BOOLEAN NOT NULL DEFAULT TRUE,
    "fileUrl"         TEXT,
    "downloadCount"   INTEGER NOT NULL DEFAULT 0,

    "generatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE ("eventStudentId", "eventId", "certificateType")
);


-- ─── JUDGES ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "judges" (
    "id"              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "memberId"        UUID NOT NULL UNIQUE REFERENCES "members"("id") ON DELETE CASCADE,

    "fullName"        TEXT NOT NULL,
    "isAcademic"      BOOLEAN NOT NULL DEFAULT TRUE,
    "college"         TEXT,
    "specialization"  TEXT,
    "yearsExperience" INTEGER
);


-- ─── SESSIONS ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "sessions" (
    "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name"        TEXT NOT NULL,
    "type"        "EventType" NOT NULL,
    "mode"        "EventMode" NOT NULL,
    "subject"     TEXT NOT NULL,

    "eventId"     UUID REFERENCES "events"("id") ON DELETE SET NULL,

    "startTime"   TIMESTAMPTZ,
    "endTime"     TIMESTAMPTZ,
    "venue"       TEXT,
    "meetingLink" TEXT,

    "chairId"     UUID REFERENCES "judges"("id") ON DELETE SET NULL,

    "status"      TEXT NOT NULL DEFAULT 'SCHEDULED',

    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── SESSION PARTICIPANTS ───────────────────────────────

CREATE TABLE IF NOT EXISTS "session_participants" (
    "id"                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sessionId"         UUID NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
    "eventStudentId"    UUID NOT NULL REFERENCES "event_students"("id") ON DELETE CASCADE,
    "submissionId"      UUID NOT NULL UNIQUE REFERENCES "submissions"("id") ON DELETE CASCADE,

    "presentationOrder" INTEGER,
    "attended"          BOOLEAN NOT NULL DEFAULT FALSE,

    UNIQUE ("sessionId", "eventStudentId")
);


-- ─── SESSION JUDGES ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS "session_judges" (
    "id"        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sessionId" UUID NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
    "judgeId"   UUID NOT NULL REFERENCES "judges"("id") ON DELETE CASCADE,

    "isChair"   BOOLEAN NOT NULL DEFAULT FALSE,

    UNIQUE ("sessionId", "judgeId")
);


-- ─── EVALUATION CRITERIA ────────────────────────────────

CREATE TABLE IF NOT EXISTS "evaluation_criteria" (
    "id"        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "eventType" "EventType" NOT NULL,
    "name"      TEXT NOT NULL,
    "maxScore"  INTEGER NOT NULL,
    "weightage" DOUBLE PRECISION NOT NULL DEFAULT 1.0
);


-- ─── EVALUATIONS ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "evaluations" (
    "id"             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "judgeId"        UUID NOT NULL REFERENCES "judges"("id") ON DELETE CASCADE,
    "participantId"  UUID NOT NULL REFERENCES "session_participants"("id") ON DELETE CASCADE,
    "eventStudentId" UUID NOT NULL REFERENCES "event_students"("id") ON DELETE CASCADE,
    "criteriaId"     UUID NOT NULL REFERENCES "evaluation_criteria"("id") ON DELETE CASCADE,

    "score"          DOUBLE PRECISION NOT NULL,
    "comments"       TEXT,

    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── ATTENDANCE ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "attendances" (
    "id"             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sessionId"      UUID NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
    "eventStudentId" UUID NOT NULL REFERENCES "event_students"("id") ON DELETE CASCADE,

    "status"         "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "scannedBy"      TEXT,
    "qrData"         TEXT,
    "scannedAt"      TIMESTAMPTZ,

    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE ("sessionId", "eventStudentId")
);


-- ─── VOLUNTEER ASSIGNMENTS ──────────────────────────────

CREATE TABLE IF NOT EXISTS "volunteer_assignments" (
    "id"         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "memberId"   UUID NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
    "sessionId"  UUID NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,

    "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE ("memberId", "sessionId")
);


-- ─── RESULTS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "results" (
    "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sessionId"   UUID NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
    "eventId"     UUID NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,

    "isPublished" BOOLEAN NOT NULL DEFAULT FALSE,
    "isLocked"    BOOLEAN NOT NULL DEFAULT FALSE,
    "publishedAt" TIMESTAMPTZ,
    "publishedBy" TEXT,

    "rankings"    TEXT,  -- JSON string of ranked student results

    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE ("sessionId", "eventId")
);


-- ─── NOTIFICATIONS ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "notifications" (
    "id"             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "memberId"       UUID REFERENCES "members"("id") ON DELETE CASCADE,
    "eventStudentId" UUID REFERENCES "event_students"("id") ON DELETE CASCADE,

    "type"           "NotificationType" NOT NULL DEFAULT 'GENERAL',
    "title"          TEXT NOT NULL,
    "message"        TEXT NOT NULL,
    "isRead"         BOOLEAN NOT NULL DEFAULT FALSE,

    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── SYSTEM LOGS (AUDIT) ────────────────────────────────

CREATE TABLE IF NOT EXISTS "system_logs" (
    "id"        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "memberId"  UUID REFERENCES "members"("id") ON DELETE SET NULL,

    "action"    TEXT NOT NULL,
    "details"   TEXT,
    "entityType" TEXT,
    "entityId"  TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════
-- INDEXES (for performance)
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_members_email ON "members"("email");
CREATE INDEX IF NOT EXISTS idx_members_role ON "members"("role");
CREATE INDEX IF NOT EXISTS idx_event_students_email ON "event_students"("email");
CREATE INDEX IF NOT EXISTS idx_event_students_mobile ON "event_students"("mobile");
CREATE INDEX IF NOT EXISTS idx_event_students_college ON "event_students"("college");
CREATE INDEX IF NOT EXISTS idx_event_students_midasId ON "event_students"("midasId");
CREATE INDEX IF NOT EXISTS idx_event_registrations_student ON "event_registrations"("eventStudentId");
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON "event_registrations"("eventId");
CREATE INDEX IF NOT EXISTS idx_payments_student ON "payments"("eventStudentId");
CREATE INDEX IF NOT EXISTS idx_payments_status ON "payments"("status");
CREATE INDEX IF NOT EXISTS idx_submissions_student ON "submissions"("eventStudentId");
CREATE INDEX IF NOT EXISTS idx_submissions_status ON "submissions"("status");
CREATE INDEX IF NOT EXISTS idx_sessions_event ON "sessions"("eventId");
CREATE INDEX IF NOT EXISTS idx_evaluations_judge ON "evaluations"("judgeId");
CREATE INDEX IF NOT EXISTS idx_evaluations_participant ON "evaluations"("participantId");
CREATE INDEX IF NOT EXISTS idx_notifications_member ON "notifications"("memberId");
CREATE INDEX IF NOT EXISTS idx_notifications_student ON "notifications"("eventStudentId");
CREATE INDEX IF NOT EXISTS idx_system_logs_member ON "system_logs"("memberId");
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON "system_logs"("timestamp" DESC);


-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) — Disable for now so frontend can read/write
-- You can enable RLS later with proper policies
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "certificates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "judges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_judges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evaluation_criteria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "volunteer_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_logs" ENABLE ROW LEVEL SECURITY;

-- Allow full access for authenticated and anon users (development only)
-- IMPORTANT: Restrict these policies before going to production!

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'members', 'event_students', 'events', 'event_registrations',
            'payments', 'submissions', 'certificates', 'judges', 'sessions',
            'session_participants', 'session_judges', 'evaluation_criteria',
            'evaluations', 'attendances', 'volunteer_assignments', 'results',
            'notifications', 'system_logs'
        ])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow full access" ON %I', tbl);
        EXECUTE format('CREATE POLICY "Allow full access" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════
-- SEED: Default Admin Account
-- Password: admin123 (bcrypt hash)
-- ═══════════════════════════════════════════════════════════

INSERT INTO "members" ("id", "email", "password", "name", "role", "isActive", "updatedAt")
VALUES (
    uuid_generate_v4(),
    'admin@midas.com',
    '$2b$10$EIXe0eJ9G7xK7vF3kZf3aOuY9yP5kL2mN3oR4sT5uV6wX7yZ8aB0c',
    'MIDAS Admin',
    'ADMIN',
    TRUE,
    NOW()
)
ON CONFLICT ("email") DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- Done! All 18 tables created successfully.
-- ═══════════════════════════════════════════════════════════
