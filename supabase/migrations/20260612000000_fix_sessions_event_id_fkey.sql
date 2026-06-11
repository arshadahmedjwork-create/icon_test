    -- Fix foreign key constraint on sessions table pointing to old events table instead of event_master
    ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_eventId_fkey";
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event_master"("id") ON DELETE SET NULL;
