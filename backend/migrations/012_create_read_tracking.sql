-- Migration 012: Slack-style read tracking system for channels, threads, and DMs
-- UP: Create comprehensive read tracking with PostgreSQL optimizations

-- Add additional fields to thread_members for better read tracking
ALTER TABLE thread_members ADD COLUMN IF NOT EXISTS last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE thread_members ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;
ALTER TABLE thread_members ADD COLUMN IF NOT EXISTS unread_mentions INTEGER DEFAULT 0;

-- Create a dedicated table for tracking read status across different entity types
CREATE TABLE user_read_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('thread', 'channel', 'dm', 'workspace')),
    entity_id UUID NOT NULL, -- Can reference threads.id or other entities
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    unread_count INTEGER DEFAULT 0,
    unread_mentions INTEGER DEFAULT 0,
    is_muted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique combination per user/entity
    UNIQUE(user_id, workspace_id, entity_type, entity_id)
);

-- Create performance indexes
CREATE INDEX idx_user_read_status_user_workspace ON user_read_status (user_id, workspace_id);
CREATE INDEX idx_user_read_status_entity ON user_read_status (entity_type, entity_id);
CREATE INDEX idx_user_read_status_unread ON user_read_status (user_id, unread_count) WHERE unread_count > 0;
CREATE INDEX idx_user_read_status_mentions ON user_read_status (user_id, unread_mentions) WHERE unread_mentions > 0;
CREATE INDEX idx_user_read_status_updated ON user_read_status (updated_at DESC);

