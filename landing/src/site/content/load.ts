import { readdir, readFile } from "fs/promises";
import path from "path";

import matter from "gray-matter";

import { LANGS, type Lang } from "../../shared/lang";
import { parsePostFrontmatter } from "./schema";
import { renderMarkdown } from "./markdown";
import type { Content, PageContentId, Post } from "./types";

const PAGE_IDS: PageContentId[] = ["home", "about", "services"];

/**
 * Reads everything under content/ once, at build time. Throws on a missing
 * page or an invalid post, so a broken content tree fails the build.
 */
export async function loadContent(rootDir: string): Promise<Content> {
  const pages = {} as Content["pages"];
  for (const lang of LANGS) {
    pages[lang] = {} as Record<PageContentId, string>;
    for (const id of PAGE_IDS) {
      const file = path.join(rootDir, "content/pages", lang, `${id}.md`);
      const source = await readFile(file, "utf8");
      pages[lang][id] = renderMarkdown(source, lang);
    }
  }

  const blogDir = path.join(rootDir, "content/blog");
  const files = (await readdir(blogDir)).filter((file) => path.extname(file) === ".md");

  const posts: Post[] = [];
  for (const file of files) {
    const source = await readFile(path.join(blogDir, file), "utf8");
    const { data, content } = matter(source);
    // Validate before the draft check so a broken draft still fails the build.
    const meta = parsePostFrontmatter(data, path.join("content/blog", file));
    if (meta.draft) continue;

    // The slug is the file name, not the frontmatter slug, so URLs stay stable.
    const slug = path.basename(file, ".md");
    const html = Object.fromEntries(
      LANGS.map((lang: Lang) => [lang, renderMarkdown(content, lang)])
    ) as Post["html"];

    posts.push({
      slug,
      title: meta.title,
      description: meta.description,
      date: meta.date,
      preview: meta.preview,
      draft: meta.draft,
      html,
    });
  }

  // ISO strings sort correctly as text; newest first.
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return { pages, posts };
}
