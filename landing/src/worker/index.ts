import { Hono } from "hono";

import { PAGES } from "../shared/site";
import { langFromCookie, negotiateLang, type Lang } from "../shared/lang";

export type Env = { ASSETS: Fetcher };

/**
 * Language-less page URLs that redirect to /{lang}{path}. Same pattern syntax as
 * run_worker_first in wrangler.jsonc: "/x" is exact, "/x/*" is a prefix.
 */
export const LANGLESS_ROUTES: readonly string[] = [
  ...PAGES.map((page) => page.path).filter((path) => path !== ""),
  "/blog/*",
];

export function matchesRoute(pattern: string, pathname: string): boolean {
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  return pathname === pattern || pathname === `${pattern}/`;
}

/** Cookie wins over the browser's preference: it records an explicit switcher choice. */
function pickLang(request: Request): Lang {
  return langFromCookie(request.headers.get("cookie")) ?? negotiateLang(request.headers.get("accept-language"));
}

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ status: "ok" }));

// The mascot endpoint returns in a later phase; until then the API is a plain 404.
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// "/" is one URL for both languages, so the response varies on what picked the language.
app.get("/", async (c) => {
  const lang = pickLang(c.req.raw);
  const asset = await c.env.ASSETS.fetch(new Request(new URL(`/${lang}`, c.req.url)));

  const headers = new Headers(asset.headers);
  headers.set("Cache-Control", "private, no-cache");
  headers.set("Vary", "Accept-Language, Cookie");
  headers.set("Content-Language", lang);
  return new Response(asset.body, { status: asset.status, headers });
});

// Everything else that reaches the Worker: language-less pages redirect, the rest is static.
app.all("*", (c) => {
  const url = new URL(c.req.url);
  if (LANGLESS_ROUTES.some((route) => matchesRoute(route, url.pathname))) {
    c.header("Vary", "Accept-Language, Cookie");
    c.header("Cache-Control", "private, no-cache");
    return c.redirect(`/${pickLang(c.req.raw)}${url.pathname}${url.search}`, 302);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
