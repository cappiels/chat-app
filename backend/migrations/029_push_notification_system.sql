-- Migration 029: Push Notification System
-- Implements Slack-like push notifications for iOS/Android/Web

-- =====================================================
-- Table 1: Device Tokens (FCM registration tokens)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'macos')),
    device_info JSONB DEFAULT '{}', -- Device model, OS version, app version, etc.
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Each token should be unique per user
    UNIQUE(user_id, device_token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON user_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON user_device_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON user_device_tokens(user_id, is_active) WHERE is_active = TRUE;

-- =====================================================
-- Table 2: Push Notification Preferences (Slack-like)
-- =====================================================
CREATE TABLE IF NOT EXISTS push_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,

    -- Global toggles (only used when workspace_id and thread_id are NULL)
    push_enabled BOOLEAN DEFAULT TRUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    badge_enabled BOOLEAN DEFAULT TRUE,
    vibration_enabled BOOLEAN DEFAULT TRUE,

    -- Notification types (what to notify about)
    notify_all_messages BOOLEAN DEFAULT FALSE,  -- Notify on every message (usually OFF)
    notify_mentions BOOLEAN DEFAULT TRUE,       -- @mentions
    notify_direct_messages BOOLEAN DEFAULT TRUE, -- DMs
    notify_thread_replies BOOLEAN DEFAULT TRUE,  -- Replies to threads you're in
    notify_task_assigned BOOLEAN DEFAULT TRUE,   -- When assigned a task
    notify_task_due BOOLEAN DEFAULT TRUE,        -- Task due reminders
    notify_task_completed BOOLEAN DEFAULT TRUE,  -- When your task is completed by someone
    notify_calendar_events BOOLEAN DEFAULT TRUE, -- Calendar event reminders
    notify_workspace_invites BOOLEAN DEFAULT TRUE, -- Workspace invitations

    -- Muting (workspace or thread level)
    mute_level VARCHAR(20) DEFAULT 'none' CHECK (mute_level IN ('all', 'mentions_only', 'none')),
    -- 'all' = completely muted, 'mentions_only' = only @mentions, 'none' = not muted
    muted_until TIMESTAMP WITH TIME ZONE, -- NULL = permanently muted until manually unmuted

    -- Do Not Disturb (only used at global level - workspace_id and thread_id NULL)
    dnd_enabled BOOLEAN DEFAULT FALSE,
    dnd_start_time TIME, -- e.g., '22:00:00'
    dnd_end_time TIME,   -- e.g., '08:00:00'
    dnd_timezone VARCHAR(50) DEFAULT 'America/New_York',
    dnd_allow_mentions BOOLEAN DEFAULT TRUE, -- Allow @mentions even during DND

    -- Quiet Hours (separate from DND, for regular daily quiet time)
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    quiet_hours_weekends_only BOOLEAN DEFAULT FALSE,

    -- Preview settings
    show_message_preview BOOLEAN DEFAULT TRUE, -- Show message content in notification
    show_sender_name BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure one preference record per user/workspace/thread combination
    UNIQUE(user_id, workspace_id, thread_id)
);

