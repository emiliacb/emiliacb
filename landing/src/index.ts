import { serve } from "@hono/node-server";
import { Hono } from "hono";
import router from "./router";
import { cache } from 'hono/cache'


const app = new Hono()
const port = parseInt(process.env.PORT ?? "", 10) || 3000;

app.get(
  '*',
  cache({
    cacheName: 'my-app',
    cacheControl: 'max-age=3600',
  })
)
app.route("/", router);

console.log(`\x1b[32mServer listening at port: \x1b[34m${port}\x1b[0m`);

serve({
  fetch: app.fetch,
  port,
});
