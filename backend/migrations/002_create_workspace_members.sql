-- Migration 002: Create workspace_members table
-- UP: Create the table

CREATE TABLE workspace_members (
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id VARCHAR(128) REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'admin', 'member'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace_id, user_id)
);

-- Add index for performance
CREATE INDEX idx_workspace_members_user_id ON workspace_members (user_id);
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members (workspace_id);

-- DOWN: Drop the table (for rollback)
-- DROP INDEX IF EXISTS idx_workspace_members_workspace_id;
-- DROP INDEX IF EXISTS idx_workspace_members_user_id;
-- DROP TABLE IF EXISTS workspace_members;
