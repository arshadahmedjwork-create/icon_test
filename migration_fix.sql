-- ═══════════════════════════════════════════════════════════
-- MIDAS Migration Fix — Add missing tables & columns
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════


-- ─── 1. Add missing column to members ───────────────────────
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT FALSE;


-- ─── 2. event_config (singleton config table) ──────────────
CREATE TABLE IF NOT EXISTS "event_config" (
    "id"                 INTEGER PRIMARY KEY DEFAULT 1,
    "subjects"           JSONB NOT NULL DEFAULT '[]'::jsonb,
    "presentation_types" JSONB NOT NULL DEFAULT '["Paper","Poster"]'::jsonb,
    "modes"              JSONB NOT NULL DEFAULT '["Online","Offline"]'::jsonb,
    "capacities"         JSONB NOT NULL DEFAULT '{"paperOnline":12,"paperOffline":8,"posterOnline":15,"posterOffline":12}'::jsonb,
    "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default config row
INSERT INTO "event_config" ("id", "subjects", "presentation_types", "modes", "capacities")
VALUES (
    1,
    '["Anatomy","Physiology","Biochemistry","Pathology","Pharmacology","Microbiology","Forensic Medicine","Community Medicine"]'::jsonb,
    '["Paper","Poster"]'::jsonb,
    '["Online","Offline"]'::jsonb,
    '{"paperOnline":12,"paperOffline":8,"posterOnline":15,"posterOffline":12}'::jsonb
)
ON CONFLICT ("id") DO NOTHING;


-- ─── 3. deadlines ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "deadlines" (
    "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name"        TEXT NOT NULL,
    "date"        TEXT NOT NULL,
    "description" TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default deadlines
INSERT INTO "deadlines" ("name", "date", "description") VALUES
    ('Abstract Submission', '2026-04-01', 'Last date for abstract submission'),
    ('Registration Closes', '2026-03-25', 'Last date for student registration'),
    ('Payment Deadline', '2026-03-28', 'Last date for fee payment'),
    ('Presentation Upload', '2026-04-10', 'Last date for uploading final presentation')
ON CONFLICT DO NOTHING;


-- ─── 4. audit_logs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "session_id"  TEXT,
    "admin_name"  TEXT,
    "admin_email" TEXT,
    "login_time"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "logout_time" TIMESTAMPTZ,
    "duration"    TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── 5. abstracts (code uses this instead of submissions) ──
CREATE TABLE IF NOT EXISTS "abstracts" (
    "id"               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "student_id"       UUID REFERENCES "event_students"("id") ON DELETE CASCADE,
    "title"            TEXT NOT NULL,
    "subject"          TEXT NOT NULL,
    "college"          TEXT,
    "type"             TEXT NOT NULL,
    "mode"             TEXT NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'pending',
    "file_url"         TEXT,
    "presentation_url" TEXT,
    "feedback"         TEXT,
    "mentor_name"      TEXT,
    "co_authors"       JSONB DEFAULT '[]'::jsonb,
    "submitted_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── 6. registrations (code uses this instead of event_registrations) ─
CREATE TABLE IF NOT EXISTS "registrations" (
    "id"               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "student_id"       UUID REFERENCES "event_students"("id") ON DELETE CASCADE,
    "college"          TEXT,
    "submission_date"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "status"           TEXT NOT NULL DEFAULT 'pending',
    "approval_date"    TIMESTAMPTZ,
    "rejection_reason" TEXT,
    "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════
-- RLS: Enable + allow full access (development only)
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'event_config', 'deadlines', 'audit_logs', 'abstracts', 'registrations'
        ])
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow full access" ON %I', tbl);
        EXECUTE format('CREATE POLICY "Allow full access" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════
-- Re-insert Admin user with correct mustChangePassword column
-- Email: admin@midas.com  |  Password: admin123
-- ═══════════════════════════════════════════════════════════

DELETE FROM "members" WHERE "email" = 'admin@midas.com';

INSERT INTO "members" ("id", "email", "password", "name", "role", "isActive", "mustChangePassword", "createdAt", "updatedAt")
VALUES (
    uuid_generate_v4(),
    'admin@midas.com',
    '$2b$10$tnMFVHRQG.7wLik5/gJWFuSoAwiNGQ9mVdnev3SmUvsUH/VFTJU7m',
    'MIDAS Admin',
    'ADMIN',
    TRUE,
    FALSE,
    NOW(),
    NOW()
);

-- ═══════════════════════════════════════════════════════════
-- Done! All missing tables created + admin seeded.
-- ═══════════════════════════════════════════════════════════

-- ─── 7. Add time_slots to judges ───────────────────────
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "time_slots" JSONB DEFAULT '[]'::jsonb;
