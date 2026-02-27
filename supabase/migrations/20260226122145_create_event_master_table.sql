-- Create event_master table for storing dynamic event tracks
CREATE TABLE event_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    mode TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 20,
    assessment_criteria JSONB DEFAULT '[]'::jsonb,
    rules TEXT,
    judge_instructions TEXT,
    abstract_deadline TIMESTAMPTZ,
    presentation_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE event_master ENABLE ROW LEVEL SECURITY;

-- Create Policies
-- Admins/Core Team can do all CRUD
CREATE POLICY "Allow full access to admin and core_team" ON event_master
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM members
            WHERE members.id = auth.uid()
            AND (members.role::text ILIKE 'admin' OR members.role::text ILIKE 'core_team')
        )
    );

-- Anyone authenticated can read events
CREATE POLICY "Allow read access to authenticated users" ON event_master
    FOR SELECT
    USING (auth.role() = 'authenticated');
