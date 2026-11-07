-- Token-2022 NFT references for roses (membership / Web3 mode, "铸成 NFT" path).
-- Separate from solana_mints (memo-only evidence): an NFT has a mint address and
-- carries its metadata *inside* the mint account, so we can verify it from
-- chain state alone instead of trusting a transaction signature.
CREATE TABLE solana_nft_mints (
    rose_id UUID PRIMARY KEY REFERENCES roses(id) ON DELETE RESTRICT,
    -- base58 mint address; one mint can only ever be claimed by one rose.
    mint_address TEXT NOT NULL UNIQUE,
    -- wallet that signed the mint and still holds the metadata update authority.
    wallet_address TEXT NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    uri TEXT NOT NULL,
    -- Verbatim Token-2022 `additionalMetadata` (key/value pairs), kept so the
    -- client can render provenance fields (e.g. roseId, color) without an RPC.
    additional_metadata JSONB NOT NULL,
    minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_solana_nft_mints_wallet_address ON solana_nft_mints(wallet_address);
