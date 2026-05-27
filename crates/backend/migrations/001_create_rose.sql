CREATE TABLE IF NOT EXISTS roses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    color VARCHAR(10) NOT NULL,
    gratitude TEXT,
    anxiety TEXT,
    hope TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
