ALTER TABLE users
    ADD COLUMN deleted_at TIMESTAMPTZ,
    ADD COLUMN deletion_reason TEXT;

CREATE INDEX idx_users_deleted_at ON users(deleted_at);
