import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { createPaymentWrapper, x402ResourceServer } from "@x402/mcp";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { generateReflection } from "./reflection.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const facilitator = new HTTPFacilitatorClient({ url: config.facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitator).register(
    config.network,
    new ExactSvmScheme(),
  );
  await resourceServer.initialize();
  const accepts = await resourceServer.buildPaymentRequirements({
    scheme: "exact",
    network: config.network,
    payTo: config.payTo,
    price: config.price,
  });
  const paid = createPaymentWrapper(resourceServer, { accepts });
  const server = new McpServer({ name: "roselet-agent", version: "0.1.0" });

  server.tool(
    "roselet_reflection",
    "Generate a Roselet flower-language reflection after a Solana x402 payment.",
    {
      color: z.enum(["red", "white", "yellow"]),
      gratitude: z.string().max(500).optional(),
      anxiety: z.string().max(500).optional(),
      hope: z.string().max(500).optional(),
    },
    paid(async input => ({
      content: [{ type: "text", text: JSON.stringify(generateReflection(input)) }],
    })),
  );

  await server.connect(new StdioServerTransport());
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
