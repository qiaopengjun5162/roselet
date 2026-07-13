CREATE TABLE nft_mints (
    rose_id UUID PRIMARY KEY REFERENCES roses(id) ON DELETE RESTRICT,
    chain_id INTEGER NOT NULL CHECK (chain_id = 84532),
    contract_address VARCHAR(42) NOT NULL,
    token_id VARCHAR(66) NOT NULL,
    tx_hash VARCHAR(66) NOT NULL UNIQUE,
    wallet_address VARCHAR(42) NOT NULL,
    on_chain_message TEXT NOT NULL CHECK (char_length(on_chain_message) BETWEEN 1 AND 200),
    message_hash VARCHAR(66) NOT NULL,
    minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chain_id, contract_address, token_id)
);

CREATE INDEX idx_nft_mints_wallet_address ON nft_mints(wallet_address);