-- Add additional fields to notifications table for message context
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES threads(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message_id UUID REFERENCES messages(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0; -- 0=normal, 1=high, 2=urgent
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) DEFAULT 'general';

-- Create indexes for the new notification fields
CREATE INDEX IF NOT EXISTS idx_notifications_thread_id ON notifications (thread_id);
CREATE INDEX IF NOT EXISTS idx_notifications_message_id ON notifications (message_id);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications (priority DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_entity_type ON notifications (entity_type);

-- Function to update unread counts when new message is created
CREATE OR REPLACE FUNCTION update_unread_counts_on_message()
RETURNS TRIGGER AS $$
DECLARE
    thread_member RECORD;
    is_mention BOOLEAN := false;
BEGIN
    -- Check if this message contains mentions
    SELECT EXISTS(
        SELECT 1 FROM message_mentions mm 
        WHERE mm.message_id = NEW.id
    ) INTO is_mention;

    -- Update unread counts for all thread members except the sender
    FOR thread_member IN 
        SELECT tm.user_id, tm.thread_id
        FROM thread_members tm
        WHERE tm.thread_id = NEW.thread_id 
        AND tm.user_id != NEW.sender_id
    LOOP
        -- Insert or update user_read_status
        INSERT INTO user_read_status (
            user_id, 
            workspace_id, 
            entity_type, 
            entity_id, 
            unread_count,
            unread_mentions,
            updated_at
        )
        VALUES (
            thread_member.user_id,
            (SELECT workspace_id FROM threads WHERE id = NEW.thread_id),
            'thread',
            NEW.thread_id,
            1,
            CASE WHEN is_mention THEN 1 ELSE 0 END,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (user_id, workspace_id, entity_type, entity_id)
        DO UPDATE SET
            unread_count = user_read_status.unread_count + 1,
            unread_mentions = user_read_status.unread_mentions + CASE WHEN is_mention THEN 1 ELSE 0 END,
            updated_at = CURRENT_TIMESTAMP;

        -- Also update the thread_members table for backwards compatibility
        UPDATE thread_members 
        SET 
            unread_count = unread_count + 1,
            unread_mentions = unread_mentions + CASE WHEN is_mention THEN 1 ELSE 0 END
        WHERE thread_id = NEW.thread_id 
        AND user_id = thread_member.user_id;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to mark messages as read and update counts
CREATE OR REPLACE FUNCTION mark_messages_read(
    p_user_id VARCHAR(128),
    p_workspace_id UUID,
    p_entity_type VARCHAR(20),
    p_entity_id UUID,
    p_message_id UUID DEFAULT NULL
)
RETURNS TABLE(
    unread_count INTEGER,
    unread_mentions INTEGER
) AS $$
DECLARE
    new_unread_count INTEGER := 0;
    new_unread_mentions INTEGER := 0;
    last_message_id UUID;
BEGIN
    -- Get the latest message ID if not provided
    IF p_message_id IS NULL THEN
        SELECT m.id INTO last_message_id
        FROM messages m
        JOIN threads t ON m.thread_id = t.id
        WHERE t.id = p_entity_id
        AND m.is_deleted = false
        ORDER BY m.created_at DESC
        LIMIT 1;
    ELSE
        last_message_id := p_message_id;
    END IF;

    -- Count remaining unread messages after the read position
    SELECT 
        COUNT(*) FILTER (WHERE m.created_at > COALESCE(
            (SELECT created_at FROM messages WHERE id = last_message_id), 
            '1970-01-01'::timestamp
        )),
        COUNT(*) FILTER (WHERE m.created_at > COALESCE(
            (SELECT created_at FROM messages WHERE id = last_message_id), 
            '1970-01-01'::timestamp
        ) AND EXISTS(
            SELECT 1 FROM message_mentions mm 
            WHERE mm.message_id = m.id AND mm.mentioned_user_id = p_user_id
        ))
    INTO new_unread_count, new_unread_mentions
    FROM messages m
    JOIN threads t ON m.thread_id = t.id
    WHERE t.id = p_entity_id
    AND m.is_deleted = false
    AND m.sender_id != p_user_id;

    -- Update or insert the read status
    INSERT INTO user_read_status (
        user_id, 
        workspace_id, 
        entity_type, 
        entity_id, 
        last_read_message_id,
        last_read_at,
        unread_count,
        unread_mentions,
        updated_at
    )
    VALUES (
        p_user_id,
        p_workspace_id,
        p_entity_type,
        p_entity_id,
        last_message_id,
        CURRENT_TIMESTAMP,
        new_unread_count,
        new_unread_mentions,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (user_id, workspace_id, entity_type, entity_id)
    DO UPDATE SET
        last_read_message_id = last_message_id,
        last_read_at = CURRENT_TIMESTAMP,
        unread_count = new_unread_count,
        unread_mentions = new_unread_mentions,
        updated_at = CURRENT_TIMESTAMP;

    -- Also update thread_members for backwards compatibility
    UPDATE thread_members 
    SET 
        last_read_at = CURRENT_TIMESTAMP,
        last_read_message_id = last_message_id,
        unread_count = new_unread_count,
        unread_mentions = new_unread_mentions
    WHERE thread_id = p_entity_id 
    AND user_id = p_user_id;

    RETURN QUERY SELECT new_unread_count, new_unread_mentions;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update unread counts on new messages
DROP TRIGGER IF EXISTS trigger_update_unread_counts ON messages;
CREATE TRIGGER trigger_update_unread_counts
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_unread_counts_on_message();

-- Create materialized view for efficient unread summary queries
CREATE MATERIALIZED VIEW user_unread_summary AS
SELECT 
    urs.user_id,
    urs.workspace_id,
    SUM(urs.unread_count) as total_unread,
    SUM(urs.unread_mentions) as total_mentions,
    COUNT(CASE WHEN urs.unread_count > 0 THEN 1 END) as unread_conversations,
    MAX(urs.updated_at) as last_activity
FROM user_read_status urs
WHERE urs.unread_count > 0
GROUP BY urs.user_id, urs.workspace_id;

-- Index for the materialized view
CREATE UNIQUE INDEX idx_user_unread_summary_user_workspace 
ON user_unread_summary (user_id, workspace_id);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_unread_summary()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_unread_summary;
END;
$$ LANGUAGE plpgsql;

-- Initialize read status for existing users (run once)
INSERT INTO user_read_status (
    user_id, 
    workspace_id, 
    entity_type, 
    entity_id, 
    unread_count,
    unread_mentions
)
SELECT DISTINCT
    tm.user_id,
    t.workspace_id,
    'thread',
    tm.thread_id,
    COALESCE(tm.unread_count, 0),
    COALESCE(tm.unread_mentions, 0)
FROM thread_members tm
JOIN threads t ON tm.thread_id = t.id
ON CONFLICT (user_id, workspace_id, entity_type, entity_id) DO NOTHING;

-- Initial refresh of the materialized view
SELECT refresh_unread_summary();

-- DOWN: Drop everything (for rollback)
/*
DROP MATERIALIZED VIEW IF EXISTS user_unread_summary;
DROP FUNCTION IF EXISTS refresh_unread_summary();
DROP TRIGGER IF EXISTS trigger_update_unread_counts ON messages;
DROP FUNCTION IF EXISTS update_unread_counts_on_message();
DROP FUNCTION IF EXISTS mark_messages_read(VARCHAR(128), UUID, VARCHAR(20), UUID, UUID);
DROP INDEX IF EXISTS idx_user_read_status_updated;
DROP INDEX IF EXISTS idx_user_read_status_mentions;
DROP INDEX IF EXISTS idx_user_read_status_unread;
DROP INDEX IF EXISTS idx_user_read_status_entity;
DROP INDEX IF EXISTS idx_user_read_status_user_workspace;
DROP TABLE IF EXISTS user_read_status;
ALTER TABLE thread_members DROP COLUMN IF EXISTS unread_mentions;
ALTER TABLE thread_members DROP COLUMN IF EXISTS unread_count;
ALTER TABLE thread_members DROP COLUMN IF EXISTS last_read_message_id;
ALTER TABLE notifications DROP COLUMN IF EXISTS entity_type;
ALTER TABLE notifications DROP COLUMN IF EXISTS priority;
ALTER TABLE notifications DROP COLUMN IF EXISTS message_id;
ALTER TABLE notifications DROP COLUMN IF EXISTS thread_id;
*/
