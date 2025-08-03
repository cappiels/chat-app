-- Advanced Knowledge Management System with Flexible Permissions
-- This replaces the simple personal/company model with sophisticated RBAC

-- Drop the old simple knowledge tables if they exist
DROP TABLE IF EXISTS knowledge_views;
DROP TABLE IF EXISTS knowledge_item_tags;
DROP TABLE IF EXISTS knowledge_tags;
DROP TABLE IF EXISTS knowledge_items;
DROP TABLE IF EXISTS knowledge_categories;

-- Knowledge Scopes (defines the boundary/context for knowledge)
CREATE TABLE IF NOT EXISTS knowledge_scopes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    scope_type TEXT CHECK(scope_type IN ('channel', 'workspace', 'collection', 'cross-channel', 'custom')) NOT NULL,
    source_thread_id INTEGER, -- For channel-scoped knowledge
    parent_scope_id INTEGER, -- For hierarchical scopes
    is_active BOOLEAN DEFAULT TRUE,
    settings JSON, -- Flexible settings (auto-categorization rules, etc.)
    created_by TEXT NOT NULL, -- Firebase UID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (source_thread_id) REFERENCES threads(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_scope_id) REFERENCES knowledge_scopes(id) ON DELETE SET NULL,
    UNIQUE(workspace_id, name)
);

-- Knowledge Roles (defines what users can do within a scope)
CREATE TABLE IF NOT EXISTS knowledge_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    permissions JSON NOT NULL, -- Flexible permissions object
    scope_level TEXT CHECK(scope_level IN ('scope', 'category', 'global')) DEFAULT 'scope',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, scope_level)
);

-- Knowledge Scope Members (who has access to what scope with what role)
CREATE TABLE IF NOT EXISTS knowledge_scope_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope_id INTEGER NOT NULL,
    user_id TEXT NOT NULL, -- Firebase UID
    role_id INTEGER NOT NULL,
    granted_by TEXT NOT NULL, -- Firebase UID of person who granted access
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME, -- Optional expiration
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES knowledge_roles(id) ON DELETE CASCADE,
    UNIQUE(scope_id, user_id)
);

-- Advanced Knowledge Categories with Administrators
CREATE TABLE IF NOT EXISTS knowledge_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL,
    scope_id INTEGER, -- Categories can be scoped to specific knowledge scopes
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    icon TEXT, -- Icon identifier
    is_system_category BOOLEAN DEFAULT FALSE, -- System vs user-created
    auto_categorization_rules JSON, -- AI/ML rules for auto-categorization
    parent_category_id INTEGER, -- For hierarchical categories
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT NOT NULL, -- Firebase UID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_category_id) REFERENCES knowledge_categories(id) ON DELETE SET NULL
);

-- Category Administrators (topic experts who manage specific categories)
CREATE TABLE IF NOT EXISTS knowledge_category_admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    user_id TEXT NOT NULL, -- Firebase UID
    admin_level TEXT CHECK(admin_level IN ('owner', 'moderator', 'contributor')) DEFAULT 'moderator',
    permissions JSON, -- Specific permissions for this category
    appointed_by TEXT NOT NULL, -- Firebase UID
    appointed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES knowledge_categories(id) ON DELETE CASCADE,
    UNIQUE(category_id, user_id)
);

-- Advanced Knowledge Items with Multi-Scope Support
CREATE TABLE IF NOT EXISTS knowledge_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL,
    primary_scope_id INTEGER NOT NULL, -- Main scope this belongs to
    created_by TEXT NOT NULL, -- Firebase UID
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'markdown', -- markdown, html, plaintext
    category_id INTEGER,
    
    -- Source tracking
    source_message_id INTEGER,
    source_thread_id INTEGER,
    source_type TEXT CHECK(source_type IN ('message', 'manual', 'import', 'ai_generated')) DEFAULT 'manual',
    
    -- Engagement metrics
    views_count INTEGER DEFAULT 0,
    saves_count INTEGER DEFAULT 0, -- How many people saved this
    upvotes_count INTEGER DEFAULT 0,
    downvotes_count INTEGER DEFAULT 0,
    
    -- Flags and status
    is_featured BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    is_template BOOLEAN DEFAULT FALSE,
    approval_status TEXT CHECK(approval_status IN ('draft', 'pending', 'approved', 'rejected')) DEFAULT 'approved',
    approved_by TEXT, -- Firebase UID
    approved_at DATETIME,
    
    -- AI/ML fields
    ai_summary TEXT, -- AI-generated summary
    ai_tags JSON, -- AI-suggested tags
    ai_confidence_score REAL, -- Confidence in AI suggestions
    
    -- Temporal fields
    effective_date DATETIME, -- When this knowledge becomes effective
    expiry_date DATETIME, -- When this knowledge expires
    last_verified_at DATETIME, -- When this was last verified as accurate
    verified_by TEXT, -- Firebase UID of verifier
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
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
    added_by TEXT NOT NULL, -- Firebase UID
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_primary BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (knowledge_item_id, scope_id),
    FOREIGN KEY (knowledge_item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
    FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE CASCADE
);

