import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { parseKeypairBytes } from "./client-keypair.js";
import { decodeBase64JsonHeader, withoutExplicitContentLength } from "./client-network.js";

function formatError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = "cause" in error ? error.cause : undefined;
  return cause ? `${error.message}: ${formatError(cause)}` : error.message;
}

function enableNetworkDiagnostics(): void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = request.url;
    try {
      const response = await originalFetch(input, init);
      const paymentRequired = response.headers.get("payment-required");
      console.error(
        JSON.stringify({
          url,
          status: response.status,
          paymentSignature: request.headers.has("payment-signature"),
          paymentRequired: decodeBase64JsonHeader(paymentRequired),
          paymentResponse: response.headers.has("payment-response"),
        }),
      );
      return response;
    } catch (error) {
      console.error(`fetch ${url}: ${formatError(error)}`);
      throw error;
    }
  };
}

function enableProxyFetch(): void {
  setGlobalDispatcher(new EnvHttpProxyAgent());
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => originalFetch(input, withoutExplicitContentLength(init));
}

async function main(): Promise<void> {
  const keypairPath = process.env.X402_SVM_KEYPAIR_PATH || resolve(homedir(), ".config/solana/id.json");
  const resourceUrl = process.env.X402_RESOURCE_URL || "http://127.0.0.1:4021/v1/reflection";
  const rpcUrl = process.env.X402_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const input = JSON.parse(
    process.env.X402_REFLECTION_INPUT || '{"color":"yellow","hope":"ship the paid agent API"}',
  );
  const keypair = parseKeypairBytes(JSON.parse(await readFile(keypairPath, "utf8")));
  const signer = await createKeyPairSignerFromBytes(keypair);
  if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
    enableProxyFetch();
  }
  if (process.env.X402_DEBUG_NETWORK === "1") enableNetworkDiagnostics();
  const client = new x402Client().register("solana:*", new ExactSvmScheme(signer, { rpcUrl }));
  const paidFetch = wrapFetchWithPayment(fetch, client);

  const response = await paidFetch(resourceUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await response.json();
  const paymentResponse = response.headers.get("payment-response");
  console.log(JSON.stringify({ status: response.status, paymentResponse, body }, null, 2));
  if (!response.ok) process.exitCode = 1;
}

main().catch(error => {
  console.error(formatError(error));
  process.exitCode = 1;
});
