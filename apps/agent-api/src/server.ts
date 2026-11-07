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
