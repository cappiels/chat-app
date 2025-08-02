-- Migration 003: Create threads table
-- UP: Create the table

CREATE TABLE threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255), -- e.g., 'general', can be NULL for DMs
    type VARCHAR(50) NOT NULL, -- 'channel', 'direct_message'
    description TEXT, -- Optional channel description
    is_private BOOLEAN DEFAULT false, -- For private channels
    created_by VARCHAR(128) NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_threads_workspace_id ON threads (workspace_id);
CREATE INDEX idx_threads_type ON threads (type);
CREATE INDEX idx_threads_created_by ON threads (created_by);

-- DOWN: Drop the table (for rollback)
-- DROP INDEX IF EXISTS idx_threads_created_by;
-- DROP INDEX IF EXISTS idx_threads_type;
-- DROP INDEX IF EXISTS idx_threads_workspace_id;
-- DROP TABLE IF EXISTS threads;
