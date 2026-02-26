import { Readable } from "node:stream";
import { createReadStream } from "node:fs";

import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { config } from 'dotenv';

import homeHandler from "./routes/home";
import blogHandler from "./routes/blog";
import servicesHandler from "./routes/services";
import aboutHandler from "./routes/about";
import notFoundHandler from "./routes/not-found";
import { langMiddleware } from "./middlewares/lang";
import { generalCacheMiddleware, cacheVersionMiddleware, versionedStaticCacheMiddleware, CACHE_VERSION } from "./middlewares/cache";
import { rateLimiterMiddleware } from "./middlewares/rateLimiter";

config();

const router = new Hono();

router
  .use("*", generalCacheMiddleware)
  .use("*", (c, next) => {
    const time = new Date().toISOString();
    console.log(`${time} - ${c.req.method} ${c.req.path}`);
    return next();
  })
  .use("*", rateLimiterMiddleware)
  .use("*", cacheVersionMiddleware)
  .use(
    `/public/${CACHE_VERSION}/*`,
    versionedStaticCacheMiddleware,
    serveStatic({
      root: "./public",
      rewriteRequestPath(path) {
        return path.replace(/^\/public\/[^/]+/, "");
      },
    })
  )
  .use(
    "/public/*",
    serveStatic({
      root: "./public",
      rewriteRequestPath(path) {
        return path.replace(/^\/public/, "");
      },
    })
  )
  .use('/robots.txt', serveStatic({ path: './public/robots.txt' }))
  .use(
    '/sw.js',
    (c: any, next: any) => { c.header('Cache-Control', 'no-cache'); return next(); },
    serveStatic({ path: './public/sw.js' })
  )
  .get("/health", (c) => {
    return c.json({ status: "ok" });
  })
  .get("/cv", (c) => {
    const nodeStream = createReadStream("./public/cv.pdf");

    c.header("Content-Type", "application/pdf");
    c.header(
      "Content-Disposition",
      'attachment; filename="Emilia_C_B_Resume.pdf"'
    );

    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    return c.body(webStream);
  })
  .use("*", langMiddleware)
  .get("/:lang?", homeHandler)
  .get("/:lang/about", aboutHandler)
  .get("/:lang/blog/*", blogHandler)
  .get("/:lang/services", servicesHandler)
  .get("*", notFoundHandler);

export default router;