-- Advanced Tagging System
CREATE TABLE IF NOT EXISTS knowledge_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL,
    scope_id INTEGER, -- Tags can be scoped
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    is_system_tag BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_by TEXT NOT NULL, -- Firebase UID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE SET NULL,
    UNIQUE(workspace_id, scope_id, name)
);

-- Knowledge Item Tags (Many-to-Many with metadata)
CREATE TABLE IF NOT EXISTS knowledge_item_tags (
    knowledge_item_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    added_by TEXT NOT NULL, -- Firebase UID
    confidence_score REAL DEFAULT 1.0, -- For AI-suggested tags
    is_ai_suggested BOOLEAN DEFAULT FALSE,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (knowledge_item_id, tag_id),
    FOREIGN KEY (knowledge_item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES knowledge_tags(id) ON DELETE CASCADE
);

-- Knowledge Collections (curated groups of knowledge items)
CREATE TABLE IF NOT EXISTS knowledge_collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL,
    scope_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cover_image TEXT, -- URL or path to cover image
    is_public BOOLEAN DEFAULT TRUE,
    is_collaborative BOOLEAN DEFAULT TRUE,
    auto_include_rules JSON, -- Rules for automatically including items
    created_by TEXT NOT NULL, -- Firebase UID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE CASCADE
);

-- Knowledge Collection Items
CREATE TABLE IF NOT EXISTS knowledge_collection_items (
    collection_id INTEGER NOT NULL,
    knowledge_item_id INTEGER NOT NULL,
    added_by TEXT NOT NULL, -- Firebase UID
    sort_order INTEGER DEFAULT 0,
    notes TEXT, -- Curator's notes about why this item is in the collection
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_id, knowledge_item_id),
    FOREIGN KEY (collection_id) REFERENCES knowledge_collections(id) ON DELETE CASCADE,
    FOREIGN KEY (knowledge_item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE
);

-- Advanced Analytics and Views
CREATE TABLE IF NOT EXISTS knowledge_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    knowledge_item_id INTEGER NOT NULL,
    user_id TEXT NOT NULL, -- Firebase UID
    action_type TEXT CHECK(action_type IN ('view', 'save', 'share', 'upvote', 'downvote', 'edit', 'comment')) NOT NULL,
    scope_id INTEGER, -- Which scope they accessed it from
    metadata JSON, -- Additional context (time spent, search query, etc.)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (knowledge_item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
    FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE SET NULL
);

-- Knowledge Comments and Discussions
CREATE TABLE IF NOT EXISTS knowledge_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    knowledge_item_id INTEGER NOT NULL,
    user_id TEXT NOT NULL, -- Firebase UID
    parent_comment_id INTEGER, -- For threaded discussions
    content TEXT NOT NULL,
    is_suggestion BOOLEAN DEFAULT FALSE,
    suggestion_status TEXT CHECK(suggestion_status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    upvotes_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (knowledge_item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES knowledge_comments(id) ON DELETE CASCADE
);

-- Performance Indexes
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

-- Insert Default Knowledge Roles
INSERT OR IGNORE INTO knowledge_roles (name, description, permissions, scope_level) VALUES 
('Global Admin', 'Full administrative access across all knowledge', '{"create": true, "read": true, "update": true, "delete": true, "manage_permissions": true, "manage_categories": true, "moderate": true}', 'global'),
('Scope Admin', 'Administrative access within a specific scope', '{"create": true, "read": true, "update": true, "delete": true, "manage_permissions": true, "manage_categories": true, "moderate": true}', 'scope'),
('Category Moderator', 'Moderate specific categories', '{"create": true, "read": true, "update": true, "delete": false, "manage_categories": true, "moderate": true}', 'category'),
('Contributor', 'Can create and edit knowledge items', '{"create": true, "read": true, "update": true, "delete": false, "manage_permissions": false, "manage_categories": false, "moderate": false}', 'scope'),
('Viewer', 'Read-only access to knowledge items', '{"create": false, "read": true, "update": false, "delete": false, "manage_permissions": false, "manage_categories": false, "moderate": false}', 'scope');

-- Create default workspace scope for existing workspaces
INSERT OR IGNORE INTO knowledge_scopes (workspace_id, name, description, scope_type, created_by)
SELECT id, 'Default Workspace Knowledge', 'Default knowledge scope for workspace', 'workspace', 'system'
FROM workspaces;

-- Update triggers
CREATE TRIGGER IF NOT EXISTS update_knowledge_items_timestamp 
    AFTER UPDATE ON knowledge_items
    FOR EACH ROW
BEGIN
    UPDATE knowledge_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_knowledge_categories_timestamp 
    AFTER UPDATE ON knowledge_categories
    FOR EACH ROW
BEGIN
    UPDATE knowledge_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_knowledge_tag_usage 
    AFTER INSERT ON knowledge_item_tags
    FOR EACH ROW
BEGIN
    UPDATE knowledge_tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
END;

CREATE TRIGGER IF NOT EXISTS update_knowledge_views_count 
    AFTER INSERT ON knowledge_analytics
    FOR EACH ROW
    WHEN NEW.action_type = 'view'
BEGIN
    UPDATE knowledge_items SET views_count = views_count + 1 WHERE id = NEW.knowledge_item_id;
END;
