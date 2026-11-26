/**
 * Refreshes content/github.json, the numbers the GitHub sidebar shows.
 *
 *   npm run github:stats
 *
 * Run by hand, with the GitHub CLI logged in as the account (`gh auth login`).
 * Most of the work happens in private repositories, which the Actions token of
 * this repository cannot see, so this is not part of the deploy: run it, look
 * at the diff, commit it. Only counts are written, never a PR, repository or
 * commit of a private repository.
 *
 * GitHub's search API allows 30 requests a minute; the script waits between
 * them, so a run takes about two minutes.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { parseGithubStats, type GithubStats } from "../src/site/github/stats";

const USER = "emiliacb";
/** PRs the Marmot bot opens on the account's behalf, which say "Requested by @emiliacb". */
const REQUESTED_BY = `"requested by ${USER}" author:app/sonora-marmot`;
const WEEKS = 52;
const SEARCH_INTERVAL_MS = 2_200;

const root = path.resolve(import.meta.dirname, "..");
const outFile = path.join(root, "content", "github.json");

const day = (date: Date) => date.toISOString().slice(0, 10);
const daysAgo = (from: Date, days: number) => new Date(from.getTime() - days * 86_400_000);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function gh(args: string[]): string {
  return execFileSync("gh", ["api", ...args], { encoding: "utf8" });
}

let lastSearch = 0;
async function searchCount(kind: "issues" | "commits" | "repositories", q: string): Promise<number> {
  const wait = lastSearch + SEARCH_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastSearch = Date.now();
  // The search API also has an unpublished secondary limit; a refused request
  // is retried after a pause rather than failing the whole run.
  for (let attempt = 1; ; attempt++) {
    try {
      const out = gh(["-X", "GET", `search/${kind}`, "-f", `q=${q}`, "-f", "per_page=1", "--jq", ".total_count"]);
      const n = Number(out.trim());
      if (!Number.isInteger(n)) throw new Error(`search/${kind} "${q}" returned ${out}`);
      return n;
    } catch (error) {
      if (attempt === 3) throw error;
      console.warn(`\nsearch/${kind} failed, retrying in 30s`);
      await sleep(30_000);
      lastSearch = Date.now();
    }
  }
}

const today = new Date();
const since30 = day(daysAgo(today, 30));
const since365 = day(daysAgo(today, 365));

const prsOwn = await searchCount("issues", `author:${USER} is:pr is:merged merged:>=${since30}`);
// Scoped to the bot rather than "-author:${USER}": GitHub's search returns
// nothing for that negation next to a quoted phrase.
const prsRequested = await searchCount("issues", `${REQUESTED_BY} is:pr is:merged merged:>=${since30}`);
const commitsYear = await searchCount("commits", `author:${USER} author-date:>=${since365}`);
const commits30d = await searchCount("commits", `author:${USER} author-date:>=${since30}`);

// Oldest week first; the last one ends today.
const weeklyCommits: number[] = [];
for (let i = WEEKS - 1; i >= 0; i--) {
  const end = daysAgo(today, i * 7);
  const start = daysAgo(end, 6);
  weeklyCommits.push(await searchCount("commits", `author:${USER} author-date:${day(start)}..${day(end)}`));
  process.stdout.write(".");
}
process.stdout.write("\n");

// Public, non-fork repositories: what a visitor finds on the profile.
const repos = JSON.parse(
  gh([
    "-X", "GET", "search/repositories",
    "-f", `q=user:${USER} is:public fork:false`,
    "-f", "per_page=100",
    "--jq", "[.items[] | {language, stars: .stargazers_count}]",
  ]),
) as { language: string | null; stars: number }[];

const byLanguage = new Map<string, number>();
for (const repo of repos) {
  if (repo.language) byLanguage.set(repo.language, (byLanguage.get(repo.language) ?? 0) + 1);
}
const languages = [...byLanguage]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 5)
  .map(([name, count]) => ({ name, repos: count }));

const stats: GithubStats = parseGithubStats({
  user: USER,
  updatedAt: day(today),
  prsMerged30d: { own: prsOwn, requested: prsRequested },
  commits: { year: commitsYear, last30d: commits30d, weekly: weeklyCommits },
  publicRepos: repos.length,
  stars: repos.reduce((sum, repo) => sum + repo.stars, 0),
  languages,
});

await fs.writeFile(outFile, `${JSON.stringify(stats, null, 2)}\n`);
console.log(
  `github.json: ${prsOwn + prsRequested} PRs merged in 30 days (${prsOwn} own, ${prsRequested} requested), ` +
    `${commitsYear} commits in a year, ${repos.length} public repos`,
);
