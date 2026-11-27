import { describe, it, expect } from "vitest";

import { dictionaries } from "../../src/shared/i18n";
import type { RenderCtx } from "../../src/site/context";
import githubSidebar from "../../src/site/components/github-sidebar";
import { parseContributionCalendar } from "../../src/site/github/calendar";
import { githubStats, parseGithubStats, type GithubStats } from "../../src/site/github/stats";

const stats: GithubStats = {
  user: "emiliacb",
  updatedAt: "2026-11-27",
  prsMerged30d: 433,
  prsByMonth: [
    { month: "2026-10", count: 535 },
    { month: "2026-11", count: 328 },
  ],
  // Sunday 2026-11-01 to Friday 2026-11-27: four columns, the last one short.
  contributions: { total: 6, start: "2026-11-01", days: [...Array(26).fill(0), 6] },
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
    expect(() => parseGithubStats({ ...stats, prsMerged30d: "433" })).toThrow();
    expect(() => parseGithubStats({ ...stats, updatedAt: "27/11/2026" })).toThrow();
    // The calendar's first row is Sunday.
    expect(() => parseGithubStats({ ...stats, contributions: { ...stats.contributions, start: "2026-11-02" } })).toThrow();
  });
});

describe("githubSidebar", () => {
  it("shows the PRs of the last 30 days as the one number", () => {
    expect(render("en")).toContain(">433</span>");
  });

  it("draws a bar per month, the current one in the accent", () => {
    const html = render("es");
    expect(html.match(/class="gh-month[ "]/g)).toHaveLength(2);
    expect(html.match(/gh-month-now/g)).toHaveLength(1);
    expect(html).toContain("octubre de 2026: 535 pull requests");
  });

  it("draws a square per day of the calendar, today ringed", () => {
    const html = render("en");
    expect(html.match(/<rect x=/g)).toHaveLength(27);
    expect(html.match(/gh-today/g)).toHaveLength(1);
    expect(html).toContain("November 27, 2026: 6 contributions");
    expect(render("es")).toContain("6 contribuciones en el último año");
  });

  it("starts hidden, so nothing shows before the drawer upgrades", () => {
    const html = render("en");
    expect(html).toMatch(/<ui-drawer-content hidden/);
    expect(html).toMatch(/<ui-drawer-backdrop hidden/);
  });
});

describe("parseContributionCalendar", () => {
  const day = (i: number, date: string, label: string) =>
    `<td tabindex="0" data-ix="${i}" style="width: 10px" data-date="${date}" id="contribution-day-component-${i}-0" data-level="1" role="gridcell" class="ContributionCalendar-day"></td>` +
    `<tool-tip id="tooltip-${i}" for="contribution-day-component-${i}-0" popover="manual" data-direction="n" class="sr-only position-absolute">${label}</tool-tip>`;

  const page = (heading: string) =>
    `<h2 class="f4 text-normal mb-2">\n  ${heading}\n</h2><table>` +
    day(0, "2026-11-22", "No contributions on November 22nd.") +
    day(1, "2026-11-23", "1 contribution on November 23rd.") +
    day(2, "2026-11-25", "1,204 contributions on November 25th.") +
    "</table>";

  it("reads each day's count from its label, filling missing days with zero", () => {
    expect(parseContributionCalendar(page("1,205 contributions in the last year"))).toEqual({
      total: 1205,
      start: "2026-11-22",
      days: [0, 1, 0, 1204],
    });
  });

  it("fails when the days do not add up to the heading", () => {
    expect(() => parseContributionCalendar(page("9 contributions in the last year"))).toThrow(/add up/);
  });

  it("fails on a page without the calendar", () => {
    expect(() => parseContributionCalendar("<html>rate limited</html>")).toThrow();
  });
});
