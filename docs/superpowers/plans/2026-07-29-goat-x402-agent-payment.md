# GOAT x402 Agent Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GOAT Testnet3 DIRECT merchant payment path to `apps/agent-api` alongside the existing Solana x402 path, per `docs/superpowers/specs/2026-07-29-goat-x402-agent-payment-design.md`.

**Architecture:** Rust WASM (`crates/recommend`) owns payment normalization and the domain-separated deterministic `dapp_order_id`. `apps/agent-api` wraps the official `goatflow-sdk-server` behind an injectable `GoatMerchantClient` interface so tests use a fake client. Three new routes (`GET /v1/goat/merchant`, `POST /v1/goat/reflection/orders`, `POST /v1/goat/reflection/complete`) gate recommendation delivery on authoritative `INVOICED` status plus proof field match. The service starts without GOAT credentials; partial configuration fails at startup.

**Tech Stack:** Rust + wasm-bindgen + sha2, Hono on Node, TypeScript NodeNext, vitest, `goatflow-sdk-server@0.3.0`.

---

### Task 1: Rust order reference module

**Files:**
- Create: `crates/recommend/src/goat.rs`
- Test: in-module `#[cfg(test)]` tests

- [ ] **Step 1: Write the failing tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    const PAYER: &str = "0x1111111111111111111111111111111111111111";
    const CONTRACT: &str = "0x2222222222222222222222222222222222222222";

    fn input_json() -> String {
        format!(
            r#"{{"reflection":{{"color":"red","gratitude":"thanks"}},"payer":"{PAYER}","chain_id":48816,"token_symbol":"USDC","token_contract":"{CONTRACT}","amount_wei":"1000"}}"#
        )
    }

    #[test]
    fn builds_deterministic_domain_separated_reference() {
        let first = build_order_reference(&input_json()).unwrap();
        let second = build_order_reference(&input_json()).unwrap();

        assert_eq!(first, second);
        assert!(first.dapp_order_id.starts_with("0x"));
        assert_eq!(first.dapp_order_id.len(), 66);
    }

    #[test]
    fn normalizes_equivalent_payment_fields_to_same_reference() {
        let baseline = build_order_reference(&input_json()).unwrap();
        let equivalent = build_order_reference(&format!(
            r#"{{"reflection":{{"gratitude":"thanks","color":"red"}},"payer":"0x1111111111111111111111111111111111111111","chain_id":48816,"token_symbol":"usdc","token_contract":"0x2222222222222222222222222222222222222222","amount_wei":"01000"}}"#
        ))
        .unwrap();

        assert_eq!(baseline, equivalent);
    }

    #[test]
    fn binds_reference_to_each_field() {
        let baseline = build_order_reference(&input_json()).unwrap();
        let other_reflection =
            build_order_reference(&input_json().replace("thanks", "changed")).unwrap();
        let other_amount = build_order_reference(&input_json().replace("1000", "1001")).unwrap();

        assert_ne!(baseline.dapp_order_id, other_reflection.dapp_order_id);
        assert_ne!(baseline.dapp_order_id, other_amount.dapp_order_id);
    }

    #[test]
    fn rejects_invalid_payment_fields() {
        assert!(build_order_reference(&input_json().replace(PAYER, "not-an-address")).is_err());
        assert!(build_order_reference(&input_json().replace(CONTRACT, "0x1234")).is_err());
        assert!(build_order_reference(&input_json().replace("1000", "0")).is_err());
        assert!(build_order_reference(&input_json().replace("1000", "10.5")).is_err());
        assert!(build_order_reference(&input_json().replace("48816", "0")).is_err());
        assert!(build_order_reference(&input_json().replace("USDC", "")).is_err());
        assert!(build_order_reference(r#"{"reflection":[],"payer":"0x1111111111111111111111111111111111111111","chain_id":48816,"token_symbol":"USDC","token_contract":"0x2222222222222222222222222222222222222222","amount_wei":"1000"}"#).is_err());
        assert!(build_order_reference("{").is_err());
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo nextest run -p roselet-recommend -j1 goat`
Expected: compile error because the `goat` module does not exist yet.

- [ ] **Step 3: Write the implementation**

```rust
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Deserialize)]
pub struct GoatOrderReferenceInput {
    pub reflection: serde_json::Value,
    pub payer: String,
    pub chain_id: u64,
    pub token_symbol: String,
    pub token_contract: String,
    pub amount_wei: String,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct GoatOrderReference {
    pub dapp_order_id: String,
    pub payer: String,
    pub chain_id: u64,
    pub token_symbol: String,
    pub token_contract: String,
    pub amount_wei: String,
}

pub fn build_order_reference(input_json: &str) -> Result<GoatOrderReference, String> {
    let input: GoatOrderReferenceInput =
        serde_json::from_str(input_json).map_err(|_| "invalid order reference input".to_string())?;

    if !input.reflection.is_object() {
        return Err("reflection must be a JSON object".into());
    }
    if input.chain_id == 0 {
        return Err("chain_id must be a positive integer".into());
    }
    let payer = normalize_evm_address("payer", &input.payer)?;
    let token_contract = normalize_evm_address("token_contract", &input.token_contract)?;
    let token_symbol = input.token_symbol.trim().to_ascii_uppercase();
    if token_symbol.is_empty() {
        return Err("token_symbol is required".into());
    }
    let amount_wei = normalize_amount_wei(&input.amount_wei)?;
    // serde_json maps preserve sorted keys by default, so this serialization is canonical.
    let reflection =
        serde_json::to_string(&input.reflection).map_err(|_| "invalid reflection".to_string())?;

    let mut hasher = Sha256::new();
    hasher.update(b"roselet-goat-x402-v1\0");
    for part in [
        reflection.as_str(),
        payer.as_str(),
        token_symbol.as_str(),
        token_contract.as_str(),
        amount_wei.as_str(),
    ] {
        hasher.update(part.as_bytes());
        hasher.update(b"\0");
    }
    hasher.update(input.chain_id.to_string().as_bytes());

    let digest = hasher.finalize();
    let dapp_order_id = format!(
        "0x{}",
        digest
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    );

    Ok(GoatOrderReference {
        dapp_order_id,
        payer,
        chain_id: input.chain_id,
        token_symbol,
        token_contract,
        amount_wei,
    })
}

fn normalize_evm_address(field: &str, value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    let invalid = || format!("{field} must be a 0x-prefixed EVM address");
    let Some(hex_digits) = trimmed.strip_prefix("0x") else {
        return Err(invalid());
    };
    if hex_digits.len() != 40 || !hex_digits.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(invalid());
    }
    Ok(format!("0x{}", hex_digits.to_ascii_lowercase()))
}

fn normalize_amount_wei(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() || !trimmed.chars().all(|c| c.is_ascii_digit()) {
        return Err("amount_wei must be a positive integer".into());
    }
    let normalized = trimmed.trim_start_matches('0');
    if normalized.is_empty() {
        return Err("amount_wei must be a positive integer".into());
    }
    Ok(normalized.to_string())
}
```

- [ ] **Step 4: Register the module and run tests**

Add `mod goat;` to `crates/recommend/src/lib.rs` (next to `mod aleo;`).

Run: `cargo nextest run -p roselet-recommend -j1 goat`
Expected: 4 tests pass.

- [ ] **Step 5: Format**

Run: `cargo fmt --all -- --check`
Expected: clean.

### Task 2: WASM export and rebuild

**Files:**
- Modify: `crates/recommend/src/lib.rs` (near `build_aleo_vault_inputs_wasm`)
- Regenerate: `apps/agent-api/pkg/*`

- [ ] **Step 1: Write the failing WASM wrapper test**

Add to the `crates/recommend/src/lib.rs` test module:

```rust
    #[test]
    fn goat_order_reference_wasm_roundtrip() {
        let result = build_goat_order_reference_wasm(
            r#"{"reflection":{"color":"red","gratitude":"thanks"},"payer":"0x1111111111111111111111111111111111111111","chain_id":48816,"token_symbol":"USDC","token_contract":"0x2222222222222222222222222222222222222222","amount_wei":"1000"}"#,
        );
        let parsed: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert!(parsed["dapp_order_id"].as_str().unwrap().starts_with("0x"));

        let error = build_goat_order_reference_wasm("{}");
        assert!(error.contains("error"));
    }
```

Run: `cargo nextest run -p roselet-recommend -j1 goat_order_reference_wasm`
Expected: compile error — `build_goat_order_reference_wasm` does not exist (RED).

- [ ] **Step 2: Add the WASM export**

In `crates/recommend/src/lib.rs`, after `build_aleo_vault_inputs_wasm`:

```rust
#[wasm_bindgen]
pub fn build_goat_order_reference_wasm(input_json: &str) -> String {
    match goat::build_order_reference(input_json) {
        Ok(reference) => serde_json::to_string(&reference).unwrap_or_else(|_| "{}".into()),
        Err(error) => serde_json::json!({ "error": error }).to_string(),
    }
}
```

- [ ] **Step 3: Run tests and rebuild the Node WASM package**

Run: `cargo nextest run -p roselet-recommend -j1`
Expected: all tests pass.

Run: `just agent-wasm`
Expected: `apps/agent-api/pkg/roselet_recommend.js` exports `build_goat_order_reference_wasm`.

- [ ] **Step 4: Commit**

```bash
git add crates/recommend/src/goat.rs crates/recommend/src/lib.rs apps/agent-api/pkg docs/superpowers/plans/2026-07-29-goat-x402-agent-payment.md
git commit -m "feat: add GOAT order reference to Rust WASM"
```

### Task 3: Install the official GOAT server SDK

**Files:**
- Modify: `apps/agent-api/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add the dependency**

Add to `apps/agent-api/package.json` dependencies:

```json
    "goatflow-sdk-server": "0.3.0",
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: lockfile updates, `node_modules/goatflow-sdk-server` present.

### Task 4: GOAT runtime configuration

**Files:**
- Modify: `apps/agent-api/src/config.ts`
- Test: `apps/agent-api/src/config.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `config.test.ts`, and update the import to include `DEFAULT_GOATX402_API_URL` and `loadGoatConfig`:

```ts
describe("loadGoatConfig", () => {
  const GOAT_ENV = {
    GOATX402_MERCHANT_ID: "merchant-1",
    GOATX402_API_KEY: "key-1",
    GOATX402_API_SECRET: "secret-1",
    GOATX402_REFLECTION_AMOUNT_WEI: "1000",
  };

  it("returns null when GOAT is not configured", () => {
    expect(loadGoatConfig({})).toBeNull();
  });

  it("uses the official Testnet3 API by default", () => {
    expect(loadGoatConfig(GOAT_ENV)).toEqual({
      apiUrl: DEFAULT_GOATX402_API_URL,
      merchantId: "merchant-1",
      apiKey: "key-1",
      apiSecret: "secret-1",
      reflectionAmountWei: "1000",
    });
  });

  it("fails fast on partial configuration", () => {
    expect(() => loadGoatConfig({ GOATX402_MERCHANT_ID: "merchant-1" })).toThrow(
      "partial GOAT x402 configuration",
    );
    expect(() => loadGoatConfig({ ...GOAT_ENV, GOATX402_API_SECRET: "" })).toThrow(
      "GOATX402_API_SECRET",
    );
  });

  it("rejects a non-positive-integer reflection amount", () => {
    expect(() => loadGoatConfig({ ...GOAT_ENV, GOATX402_REFLECTION_AMOUNT_WEI: "0" })).toThrow(
      "positive integer",
    );
    expect(() => loadGoatConfig({ ...GOAT_ENV, GOATX402_REFLECTION_AMOUNT_WEI: "1.5" })).toThrow(
      "positive integer",
    );
  });
});
```

Run: `cd apps/agent-api && pnpm vitest run src/config.test.ts --coverage.enabled=false`
Expected: FAIL — `loadGoatConfig` is not exported.

- [ ] **Step 2: Implement `loadGoatConfig`**

Append to `apps/agent-api/src/config.ts`:

```ts
export const DEFAULT_GOATX402_API_URL = "https://x402-api-lx58aabp0r.testnet3.goat.network/";

export interface GoatX402Config {
  apiUrl: string;
  merchantId: string;
  apiKey: string;
  apiSecret: string;
  reflectionAmountWei: string;
}

export function loadGoatConfig(env: NodeJS.ProcessEnv = process.env): GoatX402Config | null {
  const fields = {
    GOATX402_MERCHANT_ID: env.GOATX402_MERCHANT_ID?.trim(),
    GOATX402_API_KEY: env.GOATX402_API_KEY?.trim(),
    GOATX402_API_SECRET: env.GOATX402_API_SECRET?.trim(),
    GOATX402_REFLECTION_AMOUNT_WEI: env.GOATX402_REFLECTION_AMOUNT_WEI?.trim(),
  };
  const missing = Object.entries(fields)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length === Object.keys(fields).length) return null;
  if (missing.length > 0) {
    throw new Error(`partial GOAT x402 configuration, missing: ${missing.join(", ")}`);
  }

  const reflectionAmountWei = fields.GOATX402_REFLECTION_AMOUNT_WEI as string;
  if (!/^[1-9]\d*$/.test(reflectionAmountWei)) {
    throw new Error("GOATX402_REFLECTION_AMOUNT_WEI must be a positive integer in wei");
  }

  return {
    apiUrl: env.GOATX402_API_URL?.trim() || DEFAULT_GOATX402_API_URL,
    merchantId: fields.GOATX402_MERCHANT_ID as string,
    apiKey: fields.GOATX402_API_KEY as string,
    apiSecret: fields.GOATX402_API_SECRET as string,
    reflectionAmountWei,
  };
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd apps/agent-api && pnpm vitest run src/config.test.ts --coverage.enabled=false`
Expected: all config tests pass.

### Task 5: GOAT client wrapper

**Files:**
- Create: `apps/agent-api/src/goat-client.ts`
- Test: `apps/agent-api/src/goat-client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createGoatClient } from "./goat-client.js";

describe("createGoatClient", () => {
  it("wraps the official SDK without exposing credentials", () => {
    const client = createGoatClient({
      apiUrl: "https://goat.example",
      merchantId: "merchant-1",
      apiKey: "key-1",
      apiSecret: "secret-1",
      reflectionAmountWei: "1000",
    });

    expect(typeof client.getMerchant).toBe("function");
    expect(typeof client.createOrderRaw).toBe("function");
    expect(typeof client.getOrderStatus).toBe("function");
    expect(typeof client.getOrderProof).toBe("function");
    expect(JSON.stringify(client)).not.toContain("secret-1");
  });
});
```

Run: `cd apps/agent-api && pnpm vitest run src/goat-client.test.ts --coverage.enabled=false`
Expected: FAIL — module does not exist.

- [ ] **Step 2: Implement the wrapper**

```ts
import {
  type CreateOrderParams,
  GoatFlowClient,
  type MerchantInfo,
  type OrderProof,
  type OrderProofResponse,
  type X402PaymentRequired,
} from "goatflow-sdk-server";
import type { GoatX402Config } from "./config.js";

export interface GoatMerchantClient {
  getMerchant(): Promise<MerchantInfo>;
  createOrderRaw(params: CreateOrderParams): Promise<X402PaymentRequired>;
  getOrderStatus(orderId: string): Promise<OrderProof>;
  getOrderProof(orderId: string): Promise<OrderProofResponse>;
}

// Credentials live only inside the SDK instance; routes never see apiKey/apiSecret.
export function createGoatClient(config: GoatX402Config): GoatMerchantClient {
  const client = new GoatFlowClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
  });

  return {
    getMerchant: () => client.getMerchant(config.merchantId),
    createOrderRaw: params => client.createOrderRaw(params),
    getOrderStatus: orderId => client.getOrderStatus(orderId),
    getOrderProof: orderId => client.getOrderProof(orderId),
  };
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd apps/agent-api && pnpm vitest run src/goat-client.test.ts --coverage.enabled=false`
Expected: PASS.

### Task 6: Rust WASM order reference helper (TS side)

**Files:**
- Create: `apps/agent-api/src/goat-order.ts`
- Test: `apps/agent-api/src/goat-order.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { buildGoatOrderReference, InvalidGoatOrderReference } from "./goat-order.js";

const INPUT = {
  reflection: { color: "red", gratitude: "thanks" },
  payer: "0x1111111111111111111111111111111111111111",
  chain_id: 48816,
  token_symbol: "USDC",
  token_contract: "0x2222222222222222222222222222222222222222",
  amount_wei: "1000",
};

describe("buildGoatOrderReference", () => {
  it("returns the Rust normalized reference", () => {
    const reference = buildGoatOrderReference(INPUT);

    expect(reference.dapp_order_id).toMatch(/^0x[0-9a-f]{64}$/);
    expect(reference.payer).toBe(INPUT.payer);
    expect(reference.chain_id).toBe(48816);
    expect(reference.amount_wei).toBe("1000");
  });

  it("rejects invalid payment fields with a stable error", () => {
    expect(() => buildGoatOrderReference({ ...INPUT, payer: "bad" })).toThrow(
      InvalidGoatOrderReference,
    );
  });
});
```

Run: `cd apps/agent-api && pnpm vitest run src/goat-order.test.ts --coverage.enabled=false`
Expected: FAIL — module does not exist.

- [ ] **Step 2: Implement the helper**

```ts
import { build_goat_order_reference_wasm } from "../pkg/roselet_recommend.js";

export interface GoatOrderReferenceInput {
  reflection: unknown;
  payer: string;
  chain_id: number;
  token_symbol: string;
  token_contract: string;
  amount_wei: string;
}

export interface GoatOrderReference {
  dapp_order_id: string;
  payer: string;
  chain_id: number;
  token_symbol: string;
  token_contract: string;
  amount_wei: string;
}

export class InvalidGoatOrderReference extends Error {}

export function buildGoatOrderReference(input: GoatOrderReferenceInput): GoatOrderReference {
  const result = JSON.parse(build_goat_order_reference_wasm(JSON.stringify(input))) as
    | GoatOrderReference
    | { error: string };
  if ("error" in result) {
    throw new InvalidGoatOrderReference(result.error);
  }
  return result;
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd apps/agent-api && pnpm vitest run src/goat-order.test.ts --coverage.enabled=false`
Expected: PASS (requires Task 2's rebuilt pkg).

### Task 7: GOAT routes

**Files:**
- Create: `apps/agent-api/src/goat-routes.ts`
- Test: `apps/agent-api/src/goat-routes.test.ts`
- Modify: `apps/agent-api/src/app.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/agent-api/src/goat-routes.test.ts`:

```ts
import type { MiddlewareHandler } from "hono";
import type {
  MerchantInfo,
  OrderProof,
  OrderProofResponse,
  X402PaymentRequired,
} from "goatflow-sdk-server";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { GoatMerchantClient } from "./goat-client.js";

const allowPayment: MiddlewareHandler = async (_c, next) => next();

const MERCHANT: MerchantInfo = {
  merchantId: "merchant-1",
  name: "Roselet",
  receiveType: "DIRECT",
  supportedTokens: [
    { chainId: 48816, symbol: "USDC", tokenContract: "0x2222222222222222222222222222222222222222" },
  ],
};

const ORDER_BODY = {
  payer: "0x1111111111111111111111111111111111111111",
  chainId: 48816,
  tokenSymbol: "USDC",
  tokenContract: "0x2222222222222222222222222222222222222222",
  reflection: { color: "red", gratitude: "thanks" },
};

function x402Response(orderId: string): X402PaymentRequired {
  return {
    x402Version: 2,
    resource: { url: "https://agent.example/v1/goat/reflection" },
    accepts: [],
    order_id: orderId,
    flow: "ERC20_DIRECT",
    token_symbol: "USDC",
  };
}

function statusProof(orderId: string, status: OrderProof["status"]): OrderProof {
  return {
    orderId,
    merchantId: "merchant-1",
    dappOrderId: "",
    chainId: 48816,
    tokenContract: ORDER_BODY.tokenContract,
    tokenSymbol: "USDC",
    fromAddress: ORDER_BODY.payer,
    amountWei: "1000",
    status,
  };
}

function proofPayload(orderId: string): OrderProofResponse["payload"] {
  return {
    order_id: orderId,
    tx_hash: "0xabc",
    log_index: 0,
    from_addr: ORDER_BODY.payer,
    to_addr: "0x3333333333333333333333333333333333333333",
    amount_wei: "1000",
    from_chain_id: 48816,
    status: "INVOICED",
  };
}

interface FakeOverrides {
  merchant?: Partial<MerchantInfo>;
  status?: OrderProof["status"];
  dappOrderId?: string;
  proof?: Partial<OrderProofResponse["payload"]>;
  fail?: boolean;
}

function fakeClient(overrides: FakeOverrides = {}) {
  const fake = {
    lastDappOrderId: "",
    async getMerchant(): Promise<MerchantInfo> {
      if (overrides.fail) throw new Error("upstream down");
      return { ...MERCHANT, ...overrides.merchant };
    },
    async createOrderRaw(params: { dappOrderId: string }): Promise<X402PaymentRequired> {
      fake.lastDappOrderId = params.dappOrderId;
      return x402Response("goat-order-1");
    },
    async getOrderStatus(orderId: string): Promise<OrderProof> {
      return {
        ...statusProof(orderId, overrides.status ?? "INVOICED"),
        dappOrderId: overrides.dappOrderId ?? fake.lastDappOrderId,
      };
    },
    async getOrderProof(orderId: string): Promise<OrderProofResponse> {
      return {
        payload: { ...proofPayload(orderId), ...overrides.proof },
        signature: "0xchecksum",
      };
    },
  };
  return fake;
}

function goatApp(client: ReturnType<typeof fakeClient> | null) {
  return createApp({
    payment: allowPayment,
    goat: client && { client: client as GoatMerchantClient, amountWei: "1000" },
  });
}

async function postOrder(app: ReturnType<typeof goatApp>, body: unknown = ORDER_BODY) {
  return app.request("/v1/goat/reflection/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function postComplete(
  app: ReturnType<typeof goatApp>,
  body: unknown = { orderId: "goat-order-1", ...ORDER_BODY },
) {
  return app.request("/v1/goat/reflection/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GOAT routes", () => {
  it("reports 503 on every GOAT route when not configured", async () => {
    const app = goatApp(null);

    expect((await app.request("/v1/goat/merchant")).status).toBe(503);
    expect((await postOrder(app)).status).toBe(503);
    expect((await postComplete(app)).status).toBe(503);
    expect(await (await app.request("/v1/goat/merchant")).json()).toEqual({
      error: "goat_x402_not_configured",
    });
  });

  it("returns the public merchant configuration", async () => {
    const response = await goatApp(fakeClient()).request("/v1/goat/merchant");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(MERCHANT);
  });

  it("maps upstream merchant failures to 502 without leaking details", async () => {
    const response = await goatApp(fakeClient({ fail: true })).request("/v1/goat/merchant");

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "goat_upstream_unavailable" });
  });

  it("creates an order as HTTP 402 with a PAYMENT-REQUIRED header", async () => {
    const client = fakeClient();
    const response = await postOrder(goatApp(client));

    expect(response.status).toBe(402);
    const header = response.headers.get("PAYMENT-REQUIRED");
    expect(header).toBeTruthy();
    const decoded = JSON.parse(Buffer.from(header as string, "base64").toString());
    expect(decoded.order_id).toBe("goat-order-1");
    expect(client.lastDappOrderId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(JSON.stringify(await response.json())).not.toContain("recommendation");
  });

  it("rejects invalid input before creating an order", async () => {
    const app = goatApp(fakeClient());

    expect((await postOrder(app, { ...ORDER_BODY, reflection: { color: "red" } })).status).toBe(400);
    expect((await postOrder(app, { ...ORDER_BODY, payer: "bad" })).status).toBe(400);
    expect((await postOrder(app, { ...ORDER_BODY, chainId: 1 })).status).toBe(400);
    const notJson = await app.request("/v1/goat/reflection/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(notJson.status).toBe(400);
  });

  it("rejects non-DIRECT merchants", async () => {
    const app = goatApp(fakeClient({ merchant: { receiveType: "DELEGATE" } }));
    const response = await postOrder(app);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "unsupported_merchant_route" });
  });

  it("returns 409 while the order is pending", async () => {
    for (const status of ["CHECKOUT_VERIFIED", "PAYMENT_CONFIRMED"] as const) {
      const client = fakeClient({ status });
      await postOrder(goatApp(client));
      const response = await postComplete(goatApp(client));

      expect(response.status).toBe(409);
      expect((await response.json() as { error: string }).error).toBe("goat_order_pending");
    }
  });

  it("returns 402 for terminal unpaid orders", async () => {
    for (const status of ["FAILED", "EXPIRED", "CANCELLED"] as const) {
      const client = fakeClient({ status });
      await postOrder(goatApp(client));
      const response = await postComplete(goatApp(client));

      expect(response.status).toBe(402);
    }
  });

  it("rejects mismatched order fields", async () => {
    const client = fakeClient({ dappOrderId: "0xdeadbeef" });
    await postOrder(goatApp(client));
    const response = await postComplete(goatApp(client));

    expect(response.status).toBe(409);
    expect((await response.json() as { error: string }).error).toBe("goat_order_mismatch");
  });

  it("rejects mismatched proof fields", async () => {
    const client = fakeClient({ proof: { amount_wei: "9999" } });
    await postOrder(goatApp(client));
    const response = await postComplete(goatApp(client));

    expect(response.status).toBe(409);
    expect((await response.json() as { error: string }).error).toBe("goat_proof_mismatch");
  });

  it("delivers the Rust recommendation only after INVOICED status and matching proof", async () => {
    const client = fakeClient();
    await postOrder(goatApp(client));
    const response = await postComplete(goatApp(client));

    expect(response.status).toBe(200);
    const body = await response.json() as { recommendation: { theme: { title: string } } };
    expect(body.recommendation.theme.title).toBeTruthy();
  });
});
```

Run: `cd apps/agent-api && pnpm vitest run src/goat-routes.test.ts --coverage.enabled=false`
Expected: FAIL — `goat` option and routes do not exist.

- [ ] **Step 2: Implement `goat-routes.ts`**

```ts
import type { Hono } from "hono";
import type { GoatMerchantClient } from "./goat-client.js";
import {
  buildGoatOrderReference,
  type GoatOrderReference,
  InvalidGoatOrderReference,
} from "./goat-order.js";
import {
  type CleanedReflectionInput,
  generateReflectionFromCleanedInput,
  InvalidReflectionInput,
  validateReflectionInput,
} from "./reflection.js";

export interface GoatRouteContext {
  client: GoatMerchantClient;
  amountWei: string;
}

interface GoatReflectionRequest {
  payer: string;
  chainId: number;
  tokenSymbol: string;
  tokenContract: string;
  reflection: unknown;
}

interface ParsedGoatRequest {
  raw: unknown;
  request: GoatReflectionRequest;
  cleaned: CleanedReflectionInput;
}

export function registerGoatRoutes(app: Hono, goat: GoatRouteContext | null) {
  const notConfigured = () =>
    Response.json({ error: "goat_x402_not_configured" }, { status: 503 });

  app.get("/v1/goat/merchant", async c => {
    if (!goat) return notConfigured();
    try {
      return c.json(await goat.client.getMerchant());
    } catch {
      return c.json({ error: "goat_upstream_unavailable" }, 502);
    }
  });

  app.post("/v1/goat/reflection/orders", async c => {
    if (!goat) return notConfigured();
    const parsed = await parseGoatRequest(c.req.raw);
    if (parsed instanceof Response) return parsed;

    const prepared = await prepareOrder(goat, parsed);
    if (prepared instanceof Response) return prepared;

    try {
      const x402 = await goat.client.createOrderRaw({
        dappOrderId: prepared.dapp_order_id,
        chainId: prepared.chain_id,
        tokenSymbol: prepared.token_symbol,
        tokenContract: prepared.token_contract,
        fromAddress: prepared.payer,
        amountWei: prepared.amount_wei,
      });
      return new Response(JSON.stringify(x402), {
        status: 402,
        headers: {
          "content-type": "application/json",
          "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(x402)).toString("base64"),
        },
      });
    } catch {
      return c.json({ error: "goat_upstream_unavailable" }, 502);
    }
  });

  app.post("/v1/goat/reflection/complete", async c => {
    if (!goat) return notConfigured();
    const parsed = await parseGoatRequest(c.req.raw);
    if (parsed instanceof Response) return parsed;
    const orderId = (parsed.raw as { orderId?: unknown }).orderId;
    if (typeof orderId !== "string" || !orderId.trim()) {
      return c.json({ error: "invalid_goat_order_request" }, 400);
    }

    let reference: GoatOrderReference;
    try {
      reference = buildReference(goat, parsed);
    } catch (error) {
      if (error instanceof InvalidGoatOrderReference) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }

    const trimmedOrderId = orderId.trim();
    let status;
    try {
      status = await goat.client.getOrderStatus(trimmedOrderId);
    } catch {
      return c.json({ error: "goat_upstream_unavailable" }, 502);
    }

    if (
      status.status === "FAILED" || status.status === "EXPIRED" || status.status === "CANCELLED"
    ) {
      return c.json({ error: `goat_order_${status.status.toLowerCase()}` }, 402);
    }
    if (status.status !== "INVOICED") {
      return c.json({ error: "goat_order_pending", status: status.status }, 409);
    }
    if (
      status.dappOrderId !== reference.dapp_order_id ||
      status.fromAddress.toLowerCase() !== reference.payer ||
      status.chainId !== reference.chain_id ||
      status.tokenSymbol.toUpperCase() !== reference.token_symbol ||
      status.tokenContract.toLowerCase() !== reference.token_contract ||
      status.amountWei !== reference.amount_wei
    ) {
      return c.json({ error: "goat_order_mismatch" }, 409);
    }

    let proof;
    try {
      proof = await goat.client.getOrderProof(trimmedOrderId);
    } catch {
      return c.json({ error: "goat_upstream_unavailable" }, 502);
    }
    if (
      proof.payload.order_id !== trimmedOrderId ||
      proof.payload.from_addr.toLowerCase() !== reference.payer ||
      proof.payload.amount_wei !== reference.amount_wei ||
      proof.payload.from_chain_id !== reference.chain_id ||
      proof.payload.status !== "INVOICED"
    ) {
      return c.json({ error: "goat_proof_mismatch" }, 409);
    }

    return c.json(generateReflectionFromCleanedInput(parsed.cleaned));
  });
}

async function parseGoatRequest(request: Request): Promise<ParsedGoatRequest | Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "request body must be valid JSON" }, { status: 400 });
  }

  const body = raw as Partial<Record<keyof GoatReflectionRequest, unknown>> | null;
  if (
    !body ||
    typeof body.payer !== "string" ||
    typeof body.tokenSymbol !== "string" ||
    typeof body.tokenContract !== "string" ||
    !Number.isSafeInteger(body.chainId) ||
    body.reflection === undefined
  ) {
    return Response.json({ error: "invalid_goat_order_request" }, { status: 400 });
  }

  try {
    const cleaned = validateReflectionInput(body.reflection);
    return {
      raw,
      request: {
        payer: body.payer,
        chainId: body.chainId as number,
        tokenSymbol: body.tokenSymbol,
        tokenContract: body.tokenContract,
        reflection: body.reflection,
      },
      cleaned,
    };
  } catch (error) {
    if (error instanceof InvalidReflectionInput) {
      return Response.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }
}

function buildReference(goat: GoatRouteContext, parsed: ParsedGoatRequest): GoatOrderReference {
  return buildGoatOrderReference({
    reflection: parsed.cleaned,
    payer: parsed.request.payer,
    chain_id: parsed.request.chainId,
    token_symbol: parsed.request.tokenSymbol,
    token_contract: parsed.request.tokenContract,
    amount_wei: goat.amountWei,
  });
}

async function prepareOrder(
  goat: GoatRouteContext,
  parsed: ParsedGoatRequest,
): Promise<GoatOrderReference | Response> {
  let reference: GoatOrderReference;
  try {
    reference = buildReference(goat, parsed);
  } catch (error) {
    if (error instanceof InvalidGoatOrderReference) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  let merchant;
  try {
    merchant = await goat.client.getMerchant();
  } catch {
    return Response.json({ error: "goat_upstream_unavailable" }, { status: 502 });
  }
  const route = merchant.supportedTokens.find(
    token =>
      token.chainId === reference.chain_id &&
      token.symbol.toUpperCase() === reference.token_symbol &&
      token.tokenContract.toLowerCase() === reference.token_contract,
  );
  if (merchant.receiveType !== "DIRECT" || !route) {
    return Response.json({ error: "unsupported_merchant_route" }, { status: 400 });
  }

  return reference;
}
```

- [ ] **Step 3: Wire the routes into `app.ts`**

Modify `apps/agent-api/src/app.ts`:

```ts
import { Hono, type MiddlewareHandler } from "hono";
import { type GoatRouteContext, registerGoatRoutes } from "./goat-routes.js";
import {
  type CleanedReflectionInput,
  generateReflectionFromCleanedInput,
  InvalidReflectionInput,
  validateReflectionInput,
} from "./reflection.js";

export interface CreateAppOptions {
  payment: MiddlewareHandler;
  goat?: GoatRouteContext | null;
}

export function createApp({ payment, goat = null }: CreateAppOptions) {
  const app = new Hono<{ Variables: { reflectionInput: CleanedReflectionInput } }>();

  // ...existing health and /v1/reflection routes unchanged...

  registerGoatRoutes(app, goat);

  return app;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agent-api && pnpm vitest run --coverage.enabled=false`
Expected: all tests pass.

### Task 8: Wire the server entrypoint

**Files:**
- Modify: `apps/agent-api/src/server.ts`

- [ ] **Step 1: Update `server.ts`**

```ts
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig, loadGoatConfig } from "./config.js";
import { createGoatClient } from "./goat-client.js";
import { createReflectionPayment } from "./payment.js";

const config = loadConfig();
const goatConfig = loadGoatConfig();
const app = createApp({
  payment: createReflectionPayment(config),
  goat: goatConfig && {
    client: createGoatClient(goatConfig),
    amountWei: goatConfig.reflectionAmountWei,
  },
});

serve({ fetch: app.fetch, hostname: config.host, port: config.port }, info => {
  console.log(`Roselet Agent API listening on http://${info.address}:${info.port}`);
});
```

- [ ] **Step 2: Typecheck, test with coverage, and build**

Run: `just agent-check`
Expected: typecheck clean, all tests pass, coverage thresholds met.

Run: `pnpm agent:build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/agent-api
git commit -m "feat: add GOAT x402 DIRECT merchant payment routes"
```

### Task 9: Documentation

**Files:**
- Modify: `apps/agent-api/README.md`
- Modify: `docs/WEB3_GRANT_DEMO.md`
- Modify: `CLAUDE.md` (test counts)
- Modify: `DEVLOG.md`

- [ ] **Step 1: Document the GOAT env vars and endpoints**

In `apps/agent-api/README.md`, add a "GOAT x402 (Testnet3)" section documenting the five env vars, the three endpoints, the 402 order flow, and the INVOICED + proof delivery gate.

- [ ] **Step 2: Update grant demo doc, CLAUDE.md test counts, DEVLOG.md**

Record what was added, why DIRECT mode, why INVOICED + proof gating, verification commands, and remaining external steps (merchant approval, faucet, real Testnet3 order).

- [ ] **Step 3: Commit**

```bash
git add apps/agent-api/README.md docs/WEB3_GRANT_DEMO.md CLAUDE.md DEVLOG.md
git commit -m "docs: document GOAT x402 agent payment path"
```

### Task 10: Final verification and push

- [ ] **Step 1: Run the full verification suite**

```bash
cargo fmt --all -- --check
cargo nextest run -p roselet-recommend -j1
just agent-check
pnpm agent:build
git diff --check
```

Expected: all clean.

- [ ] **Step 2: Push**

```bash
git push
```
