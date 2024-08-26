import { Hono } from "hono";
import { cache } from 'hono/cache'

import homeHandler from "./routes/home";
import blogHandler from "./routes/blog";
import servicesHandler from "./routes/services";
import aboutHandler from "./routes/about";
import notFoundHandler from "./routes/not-found";

const router = new Hono();
const cacheVersion = 1;

router
  .get(
    '*',
    cache({
      cacheName: `emiliacb-v${cacheVersion}`,
      cacheControl: 'max-age=3600',
    }))
  .get("/", homeHandler)
  .get("/about", aboutHandler)
  .get("/blog/*", blogHandler)
  .get("/services", servicesHandler)
  .get("*", notFoundHandler);

export default router;
