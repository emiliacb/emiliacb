import { describe, it, expect } from "vitest";

import { dictionaries } from "../../src/shared/i18n";
import type { RenderCtx } from "../../src/site/context";
import githubSidebar from "../../src/site/components/github-sidebar";
import { githubStats, parseGithubStats, type GithubStats } from "../../src/site/github/stats";

const stats: GithubStats = {
  user: "emiliacb",
  updatedAt: "2026-11-26",
  prsMerged30d: { own: 284, requested: 178 },
  commits: { year: 1055, last30d: 298, weekly: [0, 3, 12] },
  publicRepos: 22,
  stars: 16,
  languages: [{ name: "TypeScript", repos: 4 }],
};

function render(lang: "en" | "es", data = stats) {
  const ctx = { lang, t: dictionaries[lang] } as RenderCtx;
  return String(githubSidebar(ctx, data));
}

describe("github stats", () => {
  it("content/github.json is valid", () => {
    expect(githubStats.user).toBe("emiliacb");
  });

  it("rejects a hand edit that breaks the shape", () => {
    expect(() => parseGithubStats({ ...stats, prsMerged30d: 462 })).toThrow();
    expect(() => parseGithubStats({ ...stats, updatedAt: "26/11/2026" })).toThrow();
  });
});

describe("githubSidebar", () => {
  it("shows the merged PRs as one number: own plus requested", () => {
    expect(render("en")).toContain(">462</dd>");
  });

  it("draws one bar per week, the last one as this week", () => {
    const html = render("en");
    expect(html.match(/<rect/g)).toHaveLength(3);
    expect(html.match(/gh-bar-now/g)).toHaveLength(1);
  });

  it("formats numbers and dates in the page's language", () => {
    expect(render("en")).toContain("1,055");
    expect(render("en")).toContain("November 26, 2026");
    expect(render("es")).toContain("26 de noviembre de 2026");
    expect(render("es")).toContain("Ver en GitHub");
  });

  it("starts hidden, so nothing shows before the drawer upgrades", () => {
    const html = render("en");
    expect(html).toMatch(/<ui-drawer-content hidden/);
    expect(html).toMatch(/<ui-drawer-backdrop hidden/);
  });

  it("leaves out the languages section when there are none", () => {
    expect(render("en", { ...stats, languages: [] })).not.toContain("Languages in public repositories");
  });
});
