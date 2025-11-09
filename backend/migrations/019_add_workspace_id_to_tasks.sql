-- Migration 019: Add workspace_id to channel_tasks for efficient querying
-- This denormalizes the data to avoid JOINs and enable faster rollups

-- Add workspace_id column to channel_tasks
ALTER TABLE channel_tasks 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Populate workspace_id from existing threads data
UPDATE channel_tasks 
SET workspace_id = threads.workspace_id
FROM threads 
WHERE channel_tasks.thread_id = threads.id
AND channel_tasks.workspace_id IS NULL;

-- Make workspace_id NOT NULL after populating data
ALTER TABLE channel_tasks 
ALTER COLUMN workspace_id SET NOT NULL;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_channel_tasks_workspace_id ON channel_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_workspace_thread ON channel_tasks(workspace_id, thread_id);

-- Add constraint to ensure data consistency
ALTER TABLE channel_tasks 
ADD CONSTRAINT IF NOT EXISTS check_workspace_thread_consistency 
CHECK (
  (SELECT workspace_id FROM threads WHERE id = thread_id) = workspace_id
);

-- Add comment for documentation
COMMENT ON COLUMN channel_tasks.workspace_id IS 'Denormalized workspace_id for efficient querying without JOINs. Must match threads.workspace_id.';

-- Verify the migration worked
DO $$
DECLARE
    task_count INTEGER;
    consistent_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO task_count FROM channel_tasks;
    
    SELECT COUNT(*) INTO consistent_count 
    FROM channel_tasks ct
    JOIN threads t ON ct.thread_id = t.id
    WHERE ct.workspace_id = t.workspace_id;
    
    IF task_count = consistent_count THEN
        RAISE NOTICE '✅ Migration 019 successful: % tasks updated with workspace_id', task_count;
    ELSE
        RAISE EXCEPTION '❌ Migration 019 failed: Data consistency check failed. % total vs % consistent', task_count, consistent_count;
    END IF;
END $$;
