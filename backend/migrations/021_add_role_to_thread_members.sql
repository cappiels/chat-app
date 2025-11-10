-- Migration 021: Add role column to thread_members table
-- UP: Add the missing role column

ALTER TABLE thread_members ADD COLUMN role VARCHAR(50) DEFAULT 'member';

-- Add some common role constraints
ALTER TABLE thread_members ADD CONSTRAINT thread_members_valid_role 
  CHECK (role IN ('owner', 'admin', 'moderator', 'member'));

-- Add index for performance on role-based queries
CREATE INDEX idx_thread_members_role ON thread_members (role);

-- DOWN: Remove the column (for rollback)
-- DROP INDEX IF EXISTS idx_thread_members_role;
-- ALTER TABLE thread_members DROP CONSTRAINT IF EXISTS thread_members_valid_role;
-- ALTER TABLE thread_members DROP COLUMN IF EXISTS role;
