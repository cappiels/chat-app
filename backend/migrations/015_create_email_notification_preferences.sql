-- Email notification preferences migration
CREATE TABLE IF NOT EXISTS email_notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    workspace_id UUID,
    thread_id UUID,
    
    -- Global preferences
    immediate_mentions BOOLEAN DEFAULT TRUE,
    immediate_direct_messages BOOLEAN DEFAULT TRUE,
    immediate_workspace_invites BOOLEAN DEFAULT TRUE,
    
    -- Batched notifications
    batched_enabled BOOLEAN DEFAULT TRUE,
    batched_frequency_minutes INTEGER DEFAULT 30,
    batched_active_threads BOOLEAN DEFAULT TRUE,
    batched_channel_activity BOOLEAN DEFAULT FALSE,
    
    -- Daily digest
    digest_enabled BOOLEAN DEFAULT TRUE,
    digest_time TIME DEFAULT '09:00:00',
    digest_timezone VARCHAR(50) DEFAULT 'America/New_York',
    digest_include_unread BOOLEAN DEFAULT TRUE,
    digest_include_members BOOLEAN DEFAULT TRUE,
    digest_include_stats BOOLEAN DEFAULT FALSE,
    
    -- Thread/workspace specific overrides
    thread_immediate BOOLEAN, -- NULL = use global settings, TRUE/FALSE = override
    workspace_immediate BOOLEAN,
    
    -- Meta fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes and constraints
    UNIQUE(user_id, workspace_id, thread_id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

-- User activity tracking for offline detection
CREATE TABLE IF NOT EXISTS user_activity (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    workspace_id UUID,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_socket_connection TIMESTAMP,
    is_online BOOLEAN DEFAULT FALSE,
    
    -- Indexes and constraints
    UNIQUE(user_id, workspace_id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Email notification queue for batching and processing
CREATE TABLE IF NOT EXISTS email_notification_queue (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    workspace_id UUID NOT NULL,
    thread_id UUID,
    message_id UUID,
    
    -- Notification details
    notification_type VARCHAR(50) NOT NULL, -- 'mention', 'direct_message', 'thread_message', 'workspace_invite'
    priority VARCHAR(20) DEFAULT 'normal', -- 'immediate', 'normal', 'low'
    
    -- Message details
    sender_name VARCHAR(255),
    sender_email VARCHAR(255),
    message_content TEXT,
    message_timestamp TIMESTAMP,
    
    -- Processing status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed'
    scheduled_for TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Meta fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Digest summary cache to avoid recalculating
CREATE TABLE IF NOT EXISTS daily_digest_cache (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    workspace_id UUID NOT NULL,
    digest_date DATE NOT NULL,
    
    -- Cached summary data (JSON)
    unread_count INTEGER DEFAULT 0,
    mention_count INTEGER DEFAULT 0,
    thread_count INTEGER DEFAULT 0,
    new_members_count INTEGER DEFAULT 0,
    summary_data JSONB,
    
    -- Processing status
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    
    UNIQUE(user_id, workspace_id, digest_date),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_prefs_user ON email_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_email_prefs_workspace ON email_notification_preferences(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_prefs_thread ON email_notification_preferences(thread_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_workspace ON user_activity(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_last_active ON user_activity(last_active);
CREATE INDEX IF NOT EXISTS idx_notification_queue_priority ON email_notification_queue(priority, status);
CREATE INDEX IF NOT EXISTS idx_digest_cache_date ON daily_digest_cache(digest_date, user_id);
