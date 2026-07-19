# Roselet Private Vault

`roselet_private_vault.aleo` is Roselet's Aleo Hackathon program for private reflections.

- `PrivateRose` holds the owner, Roselet id commitment, content commitment, AI reply commitment, and share key as a private Aleo record.
- `rotate_share_key` consumes and replaces the owner's record, invalidating a previous sharing key without exposing content.
- `share_private_rose` keeps the owner's record and creates a recipient-owned `RoseShare` authorization record.

The application creates commitments in the user-controlled client. The original reflection and AI reply are never program inputs and are not written to a public Aleo mapping.

## Local verification

```bash
cd contracts/aleo-private-vault
leo test --offline
leo build --offline
```

Deployment and wallet execution require a configured Aleo testnet account, program id, and transaction fee. They are deliberately not embedded in this repository.

## Web wallet setup

The Web demo is available at `/private-vault` and uses Leo Wallet on Aleo Testnet. Configure the deployed program before building the Web app:

```bash
NEXT_PUBLIC_ALEO_VAULT_PROGRAM_ID=roselet_private_vault.aleo
NEXT_PUBLIC_ALEO_EXECUTION_FEE_MICROCREDITS=100000
```

The current repository verifies local compilation and wallet transaction construction only. A real Testnet deployment and end-to-end wallet execution still require a funded deployment account, the deployed program id, and Leo Wallet Testnet credits.
