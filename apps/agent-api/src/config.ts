import { address, type Address } from "@solana/kit";

export const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" as const;
export const DEFAULT_FACILITATOR_URL = "https://x402.org/facilitator";
export const DEFAULT_REFLECTION_PRICE = "$0.001";

export interface AgentApiConfig {
  facilitatorUrl: string;
  host: "127.0.0.1" | "0.0.0.0";
  network: typeof SOLANA_DEVNET;
  payTo: Address;
  port: number;
  price: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgentApiConfig {
  const payTo = env.X402_SVM_PAY_TO?.trim();
  if (!payTo) throw new Error("X402_SVM_PAY_TO is required");

  const host = env.AGENT_API_HOST?.trim() || "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "0.0.0.0") {
    throw new Error("AGENT_API_HOST must be 127.0.0.1 or 0.0.0.0");
  }

  const port = Number(env.AGENT_API_PORT || "4021");
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("AGENT_API_PORT must be a valid TCP port");
  }

  const price = env.X402_REFLECTION_PRICE?.trim() || DEFAULT_REFLECTION_PRICE;
  if (!/^\$\d+(?:\.\d{1,6})?$/.test(price) || Number(price.slice(1)) <= 0) {
    throw new Error("X402_REFLECTION_PRICE must be a positive USD amount such as $0.001");
  }

  return {
    facilitatorUrl: env.X402_FACILITATOR_URL?.trim() || DEFAULT_FACILITATOR_URL,
    host,
    network: SOLANA_DEVNET,
    payTo: address(payTo),
    port,
    price,
  };
}

export const DEFAULT_GOATX402_API_URL = "https://x402-api-lx58aabp0r.testnet3.goat.network/";

export interface GoatX402Config {
  apiUrl: string;
  merchantId: string;
  apiKey: string;
  apiSecret: string;
  reflectionAmountWei: string;
}

// 部分配置直接启动失败：避免部署环境凭据缺失却静默降级。
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
