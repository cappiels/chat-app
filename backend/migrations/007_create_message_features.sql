-- Migration 007: Create enterprise message features tables
-- UP: Create the tables

-- Message reactions (emoji responses)
CREATE TABLE message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(100) NOT NULL, -- Unicode emoji or custom emoji code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id, emoji)
);

-- Message mentions (@username functionality)
CREATE TABLE message_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    mentioned_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mention_type VARCHAR(50) DEFAULT 'user', -- 'user', 'channel', 'everyone'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Message edit history tracking
CREATE TABLE message_edit_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    previous_content TEXT NOT NULL,
    edited_by VARCHAR(128) NOT NULL REFERENCES users(id),
    edit_reason TEXT,
    edited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications system
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'mention', 'reaction', 'message', 'invite', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB, -- Additional structured data
    is_read BOOLEAN DEFAULT false,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

-- Thread bookmarks/favorites
CREATE TABLE thread_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, thread_id)
);

-- Message templates for common responses
CREATE TABLE message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL for personal templates
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    template_type VARCHAR(50) DEFAULT 'text', -- 'text', 'rich_text', 'code'
    is_shared BOOLEAN DEFAULT false, -- Can other workspace members use this?
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns to existing messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(128) REFERENCES users(id),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS forwarded_from_message_id UUID REFERENCES messages(id),
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES message_templates(id);

-- Add new columns to existing threads table for organization
ALTER TABLE threads 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_by VARCHAR(128) REFERENCES users(id),
ADD COLUMN IF NOT EXISTS folder_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS thread_color VARCHAR(7), -- Hex color code
ADD COLUMN IF NOT EXISTS auto_archive_days INTEGER; -- Auto-archive after X days of inactivity

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions (message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions (user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_emoji ON message_reactions (emoji);

CREATE INDEX IF NOT EXISTS idx_message_mentions_message_id ON message_mentions (message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_user_id ON message_mentions (mentioned_user_id);

CREATE INDEX IF NOT EXISTS idx_message_edit_history_message_id ON message_edit_history (message_id);
CREATE INDEX IF NOT EXISTS idx_message_edit_history_edited_at ON message_edit_history (edited_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id ON notifications (workspace_id);

CREATE INDEX IF NOT EXISTS idx_thread_bookmarks_user_id ON thread_bookmarks (user_id);
CREATE INDEX IF NOT EXISTS idx_thread_bookmarks_thread_id ON thread_bookmarks (thread_id);

CREATE INDEX IF NOT EXISTS idx_message_templates_user_id ON message_templates (user_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_workspace_id ON message_templates (workspace_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_is_shared ON message_templates (is_shared);

CREATE INDEX IF NOT EXISTS idx_messages_is_pinned ON messages (is_pinned);
CREATE INDEX IF NOT EXISTS idx_messages_scheduled_for ON messages (scheduled_for);
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON messages (deleted_at);

CREATE INDEX IF NOT EXISTS idx_threads_is_archived ON threads (is_archived);
CREATE INDEX IF NOT EXISTS idx_threads_folder_name ON threads (folder_name);

-- Full-text search indexes for message content
CREATE INDEX IF NOT EXISTS idx_messages_content_search ON messages USING gin(to_tsvector('english', content));

-- DOWN: Drop everything (for rollback)
-- DROP INDEX IF EXISTS idx_messages_content_search;
-- DROP INDEX IF EXISTS idx_threads_folder_name;
-- DROP INDEX IF EXISTS idx_threads_is_archived;
-- DROP INDEX IF EXISTS idx_messages_deleted_at;
-- DROP INDEX IF EXISTS idx_messages_scheduled_for;
-- DROP INDEX IF EXISTS idx_messages_is_pinned;
-- DROP INDEX IF EXISTS idx_message_templates_is_shared;
-- DROP INDEX IF EXISTS idx_message_templates_workspace_id;
-- DROP INDEX IF EXISTS idx_message_templates_user_id;
-- DROP INDEX IF EXISTS idx_thread_bookmarks_thread_id;
-- DROP INDEX IF EXISTS idx_thread_bookmarks_user_id;
-- DROP INDEX IF EXISTS idx_notifications_workspace_id;
-- DROP INDEX IF EXISTS idx_notifications_created_at;
-- DROP INDEX IF EXISTS idx_notifications_is_read;
-- DROP INDEX IF EXISTS idx_notifications_user_id;
-- DROP INDEX IF EXISTS idx_message_edit_history_edited_at;
-- DROP INDEX IF EXISTS idx_message_edit_history_message_id;
-- DROP INDEX IF EXISTS idx_message_mentions_user_id;
-- DROP INDEX IF EXISTS idx_message_mentions_message_id;
-- DROP INDEX IF EXISTS idx_message_reactions_emoji;
-- DROP INDEX IF EXISTS idx_message_reactions_user_id;
-- DROP INDEX IF EXISTS idx_message_reactions_message_id;

-- ALTER TABLE threads DROP COLUMN IF EXISTS auto_archive_days;
-- ALTER TABLE threads DROP COLUMN IF EXISTS thread_color;
-- ALTER TABLE threads DROP COLUMN IF EXISTS folder_name;
-- ALTER TABLE threads DROP COLUMN IF EXISTS archived_by;
-- ALTER TABLE threads DROP COLUMN IF EXISTS archived_at;
-- ALTER TABLE threads DROP COLUMN IF EXISTS is_archived;

-- ALTER TABLE messages DROP COLUMN IF EXISTS template_id;
-- ALTER TABLE messages DROP COLUMN IF EXISTS forwarded_from_message_id;
-- ALTER TABLE messages DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE messages DROP COLUMN IF EXISTS deleted_by;
-- ALTER TABLE messages DROP COLUMN IF EXISTS scheduled_for;
-- ALTER TABLE messages DROP COLUMN IF EXISTS is_pinned;

-- DROP TABLE IF EXISTS message_templates;
-- DROP TABLE IF EXISTS thread_bookmarks;
-- DROP TABLE IF EXISTS notifications;
-- DROP TABLE IF EXISTS message_edit_history;
-- DROP TABLE IF EXISTS message_mentions;
-- DROP TABLE IF EXISTS message_reactions;
