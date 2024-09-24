import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";

import homeHandler from "./routes/home";
import blogHandler from "./routes/blog";
import servicesHandler from "./routes/services";
import aboutHandler from "./routes/about";
import notFoundHandler from "./routes/not-found";

const router = new Hono();

router
  .get("/", homeHandler)
  .get(
    "/public/*",
    serveStatic({
      root: "./public",
      rewriteRequestPath(path) {
        return path.replace(/^\/public/, "");
      },
    })
  )
  .get("/about", aboutHandler)
  .get("/blog/*", blogHandler)
  .get("/services", servicesHandler)
  .get("*", notFoundHandler);

export default router;
