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
  .use("*", langMiddleware)
  .get("/:lang?", homeHandler)
  .get("/:lang/about", aboutHandler)
  .get("/:lang/blog/*", blogHandler)
  .get("/:lang/services", servicesHandler)
  .get("*", notFoundHandler);

export default router;
