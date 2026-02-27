ALTER TABLE event_master DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to admin and core_team" ON event_master;
DROP POLICY IF EXISTS "Allow read access to anyone" ON event_master;
