-- Migration 030: Add task message link for discussion threads
-- This enables tasks to have associated channel messages with threaded replies

-- Add message_id column to link tasks to their channel message
ALTER TABLE channel_tasks ADD COLUMN IF NOT EXISTS message_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Add metadata column to messages for storing task reference
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create index for efficient task message lookups
CREATE INDEX IF NOT EXISTS idx_channel_tasks_message_id ON channel_tasks(message_id);

-- Create index for message metadata (for finding task messages)
CREATE INDEX IF NOT EXISTS idx_messages_metadata ON messages USING GIN (metadata);

-- Add index for finding replies to task messages
CREATE INDEX IF NOT EXISTS idx_messages_parent_message_id ON messages(parent_message_id) WHERE parent_message_id IS NOT NULL;

-- Comment explaining the schema
COMMENT ON COLUMN channel_tasks.message_id IS 'Reference to the channel message created when task was created. Replies to this message become task discussion.';
COMMENT ON COLUMN messages.metadata IS 'Additional data for special message types (e.g., task_id for task messages)';
