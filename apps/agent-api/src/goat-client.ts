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

// 凭据只存在于 SDK 实例内部，路由层永远接触不到 apiKey/apiSecret。
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
