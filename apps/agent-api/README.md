# Roselet Agent API

`@roselet/agent-api` exposes Roselet's Rust recommendation engine as a paid HTTP API and MCP tool. Payment uses the x402 v2 `exact` scheme with Solana Devnet USDC.

## Boundaries

- Rust WASM owns reflection validation, cleanup, flower language, theme, and color recommendation.
- Hono owns HTTP transport; the MCP SDK owns tool transport.
- x402 Foundation packages own payment requirements, verification, and settlement.
- The server only needs a public `X402_SVM_PAY_TO` address. It never receives a payer or merchant private key.

## Run

```bash
just agent-wasm
X402_SVM_PAY_TO=<solana-devnet-address> just agent-dev
```

The server binds to `127.0.0.1` by default. Set `AGENT_API_HOST=0.0.0.0` only when exposing it through a container or trusted reverse proxy.

Free health check:

```bash
curl http://127.0.0.1:4021/health
```

An unpaid request returns `402 Payment Required` with a base64 `PAYMENT-REQUIRED` header:

```bash
curl -i -X POST http://127.0.0.1:4021/v1/reflection \
  -H 'content-type: application/json' \
  --data '{"color":"yellow","hope":"ship the agent API"}'
```

The current default is `$0.001`, represented by 1000 minimal units of Solana Devnet USDC. The facilitator supplies the current Devnet mint and sponsored fee payer; Roselet does not hardcode them.

An x402-aware client is included. It reads the local Solana CLI keypair file and never sends private key material to the server:

```bash
pnpm agent:pay
```

Override `X402_SVM_KEYPAIR_PATH`, `X402_RESOURCE_URL`, `X402_SOLANA_RPC_URL`, or `X402_REFLECTION_INPUT` when needed. `HTTPS_PROXY` / `HTTP_PROXY` are honored through Undici; use `NO_PROXY=127.0.0.1,localhost` for a local resource server. Set `X402_DEBUG_NETWORK=1` to log payment stages without logging signatures or keys.

The wallet must hold Devnet USDC before settlement can succeed. Test USDC is available from the official [Circle Testnet Faucet](https://faucet.circle.com/); select USDC and Solana Devnet.

## MCP

Start the stdio server with the same public payment configuration:

```bash
X402_SVM_PAY_TO=<solana-devnet-address> just agent-mcp
```

The server exposes `roselet_reflection`. Calling it without x402 payment metadata returns a structured payment requirement; an x402-aware MCP client can sign and retry automatically.

## GOAT x402 (Testnet3)

Optional second payment path using the official GOAT merchant API (`goatflow-sdk-server`, DIRECT mode). Without the variables below the server starts normally and every `/v1/goat/*` route returns `503 goat_x402_not_configured`; a partial configuration fails at startup.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GOATX402_API_URL` | no | GOAT Flow API base URL (defaults to the official Testnet3 API) |
| `GOATX402_MERCHANT_ID` | yes (for GOAT) | Merchant ID |
| `GOATX402_API_KEY` | yes (for GOAT) | Server-only API key |
| `GOATX402_API_SECRET` | yes (for GOAT) | Server-only HMAC secret; never logged or returned |
| `GOATX402_REFLECTION_AMOUNT_WEI` | yes (for GOAT) | Reflection price in wei |

Endpoints:

- `GET /v1/goat/merchant` returns the public merchant configuration (receive type, supported chains and tokens).
- `POST /v1/goat/reflection/orders` accepts `{ payer, chainId, tokenSymbol, tokenContract, reflection }`, binds the input to a deterministic Rust WASM `dapp_order_id`, creates a GOAT order, and returns HTTP 402 with a base64 `PAYMENT-REQUIRED` header. No recommendation is generated at this step.
- `POST /v1/goat/reflection/complete` accepts the same body plus `orderId`. The Rust recommendation is delivered only when the order is `INVOICED`, every order field matches the recomputed reference, and the settlement proof payload matches. `PAYMENT_CONFIRMED` is treated as pending; the proof `signature` is an unsigned checksum and is never trusted as an attestation.

## Verify

```bash
just agent-check
pnpm agent:build
```

Local and CI tests do not settle funds; GOAT routes are tested with a fake client and never create real orders. The included client has completed x402 negotiation, Solana RPC transaction construction, signing, and facilitator simulation; an unfunded Devnet USDC account is rejected as `transaction_simulation_failed` before settlement.
