import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";

import app, { type Env } from "../../src/worker/index";

const BASE = "http://example.com";

// Calls the Hono app with the real ASSETS binding from the fixture directory.
function get(path: string, headers: Record<string, string> = {}) {
  return app.fetch(new Request(`${BASE}${path}`, { headers, redirect: "manual" }), env as unknown as Env);
}

describe("GET /", () => {
  it("serves the Spanish page for Accept-Language: es", async () => {
    const res = await get("/", { "Accept-Language": "es" });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("home es");
    expect(res.headers.get("Content-Language")).toBe("es");
  });

  it("marks the response as private and varying on language inputs", async () => {
    const res = await get("/", { "Accept-Language": "es" });
    expect(res.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(res.headers.get("Vary")).toContain("Accept-Language");
    expect(res.headers.get("Vary")).toContain("Cookie");
  });

  it("lets the lang cookie override Accept-Language", async () => {
    const res = await get("/", { "Accept-Language": "es", Cookie: "lang=en" });
    expect(await res.text()).toContain("home en");
    expect(res.headers.get("Content-Language")).toBe("en");
  });
});

describe("language-less page redirects", () => {
  it("redirects /about to the Spanish page for an es browser", async () => {
    const res = await get("/about", { "Accept-Language": "es" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/es/about");
  });

  it("keeps the query string and uses the cookie language", async () => {
    const res = await get("/blog/foo?x=1", { Cookie: "lang=en", "Accept-Language": "es" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/en/blog/foo?x=1");
  });
});

describe("other Worker routes", () => {
  it("answers /health", async () => {
    const res = await get("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("returns 404 JSON for the API for now", async () => {
    const res = await get("/api/mascot-comment");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });
});
