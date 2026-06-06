-- ─── ACTION LOGS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "action_logs" (
    "id"            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "actor_id"      UUID, 
    "actor_name"    TEXT,
    "actor_role"    TEXT,
    "action"        TEXT NOT NULL, 
    "resource_type" TEXT NOT NULL, 
    "resource_id"   UUID,
    "timestamp"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "metadata"      JSONB
);

-- Enable RLS
ALTER TABLE "action_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full select" ON "action_logs" FOR SELECT USING (true);
CREATE POLICY "Allow full insert" ON "action_logs" FOR INSERT WITH CHECK (true);

-- ─── EVENT MODE RESTRICTION ───────────────────────────────
-- Update existing HYBRID modes to OFFLINE (most common fallback)
UPDATE "event_master" SET "mode" = 'OFFLINE' WHERE "mode" = 'HYBRID';
UPDATE "submissions" SET "eventMode" = 'OFFLINE' WHERE "eventMode" = 'HYBRID';

-- Note: We avoid ALtering the Enum type itself as it might be held by active sessions.
-- But we can add a CHECK constraint to enforce Online/Offline only going forward.
ALTER TABLE "event_master" DROP CONSTRAINT IF EXISTS "mode_check";
ALTER TABLE "event_master" ADD CONSTRAINT "mode_check" CHECK ("mode" IN ('ONLINE', 'OFFLINE'));
