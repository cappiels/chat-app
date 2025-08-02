-- Migration 005: Create messages table
-- UP: Create the table

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    sender_id VARCHAR(128) NOT NULL REFERENCES users(id),
    content TEXT,
    message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'file', 'system'
    is_edited BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    parent_message_id UUID REFERENCES messages(id), -- For threading/replies
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_messages_thread_id ON messages (thread_id);
CREATE INDEX idx_messages_sender_id ON messages (sender_id);
CREATE INDEX idx_messages_created_at ON messages (created_at);
CREATE INDEX idx_messages_parent_id ON messages (parent_message_id);

-- DOWN: Drop the table (for rollback)
-- DROP INDEX IF EXISTS idx_messages_parent_id;
-- DROP INDEX IF EXISTS idx_messages_created_at;
-- DROP INDEX IF EXISTS idx_messages_sender_id;
-- DROP INDEX IF EXISTS idx_messages_thread_id;
-- DROP TABLE IF EXISTS messages;
