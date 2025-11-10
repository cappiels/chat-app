-- Migration 020: Add is_pinned column to messages table
-- UP: Add the missing column

ALTER TABLE messages ADD COLUMN is_pinned BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN scheduled_for TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN deleted_by VARCHAR(128) REFERENCES users(id);
ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Add index for performance on pinned messages
CREATE INDEX idx_messages_is_pinned ON messages (is_pinned) WHERE is_pinned = true;
CREATE INDEX idx_messages_scheduled ON messages (scheduled_for) WHERE scheduled_for IS NOT NULL;

-- DOWN: Remove the columns (for rollback)
-- DROP INDEX IF EXISTS idx_messages_scheduled;
-- DROP INDEX IF EXISTS idx_messages_is_pinned;
-- ALTER TABLE messages DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE messages DROP COLUMN IF EXISTS deleted_by;
-- ALTER TABLE messages DROP COLUMN IF EXISTS scheduled_for;
-- ALTER TABLE messages DROP COLUMN IF EXISTS is_pinned;
