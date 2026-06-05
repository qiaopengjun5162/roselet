CREATE TABLE feedbacks (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 5 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
