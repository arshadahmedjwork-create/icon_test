-- Create action_logs table if not exists
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

-- Enable RLS and create policies
ALTER TABLE "action_logs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full select" ON "action_logs";
CREATE POLICY "Allow full select" ON "action_logs" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow full insert" ON "action_logs";
CREATE POLICY "Allow full insert" ON "action_logs" FOR INSERT WITH CHECK (true);
