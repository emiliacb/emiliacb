import { Readable } from "node:stream";
import { createReadStream } from "node:fs";

import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { RateLimiterMemory } from "rate-limiter-flexible";

import homeHandler from "./routes/home";
import blogHandler from "./routes/blog";
import servicesHandler from "./routes/services";
import aboutHandler from "./routes/about";
import notFoundHandler from "./routes/not-found";
import { langMiddleware } from "./middlewares/lang";

const BLOCK_SECONDS = 120;

const router = new Hono();
const ipLimiter = new RateLimiterMemory({
  points: 20,
  duration: 60,
});

router
  .use("*", (c, next) => {
    const time = new Date().toISOString();
    console.log(`${time} - ${c.req.method} ${c.req.path}`);
    return next();
  })
  .use("*", async (c, next) => {
    // @ts-expect-error: req.ip exists
    const ip = c.req.ip;
    const { msBeforeNext } = (await ipLimiter.get(ip)) || {};

    try {
      await ipLimiter.consume(ip);
      await next();
    } catch (error) {
      await ipLimiter.block(ip, BLOCK_SECONDS);
      return c.html(
        `You have been blocked due too many requests. Please wait ${
          msBeforeNext ? Math.trunc(msBeforeNext / 1000) : BLOCK_SECONDS
        } seconds.`,
        429
      );
    }
  })
  .get("/health", (c) => {
    return c.json({ status: "ok" });
  })
  .get("/public/*.css)", (c, next) => {
    const oneHour = 3600;
    const sixHours = 21600;

    c.header(
      "Cache-Control",
      `public, max-age=${oneHour}, stale-while-revalidate=${sixHours}`
    );
    return next();
  })
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
