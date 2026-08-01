import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoatClient } from "./goat-client.js";

const CONFIG = {
  apiUrl: "https://goat.example",
  merchantId: "merchant-1",
  apiKey: "key-1",
  apiSecret: "secret-1",
  reflectionAmountWei: "1000",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createGoatClient", () => {
  it("wraps the official SDK without exposing credentials", () => {
    const client = createGoatClient(CONFIG);

    expect(typeof client.getMerchant).toBe("function");
    expect(typeof client.createOrderRaw).toBe("function");
    expect(typeof client.getOrderStatus).toBe("function");
    expect(typeof client.getOrderProof).toBe("function");
    expect(JSON.stringify(client)).not.toContain("secret-1");
  });

  it("forwards every method to the official SDK endpoints", async () => {
    const calls: { url: string; method?: string; body?: string }[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method, body: init?.body as string | undefined });

      if (url.includes("/merchants/")) {
        return Response.json({
          merchant_id: "merchant-1",
          name: "Roselet",
          receive_type: "DIRECT",
          wallets: [{
            chain_id: 48816,
            token_symbol: "USDC",
            token_contract: "0x2222222222222222222222222222222222222222",
          }],
        });
      }
      if (url.endsWith("/proof")) {
        return Response.json({
          payload: {
            order_id: "o1",
            tx_hash: "0xabc",
            log_index: 0,
            from_addr: "0x1111111111111111111111111111111111111111",
            to_addr: "0x3333333333333333333333333333333333333333",
            amount_wei: "1000",
            from_chain_id: 48816,
            status: "INVOICED",
          },
          signature: "0xchecksum",
        });
      }
      if (init?.method === "GET") {
        return Response.json({
          order_id: "o1",
          merchant_id: "merchant-1",
          dapp_order_id: "0xdapp",
          chain_id: 48816,
          token_contract: "0x2222222222222222222222222222222222222222",
          token_symbol: "USDC",
          from_address: "0x1111111111111111111111111111111111111111",
          amount_wei: "1000",
          status: "INVOICED",
        });
      }
      return Response.json(
        {
          x402Version: 2,
          resource: { url: "https://agent.example/v1/goat/reflection" },
          accepts: [],
          order_id: "o1",
          flow: "ERC20_DIRECT",
          token_symbol: "USDC",
        },
        { status: 402 },
      );
    });

    const client = createGoatClient(CONFIG);

    const merchant = await client.getMerchant();
    expect(merchant.receiveType).toBe("DIRECT");
    expect(calls[0].url).toBe("https://goat.example/merchants/merchant-1");

    const order = await client.createOrderRaw({
      dappOrderId: "0xdapp",
      chainId: 48816,
      tokenSymbol: "USDC",
      tokenContract: "0x2222222222222222222222222222222222222222",
      fromAddress: "0x1111111111111111111111111111111111111111",
      amountWei: "1000",
    });
    expect(order.order_id).toBe("o1");
    expect(JSON.parse(calls[1].body as string).dapp_order_id).toBe("0xdapp");

    const status = await client.getOrderStatus("o1");
    expect(status.status).toBe("INVOICED");
    expect(status.dappOrderId).toBe("0xdapp");

    const proof = await client.getOrderProof("o1");
    expect(proof.payload.order_id).toBe("o1");
  });
});
