-- Complete Database Schema for Chat App
-- This file contains the entire database structure in one place
-- Rebuilt from ALL migrations to ensure 100% accuracy
-- No more migration headaches - dev and prod are always identical

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (Migration 001)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,  -- Firebase UID (standardized to 255)
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  profile_picture_url TEXT,
  phone_number VARCHAR(20),
  auth_provider VARCHAR(50) DEFAULT 'email',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Create workspaces table  
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Create workspace_members table (Migration 002)
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  role VARCHAR(50) DEFAULT 'member', -- owner, admin, member
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  invited_by VARCHAR(255) REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(workspace_id, user_id)
);

-- Create threads table (channels) (Migration 003)
CREATE TABLE IF NOT EXISTS threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'channel', -- channel, direct_message, group
  created_by VARCHAR(255) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_archived BOOLEAN DEFAULT false,
  is_private BOOLEAN DEFAULT false
);

-- Create thread_members table (Migration 004)
CREATE TABLE IF NOT EXISTS thread_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  role VARCHAR(50) DEFAULT 'member', -- owner, admin, moderator, member
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(thread_id, user_id)
);

-- Create messages table (Migration 005 + 020)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text', -- text, file, image, system
  parent_message_id UUID REFERENCES messages(id),
  edited_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_pinned BOOLEAN DEFAULT false,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  deleted_by VARCHAR(255) REFERENCES users(id),
  deleted_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create message_reactions table (Migration 022)
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  emoji VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id, emoji)
);

-- Create message_mentions table (Migration 022)
CREATE TABLE IF NOT EXISTS message_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mentioned_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mention_type VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create message_edit_history table (Migration 022)
CREATE TABLE IF NOT EXISTS message_edit_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  previous_content TEXT NOT NULL,
  edited_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  edit_reason TEXT,
  edited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create thread_bookmarks table (Migration 022)
CREATE TABLE IF NOT EXISTS thread_bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, thread_id)
);

-- Create attachments table (Migration 006)
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table (Migration 011)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- mention, direct_message, channel_message, workspace_invite
  title VARCHAR(255) NOT NULL,
  content TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP
);

-- Create email_notification_preferences table (Migration 015)
CREATE TABLE IF NOT EXISTS email_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  direct_messages BOOLEAN DEFAULT true,
  mentions BOOLEAN DEFAULT true,
  all_messages BOOLEAN DEFAULT false,
  digest_frequency VARCHAR(20) DEFAULT 'daily', -- none, daily, weekly
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, workspace_id)
);

-- =========================================================================
-- KNOWLEDGE MANAGEMENT SYSTEM (Migrations 009-010)
-- Complete advanced knowledge system with RBAC, scopes, and AI features
-- =========================================================================

-- Knowledge Scopes (defines the boundary/context for knowledge)
CREATE TABLE IF NOT EXISTS knowledge_scopes (
  id SERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  scope_type VARCHAR(50) CHECK(scope_type IN ('channel', 'workspace', 'collection', 'cross-channel', 'custom', 'personal')) NOT NULL,
  source_thread_id UUID, -- For channel-scoped knowledge
  parent_scope_id INTEGER, -- For hierarchical scopes
  is_active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}', -- Flexible settings (auto-categorization rules, etc.)
  created_by VARCHAR(255) NOT NULL, -- Firebase UID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (source_thread_id) REFERENCES threads(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_scope_id) REFERENCES knowledge_scopes(id) ON DELETE SET NULL,
  UNIQUE(workspace_id, name)
);

-- Knowledge Roles (defines what users can do within a scope)
CREATE TABLE IF NOT EXISTS knowledge_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL, -- Flexible permissions object
  scope_level VARCHAR(20) CHECK(scope_level IN ('scope', 'category', 'global')) DEFAULT 'scope',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, scope_level)
);

-- Knowledge Scope Members (who has access to what scope with what role)
CREATE TABLE IF NOT EXISTS knowledge_scope_members (
  id SERIAL PRIMARY KEY,
  scope_id INTEGER NOT NULL, 
  user_id VARCHAR(255) NOT NULL, -- Firebase UID
  role_id INTEGER NOT NULL,
  granted_by VARCHAR(255) NOT NULL, -- Firebase UID of person who granted access
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES knowledge_roles(id) ON DELETE CASCADE,
  UNIQUE(scope_id, user_id)
);

-- Advanced Knowledge Categories with Administrators
CREATE TABLE IF NOT EXISTS knowledge_categories (
  id SERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL,
  scope_id INTEGER, -- Categories can be scoped to specific knowledge scopes
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6366f1',
  icon VARCHAR(50), -- Icon identifier
  is_system_category BOOLEAN DEFAULT FALSE, -- System vs user-created
  auto_categorization_rules JSONB DEFAULT '{}', -- AI/ML rules for auto-categorization
  parent_category_id INTEGER, -- For hierarchical categories
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(255) NOT NULL, -- Firebase UID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_category_id) REFERENCES knowledge_categories(id) ON DELETE SET NULL
);

-- Category Administrators (topic experts who manage specific categories)
CREATE TABLE IF NOT EXISTS knowledge_category_admins (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL,
  user_id VARCHAR(255) NOT NULL, -- Firebase UID
  admin_level VARCHAR(20) CHECK(admin_level IN ('owner', 'moderator', 'contributor')) DEFAULT 'moderator',
  permissions JSONB DEFAULT '{}', -- Specific permissions for this category
  appointed_by VARCHAR(255) NOT NULL, -- Firebase UID
  appointed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES knowledge_categories(id) ON DELETE CASCADE,
  UNIQUE(category_id, user_id)
);

