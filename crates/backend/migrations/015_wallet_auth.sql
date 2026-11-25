-- Wallet login (Sign-In With Solana) and membership identity.
--
-- Membership is not a UI toggle: an account becomes a member when it has
-- proven ownership of a Solana wallet and that address is bound here. The
-- unique index is what makes "one wallet, one account" true even when two
-- verify requests race each other.
ALTER TABLE users ADD COLUMN wallet_address TEXT;
ALTER TABLE users ADD COLUMN member_since TIMESTAMPTZ;

CREATE UNIQUE INDEX idx_users_wallet_address ON users(wallet_address)
    WHERE wallet_address IS NOT NULL;

-- One row per login attempt. We store the exact message the client signed:
-- verification then checks the signature against stored bytes instead of
-- re-parsing a client-supplied string (which would let a caller sign one
-- message and claim another).
CREATE TABLE wallet_challenges (
    nonce TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    message TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_challenges_expires_at ON wallet_challenges(expires_at);
CREATE INDEX idx_wallet_challenges_wallet_address ON wallet_challenges(wallet_address);
