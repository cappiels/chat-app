-- Advanced Knowledge Management System for PostgreSQL
-- Converted from SQLite to proper PostgreSQL syntax

-- Drop the old simple knowledge tables if they exist
DROP TABLE IF EXISTS knowledge_views CASCADE;
DROP TABLE IF EXISTS knowledge_item_tags CASCADE;
DROP TABLE IF EXISTS knowledge_tags CASCADE;
DROP TABLE IF EXISTS knowledge_items CASCADE;
DROP TABLE IF EXISTS knowledge_categories CASCADE;

-- Knowledge Scopes (defines the boundary/context for knowledge)
CREATE TABLE IF NOT EXISTS knowledge_scopes (
    id SERIAL PRIMARY KEY,
    workspace_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    scope_type VARCHAR(50) CHECK(scope_type IN ('channel', 'workspace', 'collection', 'cross-channel', 'custom')) NOT NULL,
    source_thread_id UUID, -- For channel-scoped knowledge
    parent_scope_id INTEGER, -- For hierarchical scopes
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB, -- Flexible settings (auto-categorization rules, etc.)
    created_by VARCHAR(128) NOT NULL, -- Firebase UID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, scope_level)
);

-- Knowledge Scope Members (who has access to what scope with what role)
CREATE TABLE IF NOT EXISTS knowledge_scope_members (
    id SERIAL PRIMARY KEY,
    scope_id INTEGER NOT NULL,
    user_id VARCHAR(128) NOT NULL, -- Firebase UID
    role_id INTEGER NOT NULL,
    granted_by VARCHAR(128) NOT NULL, -- Firebase UID of person who granted access
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
    auto_categorization_rules JSONB, -- AI/ML rules for auto-categorization
    parent_category_id INTEGER, -- For hierarchical categories
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(128) NOT NULL, -- Firebase UID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_category_id) REFERENCES knowledge_categories(id) ON DELETE SET NULL
);

-- Category Administrators (topic experts who manage specific categories)
CREATE TABLE IF NOT EXISTS knowledge_category_admins (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL,
    user_id VARCHAR(128) NOT NULL, -- Firebase UID
    admin_level VARCHAR(20) CHECK(admin_level IN ('owner', 'moderator', 'contributor')) DEFAULT 'moderator',
    permissions JSONB, -- Specific permissions for this category
    appointed_by VARCHAR(128) NOT NULL, -- Firebase UID
    appointed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (category_id) REFERENCES knowledge_categories(id) ON DELETE CASCADE,
    UNIQUE(category_id, user_id)
);

-- Advanced Knowledge Items with Multi-Scope Support
CREATE TABLE IF NOT EXISTS knowledge_items (
    id SERIAL PRIMARY KEY,
    workspace_id UUID NOT NULL,
    primary_scope_id INTEGER NOT NULL, -- Main scope this belongs to
    created_by VARCHAR(128) NOT NULL, -- Firebase UID
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
    approved_by VARCHAR(128), -- Firebase UID
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- AI/ML fields
    ai_summary TEXT, -- AI-generated summary
    ai_tags JSONB, -- AI-suggested tags
    ai_confidence_score REAL, -- Confidence in AI suggestions
    
    -- Temporal fields
    effective_date TIMESTAMP WITH TIME ZONE, -- When this knowledge becomes effective
    expiry_date TIMESTAMP WITH TIME ZONE, -- When this knowledge expires
    last_verified_at TIMESTAMP WITH TIME ZONE, -- When this was last verified as accurate
    verified_by VARCHAR(128), -- Firebase UID of verifier
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
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
    added_by VARCHAR(128) NOT NULL, -- Firebase UID
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
    created_by VARCHAR(128) NOT NULL, -- Firebase UID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE SET NULL,
    UNIQUE(workspace_id, scope_id, name)
);

-- Knowledge Item Tags (Many-to-Many with metadata)
CREATE TABLE IF NOT EXISTS knowledge_item_tags (
    knowledge_item_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    added_by VARCHAR(128) NOT NULL, -- Firebase UID
    confidence_score REAL DEFAULT 1.0, -- For AI-suggested tags
    is_ai_suggested BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
    auto_include_rules JSONB, -- Rules for automatically including items
    created_by VARCHAR(128) NOT NULL, -- Firebase UID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE CASCADE
);

-- Knowledge Collection Items
CREATE TABLE IF NOT EXISTS knowledge_collection_items (
    collection_id INTEGER NOT NULL,
    knowledge_item_id INTEGER NOT NULL,
    added_by VARCHAR(128) NOT NULL, -- Firebase UID
    sort_order INTEGER DEFAULT 0,
    notes TEXT, -- Curator's notes about why this item is in the collection
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (collection_id, knowledge_item_id),
    FOREIGN KEY (collection_id) REFERENCES knowledge_collections(id) ON DELETE CASCADE,
    FOREIGN KEY (knowledge_item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE
);

-- Advanced Analytics and Views
CREATE TABLE IF NOT EXISTS knowledge_analytics (
    id SERIAL PRIMARY KEY,
    knowledge_item_id INTEGER NOT NULL,
    user_id VARCHAR(128) NOT NULL, -- Firebase UID
    action_type VARCHAR(20) CHECK(action_type IN ('view', 'save', 'share', 'upvote', 'downvote', 'edit', 'comment')) NOT NULL,
    scope_id INTEGER, -- Which scope they accessed it from
    metadata JSONB, -- Additional context (time spent, search query, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (knowledge_item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
    FOREIGN KEY (scope_id) REFERENCES knowledge_scopes(id) ON DELETE SET NULL
);

-- Knowledge Comments and Discussions
CREATE TABLE IF NOT EXISTS knowledge_comments (
    id SERIAL PRIMARY KEY,
    knowledge_item_id INTEGER NOT NULL,
    user_id VARCHAR(128) NOT NULL, -- Firebase UID
    parent_comment_id INTEGER, -- For threaded discussions
    content TEXT NOT NULL,
    is_suggestion BOOLEAN DEFAULT FALSE,
    suggestion_status VARCHAR(20) CHECK(suggestion_status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    upvotes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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

-- Update triggers for PostgreSQL
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_knowledge_items_updated_at BEFORE UPDATE ON knowledge_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_categories_updated_at BEFORE UPDATE ON knowledge_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_collections_updated_at BEFORE UPDATE ON knowledge_collections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_comments_updated_at BEFORE UPDATE ON knowledge_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update tag usage count
CREATE OR REPLACE FUNCTION update_knowledge_tag_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE knowledge_tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_knowledge_tag_usage_trigger AFTER INSERT ON knowledge_item_tags FOR EACH ROW EXECUTE FUNCTION update_knowledge_tag_usage();

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

CREATE TRIGGER update_knowledge_views_count_trigger AFTER INSERT ON knowledge_analytics FOR EACH ROW EXECUTE FUNCTION update_knowledge_views_count();
