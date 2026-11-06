-- Solana on-chain references for roses (membership / Web3 mode).
-- Separate from nft_mints (which is hardcoded to Base Sepolia / EVM): Solana
-- uses base58 addresses (~44 chars) and signatures (~88 chars), stored as TEXT.
-- Records only a *reference* to what the user put on-chain (tx signature,
-- on-chain account, wallet that signed, IPFS CID of image if any, and the
-- metadata the client claimed). On-chain verification is a later step.
CREATE TABLE solana_mints (
    rose_id UUID PRIMARY KEY REFERENCES roses(id) ON DELETE RESTRICT,
    signature TEXT NOT NULL,
    account TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    ipfs_cid TEXT,
    on_chain_metadata JSONB NOT NULL,
    minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_solana_mints_wallet_address ON solana_mints(wallet_address);
