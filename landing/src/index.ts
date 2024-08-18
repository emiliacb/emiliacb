import { serve } from "@hono/node-server";
import { Hono } from "hono";
import router from "./router";

const app = new Hono()
  .route("/", router)

serve({
  fetch: app.fetch,
  port: 3000,
});
