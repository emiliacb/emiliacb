import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

import { byLang, type Lang } from "../../shared/lang";
import { parsePostFrontmatter } from "./schema";
import { renderMarkdown } from "./markdown";
import type { Content, PageContentId, Post } from "./types";

type PageRecord = Record<PageContentId, string>;

async function readPageSources(rootDir: string, lang: Lang): Promise<PageRecord> {
  const read = (id: PageContentId) => readFile(path.join(rootDir, "content/pages", lang, `${id}.md`), "utf8");
  const [home, about, services] = await Promise.all([read("home"), read("about"), read("services")]);
  return { home, about, services };
}

function renderPages(sources: PageRecord, lang: Lang): PageRecord {
  return {
    home: renderMarkdown(sources.home, lang),
    about: renderMarkdown(sources.about, lang),
    services: renderMarkdown(sources.services, lang),
  };
}

/** Parses one post file; null for a draft. Throws on invalid frontmatter. */
async function readPost(blogDir: string, file: string): Promise<Post | null> {
  const source = await readFile(path.join(blogDir, file), "utf8");
  const { data, content } = matter(source);
  // Validate before the draft check so a broken draft still fails the build.
  const meta = parsePostFrontmatter(data, path.join("content/blog", file));
  if (meta.draft) return null;

  return {
    // The slug is the file name, not the frontmatter slug, so URLs stay stable.
    slug: path.basename(file, ".md"),
    title: meta.title,
    description: meta.description,
    date: meta.date,
    preview: meta.preview,
    draft: meta.draft,
    html: byLang((lang) => renderMarkdown(content, lang)),
    markdown: content,
  };
}

/**
 * Reads everything under content/ once, at build time. Throws on a missing
 * page or an invalid post, so a broken content tree fails the build.
 */
export async function loadContent(rootDir: string): Promise<Content> {
  const [en, es] = await Promise.all([readPageSources(rootDir, "en"), readPageSources(rootDir, "es")]);
  const pageSources = { en, es };
  const pages = byLang((lang) => renderPages(pageSources[lang], lang));

  const blogDir = path.join(rootDir, "content/blog");
  const files = (await readdir(blogDir)).filter((file) => path.extname(file) === ".md");
  const read = await Promise.all(files.map((file) => readPost(blogDir, file)));

  // ISO strings sort correctly as text; newest first.
  const posts = read.filter((post) => post !== null).toSorted((a, b) => Date.parse(b.date) - Date.parse(a.date));

  return { pages, pageSources, posts };
}
