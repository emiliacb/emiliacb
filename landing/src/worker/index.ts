import { Hono } from "hono";

import { PAGES, markdownPath } from "../shared/site";
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

/** Serves the language's version of a language-less URL in place, without a redirect. */
async function serveNegotiated(request: Request, env: Env, assetPath: (lang: Lang) => string) {
  const lang = pickLang(request);
  const asset = await env.ASSETS.fetch(new Request(new URL(assetPath(lang), request.url)));

  const headers = new Headers(asset.headers);
  headers.set("Cache-Control", "private, no-cache");
  headers.set("Vary", "Accept-Language, Cookie");
  headers.set("Content-Language", lang);
  return new Response(asset.body, { status: asset.status, headers });
}

// "/" is one URL for both languages, so the response varies on what picked the language.
app.get("/", (c) => serveNegotiated(c.req.raw, c.env, (lang) => `/${lang}`));

// The home's Markdown version, for LLMs and agents ("/en.md", "/es.md" in dist).
// The charset is explicit: production serves .md without one, which browsers
// read as Windows-1252. Only on success: a miss is the HTML 404 page.
app.get("/.md", async (c) => {
  const res = await serveNegotiated(c.req.raw, c.env, (lang) => markdownPath(lang, ""));
  if (res.ok) res.headers.set("Content-Type", "text/markdown; charset=utf-8");
  return res;
});

// Everything else that reaches the Worker: language-less pages (and their .md
// versions, "/about.md" → "/en/about.md") redirect, the rest is static.
app.all("*", (c) => {
  const url = new URL(c.req.url);
  const pagePath = url.pathname.endsWith(".md") ? url.pathname.slice(0, -".md".length) : url.pathname;
  if (LANGLESS_ROUTES.some((route) => matchesRoute(route, pagePath))) {
    c.header("Vary", "Accept-Language, Cookie");
    c.header("Cache-Control", "private, no-cache");
    return c.redirect(`/${pickLang(c.req.raw)}${url.pathname}${url.search}`, 302);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
