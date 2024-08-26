import { Hono } from "hono";
import { cache } from "hono/cache";

import homeHandler from "./routes/home";
import blogHandler from "./routes/blog";
import servicesHandler from "./routes/services";
import aboutHandler from "./routes/about";
import notFoundHandler from "./routes/not-found";

const router = new Hono();
const cacheVersion = 2;

router
  .get(
    '*',
    cache({
      cacheName: `emiliacb-v${cacheVersion}`,
      cacheControl: 'public, max-age=3605',
    }))
  .get("/", homeHandler)
  .get("/about", aboutHandler)
  .get("/blog/*", blogHandler)
  .get("/services", servicesHandler)
  .get("*", notFoundHandler);

export default router;
