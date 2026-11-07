import type { Env, Hono } from "hono";
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

export function registerGoatRoutes<E extends Env>(app: Hono<E>, goat: GoatRouteContext | null) {
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
    // proof.signature 只是未签名 checksum，不能作为背书；只校验 payload 字段一致性。
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
