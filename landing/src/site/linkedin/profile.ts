import { z } from "zod";

import raw from "../../../content/linkedin.json";

/**
 * What the LinkedIn sidebar shows, kept by hand in content/linkedin.json:
 * the jobs (the same as the about page's) and the latest post. Validated here
 * so a hand edit that breaks the shape fails the build.
 */
const month = z.string().regex(/^\d{4}-\d{2}$/);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = z.string().min(1);

const schema = z.object({
  /** Newest first; the current job has no `to`. */
  experience: z
    .array(z.object({ company: text, role: z.object({ en: text, es: text }), from: month, to: month.optional() }))
    .min(1),
  latestPost: z.object({
    url: z.string().url().startsWith("https://www.linkedin.com/"),
    date: isoDay,
    /** The post's own language, which stays as written on both versions of the site. */
    lang: z.enum(["en", "es"]),
    /** Its opening lines, as LinkedIn shows them before "see more". */
    lines: z.array(text).min(1),
  }),
});

export type LinkedinProfile = z.infer<typeof schema>;

export function parseLinkedinProfile(data: unknown): LinkedinProfile {
  return schema.parse(data);
}

export const linkedinProfile: LinkedinProfile = parseLinkedinProfile(raw);
