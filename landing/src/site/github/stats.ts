import { z } from "zod";

import raw from "../../../content/github.json";

/**
 * The numbers behind the GitHub sidebar, written by scripts/github-stats.ts
 * (or by hand) into content/github.json. Validated here so a hand edit that
 * breaks the shape fails the build instead of rendering "undefined".
 */
const count = z.number().int().nonnegative();

const schema = z.object({
  user: z.string().min(1),
  /** Day the numbers were taken, YYYY-MM-DD. */
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Merged in the 30 days before updatedAt: the account's own, and Marmot's "Requested by" ones. */
  prsMerged30d: z.object({ own: count, requested: count }),
  commits: z.object({
    year: count,
    last30d: count,
    /** Commits per week, oldest first; the last week ends on updatedAt. */
    weekly: z.array(count).min(1),
  }),
  publicRepos: count,
  stars: count,
  languages: z.array(z.object({ name: z.string().min(1), repos: count })),
});

export type GithubStats = z.infer<typeof schema>;

export function parseGithubStats(data: unknown): GithubStats {
  return schema.parse(data);
}

export const githubStats: GithubStats = parseGithubStats(raw);
