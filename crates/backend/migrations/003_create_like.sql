CREATE TABLE IF NOT EXISTS likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    rose_id UUID NOT NULL REFERENCES roses(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, rose_id)
);

CREATE INDEX idx_likes_rose_id ON likes(rose_id);
CREATE INDEX idx_likes_user_id ON likes(user_id);
