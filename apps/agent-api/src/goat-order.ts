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
