-- 性能优化索引
CREATE INDEX IF NOT EXISTS idx_roses_user_id ON roses(user_id);
CREATE INDEX IF NOT EXISTS idx_roses_color ON roses(color);
CREATE INDEX IF NOT EXISTS idx_roses_created_at ON roses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_user_rose ON likes(user_id, rose_id);
