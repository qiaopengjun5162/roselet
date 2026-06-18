ALTER TABLE roses
    ADD COLUMN recipient_nickname TEXT,
    ADD COLUMN recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
