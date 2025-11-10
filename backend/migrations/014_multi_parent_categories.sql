-- Migration 014: Multi-Parent Category System
-- Upgrade knowledge categories to support multiple parents (many-to-many)

-- Create many-to-many table for category relationships
CREATE TABLE IF NOT EXISTS knowledge_category_relationships (
    id SERIAL PRIMARY KEY, -- FIXED: SERIAL not UUID
    child_category_id INTEGER NOT NULL, -- FIXED: INTEGER to match knowledge_categories.id
    parent_category_id INTEGER NOT NULL, -- FIXED: INTEGER to match knowledge_categories.id
    relationship_type TEXT CHECK(relationship_type IN ('hierarchy', 'cross_reference', 'related')) DEFAULT 'hierarchy',
    weight REAL DEFAULT 1.0, -- For determining primary parent, relevance scoring
    created_by VARCHAR(128) NOT NULL, -- Firebase UID
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_category_id) REFERENCES knowledge_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_category_id) REFERENCES knowledge_categories(id) ON DELETE CASCADE,
    UNIQUE(child_category_id, parent_category_id, relationship_type),
    CHECK(child_category_id != parent_category_id) -- Prevent self-reference
);

-- Add fields to knowledge_categories for multi-parent support
ALTER TABLE knowledge_categories 
ADD COLUMN IF NOT EXISTS is_multi_parent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS primary_parent_id INTEGER, -- FIXED: INTEGER to match knowledge_categories.id
ADD COLUMN IF NOT EXISTS breadcrumb_path TEXT, -- Cached breadcrumb for performance
ADD CONSTRAINT fk_primary_parent FOREIGN KEY (primary_parent_id) REFERENCES knowledge_categories(id) ON DELETE SET NULL;

-- Categories can have multiple parent admins (inherit from all parents)
CREATE TABLE IF NOT EXISTS knowledge_category_inherited_admins (
    category_id INTEGER NOT NULL, -- FIXED: INTEGER to match knowledge_categories.id
    inherited_from_category_id INTEGER NOT NULL, -- FIXED: INTEGER to match knowledge_categories.id
    user_id VARCHAR(128) NOT NULL, -- Firebase UID
    admin_level TEXT CHECK(admin_level IN ('owner', 'moderator', 'contributor')) NOT NULL,
    is_direct BOOLEAN DEFAULT FALSE, -- Direct assignment vs inherited
    inheritance_path INTEGER[], -- FIXED: INTEGER[] for category IDs
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (category_id, inherited_from_category_id, user_id),
    FOREIGN KEY (category_id) REFERENCES knowledge_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (inherited_from_category_id) REFERENCES knowledge_categories(id) ON DELETE CASCADE
);

-- Update knowledge_items to support multiple categories
ALTER TABLE knowledge_items 
ADD COLUMN IF NOT EXISTS primary_category_id INTEGER, -- FIXED: INTEGER to match knowledge_categories.id
ADD CONSTRAINT fk_primary_category FOREIGN KEY (primary_category_id) REFERENCES knowledge_categories(id) ON DELETE SET NULL;

