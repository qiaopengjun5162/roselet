import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createReflectionPayment } from "./payment.js";

const config = loadConfig();
const app = createApp({ payment: createReflectionPayment(config) });

serve({ fetch: app.fetch, hostname: config.host, port: config.port }, info => {
  console.log(`Roselet Agent API listening on http://${info.address}:${info.port}`);
});
