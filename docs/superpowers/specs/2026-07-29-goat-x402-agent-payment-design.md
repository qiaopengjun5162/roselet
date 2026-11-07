# GOAT x402 Agent Payment Design

## Goal

Add an official GOAT x402 payment path without replacing Roselet's existing Solana x402 API and MCP tool.

- Solana Devnet remains the low-cost, standard x402 v2 SVM demo.
- GOAT Testnet3 adds the Grant-specific EVM merchant payment path.
- Both paths unlock the same Rust WASM reflection engine.

Base Sepolia public memorials and the Aleo private vault remain separate product capabilities.

## Scope

The first GOAT integration uses `DIRECT` mode. Payment unlocks an off-chain API response, so `DELEGATE`, callback contracts, ERC-8004 identity, and a new frontend checkout are outside this change.

The service can start without GOAT credentials. GOAT routes report that the integration is unavailable until all required merchant settings are present. A partial GOAT configuration fails at startup so a deployment cannot silently run with mismatched credentials.

## Runtime Configuration

The Agent API accepts these server-only variables:

- `GOATX402_API_URL`, defaulting to the official Testnet3 API
- `GOATX402_MERCHANT_ID`
- `GOATX402_API_KEY`
- `GOATX402_API_SECRET`
- `GOATX402_REFLECTION_AMOUNT_WEI`

`GOATX402_API_SECRET` must never appear in health responses, logs, browser bundles, MCP output, or API error bodies. Supported chains and tokens come from the merchant API instead of repository constants.

## API

### `GET /v1/goat/merchant`

Returns the official SDK's normalized public merchant configuration. When GOAT is not configured, it returns `503` with a stable `goat_x402_not_configured` error.

### `POST /v1/goat/reflection/orders`

Accepts a payer address, selected merchant route, and reflection input. The route must exist in the current merchant configuration and the merchant must be enabled with `DIRECT` receive type.

Rust WASM validates and cleans the reflection input, normalizes the payment fields, and creates a domain-separated deterministic `dapp_order_id`. The backend calls the official `goatflow-sdk-server` and returns the raw GOAT x402 payment requirement as HTTP `402`, including the standard `PAYMENT-REQUIRED` header.

No recommendation is generated at order creation time.

### `POST /v1/goat/reflection/complete`

Accepts the GOAT order ID plus the same payer, route, and reflection input. The backend recomputes the Rust order reference and loads the authoritative order status.

Delivery requires all of the following:

- status is `INVOICED`
- `dapp_order_id`, payer, chain, token, contract, and amount match the request and server configuration
- the settlement proof can be retrieved and its order, payer, chain, amount, and completed status match

Only then does Roselet run the Rust recommendation engine. Reusing a completed order can only reproduce the same bound reflection result.

## Components

- `crates/recommend`: owns canonical payment input normalization and the domain-separated order reference.
- `apps/agent-api` GOAT client module: wraps the official server SDK and maps its failures to stable API errors.
- `apps/agent-api` routes: parse transport input, call Rust WASM, preserve HTTP `402`, and gate delivery on authoritative status and proof.
- Existing Solana payment middleware and MCP server: unchanged.

## Error Handling

- Invalid reflection or payment input returns `400` before any GOAT order is created.
- Unsupported merchant routes return `400`.
- Missing complete GOAT configuration returns `503`.
- Pending orders return `409`; failed, expired, or cancelled orders return `402` with a stable status code.
- GOAT authentication, rate-limit, and upstream failures are mapped without exposing credentials or raw authenticated response bodies.

## Verification

Tests cover Rust order-reference determinism and normalization, optional and partial configuration, disabled routes, merchant route validation, HTTP `402` propagation, pending and terminal order states, order mismatch rejection, proof mismatch rejection, and successful post-payment delivery.

The automated suite uses a fake GOAT client and does not create orders or move funds. Real Testnet3 verification remains a separate step after merchant approval, faucet funding, and explicit wallet authorization.