-- Index for fast preference lookups
CREATE INDEX IF NOT EXISTS idx_push_prefs_user ON push_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_push_prefs_workspace ON push_notification_preferences(user_id, workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_prefs_thread ON push_notification_preferences(user_id, thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_prefs_global ON push_notification_preferences(user_id) WHERE workspace_id IS NULL AND thread_id IS NULL;

-- =====================================================
-- Table 3: Push Notification Queue (for batching/retry)
-- =====================================================
CREATE TABLE IF NOT EXISTS push_notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,

    -- Notification content
    notification_type VARCHAR(50) NOT NULL,
    -- Types: 'message', 'mention', 'direct_message', 'thread_reply',
    -- 'task_assigned', 'task_due', 'task_completed', 'calendar_event', 'workspace_invite'

    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}', -- Custom data payload for deep linking

    -- iOS specific
    badge_count INTEGER,
    sound VARCHAR(100) DEFAULT 'default',
    category VARCHAR(50), -- For actionable notifications (reply, mark_read, etc.)

    -- Processing
    priority VARCHAR(20) DEFAULT 'high' CHECK (priority IN ('high', 'normal')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Timing
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Error tracking
    last_error TEXT,
    failed_tokens JSONB DEFAULT '[]' -- Track which tokens failed
);

CREATE INDEX IF NOT EXISTS idx_push_queue_pending ON push_notification_queue(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_push_queue_user ON push_notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_push_queue_created ON push_notification_queue(created_at DESC);

-- =====================================================
-- Table 4: User Badge Counts (per workspace)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_badge_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

    unread_messages INTEGER DEFAULT 0,
    unread_mentions INTEGER DEFAULT 0,
    unread_direct_messages INTEGER DEFAULT 0,
    unread_tasks INTEGER DEFAULT 0,

    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_badge_counts_user ON user_badge_counts(user_id);

-- =====================================================
-- Table 5: Notification Delivery Log (for debugging)
-- =====================================================
CREATE TABLE IF NOT EXISTS push_notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID REFERENCES push_notification_queue(id) ON DELETE SET NULL,
    user_id VARCHAR(128) NOT NULL,
    device_token_id UUID REFERENCES user_device_tokens(id) ON DELETE SET NULL,

    -- Delivery result
    success BOOLEAN NOT NULL,
    fcm_message_id VARCHAR(255), -- Firebase message ID if successful
    error_code VARCHAR(100),
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_log_user ON push_notification_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_log_queue ON push_notification_log(queue_id);

-- =====================================================
-- Helper function: Get effective push preferences
-- Returns merged preferences (global + workspace + thread overrides)
-- =====================================================
CREATE OR REPLACE FUNCTION get_effective_push_preferences(
    p_user_id VARCHAR(128),
    p_workspace_id UUID DEFAULT NULL,
    p_thread_id UUID DEFAULT NULL
) RETURNS TABLE (
    push_enabled BOOLEAN,
    sound_enabled BOOLEAN,
    badge_enabled BOOLEAN,
    notify_mentions BOOLEAN,
    notify_direct_messages BOOLEAN,
    notify_thread_replies BOOLEAN,
    notify_task_assigned BOOLEAN,
    mute_level VARCHAR(20),
    muted_until TIMESTAMP WITH TIME ZONE,
    dnd_enabled BOOLEAN,
    dnd_start_time TIME,
    dnd_end_time TIME,
    dnd_timezone VARCHAR(50),
    dnd_allow_mentions BOOLEAN,
    show_message_preview BOOLEAN
) AS $$
DECLARE
    global_prefs RECORD;
    workspace_prefs RECORD;
    thread_prefs RECORD;
BEGIN
    -- Get global preferences
    SELECT * INTO global_prefs
    FROM push_notification_preferences
    WHERE user_id = p_user_id AND workspace_id IS NULL AND thread_id IS NULL;

    -- Get workspace preferences if workspace_id provided
    IF p_workspace_id IS NOT NULL THEN
        SELECT * INTO workspace_prefs
        FROM push_notification_preferences
        WHERE user_id = p_user_id AND workspace_id = p_workspace_id AND thread_id IS NULL;
    END IF;

    -- Get thread preferences if thread_id provided
    IF p_thread_id IS NOT NULL THEN
        SELECT * INTO thread_prefs
        FROM push_notification_preferences
        WHERE user_id = p_user_id AND thread_id = p_thread_id;
    END IF;

    -- Return merged preferences (thread > workspace > global)
    RETURN QUERY SELECT
        COALESCE(global_prefs.push_enabled, TRUE),
        COALESCE(global_prefs.sound_enabled, TRUE),
        COALESCE(global_prefs.badge_enabled, TRUE),
        COALESCE(thread_prefs.notify_mentions, workspace_prefs.notify_mentions, global_prefs.notify_mentions, TRUE),
        COALESCE(thread_prefs.notify_direct_messages, workspace_prefs.notify_direct_messages, global_prefs.notify_direct_messages, TRUE),
        COALESCE(thread_prefs.notify_thread_replies, workspace_prefs.notify_thread_replies, global_prefs.notify_thread_replies, TRUE),
        COALESCE(workspace_prefs.notify_task_assigned, global_prefs.notify_task_assigned, TRUE),
        COALESCE(thread_prefs.mute_level, workspace_prefs.mute_level, 'none')::VARCHAR(20),
        COALESCE(thread_prefs.muted_until, workspace_prefs.muted_until),
        COALESCE(global_prefs.dnd_enabled, FALSE),
        global_prefs.dnd_start_time,
        global_prefs.dnd_end_time,
        COALESCE(global_prefs.dnd_timezone, 'America/New_York'),
        COALESCE(global_prefs.dnd_allow_mentions, TRUE),
        COALESCE(global_prefs.show_message_preview, TRUE);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger: Update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_push_prefs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_push_prefs_updated
    BEFORE UPDATE ON push_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_push_prefs_timestamp();

-- =====================================================
-- DOWN: Rollback migration
-- =====================================================
-- DROP TRIGGER IF EXISTS trigger_push_prefs_updated ON push_notification_preferences;
-- DROP FUNCTION IF EXISTS update_push_prefs_timestamp();
-- DROP FUNCTION IF EXISTS get_effective_push_preferences(VARCHAR, UUID, UUID);
-- DROP TABLE IF EXISTS push_notification_log;
-- DROP TABLE IF EXISTS user_badge_counts;
-- DROP TABLE IF EXISTS push_notification_queue;
-- DROP TABLE IF EXISTS push_notification_preferences;
-- DROP TABLE IF EXISTS user_device_tokens;
