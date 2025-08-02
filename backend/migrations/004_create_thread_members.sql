-- Migration 004: Create thread_members table
-- UP: Create the table

CREATE TABLE thread_members (
    thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
    user_id VARCHAR(128) REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (thread_id, user_id)
);

-- Add indexes for performance
CREATE INDEX idx_thread_members_user_id ON thread_members (user_id);
CREATE INDEX idx_thread_members_thread_id ON thread_members (thread_id);

-- DOWN: Drop the table (for rollback)
-- DROP INDEX IF EXISTS idx_thread_members_thread_id;
-- DROP INDEX IF EXISTS idx_thread_members_user_id;
-- DROP TABLE IF EXISTS thread_members;
