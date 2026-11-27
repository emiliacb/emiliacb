/**
 * Refreshes content/github.json, the numbers the GitHub sidebar shows.
 *
 *   npm run github:stats
 *
 * Run by hand, with the GitHub CLI logged in as the account (`gh auth login`).
 * Most PRs are in private repositories, which the Actions token of this
 * repository cannot see, so this is not part of the deploy: run it, look at
 * the diff, commit it. Only counts are written, never a PR or a repository.
 *
 * GitHub's search API allows 30 requests a minute; the script waits between
 * them, so a run takes about two minutes.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { parseContributionCalendar } from "../src/site/github/calendar";
import { parseGithubStats } from "../src/site/github/stats";

const USER = "emiliacb";
/**
 * PRs that agents open for the account, counted as its own. Each query is
 * one agent; none of them overlaps the account's own PRs, since the agent is
 * the author.
 */
const AGENT_PRS = [
  // Marmot names who asked for each PR: "Requested by @emiliacb". Scoped to
  // the bot rather than "-author:", which GitHub's search answers with
  // nothing next to a quoted phrase.
  `"requested by ${USER}" author:app/sonora-marmot`,
  // Hermes does not say who asked, so all of its PRs count.
  "author:app/hermes-bsario",
];
const MONTHS = 12;
const SEARCH_INTERVAL_MS = 2_200;

const root = path.resolve(import.meta.dirname, "..");
const outFile = path.join(root, "content", "github.json");

const day = (date: Date) => date.toISOString().slice(0, 10);
const daysAgo = (from: Date, days: number) => new Date(from.getTime() - days * 86_400_000);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let lastSearch = 0;
async function searchCount(q: string): Promise<number> {
  const wait = lastSearch + SEARCH_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastSearch = Date.now();
  // The search API also has an unpublished secondary limit; a refused request
  // is retried after a pause rather than failing the whole run.
  for (let attempt = 1; ; attempt++) {
    try {
      const out = execFileSync(
        "gh",
        ["api", "-X", "GET", "search/issues", "-f", `q=${q}`, "-f", "per_page=1", "--jq", ".total_count"],
        { encoding: "utf8" },
      );
      const n = Number(out.trim());
      if (!Number.isInteger(n)) throw new Error(`search "${q}" returned ${out}`);
      return n;
    } catch (error) {
      if (attempt === 3) throw error;
      console.warn(`\nsearch failed, retrying in 30s`);
      await sleep(30_000);
      lastSearch = Date.now();
    }
  }
}

/** Own PRs plus the agents' ones, merged in `range`. */
async function prsMerged(range: string): Promise<{ own: number; agents: number }> {
  const own = await searchCount(`author:${USER} is:pr is:merged merged:${range}`);
  let agents = 0;
  for (const agent of AGENT_PRS) agents += await searchCount(`${agent} is:pr is:merged merged:${range}`);
  return { own, agents };
}

/**
 * The profile's contribution calendar, from the same HTML fragment the profile
 * page loads. Public, no token. Private contributions are in it only when the
 * profile shows them ("Private contributions" in the profile settings).
 */
async function contributionCalendar() {
  const res = await fetch(`https://github.com/users/${USER}/contributions`, {
    headers: { "User-Agent": "contribution-calendar-script" },
  });
  if (!res.ok) throw new Error(`contributions page: HTTP ${res.status}`);
  return parseContributionCalendar(await res.text());
}

const today = new Date();
const last30 = await prsMerged(`>=${day(daysAgo(today, 30))}`);

const prsByMonth: { month: string; count: number }[] = [];
for (let i = MONTHS - 1; i >= 0; i--) {
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  const { own, agents } = await prsMerged(`${day(first)}..${day(lastDay)}`);
  prsByMonth.push({ month: day(first).slice(0, 7), count: own + agents });
  process.stdout.write(".");
}
process.stdout.write("\n");

const contributions = await contributionCalendar();

const stats = parseGithubStats({
  user: USER,
  updatedAt: day(today),
  prsMerged30d: last30.own + last30.agents,
  prsByMonth,
  contributions,
});

// The calendar's days on one line: a file of counts, not 370 lines of them.
const json = JSON.stringify(stats, null, 2).replace(
  /"days": \[[^\]]*\]/,
  `"days": ${JSON.stringify(stats.contributions.days)}`,
);
await fs.writeFile(outFile, `${json}\n`);
console.log(
  `github.json: ${stats.prsMerged30d} PRs merged in 30 days (${last30.own} own, ${last30.agents} by agents), ` +
    `${contributions.total} contributions in the last year`,
);
