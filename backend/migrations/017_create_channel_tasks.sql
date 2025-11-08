-- Channel Tasks Migration - Simple calendar/timeline functionality for channels
-- Each channel automatically gets calendar and timeline capabilities

-- Channel tasks table - directly references existing threads (channels) table
CREATE TABLE IF NOT EXISTS channel_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    
    -- Task details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Scheduling (compatible with syncup calendar views)
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    
    -- Assignment and status
    assigned_to VARCHAR(128) REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    
    -- Google Calendar integration (per-channel)
    google_calendar_event_id VARCHAR(255), -- For 2-way sync with channel's Google Calendar
    calendar_type VARCHAR(20) DEFAULT 'channel', -- channel, personal, shared
    
    -- Timeline/Dependencies (for Gantt chart view)
    parent_task_id UUID REFERENCES channel_tasks(id),
    dependencies JSONB DEFAULT '[]', -- Array of task IDs this depends on [{task_id: "uuid", type: "FS"}]
    
    -- Metadata
    tags JSONB DEFAULT '[]', -- Task tags for filtering/organization
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    
    -- All-day events support (from syncup calendar)
    is_all_day BOOLEAN DEFAULT false,
    start_time TIME, -- For non-all-day events
    end_time TIME,   -- For non-all-day events
    
    -- Audit fields
    created_by VARCHAR(128) NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT channel_tasks_title_length CHECK (LENGTH(title) >= 1 AND LENGTH(title) <= 255),
    CONSTRAINT channel_tasks_valid_dates CHECK (
        (start_date IS NULL OR end_date IS NULL OR start_date <= end_date) AND
        (start_date IS NULL OR due_date IS NULL OR start_date <= due_date)
    ),
    CONSTRAINT channel_tasks_valid_hours CHECK (
        (estimated_hours IS NULL OR estimated_hours >= 0) AND
        (actual_hours IS NULL OR actual_hours >= 0)
    )
);

-- Optional: Extend threads table with Google Calendar integration
-- This allows each channel to have its own Google Calendar
ALTER TABLE threads ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR(255);
ALTER TABLE threads ADD COLUMN IF NOT EXISTS google_drive_folder_id VARCHAR(255);
ALTER TABLE threads ADD COLUMN IF NOT EXISTS calendar_settings JSONB DEFAULT '{}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_channel_tasks_thread ON channel_tasks(thread_id);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_assigned_to ON channel_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_status ON channel_tasks(status);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_dates ON channel_tasks(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_calendar_sync ON channel_tasks(google_calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_parent ON channel_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_created_at ON channel_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_priority ON channel_tasks(priority);

-- Add Google Calendar support to threads table indexes
CREATE INDEX IF NOT EXISTS idx_threads_google_calendar ON threads(google_calendar_id);

-- Insert sample tasks into the existing #general channel for testing
-- Find the #general channel and add some sample tasks
DO $$
DECLARE
    general_thread_id UUID;
    sample_user_id VARCHAR(128);
BEGIN
    -- Find the #general channel (or first available channel)
    SELECT id INTO general_thread_id
    FROM threads 
    WHERE name = 'general' OR type = 'channel'
    LIMIT 1;
    
    -- Find a user to assign tasks to
    SELECT id INTO sample_user_id
    FROM users
    LIMIT 1;
    
    IF general_thread_id IS NOT NULL AND sample_user_id IS NOT NULL THEN
        -- Insert sample tasks for testing calendar/timeline views
        INSERT INTO channel_tasks (
            thread_id, title, description, start_date, end_date, 
            assigned_to, status, priority, created_by, tags
        ) VALUES
        (
            general_thread_id,
            'Test Calendar Integration',
            'Verify that channel calendar view loads and displays tasks correctly',
            CURRENT_DATE + INTERVAL '1 day',
            CURRENT_DATE + INTERVAL '2 days',
            sample_user_id,
            'pending',
            'high',
            sample_user_id,
            '["testing", "calendar", "integration"]'
        ),
        (
            general_thread_id,
            'Test Timeline View',
            'Verify that channel timeline/Gantt view works with task dependencies',
            CURRENT_DATE + INTERVAL '3 days',
            CURRENT_DATE + INTERVAL '5 days',
            sample_user_id,
            'in_progress',
            'medium',
            sample_user_id,
            '["testing", "timeline", "gantt"]'
        ),
        (
            general_thread_id,
            'Test All-Day Event',
            'Verify all-day events display correctly in calendar view',
            CURRENT_DATE,
            CURRENT_DATE,
            sample_user_id,
            'pending',
            'low',
            sample_user_id,
            '["testing", "all-day", "calendar"]'
        );
        
        -- Update the all-day event
        UPDATE channel_tasks 
        SET is_all_day = true, start_time = NULL, end_time = NULL
        WHERE title = 'Test All-Day Event';
        
        RAISE NOTICE 'Sample channel tasks created successfully in channel: %', general_thread_id;
    ELSE
        RAISE NOTICE 'Could not create sample tasks - missing channel or user';
    END IF;
END $$;

-- Add a comment to document the channel-project relationship
COMMENT ON TABLE channel_tasks IS 'Tasks belong to channels. Each channel acts as a project with calendar and timeline views. Scales by creating more channels.';
