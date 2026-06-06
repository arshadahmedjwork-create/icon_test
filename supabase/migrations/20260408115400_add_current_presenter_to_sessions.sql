-- Add currentPresenterId column to sessions table
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "currentPresenterId" TEXT;

-- Ensure status is updated to handle 'in_progress' and 'completed' correctly
-- (Assuming status column already exists as TEXT or Enum)