-- Advanced Knowledge Items with Multi-Scope Support
CREATE TABLE IF NOT EXISTS knowledge_items (
  id SERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL,
  primary_scope_id INTEGER NOT NULL, -- Main scope this belongs to
  created_by VARCHAR(255) NOT NULL, -- Firebase UID
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(20) DEFAULT 'markdown', -- markdown, html, plaintext
  category_id INTEGER,
  
  -- Source tracking
  source_message_id UUID,
  source_thread_id UUID,
  source_type VARCHAR(20) CHECK(source_type IN ('message', 'manual', 'import', 'ai_generated')) DEFAULT 'manual',
  
  -- Engagement metrics
  views_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0, -- How many people saved this
  upvotes_count INTEGER DEFAULT 0,
  downvotes_count INTEGER DEFAULT 0,
  
  -- Flags and status
  is_featured BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_template BOOLEAN DEFAULT FALSE,
  approval_status VARCHAR(20) CHECK(approval_status IN ('draft', 'pending', 'approved', 'rejected')) DEFAULT 'approved',
  approved_by VARCHAR(255), -- Firebase UID
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- AI/ML fields
  ai_summary TEXT, -- AI-generated summary
  ai_tags JSONB DEFAULT '[]', -- AI-suggested tags
  ai_confidence_score REAL, -- Confidence in AI suggestions
  
  -- Temporal fields
  effective_date TIMESTAMP WITH TIME ZONE, -- When this knowledge becomes effective
  expiry_date TIMESTAMP WITH TIME ZONE, -- When this knowledge expires
  last_verified_at TIMESTAMP WITH TIME ZONE, -- When this was last verified as accurate
  verified_by VARCHAR(255), -- Firebase UID of verifier
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (primary_scope_id) REFERENCES knowledge_scopes(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES knowledge_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (source_message_id) REFERENCES messages(id) ON DELETE SET NULL,
  FOREIGN KEY (source_thread_id) REFERENCES threads(id) ON DELETE SET NULL
);

-- Multi-Scope Knowledge Items (knowledge can exist in multiple scopes)
CREATE TABLE IF NOT EXISTS knowledge_item_scopes (
  knowledge_item_id INTEGER NOT NULL,
  scope_id INTEGER NOT NULL,
  added_by VARCHAR(255) NOT NULL, -- Firebase UID
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_primary BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (knowledge_item_id, scope_id),
  FOREIGN KEY (knowledge_item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
  FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE CASCADE
);

-- Advanced Tagging System
CREATE TABLE IF NOT EXISTS knowledge_tags (
  id SERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL,
  scope_id INTEGER, -- Tags can be scoped
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7),
  is_system_tag BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_by VARCHAR(255) NOT NULL, -- Firebase UID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE SET NULL,
  UNIQUE(workspace_id, scope_id, name)
);

-- Knowledge Item Tags (Many-to-Many with metadata)
CREATE TABLE IF NOT EXISTS knowledge_item_tags (
  knowledge_item_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  added_by VARCHAR(255) NOT NULL, -- Firebase UID
  confidence_score REAL DEFAULT 1.0, -- For AI-suggested tags
  is_ai_suggested BOOLEAN DEFAULT FALSE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (knowledge_item_id, tag_id),
  FOREIGN KEY (knowledge_item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES knowledge_tags(id) ON DELETE CASCADE
);

-- Knowledge Collections (curated groups of knowledge items)
CREATE TABLE IF NOT EXISTS knowledge_collections (
  id SERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL,
  scope_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cover_image TEXT, -- URL or path to cover image
  is_public BOOLEAN DEFAULT TRUE,
  is_collaborative BOOLEAN DEFAULT TRUE,
  auto_include_rules JSONB DEFAULT '{}', -- Rules for automatically including items
  created_by VARCHAR(255) NOT NULL, -- Firebase UID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE CASCADE
);

-- Knowledge Collection Items
CREATE TABLE IF NOT EXISTS knowledge_collection_items (
  collection_id INTEGER NOT NULL,
  knowledge_item_id INTEGER NOT NULL,
  added_by VARCHAR(255) NOT NULL, -- Firebase UID
  sort_order INTEGER DEFAULT 0,
  notes TEXT, -- Curator's notes about why this item is in the collection
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_id, knowledge_item_id),
  FOREIGN KEY (collection_id) REFERENCES knowledge_collections(id) ON DELETE CASCADE,
  FOREIGN KEY (knowledge_item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE
);

-- Advanced Analytics and Views
CREATE TABLE IF NOT EXISTS knowledge_analytics (
  id SERIAL PRIMARY KEY,
  knowledge_item_id INTEGER NOT NULL,
  user_id VARCHAR(255) NOT NULL, -- Firebase UID
  action_type VARCHAR(20) CHECK(action_type IN ('view', 'save', 'share', 'upvote', 'downvote', 'edit', 'comment')) NOT NULL,
  scope_id INTEGER, -- Which scope they accessed it from
  metadata JSONB DEFAULT '{}', -- Additional context (time spent, search query, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (knowledge_item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
  FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE SET NULL
);

-- Knowledge Comments and Discussions
CREATE TABLE IF NOT EXISTS knowledge_comments (
  id SERIAL PRIMARY KEY,
  knowledge_item_id INTEGER NOT NULL,
  user_id VARCHAR(255) NOT NULL, -- Firebase UID
  parent_comment_id INTEGER, -- For threaded discussions
  content TEXT NOT NULL,
  is_suggestion BOOLEAN DEFAULT FALSE,
  suggestion_status VARCHAR(20) CHECK(suggestion_status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  upvotes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (knowledge_item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_comment_id) REFERENCES knowledge_comments(id) ON DELETE CASCADE
);

-- Create workspace_teams table (Migration 018)
CREATE TABLE IF NOT EXISTS workspace_teams (
  id SERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g. "kitchen-team", "frontend-dev"
  display_name VARCHAR(100) NOT NULL, -- e.g. "Kitchen Team", "Frontend Dev"
  description TEXT,
  color VARCHAR(20) DEFAULT 'blue',
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(workspace_id, name)
);

-- Create workspace_team_members table (Migration 018)
CREATE TABLE IF NOT EXISTS workspace_team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES workspace_teams(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'member', -- member, lead, admin
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  joined_by VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(team_id, user_id)
);

-- Create channel_tasks table (Migrations 017, 018, 019, 023)
CREATE TABLE IF NOT EXISTS channel_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  due_date TIMESTAMP,
  -- Legacy single assignee (for backward compatibility)
  assigned_to VARCHAR(255),
  -- New multi-assignee system (Migration 018)
  assignees JSONB DEFAULT '[]'::jsonb,
  assigned_teams JSONB DEFAULT '[]'::jsonb,
  assignment_mode VARCHAR(50) DEFAULT 'collaborative', -- collaborative, individual_response
  individual_completions JSONB DEFAULT '{}'::jsonb, -- {"user_id": "timestamp"}
  completion_count INTEGER DEFAULT 0,
  requires_individual_response BOOLEAN DEFAULT false,
  assignee_count INTEGER GENERATED ALWAYS AS (
    jsonb_array_length(assignees) + jsonb_array_length(assigned_teams)
  ) STORED,
  -- Task properties
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
  tags JSONB DEFAULT '[]'::jsonb,
  estimated_hours NUMERIC(5,2),
  actual_hours NUMERIC(5,2),
  is_all_day BOOLEAN DEFAULT false,
  start_time TIME,
  end_time TIME,
  parent_task_id UUID REFERENCES channel_tasks(id),
  dependencies JSONB DEFAULT '[]'::jsonb,
  -- Google sync fields (Migration 023)
  google_calendar_event_id VARCHAR(255),
  google_task_id VARCHAR(255),
  sync_strategy VARCHAR(20) DEFAULT 'smart', -- 'smart', 'calendar', 'tasks', 'both', 'none'
  sync_enabled BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_error TEXT,
  sync_retry_count INTEGER DEFAULT 0,
  google_calendar_etag VARCHAR(255),
  google_task_etag VARCHAR(255),
  source_key VARCHAR(255) UNIQUE, -- For deduplication: "syncup:workspace-thread-task"
  -- Enhanced fields (Migration 023)
  location TEXT,
  timezone VARCHAR(50) DEFAULT 'UTC',
  calendar_type VARCHAR(50) DEFAULT 'event',
  -- Audit fields
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- =========================================================================
-- GOOGLE SYNC INFRASTRUCTURE (Migration 023)
-- Critical for Google Calendar & Tasks sync system
-- =========================================================================

-- Workspace-level Google sync configuration table
CREATE TABLE IF NOT EXISTS workspace_google_sync_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Google Calendar configuration
  google_calendar_enabled BOOLEAN DEFAULT false,
  primary_calendar_id VARCHAR(255) DEFAULT 'primary',
  secondary_calendar_id VARCHAR(255), -- Per-workspace calendar to avoid spam
  calendar_color_id VARCHAR(10) DEFAULT '1',
  
  -- Google Tasks configuration  
  google_tasks_enabled BOOLEAN DEFAULT false,
  primary_task_list_id VARCHAR(255) DEFAULT '@default',
  secondary_task_list_id VARCHAR(255), -- Per-workspace task list
  
  -- Sync settings
  auto_sync_enabled BOOLEAN DEFAULT true,
  sync_frequency_minutes INTEGER DEFAULT 15,
  batch_sync_enabled BOOLEAN DEFAULT true,
  
  -- Advanced settings based on expert feedback
  prevent_email_notifications BOOLEAN DEFAULT true, -- No accidental attendee emails
  use_end_exclusive_dates BOOLEAN DEFAULT true,     -- Proper all-day event handling
  smart_strategy_enabled BOOLEAN DEFAULT true,      -- Auto-determine Calendar vs Tasks
  
  -- Operational data
  last_full_sync_at TIMESTAMP WITH TIME ZONE,
  sync_token VARCHAR(255), -- For incremental Calendar sync
  tasks_updated_min TIMESTAMP WITH TIME ZONE, -- For incremental Tasks sync
  
  -- Error tracking
  sync_errors JSONB DEFAULT '[]',
  error_count INTEGER DEFAULT 0,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(workspace_id)
);

-- User-level Google sync preferences table
CREATE TABLE IF NOT EXISTS user_google_sync_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL UNIQUE,
  
  -- Google OAuth tokens (encrypted in production)
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expires_at TIMESTAMP WITH TIME ZONE,
  google_scope TEXT DEFAULT 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks',
  
  -- User preferences
  calendar_sync_enabled BOOLEAN DEFAULT true,
  tasks_sync_enabled BOOLEAN DEFAULT true,
  preferred_calendar_id VARCHAR(255) DEFAULT 'primary',
  preferred_task_list_id VARCHAR(255) DEFAULT '@default',
  
  -- Advanced user settings
  conflict_resolution_strategy VARCHAR(50) DEFAULT 'last_modified_wins',
  sync_personal_tasks BOOLEAN DEFAULT false,
  notification_preferences JSONB DEFAULT '{"sync_errors": true, "sync_success": false}',
  
  -- Location & Tags preferences
  sync_location_enabled BOOLEAN DEFAULT true,
  sync_tags_enabled BOOLEAN DEFAULT true,
  tag_to_color_mapping JSONB DEFAULT '{}', -- {"urgent": "11", "development": "1"}
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_authenticated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT check_conflict_resolution_valid CHECK (
    conflict_resolution_strategy IN ('last_modified_wins', 'our_system_wins', 'google_wins', 'manual')
  )
);

-- Google sync operations logging table (for debugging and monitoring)
CREATE TABLE IF NOT EXISTS google_sync_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES channel_tasks(id) ON DELETE CASCADE,
  user_id VARCHAR(255) REFERENCES users(id),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Operation details
  operation_type VARCHAR(50) NOT NULL,
  google_service VARCHAR(20) NOT NULL,
  google_id VARCHAR(255),
  sync_direction VARCHAR(20) NOT NULL, -- 'to_google', 'from_google', 'bidirectional'
  
  -- Request/Response data
  request_payload JSONB,
  response_payload JSONB,
  
  -- Execution details
  operation_status VARCHAR(20) NOT NULL,
  error_message TEXT,
  error_code VARCHAR(50),
  execution_time_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  api_quota_used INTEGER DEFAULT 1,
  rate_limit_hit BOOLEAN DEFAULT false,
  conflict_detected BOOLEAN DEFAULT false,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT check_operation_type_valid CHECK (
    operation_type IN ('create', 'update', 'delete', 'sync_from_google', 'conflict_resolution', 'batch_sync')
  ),
  CONSTRAINT check_google_service_valid CHECK (
    google_service IN ('calendar', 'tasks')
  ),
  CONSTRAINT check_sync_direction_valid CHECK (
    sync_direction IN ('to_google', 'from_google', 'bidirectional')
  ),
  CONSTRAINT check_operation_status_valid CHECK (
    operation_status IN ('success', 'failed', 'retry', 'skipped', 'conflict')
  )
);

-- =========================================================================
-- TAG COLOR SYSTEM (Migration 024) 
-- Algorithmic color generation + admin overrides
-- =========================================================================

-- Channel-level tag color overrides table
CREATE TABLE IF NOT EXISTS channel_tag_colors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tag_name VARCHAR(100) NOT NULL,
  
  -- Color definition (multiple formats supported)
  color_hex VARCHAR(7), -- #FF5733
  color_name VARCHAR(50), -- 'red', 'blue', 'green'
  color_tailwind VARCHAR(50), -- 'bg-red-500', 'bg-blue-600'
  color_google_calendar VARCHAR(2), -- '1'-'11' for Google Calendar sync
  
  -- Admin control
  created_by VARCHAR(255) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  
  -- Ensure one color override per tag per channel
  UNIQUE(thread_id, tag_name)
);

-- Workspace-level default tag colors (fallback for channels without overrides)
CREATE TABLE IF NOT EXISTS workspace_tag_colors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tag_name VARCHAR(100) NOT NULL,
  
  -- Color definition
  color_hex VARCHAR(7),
  color_name VARCHAR(50),
  color_tailwind VARCHAR(50), 
  color_google_calendar VARCHAR(2),
  
  -- Admin control
  created_by VARCHAR(255) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(workspace_id, tag_name)
);

