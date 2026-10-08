import type { Lang } from "../../shared/lang";

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  /** Date from the frontmatter, as an ISO string. */
  date: string;
  /** File name under public/, e.g. "agent.jpg". */
  preview?: string;
  draft: boolean;
};

export type Post = PostMeta & {
  /** Rendered HTML per language (the body is the same; the table of contents label changes). */
  html: Record<Lang, string>;
};

/** Markdown pages under content/pages/{lang}/. */
export type PageContentId = "home" | "about" | "services";

/** Everything loaded from content/, once, at build time. */
export type Content = {
  /** Rendered HTML of content/pages/{lang}/{id}.md. */
  pages: Record<Lang, Record<PageContentId, string>>;
  /** Published posts (drafts excluded), newest first. */
  posts: Post[];
};
