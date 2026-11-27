import { z } from "zod";

import raw from "../../../content/github.json";

/**
 * The numbers behind the GitHub sidebar, written by scripts/github-stats.ts
 * (or by hand) into content/github.json. Validated here so a hand edit that
 * breaks the shape fails the build instead of rendering "undefined".
 */
const count = z.number().int().nonnegative();
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schema = z
  .object({
    user: z.string().min(1),
    /** Day the numbers were taken. */
    updatedAt: isoDay,
    /** PRs merged in the 30 days before updatedAt, the ones agents opened for the account included. */
    prsMerged30d: count,
    /** PRs merged per calendar month, agents' included, oldest first; the last month is the current one, so far. */
    prsByMonth: z.array(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), count })).min(1),
    /** GitHub's contribution calendar: one count per day from `start`, a Sunday, to updatedAt. */
    contributions: z.object({ total: count, start: isoDay, days: z.array(count).min(1) }),
  })
  .refine((s) => new Date(`${s.contributions.start}T00:00:00Z`).getUTCDay() === 0, {
    message: "contributions.start must be a Sunday, the first row of the calendar",
  });

export type GithubStats = z.infer<typeof schema>;

export function parseGithubStats(data: unknown): GithubStats {
  return schema.parse(data);
}

export const githubStats: GithubStats = parseGithubStats(raw);
