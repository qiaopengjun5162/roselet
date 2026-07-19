# Roselet AI x Web3 Grant Demo

Roselet uses each chain for a different product requirement instead of deploying the same feature three times.

| Track | User need | Implementation | Current evidence |
|---|---|---|---|
| Solidity / Base Sepolia | Public permanence and ownership | ERC-721 public rose memorial plus backend receipt verification | Contract, Foundry tests, Web wallet flow; deployment pending |
| Aleo | Private reflection and selective sharing | `PrivateRose` / `RoseShare` records; browser-only Rust commitments | Leo build/tests and Leo Wallet request flow; deployment pending |
| Solana / x402 | Low-cost Agent and API payments | Paid HTTP reflection API and paid MCP tool using x402 SVM exact USDC | Signed retry and facilitator simulation verified; settlement needs Devnet USDC |

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

The repository proves local execution, Rust WASM output, x402 HTTP negotiation, Solana RPC transaction construction, client signing, facilitator simulation, MCP initialization, tool discovery, and unpaid tool behavior. The signed payment currently reaches facilitator simulation and returns `transaction_simulation_failed` because the local payer has no account for the official Devnet USDC mint. It does not yet prove a settled Solana Devnet USDC payment, Base Sepolia contract deployment, or Aleo Testnet program deployment.

GOAT's public repository is currently archived. Roselet therefore does not make the archived SDK a core dependency; GOAT-compatible agents can still call the HTTP or MCP interface, while payment semantics use the actively maintained x402 Foundation implementation.