-- =========================================================================
-- COMPREHENSIVE INDEXES FOR PERFORMANCE
-- =========================================================================

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- Workspace indexes
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);

-- Thread indexes
CREATE INDEX IF NOT EXISTS idx_threads_workspace_id ON threads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_thread_members_thread_id ON thread_members(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_members_user_id ON thread_members(user_id);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_message_id ON message_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_user_id ON message_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_message_edit_history_message_id ON message_edit_history(message_id);
CREATE INDEX IF NOT EXISTS idx_thread_bookmarks_user_id ON thread_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_bookmarks_thread_id ON thread_bookmarks(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_pinned ON messages (is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_messages_scheduled ON messages (scheduled_for) WHERE scheduled_for IS NOT NULL;

-- Attachment and notification indexes
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Knowledge system indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_items_workspace_scope ON knowledge_items(workspace_id, primary_scope_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_category ON knowledge_items(category_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_created_by ON knowledge_items(created_by);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_source ON knowledge_items(source_thread_id, source_message_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_status ON knowledge_items(approval_status, is_archived);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_featured ON knowledge_items(is_featured, views_count);
CREATE INDEX IF NOT EXISTS idx_knowledge_scopes_workspace ON knowledge_scopes(workspace_id, scope_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_scope_members_user ON knowledge_scope_members(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_analytics_item ON knowledge_analytics(knowledge_item_id, action_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_analytics_user ON knowledge_analytics(user_id, created_at);

-- Team indexes
CREATE INDEX IF NOT EXISTS idx_workspace_teams_workspace_id ON workspace_teams(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_team_members_team_id ON workspace_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_workspace_team_members_user_id ON workspace_team_members(user_id);

-- Task indexes
CREATE INDEX IF NOT EXISTS idx_channel_tasks_thread_id ON channel_tasks(thread_id);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_workspace_id ON channel_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_assigned_to ON channel_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_assignees ON channel_tasks USING gin(assignees);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_assigned_teams ON channel_tasks USING gin(assigned_teams);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_created_at ON channel_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_due_date ON channel_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_status ON channel_tasks(status);

-- Google sync indexes
CREATE INDEX IF NOT EXISTS idx_channel_tasks_location ON channel_tasks(location);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_google_task_id ON channel_tasks(google_task_id);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_sync_strategy ON channel_tasks(sync_strategy);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_last_synced ON channel_tasks(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_source_key ON channel_tasks(source_key);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_tags ON channel_tasks USING gin(tags);

-- Google sync table indexes
CREATE INDEX IF NOT EXISTS idx_workspace_google_sync_config_workspace_id ON workspace_google_sync_config(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_google_sync_preferences_user_id ON user_google_sync_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_google_sync_ops_task_id ON google_sync_operations(task_id);
CREATE INDEX IF NOT EXISTS idx_google_sync_ops_user_id ON google_sync_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_google_sync_ops_workspace_id ON google_sync_operations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_google_sync_ops_status ON google_sync_operations(operation_status);
CREATE INDEX IF NOT EXISTS idx_google_sync_ops_created_at ON google_sync_operations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_sync_ops_google_service ON google_sync_operations(google_service);
CREATE INDEX IF NOT EXISTS idx_google_sync_ops_operation_type ON google_sync_operations(operation_type);

-- Tag color indexes
CREATE INDEX IF NOT EXISTS idx_channel_tag_colors_thread_id ON channel_tag_colors(thread_id);
CREATE INDEX IF NOT EXISTS idx_channel_tag_colors_workspace_id ON channel_tag_colors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channel_tag_colors_tag_name ON channel_tag_colors(tag_name);
CREATE INDEX IF NOT EXISTS idx_channel_tag_colors_active ON channel_tag_colors(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workspace_tag_colors_workspace_id ON workspace_tag_colors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tag_colors_tag_name ON workspace_tag_colors(tag_name);
CREATE INDEX IF NOT EXISTS idx_workspace_tag_colors_active ON workspace_tag_colors(is_active) WHERE is_active = true;

-- =========================================================================
-- FUNCTIONS AND TRIGGERS (Enhanced from Migration 025)
-- =========================================================================

-- Knowledge system triggers and functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create knowledge triggers
CREATE TRIGGER IF NOT EXISTS update_knowledge_items_updated_at BEFORE UPDATE ON knowledge_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER IF NOT EXISTS update_knowledge_categories_updated_at BEFORE UPDATE ON knowledge_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER IF NOT EXISTS update_knowledge_collections_updated_at BEFORE UPDATE ON knowledge_collections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER IF NOT EXISTS update_knowledge_comments_updated_at BEFORE UPDATE ON knowledge_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update tag usage count
CREATE OR REPLACE FUNCTION update_knowledge_tag_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE knowledge_tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_knowledge_tag_usage_trigger AFTER INSERT ON knowledge_item_tags FOR EACH ROW EXECUTE FUNCTION update_knowledge_tag_usage();

-- Function to update views count
CREATE OR REPLACE FUNCTION update_knowledge_views_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.action_type = 'view' THEN
        UPDATE knowledge_items SET views_count = views_count + 1 WHERE id = NEW.knowledge_item_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_knowledge_views_count_trigger AFTER INSERT ON knowledge_analytics FOR EACH ROW EXECUTE FUNCTION update_knowledge_views_count();

-- Enhanced task functions with null safety (Migration 025)
CREATE OR REPLACE FUNCTION is_task_assignee(task_assignees jsonb, task_teams jsonb, user_id varchar)
RETURNS boolean AS $$
DECLARE
  team_record RECORD;
BEGIN
  -- Handle null inputs gracefully
  task_assignees := COALESCE(task_assignees, '[]'::jsonb);
  task_teams := COALESCE(task_teams, '[]'::jsonb);
  
  -- Check direct assignment
  IF task_assignees ? user_id THEN
    RETURN true;
  END IF;
  
  -- Check team assignments
  FOR team_record IN 
    SELECT jsonb_array_elements_text(task_teams) as team_id
  LOOP
    IF EXISTS (
      SELECT 1 FROM workspace_team_members wtm 
      WHERE wtm.team_id = team_record.team_id::integer 
      AND wtm.user_id = user_id 
      AND wtm.is_active = true
    ) THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_all_task_assignees(task_assignees jsonb, task_teams jsonb)
RETURNS json AS $$
DECLARE
  all_users text[] := ARRAY[]::text[];
  individual_users text[];
  team_users text[];
  team_record RECORD;
BEGIN
  -- Handle null inputs gracefully
  task_assignees := COALESCE(task_assignees, '[]'::jsonb);
  task_teams := COALESCE(task_teams, '[]'::jsonb);
  
  -- Get individual assignees
  SELECT ARRAY(SELECT jsonb_array_elements_text(task_assignees)) INTO individual_users;
  IF individual_users IS NOT NULL THEN
    all_users := all_users || individual_users;
  END IF;
  
  -- Get team members
  FOR team_record IN 
    SELECT jsonb_array_elements_text(task_teams) as team_id
  LOOP
    SELECT ARRAY(
      SELECT wtm.user_id 
      FROM workspace_team_members wtm 
      WHERE wtm.team_id = team_record.team_id::integer 
      AND wtm.is_active = true
    ) INTO team_users;
    
    IF team_users IS NOT NULL THEN
      all_users := all_users || team_users;
    END IF;
  END LOOP;
  
  -- Remove duplicates and return as JSON
  SELECT array_agg(DISTINCT user_id) INTO all_users FROM unnest(all_users) as user_id;
  
  RETURN json_build_object(
    'all_assignees', all_users,
    'count', array_length(all_users, 1)
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_task_completion_progress(task_assignees jsonb, task_teams jsonb, individual_completions jsonb)
RETURNS json AS $$
DECLARE
  all_assignees_info json;
  total_assignees integer;
  completed_count integer;
  assignee_list text[];
  completed_assignees text[];
  team_info json[] := ARRAY[]::json[];
  team_record RECORD;
BEGIN
  -- Handle null inputs gracefully
  task_assignees := COALESCE(task_assignees, '[]'::jsonb);
  task_teams := COALESCE(task_teams, '[]'::jsonb);
  individual_completions := COALESCE(individual_completions, '{}'::jsonb);
  
  -- Get all assignees (individuals + team members)
  all_assignees_info := get_all_task_assignees(task_assignees, task_teams);
  assignee_list := (all_assignees_info->>'all_assignees')::text[];
  total_assignees := (all_assignees_info->>'count')::integer;
  
  IF total_assignees IS NULL THEN
    total_assignees := 0;
  END IF;
  
  -- Get completed assignees
  SELECT ARRAY(SELECT jsonb_object_keys(individual_completions)) INTO completed_assignees;
  completed_count := array_length(completed_assignees, 1);
  IF completed_count IS NULL THEN
    completed_count := 0;
  END IF;
  
  -- Get team information
  FOR team_record IN 
    SELECT jsonb_array_elements_text(task_teams) as team_id
  LOOP
    SELECT array_append(team_info, json_build_object(
      'id', wt.id,
      'name', wt.name,
      'display_name', wt.display_name,
      'color', wt.color,
      'member_count', (
        SELECT count(*) 
        FROM workspace_team_members wtm 
        WHERE wtm.team_id = wt.id AND wtm.is_active = true
      )
    )) INTO team_info
    FROM workspace_teams wt
    WHERE wt.id = team_record.team_id::integer;
  END LOOP;
  
  RETURN json_build_object(
    'total', total_assignees,
    'completed', completed_count,
    'percentage', CASE 
      WHEN total_assignees > 0 THEN ROUND((completed_count::decimal / total_assignees) * 100, 1)
      ELSE 0
    END,
    'all_assignees', assignee_list,
    'individual_assignees', (SELECT ARRAY(SELECT jsonb_array_elements_text(task_assignees))),
    'teams', team_info,
    'completed_by', completed_assignees,
    'is_fully_complete', completed_count = total_assignees AND total_assignees > 0
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION can_user_edit_task(task_assignees jsonb, task_teams jsonb, task_created_by varchar, current_user_id varchar)
RETURNS boolean AS $$
BEGIN
  RETURN (
    task_created_by = current_user_id OR 
    is_task_assignee(COALESCE(task_assignees, '[]'::jsonb), COALESCE(task_teams, '[]'::jsonb), current_user_id)
  );
END;
$$ LANGUAGE plpgsql;

-- Enhanced mark_task_complete_individual with null safety (Migration 025)
CREATE OR REPLACE FUNCTION mark_task_complete_individual(
  task_id_param uuid,
  user_id_param varchar,
  completion_timestamp_param timestamp DEFAULT CURRENT_TIMESTAMP
)
RETURNS json AS $$
DECLARE
  task_record channel_tasks%ROWTYPE;
  updated_completions jsonb;
  new_completion_count integer;
  progress_result json;
BEGIN
  -- Get current task
  SELECT * INTO task_record FROM channel_tasks WHERE id = task_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Task not found');
  END IF;
  
  -- Check if user is assignee (handle null values gracefully)
  IF NOT is_task_assignee(
    COALESCE(task_record.assignees, '[]'::jsonb), 
    COALESCE(task_record.assigned_teams, '[]'::jsonb), 
    user_id_param
  ) THEN
    RETURN json_build_object('success', false, 'error', 'User not assigned to this task');
  END IF;
  
  -- Update individual completions
  updated_completions := COALESCE(task_record.individual_completions, '{}'::jsonb) || 
    jsonb_build_object(user_id_param, completion_timestamp_param);
  
  -- Count completions
  new_completion_count := jsonb_object_length(updated_completions);
  
  -- Update task
  UPDATE channel_tasks 
  SET 
    individual_completions = updated_completions,
    completion_count = new_completion_count,
    completed_at = CASE 
      WHEN COALESCE(assignment_mode, 'collaborative') = 'individual_response' THEN
        CASE WHEN new_completion_count = (get_task_completion_progress(
          COALESCE(assignees, '[]'::jsonb), 
          COALESCE(assigned_teams, '[]'::jsonb), 
          updated_completions
        )->>'total')::integer
        THEN completion_timestamp_param
        ELSE completed_at END
      ELSE completion_timestamp_param
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = task_id_param;
  
  -- Get updated progress info
  SELECT get_task_completion_progress(
    COALESCE(assignees, '[]'::jsonb), 
    COALESCE(assigned_teams, '[]'::jsonb), 
    individual_completions
  ) 
  INTO progress_result
  FROM channel_tasks 
  WHERE id = task_id_param;
  
  RETURN json_build_object(
    'success', true,
    'progress', progress_result,
    'completed_by_user', user_id_param,
    'timestamp', completion_timestamp_param
  );
END;
$$ LANGUAGE plpgsql;

-- Enhanced mark_task_incomplete_individual with null safety (Migration 025)
CREATE OR REPLACE FUNCTION mark_task_incomplete_individual(
  task_id_param uuid,
  user_id_param varchar
)
RETURNS json AS $$
DECLARE
  task_record channel_tasks%ROWTYPE;
  updated_completions jsonb;
  new_completion_count integer;
  progress_result json;
BEGIN
  -- Get current task
  SELECT * INTO task_record FROM channel_tasks WHERE id = task_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Task not found');
  END IF;
  
  -- Remove user from completions
  updated_completions := COALESCE(task_record.individual_completions, '{}'::jsonb) - user_id_param;
  new_completion_count := jsonb_object_length(updated_completions);
  
  -- Update task
  UPDATE channel_tasks 
  SET 
    individual_completions = updated_completions,
    completion_count = new_completion_count,
    completed_at = CASE 
      WHEN new_completion_count = 0 THEN NULL
      WHEN COALESCE(assignment_mode, 'collaborative') = 'individual_response' THEN
        CASE WHEN new_completion_count = (get_task_completion_progress(
          COALESCE(assignees, '[]'::jsonb), 
          COALESCE(assigned_teams, '[]'::jsonb), 
          updated_completions
        )->>'total')::integer
        THEN completed_at
        ELSE NULL END
      ELSE completed_at
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = task_id_param;
  
  -- Get updated progress info
  SELECT get_task_completion_progress(
    COALESCE(assignees, '[]'::jsonb), 
    COALESCE(assigned_teams, '[]'::jsonb), 
    individual_completions
  ) 
  INTO progress_result
  FROM channel_tasks 
  WHERE id = task_id_param;
  
  RETURN json_build_object(
    'success', true,
    'progress', progress_result,
    'uncompleted_by_user', user_id_param
  );
END;
$$ LANGUAGE plpgsql;

-- Google sync functions (Migration 023)
CREATE OR REPLACE FUNCTION generate_task_source_key(
  workspace_id_param UUID,
  thread_id_param UUID, 
  task_id_param UUID
)
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'syncup-' || workspace_id_param::text || '-' || thread_id_param::text || '-' || task_id_param::text;
END;
$$ LANGUAGE plpgsql;

-- Function to determine Google sync strategy based on task attributes
CREATE OR REPLACE FUNCTION determine_google_sync_strategy(
  task_start_date TIMESTAMP WITH TIME ZONE,
  task_end_date TIMESTAMP WITH TIME ZONE,
  task_due_date TIMESTAMP WITH TIME ZONE,
  task_start_time TIME,
  task_end_time TIME,
  task_is_all_day BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  has_time_span BOOLEAN;
  has_specific_times BOOLEAN;
  has_due_date BOOLEAN;
  is_multi_day BOOLEAN;
  strategy_result JSON;
BEGIN
  -- Determine task characteristics
  has_time_span := task_start_date IS NOT NULL AND task_end_date IS NOT NULL;
  has_specific_times := task_start_time IS NOT NULL AND task_end_time IS NOT NULL;
  has_due_date := task_due_date IS NOT NULL;
  is_multi_day := has_time_span AND (task_start_date::date != task_end_date::date);
  
  -- Apply expert-reviewed strategy algorithm
  IF has_specific_times THEN
    strategy_result := json_build_object('calendar', true, 'tasks', false, 'reason', 'Timed event', 'confidence', 'high');
  ELSIF is_multi_day AND NOT has_due_date THEN
    strategy_result := json_build_object('calendar', true, 'tasks', false, 'reason', 'Multi-day event', 'confidence', 'high');
  ELSIF has_due_date AND NOT has_time_span THEN
    strategy_result := json_build_object('calendar', false, 'tasks', true, 'reason', 'Deadline task', 'confidence', 'high');
  ELSIF NOT has_time_span AND NOT has_specific_times AND NOT has_due_date THEN
    strategy_result := json_build_object('calendar', false, 'tasks', true, 'reason', 'Unscheduled task', 'confidence', 'medium');
  ELSIF has_time_span AND has_due_date THEN
    strategy_result := json_build_object('calendar', true, 'tasks', true, 'reason', 'Project with timeline and deadline', 'confidence', 'high');
  ELSIF has_time_span THEN
    strategy_result := json_build_object('calendar', true, 'tasks', false, 'reason', 'Scheduled event', 'confidence', 'medium');
  ELSE
    strategy_result := json_build_object('calendar', false, 'tasks', true, 'reason', 'Default to tasks', 'confidence', 'low');
  END IF;
  
  RETURN strategy_result;
END;
$$ LANGUAGE plpgsql;

-- Function to map tags to Google Calendar color IDs
CREATE OR REPLACE FUNCTION map_tags_to_color_id(task_tags JSONB, task_priority VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  tag_text TEXT;
  color_mapping JSONB;
BEGIN
  -- Default color mapping
  color_mapping := '{
    "urgent": "11", "high": "6", "critical": "11", "bug": "11",
    "development": "1", "frontend": "1", "backend": "2", "design": "9",
    "marketing": "5", "meeting": "10", "review": "3", "testing": "7", "deployment": "4"
  }'::jsonb;
  
  -- Check tags for color matches
  IF task_tags IS NOT NULL THEN
    FOR tag_text IN SELECT jsonb_array_elements_text(task_tags) LOOP
      IF color_mapping ? lower(tag_text) THEN
        RETURN color_mapping->>lower(tag_text);
      END IF;
    END LOOP;
  END IF;
  
  -- Fallback to priority
  RETURN CASE lower(task_priority)
    WHEN 'urgent' THEN '11' WHEN 'high' THEN '6' WHEN 'medium' THEN '1' WHEN 'low' THEN '2' ELSE '1'
  END;
END;
$$ LANGUAGE plpgsql;

-- Tag color functions (Migration 024)
CREATE OR REPLACE FUNCTION generate_algorithmic_tag_color(tag_name_param VARCHAR)
RETURNS JSON AS $$
DECLARE
  tag_hash BIGINT;
  color_index INTEGER;
  color_palette JSON[];
  selected_color JSON;
BEGIN
  tag_hash := ABS(('x' || SUBSTR(MD5(LOWER(tag_name_param)), 1, 8))::bit(32)::int);
  color_palette := ARRAY[
    '{"name": "red", "hex": "#EF4444", "tailwind": "bg-red-500 text-white", "google": "11"}'::json,
    '{"name": "blue", "hex": "#3B82F6", "tailwind": "bg-blue-500 text-white", "google": "1"}'::json,
    '{"name": "green", "hex": "#22C55E", "tailwind": "bg-green-500 text-white", "google": "2"}'::json,
    '{"name": "purple", "hex": "#A855F7", "tailwind": "bg-purple-500 text-white", "google": "3"}'::json,
    '{"name": "orange", "hex": "#F97316", "tailwind": "bg-orange-500 text-white", "google": "6"}'::json
  ];
  color_index := (tag_hash % array_length(color_palette, 1)) + 1;
  selected_color := color_palette[color_index];
  RETURN selected_color;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_tag_color(tag_name_param VARCHAR, thread_id_param UUID DEFAULT NULL, workspace_id_param UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  override_color JSON;
  workspace_color JSON;
  algorithmic_color JSON;
BEGIN
  -- Check channel override
  IF thread_id_param IS NOT NULL THEN
    SELECT json_build_object('name', color_name, 'hex', color_hex, 'tailwind', color_tailwind, 'google', color_google_calendar, 'source', 'channel_override')
    INTO override_color FROM channel_tag_colors 
    WHERE thread_id = thread_id_param AND tag_name = tag_name_param AND is_active = true;
    IF override_color IS NOT NULL THEN RETURN override_color; END IF;
  END IF;
  
  -- Check workspace default
  IF workspace_id_param IS NOT NULL THEN
    SELECT json_build_object('name', color_name, 'hex', color_hex, 'tailwind', color_tailwind, 'google', color_google_calendar, 'source', 'workspace_default')
    INTO workspace_color FROM workspace_tag_colors 
    WHERE workspace_id = workspace_id_param AND tag_name = tag_name_param AND is_active = true;
    IF workspace_color IS NOT NULL THEN RETURN workspace_color; END IF;
  END IF;
  
  -- Algorithmic fallback
  algorithmic_color := generate_algorithmic_tag_color(tag_name_param);
  RETURN algorithmic_color || json_build_object('source', 'algorithmic');
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- VIEWS
-- =========================================================================

-- Enhanced view with multi-assignee support
CREATE OR REPLACE VIEW channel_tasks_with_progress AS
SELECT 
  ct.*,
  get_task_completion_progress(ct.assignees, ct.assigned_teams, ct.individual_completions) as progress_info,
  CASE 
    WHEN ct.assignment_mode = 'individual_response' THEN 
      (get_task_completion_progress(ct.assignees, ct.assigned_teams, ct.individual_completions)->>'is_fully_complete')::boolean
    ELSE 
      ct.completed_at IS NOT NULL
  END as is_complete,
  (get_task_completion_progress(ct.assignees, ct.assigned_teams, ct.individual_completions)->>'total')::integer as total_assignees,
  jsonb_array_length(ct.assignees) as individual_assignee_count,
  jsonb_array_length(ct.assigned_teams) as team_count
FROM channel_tasks ct;

-- User task assignments view
CREATE OR REPLACE VIEW user_task_assignments AS
SELECT DISTINCT
  ct.id as task_id, ct.title, ct.thread_id, u.id as user_id,
  'individual' as assignment_type, NULL as team_id, NULL as team_name,
  ct.assignment_mode, ct.requires_individual_response,
  CASE WHEN ct.individual_completions ? u.id THEN true ELSE false END as user_completed,
  ct.progress_info, ct.is_complete
FROM channel_tasks_with_progress ct
CROSS JOIN LATERAL jsonb_array_elements_text(ct.assignees) as u(id)
UNION ALL
SELECT DISTINCT
  ct.id as task_id, ct.title, ct.thread_id, wtm.user_id,
  'team' as assignment_type, wt.id as team_id, wt.display_name as team_name,
  ct.assignment_mode, ct.requires_individual_response,
  CASE WHEN ct.individual_completions ? wtm.user_id THEN true ELSE false END as user_completed,
  ct.progress_info, ct.is_complete
FROM channel_tasks_with_progress ct
CROSS JOIN LATERAL jsonb_array_elements_text(ct.assigned_teams) as t(id)
JOIN workspace_teams wt ON wt.id = t.id::integer
JOIN workspace_team_members wtm ON wtm.team_id = wt.id AND wtm.is_active = true;

-- =========================================================================
-- CONSTRAINTS
-- =========================================================================

DO $$ 
BEGIN
  -- Team constraints
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_team_name_format') THEN
    ALTER TABLE workspace_teams ADD CONSTRAINT check_team_name_format CHECK (name ~ '^[a-z0-9-]+$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_team_color_valid') THEN
    ALTER TABLE workspace_teams ADD CONSTRAINT check_team_color_valid CHECK (color IN ('blue', 'green', 'purple', 'orange', 'pink', 'teal', 'indigo', 'red', 'yellow', 'cyan', 'rose', 'violet'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_member_role_valid') THEN
    ALTER TABLE workspace_team_members ADD CONSTRAINT check_member_role_valid CHECK (role IN ('member', 'lead', 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_assignment_mode_valid') THEN
    ALTER TABLE channel_tasks ADD CONSTRAINT check_assignment_mode_valid CHECK (assignment_mode IN ('collaborative', 'individual_response'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_completion_count_valid') THEN
    ALTER TABLE channel_tasks ADD CONSTRAINT check_completion_count_valid CHECK (completion_count >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_sync_strategy_valid') THEN
    ALTER TABLE channel_tasks ADD CONSTRAINT check_sync_strategy_valid CHECK (sync_strategy IN ('smart', 'calendar', 'tasks', 'both', 'none'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_sync_retry_count_valid') THEN
    ALTER TABLE channel_tasks ADD CONSTRAINT check_sync_retry_count_valid CHECK (sync_retry_count >= 0 AND sync_retry_count <= 10);
  END IF;
END $$;

-- =========================================================================
-- SAMPLE DATA AND INITIALIZATION
-- =========================================================================

-- Insert Default Knowledge Roles
INSERT INTO knowledge_roles (name, description, permissions, scope_level) VALUES 
('Global Admin', 'Full administrative access across all knowledge', '{"create": true, "read": true, "update": true, "delete": true, "manage_permissions": true, "manage_categories": true, "moderate": true}'::jsonb, 'global'),
('Scope Admin', 'Administrative access within a specific scope', '{"create": true, "read": true, "update": true, "delete": true, "manage_permissions": true, "manage_categories": true, "moderate": true}'::jsonb, 'scope'),
('Category Moderator', 'Moderate specific categories', '{"create": true, "read": true, "update": true, "delete": false, "manage_categories": true, "moderate": true}'::jsonb, 'category'),
('Contributor', 'Can create and edit knowledge items', '{"create": true, "read": true, "update": true, "delete": false, "manage_permissions": false, "manage_categories": false, "moderate": false}'::jsonb, 'scope'),
('Viewer', 'Read-only access to knowledge items', '{"create": false, "read": true, "update": false, "delete": false, "manage_permissions": false, "manage_categories": false, "moderate": false}'::jsonb, 'scope')
ON CONFLICT (name, scope_level) DO NOTHING;

-- Create default workspace scope for existing workspaces
INSERT INTO knowledge_scopes (workspace_id, name, description, scope_type, created_by)
SELECT id, 'Default Workspace Knowledge', 'Default knowledge scope for workspace', 'workspace', 'system'
FROM workspaces
ON CONFLICT (workspace_id, name) DO NOTHING;

-- Insert sample teams
INSERT INTO workspace_teams (workspace_id, name, display_name, description, color, created_by)
SELECT 
  (SELECT id FROM workspaces ORDER BY created_at LIMIT 1),
  'kitchen-team', 'Kitchen Team', 'Culinary and food service team members', 'orange', 'system'
WHERE NOT EXISTS (SELECT 1 FROM workspace_teams WHERE name = 'kitchen-team')
AND EXISTS (SELECT 1 FROM workspaces);

INSERT INTO workspace_teams (workspace_id, name, display_name, description, color, created_by)
SELECT 
  (SELECT id FROM workspaces ORDER BY created_at LIMIT 1),
  'frontend-dev', 'Frontend Developers', 'Frontend development team', 'blue', 'system'
WHERE NOT EXISTS (SELECT 1 FROM workspace_teams WHERE name = 'frontend-dev')
AND EXISTS (SELECT 1 FROM workspaces);

INSERT INTO workspace_teams (workspace_id, name, display_name, description, color, created_by)
SELECT 
  (SELECT id FROM workspaces ORDER BY created_at LIMIT 1),
  'backend-dev', 'Backend Developers', 'Backend development team', 'green', 'system'
WHERE NOT EXISTS (SELECT 1 FROM workspace_teams WHERE name = 'backend-dev')
AND EXISTS (SELECT 1 FROM workspaces);

INSERT INTO workspace_teams (workspace_id, name, display_name, description, color, created_by)
SELECT 
  (SELECT id FROM workspaces ORDER BY created_at LIMIT 1),
  'design-team', 'Design Team', 'UI/UX designers and design system maintainers', 'purple', 'system'
WHERE NOT EXISTS (SELECT 1 FROM workspace_teams WHERE name = 'design-team')
AND EXISTS (SELECT 1 FROM workspaces);

INSERT INTO workspace_teams (workspace_id, name, display_name, description, color, created_by)
SELECT 
  (SELECT id FROM workspaces ORDER BY created_at LIMIT 1),
  'marketing', 'Marketing Team', 'Marketing, content, and outreach team', 'pink', 'system'
WHERE NOT EXISTS (SELECT 1 FROM workspace_teams WHERE name = 'marketing')
AND EXISTS (SELECT 1 FROM workspaces);

-- =========================================================================
-- PROJECT MANAGEMENT SYSTEM (Migration 016)
-- Complete project system with Google integration
-- =========================================================================

-- Projects table - integrates with existing workspace system
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Google integration fields
  google_calendar_id VARCHAR(255), -- Service account managed calendar
  google_drive_folder_id VARCHAR(255), -- Shared project folder
  
  -- Project settings (follows workspace pattern)
  settings JSONB DEFAULT '{}',
  
  -- Ownership and timestamps
  created_by VARCHAR(255) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT projects_name_length CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 255),
  CONSTRAINT projects_description_length CHECK (LENGTH(description) <= 1000)
);

-- Project members table - tracks project-specific roles within workspace context
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  
  -- Project-specific role (within workspace context)
  role VARCHAR(50) DEFAULT 'member', -- owner, admin, member, viewer
  
  -- Google integration permissions
  permissions JSONB DEFAULT '{}', -- calendar_access, drive_access, etc.
  
  -- Timestamps
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one membership per user per project
  UNIQUE(project_id, user_id)
);

-- Project tasks/events table - integrates with Google Calendar
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Task details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Scheduling
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  
  -- Assignment and status
  assigned_to VARCHAR(255) REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
  
  -- Google Calendar integration
  google_calendar_event_id VARCHAR(255), -- For 2-way sync
  calendar_type VARCHAR(20) DEFAULT 'project', -- project, personal, shared
  
  -- Dependencies and relationships
  parent_task_id UUID REFERENCES project_tasks(id),
  dependencies JSONB DEFAULT '[]', -- Array of task IDs this depends on
  
  -- Metadata
  tags JSONB DEFAULT '[]', -- Project tags for filtering/organization
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  
  -- Audit fields
  created_by VARCHAR(255) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT tasks_title_length CHECK (LENGTH(title) >= 1 AND LENGTH(title) <= 255),
  CONSTRAINT tasks_valid_dates CHECK (
    (start_date IS NULL OR end_date IS NULL OR start_date <= end_date) AND
    (start_date IS NULL OR due_date IS NULL OR start_date <= due_date)
  ),
  CONSTRAINT tasks_valid_hours CHECK (
    (estimated_hours IS NULL OR estimated_hours >= 0) AND
    (actual_hours IS NULL OR actual_hours >= 0)
  )
);

-- Project system indexes
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_to ON project_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_dates ON project_tasks(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_project_tasks_calendar_sync ON project_tasks(google_calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_parent ON project_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_created_at ON project_tasks(created_at DESC);

-- Insert default workspace sync configurations
INSERT INTO workspace_google_sync_config (workspace_id, google_calendar_enabled, google_tasks_enabled)
SELECT DISTINCT workspace_id, false, false
FROM channel_tasks
WHERE workspace_id NOT IN (SELECT workspace_id FROM workspace_google_sync_config)
ON CONFLICT (workspace_id) DO NOTHING;
