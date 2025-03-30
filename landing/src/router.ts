import { Readable } from "node:stream";
import { createReadStream } from "node:fs";

import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";

import homeHandler from "./routes/home";
import blogHandler from "./routes/blog";
import servicesHandler from "./routes/services";
import aboutHandler from "./routes/about";
import notFoundHandler from "./routes/not-found";
import { langMiddleware } from "./middlewares/lang";

const router = new Hono();

router
  .get("/public/*", (c, next) => {
    const path = c.req.path;
    const oneHour = 3600;
    const oneDay = 86400;

    if (path.endsWith(".css")) {
      c.header(
        "Cache-Control",
        `public, max-age=${oneHour}, stale-while-revalidate`
      );
      return next();
    }

    c.header("Cache-Control", `public, max-age=${oneDay}`);

    return next();
  })
  .get(
    "/public/*",
    serveStatic({
      root: "./public",
      rewriteRequestPath(path) {
        return path.replace(/^\/public/, "");
      },
    })
  )
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
