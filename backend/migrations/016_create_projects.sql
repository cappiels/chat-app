-- Projects table - integrates with existing workspace system
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Google integration fields
    google_calendar_id VARCHAR(255), -- Service account managed calendar
    google_drive_folder_id VARCHAR(255), -- Shared project folder
    
    -- Project settings (follows workspace pattern)
    settings JSONB DEFAULT '{}',
    
    -- Ownership and timestamps
    created_by VARCHAR(128) NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT projects_name_length CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 255),
    CONSTRAINT projects_description_length CHECK (LENGTH(description) <= 1000)
);

-- Project members table - tracks project-specific roles within workspace context
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL REFERENCES users(id),
    
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Task details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Scheduling
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    
    -- Assignment and status
    assigned_to VARCHAR(128) REFERENCES users(id),
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
    created_by VARCHAR(128) NOT NULL REFERENCES users(id),
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

-- Create indexes for performance
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

-- Add project reference to existing knowledge_articles table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'knowledge_articles') THEN
        ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_knowledge_articles_project ON knowledge_articles(project_id);
    ELSE
        RAISE NOTICE 'knowledge_articles table does not exist yet - skipping project_id column addition';
    END IF;
END $$;

-- Insert initial project settings template
INSERT INTO projects (workspace_id, name, description, created_by, settings) 
VALUES (
    (SELECT id FROM workspaces LIMIT 1), -- Use first workspace for demo
    'Syncup Migration',
    'Integration of Syncup project management features into chat-app',
    (SELECT id FROM users LIMIT 1), -- Use first user as creator
    '{
        "calendar_integration": true,
        "google_drive_enabled": true,
        "default_task_status": "pending",
        "notification_preferences": {
            "task_assignments": true,
            "due_date_reminders": true,
            "project_updates": true
        }
    }'::jsonb
) ON CONFLICT DO NOTHING;

-- Add the project creator as owner
INSERT INTO project_members (project_id, user_id, role, permissions)
SELECT 
    p.id,
    p.created_by,
    'owner',
    '{
        "calendar_access": true,
        "drive_access": true,
        "manage_members": true,
        "manage_tasks": true
    }'::jsonb
FROM projects p
WHERE p.name = 'Syncup Migration'
ON CONFLICT DO NOTHING;
