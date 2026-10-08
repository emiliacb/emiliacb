import { z } from "zod";

/**
 * Blog frontmatter. gray-matter parses unquoted YAML dates into Date objects,
 * so `date` accepts both and is normalised to an ISO string.
 */
const isoDate = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return new Date(time).toISOString();
  });

/**
 * Unknown keys are stripped. `slug` is ignored on purpose: the URL comes from
 * the file name, so renaming a frontmatter slug can't change a published URL.
 * `tags` and `categories` are not used by the site yet.
 */
export const postFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  date: isoDate,
  preview: z.string().optional(),
  draft: z.boolean().default(false),
  slug: z.string().optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
});

export type PostFrontmatter = z.output<typeof postFrontmatterSchema>;

/**
 * Throws if a post's frontmatter is invalid. Called at build time, so a bad
 * post fails the build instead of shipping a broken page.
 */
export function parsePostFrontmatter(data: unknown, file: string): PostFrontmatter {
  const result = postFrontmatterSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid frontmatter in ${file}: ${issues}`);
  }
  return result.data;
}
