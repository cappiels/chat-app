-- Migration 006: Create attachments table
-- UP: Create the table

CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL, -- URL to Digital Ocean Spaces
    mime_type VARCHAR(100),
    file_size_bytes BIGINT,
    thumbnail_url TEXT, -- For image/video thumbnails
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_attachments_message_id ON attachments (message_id);
CREATE INDEX idx_attachments_mime_type ON attachments (mime_type);

-- DOWN: Drop the table (for rollback)
-- DROP INDEX IF EXISTS idx_attachments_mime_type;
-- DROP INDEX IF EXISTS idx_attachments_message_id;
-- DROP TABLE IF EXISTS attachments;
