import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { PAGES } from "../../src/shared/site";
import { LANGLESS_ROUTES, matchesRoute } from "../../src/worker/index";

/** wrangler.jsonc is JSONC: strip comments, but leave string contents (like "https://") alone. */
function readWranglerJsonc(): { assets: { run_worker_first: string[] } } {
  const raw = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
  const json = raw.replace(/("(?:\\.|[^"\\])*")|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (_m, str) => str ?? "");
  return JSON.parse(json);
}

describe("Worker routes vs wrangler.jsonc", () => {
  const { run_worker_first: runWorkerFirst } = readWranglerJsonc().assets;

  it("sends every language-less PAGES path to the Worker", () => {
    for (const page of PAGES.filter((p) => p.path !== "")) {
      const covered = runWorkerFirst.some((entry) => matchesRoute(entry, page.path));
      expect(covered, `${page.path} is not in run_worker_first`).toBe(true);
    }
  });

  it("lists every redirect route in run_worker_first", () => {
    expect(runWorkerFirst).toEqual(expect.arrayContaining(LANGLESS_ROUTES.filter((r) => r === "/blog/*")));
  });
});

describe("matchesRoute", () => {
  it("matches exact paths and their trailing-slash form", () => {
    expect(matchesRoute("/about", "/about")).toBe(true);
    expect(matchesRoute("/about", "/about/")).toBe(true);
    expect(matchesRoute("/about", "/about/team")).toBe(false);
  });

  it("matches prefix patterns on segment boundaries only", () => {
    expect(matchesRoute("/blog/*", "/blog/foo")).toBe(true);
    expect(matchesRoute("/blog/*", "/blogger")).toBe(false);
  });
});
