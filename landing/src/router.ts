import { Hono } from "hono";

import homeHandler from "./routes/home";
import blogHandler from "./routes/blog";
import servicesHandler from "./routes/services";
import aboutHandler from "./routes/about";
import coursesHandler from "./routes/courses";
import notFoundHandler from "./routes/not-found";

const router = new Hono();

router
  .get("/", homeHandler)
  .get("/about", aboutHandler)
  .get("/courses", coursesHandler)
  .get("/blog", blogHandler)
  .get("/services", servicesHandler)
  .get("*", notFoundHandler);

export default router;
