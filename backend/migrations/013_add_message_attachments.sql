-- Migration: Add attachments support to messages table
-- Version: 013
-- Description: Add JSON column to store file attachment metadata

-- Add attachments column to messages table
ALTER TABLE messages 
ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;

-- Add index for querying messages with attachments
CREATE INDEX idx_messages_has_attachments 
ON messages ((jsonb_array_length(attachments) > 0)) 
WHERE jsonb_array_length(attachments) > 0;

-- Add index for attachment metadata searches
CREATE INDEX idx_messages_attachments_gin ON messages USING GIN (attachments);

-- Add comment for documentation
COMMENT ON COLUMN messages.attachments IS 'JSON array of file attachment metadata including id, name, size, type, url, and key';

-- Example attachment structure:
-- [
--   {
--     "id": "uuid-here",
--     "name": "document.pdf", 
--     "size": 1048576,
--     "type": "application/pdf",
--     "url": "https://spaces-url/file.pdf",
--     "key": "chat-uploads/timestamp-hash-document.pdf"
--   }
-- ]

-- Verification query
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'messages' 
  AND column_name = 'attachments';
