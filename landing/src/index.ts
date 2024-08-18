import { serve } from "@hono/node-server";
import { Hono } from "hono";
import router from "./router";

const app = new Hono().route("/", router);
const port = parseInt(process.env.PORT ?? "", 10) || 3000;

console.log(`\x1b[32mServer listening at port: \x1b[34m${port}\x1b[0m`);

serve({
  fetch: app.fetch,
  port,
});
