-- Knowledge Discussion Board Feature Migration
-- Adds locking, pinning, voting, and enhanced comment support

-- Add fields to knowledge_items for discussion board features
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);  -- 'message', 'task', 'calendar', etc.
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS source_id VARCHAR(255);    -- ID of the source item
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS locked_by VARCHAR(128);
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS pinned_by VARCHAR(128);
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Vote tracking table for knowledge items (tracks who voted)
CREATE TABLE IF NOT EXISTS knowledge_item_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL,
    vote_type VARCHAR(10) CHECK(vote_type IN ('upvote', 'downvote')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(knowledge_item_id, user_id)
);

-- Vote tracking table for comments
CREATE TABLE IF NOT EXISTS knowledge_comment_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES knowledge_comments(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL,
    vote_type VARCHAR(10) CHECK(vote_type IN ('upvote', 'downvote')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- Add downvotes_count to comments if not exists
ALTER TABLE knowledge_comments ADD COLUMN IF NOT EXISTS downvotes_count INTEGER DEFAULT 0;

-- Performance indexes for discussion board queries
CREATE INDEX IF NOT EXISTS idx_kb_items_pinned ON knowledge_items(is_pinned, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_items_category_activity ON knowledge_items(category_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_items_locked ON knowledge_items(is_locked);
CREATE INDEX IF NOT EXISTS idx_kb_comments_item ON knowledge_comments(knowledge_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_item_votes_item ON knowledge_item_votes(knowledge_item_id);
CREATE INDEX IF NOT EXISTS idx_kb_item_votes_user ON knowledge_item_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_kb_comment_votes_comment ON knowledge_comment_votes(comment_id);
CREATE INDEX IF NOT EXISTS idx_kb_comment_votes_user ON knowledge_comment_votes(user_id);

-- Function to update comment count on knowledge items
CREATE OR REPLACE FUNCTION update_knowledge_item_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE knowledge_items
        SET comment_count = comment_count + 1,
            last_activity_at = NOW()
        WHERE id = NEW.knowledge_item_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE knowledge_items
        SET comment_count = GREATEST(0, comment_count - 1)
        WHERE id = OLD.knowledge_item_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create triggers for comment count
DROP TRIGGER IF EXISTS update_knowledge_item_comment_count_insert ON knowledge_comments;
DROP TRIGGER IF EXISTS update_knowledge_item_comment_count_delete ON knowledge_comments;

CREATE TRIGGER update_knowledge_item_comment_count_insert
    AFTER INSERT ON knowledge_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_item_comment_count();

CREATE TRIGGER update_knowledge_item_comment_count_delete
    AFTER DELETE ON knowledge_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_item_comment_count();

-- Function to update vote counts on knowledge items
CREATE OR REPLACE FUNCTION update_knowledge_item_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.vote_type = 'upvote' THEN
            UPDATE knowledge_items SET upvotes_count = upvotes_count + 1 WHERE id = NEW.knowledge_item_id;
        ELSE
            UPDATE knowledge_items SET downvotes_count = downvotes_count + 1 WHERE id = NEW.knowledge_item_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.vote_type = 'upvote' THEN
            UPDATE knowledge_items SET upvotes_count = GREATEST(0, upvotes_count - 1) WHERE id = OLD.knowledge_item_id;
        ELSE
            UPDATE knowledge_items SET downvotes_count = GREATEST(0, downvotes_count - 1) WHERE id = OLD.knowledge_item_id;
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle vote change (upvote to downvote or vice versa)
        IF OLD.vote_type = 'upvote' AND NEW.vote_type = 'downvote' THEN
            UPDATE knowledge_items
            SET upvotes_count = GREATEST(0, upvotes_count - 1),
                downvotes_count = downvotes_count + 1
            WHERE id = NEW.knowledge_item_id;
        ELSIF OLD.vote_type = 'downvote' AND NEW.vote_type = 'upvote' THEN
            UPDATE knowledge_items
            SET downvotes_count = GREATEST(0, downvotes_count - 1),
                upvotes_count = upvotes_count + 1
            WHERE id = NEW.knowledge_item_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create triggers for item vote counts
DROP TRIGGER IF EXISTS update_knowledge_item_vote_counts_trigger ON knowledge_item_votes;
CREATE TRIGGER update_knowledge_item_vote_counts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON knowledge_item_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_item_vote_counts();

-- Function to update vote counts on comments
CREATE OR REPLACE FUNCTION update_knowledge_comment_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.vote_type = 'upvote' THEN
            UPDATE knowledge_comments SET upvotes_count = upvotes_count + 1 WHERE id = NEW.comment_id;
        ELSE
            UPDATE knowledge_comments SET downvotes_count = downvotes_count + 1 WHERE id = NEW.comment_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.vote_type = 'upvote' THEN
            UPDATE knowledge_comments SET upvotes_count = GREATEST(0, upvotes_count - 1) WHERE id = OLD.comment_id;
        ELSE
            UPDATE knowledge_comments SET downvotes_count = GREATEST(0, downvotes_count - 1) WHERE id = OLD.comment_id;
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.vote_type = 'upvote' AND NEW.vote_type = 'downvote' THEN
            UPDATE knowledge_comments
            SET upvotes_count = GREATEST(0, upvotes_count - 1),
                downvotes_count = downvotes_count + 1
            WHERE id = NEW.comment_id;
        ELSIF OLD.vote_type = 'downvote' AND NEW.vote_type = 'upvote' THEN
            UPDATE knowledge_comments
            SET downvotes_count = GREATEST(0, downvotes_count - 1),
                upvotes_count = upvotes_count + 1
            WHERE id = NEW.comment_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create triggers for comment vote counts
DROP TRIGGER IF EXISTS update_knowledge_comment_vote_counts_trigger ON knowledge_comment_votes;
CREATE TRIGGER update_knowledge_comment_vote_counts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON knowledge_comment_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_comment_vote_counts();

-- Update existing items to have last_activity_at set to created_at
UPDATE knowledge_items
SET last_activity_at = COALESCE(updated_at, created_at)
WHERE last_activity_at IS NULL;

-- Update existing comment counts
UPDATE knowledge_items ki
SET comment_count = (
    SELECT COUNT(*)
    FROM knowledge_comments kc
    WHERE kc.knowledge_item_id = ki.id
);