-- Many-to-many for knowledge items in multiple categories
CREATE TABLE IF NOT EXISTS knowledge_item_categories (
    knowledge_item_id INTEGER NOT NULL, -- FIXED: INTEGER to match knowledge_items.id (SERIAL)
    category_id INTEGER NOT NULL, -- FIXED: INTEGER to match knowledge_categories.id
    is_primary BOOLEAN DEFAULT FALSE,
    added_by VARCHAR(128) NOT NULL, -- Firebase UID
    relevance_score REAL DEFAULT 1.0, -- How relevant is this item to this category
    added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (knowledge_item_id, category_id),
    FOREIGN KEY (knowledge_item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES knowledge_categories(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_category_relationships_child ON knowledge_category_relationships (child_category_id);
CREATE INDEX IF NOT EXISTS idx_category_relationships_parent ON knowledge_category_relationships (parent_category_id);
CREATE INDEX IF NOT EXISTS idx_category_relationships_type ON knowledge_category_relationships (relationship_type);
CREATE INDEX IF NOT EXISTS idx_category_inherited_admins_category ON knowledge_category_inherited_admins (category_id);
CREATE INDEX IF NOT EXISTS idx_category_inherited_admins_user ON knowledge_category_inherited_admins (user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_item_categories_item ON knowledge_item_categories (knowledge_item_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_item_categories_category ON knowledge_item_categories (category_id);

-- Function to update breadcrumb paths for categories
CREATE OR REPLACE FUNCTION update_category_breadcrumbs()
RETURNS TRIGGER AS $$
DECLARE
    breadcrumbs TEXT[];
    parent_names TEXT[];
BEGIN
    -- Get all parent category names for breadcrumb
    SELECT ARRAY_AGG(DISTINCT p.name ORDER BY p.name) INTO parent_names
    FROM knowledge_category_relationships kcr
    JOIN knowledge_categories p ON kcr.parent_category_id = p.id
    WHERE kcr.child_category_id = NEW.child_category_id 
    AND kcr.relationship_type = 'hierarchy';
    
    -- Update breadcrumb path for child category
    IF parent_names IS NOT NULL THEN
        UPDATE knowledge_categories 
        SET breadcrumb_path = array_to_string(parent_names || NEW.child_category_id::text, ' > ')
        WHERE id = NEW.child_category_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_category_breadcrumbs_trigger 
    AFTER INSERT OR UPDATE ON knowledge_category_relationships
    FOR EACH ROW
    EXECUTE FUNCTION update_category_breadcrumbs();

-- Function to calculate inherited permissions across multiple parents
CREATE OR REPLACE FUNCTION calculate_inherited_permissions(category_id INTEGER, user_id VARCHAR(128))
RETURNS JSONB AS $$
DECLARE
    max_permissions JSONB := '{"create": false, "read": false, "update": false, "delete": false, "manage_permissions": false, "manage_categories": false, "moderate": false}';
    parent_perms JSONB;
    perm_key TEXT;
BEGIN
    -- Get highest permission level from all parent categories
    FOR parent_perms IN
        SELECT kca.permissions
        FROM knowledge_category_relationships kcr
        JOIN knowledge_category_admins kca ON kcr.parent_category_id = kca.category_id
        WHERE kcr.child_category_id = category_id 
        AND kca.user_id = user_id
        AND kcr.relationship_type = 'hierarchy'
    LOOP
        -- Merge permissions, taking the highest level for each permission
        FOR perm_key IN SELECT jsonb_object_keys(parent_perms) LOOP
            IF (parent_perms ->> perm_key)::boolean = true THEN
                max_permissions := jsonb_set(max_permissions, ARRAY[perm_key], 'true'::jsonb);
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN max_permissions;
END;
$$ LANGUAGE plpgsql;

-- Materialized view for category hierarchy (performance optimization)
CREATE MATERIALIZED VIEW IF NOT EXISTS knowledge_category_hierarchy AS
WITH RECURSIVE category_tree AS (
    -- Base case: top-level categories (no parents)
    SELECT 
        kc.id,
        kc.name,
        kc.workspace_id,
        kc.color,
        kc.icon,
        0 as level,
        ARRAY[kc.id] as path,
        CAST(kc.name AS TEXT) as breadcrumb
    FROM knowledge_categories kc
    WHERE NOT EXISTS (
        SELECT 1 FROM knowledge_category_relationships kcr 
        WHERE kcr.child_category_id = kc.id 
        AND kcr.relationship_type = 'hierarchy'
    )
    AND kc.is_active = true
    
    UNION ALL
    
    -- Recursive case: children with their full paths
    SELECT 
        kc.id,
        kc.name,
        kc.workspace_id,
        kc.color,
        kc.icon,
        ct.level + 1,
        ct.path || kc.id,
        ct.breadcrumb || ' > ' || CAST(kc.name AS TEXT)
    FROM knowledge_categories kc
    JOIN knowledge_category_relationships kcr ON kc.id = kcr.child_category_id
    JOIN category_tree ct ON kcr.parent_category_id = ct.id
    WHERE kcr.relationship_type = 'hierarchy'
    AND kc.is_active = true
    AND NOT (kc.id = ANY(ct.path)) -- Prevent circular references
)
SELECT * FROM category_tree;

-- Index for materialized view
CREATE INDEX IF NOT EXISTS idx_category_hierarchy_workspace ON knowledge_category_hierarchy (workspace_id);
CREATE INDEX IF NOT EXISTS idx_category_hierarchy_level ON knowledge_category_hierarchy (level);

-- Function to refresh materialized view when categories change
CREATE OR REPLACE FUNCTION refresh_category_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW knowledge_category_hierarchy;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_category_hierarchy_on_change
    AFTER INSERT OR UPDATE OR DELETE ON knowledge_categories
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_category_hierarchy();

CREATE TRIGGER refresh_category_hierarchy_on_relationship_change
    AFTER INSERT OR UPDATE OR DELETE ON knowledge_category_relationships
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_category_hierarchy();

-- Sample multi-parent category data
INSERT INTO knowledge_categories (workspace_id, name, description, color, icon, created_by) VALUES
((SELECT id FROM workspaces LIMIT 1), 'Food', 'All food-related knowledge', '#FF6B35', '🍔', 'system'),
((SELECT id FROM workspaces LIMIT 1), 'Burritos', 'Burrito knowledge and recipes', '#8B5A2B', '🌯', 'system'),
((SELECT id FROM workspaces LIMIT 1), 'Sandwiches', 'Sandwich knowledge and recipes', '#D2691E', '🥪', 'system'),
((SELECT id FROM workspaces LIMIT 1), 'Burrito/Sandwich Expo', 'Events and expo coverage for both burritos and sandwiches', '#FF4500', '🎪', 'system')
ON CONFLICT DO NOTHING;

-- Create the multi-parent relationship example
INSERT INTO knowledge_category_relationships (child_category_id, parent_category_id, relationship_type, weight, created_by)
SELECT 
    (SELECT id FROM knowledge_categories WHERE name = 'Burrito/Sandwich Expo' LIMIT 1),
    (SELECT id FROM knowledge_categories WHERE name = 'Burritos' LIMIT 1),
    'hierarchy',
    0.6, -- 60% burrito-related
    'system'
WHERE EXISTS (SELECT 1 FROM knowledge_categories WHERE name = 'Burrito/Sandwich Expo')
AND EXISTS (SELECT 1 FROM knowledge_categories WHERE name = 'Burritos')
ON CONFLICT DO NOTHING;

INSERT INTO knowledge_category_relationships (child_category_id, parent_category_id, relationship_type, weight, created_by)
SELECT 
    (SELECT id FROM knowledge_categories WHERE name = 'Burrito/Sandwich Expo' LIMIT 1),
    (SELECT id FROM knowledge_categories WHERE name = 'Sandwiches' LIMIT 1),
    'hierarchy',
    0.4, -- 40% sandwich-related
    'system'
WHERE EXISTS (SELECT 1 FROM knowledge_categories WHERE name = 'Burrito/Sandwich Expo')
AND EXISTS (SELECT 1 FROM knowledge_categories WHERE name = 'Sandwiches')
ON CONFLICT DO NOTHING;
