# Roselet AI x Web3 Grant Demo

Roselet uses each chain for a different product requirement instead of deploying the same feature three times.

| Track | User need | Implementation | Current evidence |
|---|---|---|---|
| Solidity / Base Sepolia | Public permanence and ownership | ERC-721 public rose memorial plus backend receipt verification | Contract, Foundry tests, Web wallet flow; deployment pending |
| Aleo | Private reflection and selective sharing | `PrivateRose` / `RoseShare` records; browser-only Rust commitments | Leo build/tests and Leo Wallet request flow; deployment pending |
| Solana / x402 | Low-cost Agent and API payments | Paid HTTP reflection API and paid MCP tool using x402 SVM exact USDC | Signed retry and facilitator simulation verified; settlement needs Devnet USDC |
| GOAT / x402 | EVM merchant payments for the AI Builder Grant | `goatflow-sdk-server` DIRECT orders gating the same Rust WASM reflection engine | Fake-client route tests cover 402 orders, status gating, and proof match; real Testnet3 order needs merchant approval |

## GOAT Agent flow

1. An agent calls `GET /v1/goat/merchant` to discover the DIRECT receive type and supported chains/tokens.
2. `POST /v1/goat/reflection/orders` binds the payer, route, amount, and cleaned reflection into a deterministic domain-separated `dapp_order_id` (Rust WASM SHA-256) and creates a GOAT order, returned as HTTP 402 with a `PAYMENT-REQUIRED` header.
3. The payer settles the order on GOAT Testnet3.
4. `POST /v1/goat/reflection/complete` recomputes the reference and delivers the recommendation only when the order is `INVOICED`, all order fields match, and the settlement proof payload matches. `PAYMENT_CONFIRMED` is only a pending state; the proof `signature` is an unsigned checksum and is never trusted as an attestation.

Merchant API key/secret stay server-side. Without GOAT credentials the routes return a stable `503 goat_x402_not_configured` and the Solana path is unaffected; a partial configuration fails at startup.

## Solana Agent flow

1. An agent calls `POST /v1/reflection` or the `roselet_reflection` MCP tool.
2. Roselet returns x402 v2 payment requirements for `$0.001` Solana Devnet USDC.
3. An x402-aware client signs the payment and retries.
4. The official facilitator verifies and settles the payment.
5. Roselet executes the shared Rust WASM recommendation engine and returns flower language, a theme, and a color recommendation.

The Agent API never receives a wallet private key. `X402_SVM_PAY_TO` is a public recipient address only.

## Demo commands

```bash
just agent-wasm
X402_SVM_PAY_TO=$(solana address) just agent-dev
```

In another terminal:

```bash
curl http://127.0.0.1:4021/health
curl -i -X POST http://127.0.0.1:4021/v1/reflection \
  -H 'content-type: application/json' \
  --data '{"color":"white","gratitude":"Thanks for helping me ship"}'
```

The second request must return HTTP 402 and a `PAYMENT-REQUIRED` header containing:

- `x402Version: 2`
- `scheme: exact`
- `network: solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`
- `amount: 1000`
- the configured `payTo`

## Honest completion boundary

The repository proves local execution, Rust WASM output, x402 HTTP negotiation, Solana RPC transaction construction, client signing, facilitator simulation, MCP initialization, tool discovery, unpaid tool behavior, and the GOAT order/status/proof gating logic (with a fake client). The signed Solana payment currently reaches facilitator simulation and returns `transaction_simulation_failed` because the local payer has no account for the official Devnet USDC mint. It does not yet prove a settled Solana Devnet USDC payment, a real GOAT Testnet3 order (needs merchant approval, faucet funding, and explicit wallet authorization), Base Sepolia contract deployment, or Aleo Testnet program deployment.

The archived repository is the legacy `goat-sdk/goat`; the official `GOATNetwork/x402` is actively maintained and provides the `goatflow-sdk-server` used here.
