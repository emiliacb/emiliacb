import { Context, Next } from "hono";

const validLangs = ["en", "es"];

export async function langMiddleware(c: Context, next: Next) {
  // Skip language middleware for home path
  if (c.req.path === "/") {
    await next();
    return;
  }

  const pathSegments = c.req.path.split("/").filter(Boolean);
  const [firstSegment] = pathSegments;

  // If the first path segment is a valid language, continue
  if (validLangs.includes(firstSegment)) {
    await next();
    return;
  }

  // Otherwise detect language and redirect
  const acceptLang = c.req.header("accept-language")?.split(",")[0];
  const lang = acceptLang?.includes("es") ? "es" : "en";
  const newPath = `/${lang}${c.req.path === "/" ? "" : c.req.path}`;
  return c.redirect(newPath);
}
