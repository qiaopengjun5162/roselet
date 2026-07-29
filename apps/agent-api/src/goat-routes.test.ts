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
    {
      chainId: 48816,
      symbol: "USDC",
      tokenContract: "0x2222222222222222222222222222222222222222",
    },
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

    expect((await postOrder(app, { ...ORDER_BODY, reflection: { color: "red" } })).status).toBe(
      400,
    );
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
      expect(((await response.json()) as { error: string }).error).toBe("goat_order_pending");
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
    expect(((await response.json()) as { error: string }).error).toBe("goat_order_mismatch");
  });

  it("rejects mismatched proof fields", async () => {
    const client = fakeClient({ proof: { amount_wei: "9999" } });
    await postOrder(goatApp(client));
    const response = await postComplete(goatApp(client));

    expect(response.status).toBe(409);
    expect(((await response.json()) as { error: string }).error).toBe("goat_proof_mismatch");
  });

  it("delivers the Rust recommendation only after INVOICED status and matching proof", async () => {
    const client = fakeClient();
    await postOrder(goatApp(client));
    const response = await postComplete(goatApp(client));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { recommendation: { theme: { title: string } } };
    expect(body.recommendation.theme.title).toBeTruthy();
  });
});
