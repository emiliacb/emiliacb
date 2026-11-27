import { LANGS, type Lang } from "../../shared/lang";
import { PAGES, markdownPath } from "../../shared/site";
import type { RenderCtx } from "../../site/context";
import { WEBMCP_ENABLED } from "../enabled";

/**
 * Where the list_md_pages tool fetches the manifest from. The tool has the
 * same path in src/webmcp/client/tools/content.js: keep the two in step (a
 * test holds them together).
 */
export const MANIFEST_PATH = "/webmcp/pages.json";

export type ManifestEntry = {
  /** Root-relative path of the .md file: "/en/about.md", "/en.md", "/es/blog/<slug>.md". */
  path: string;
  title: string;
  lang: Lang;
  /** "index" lists other pages (the blog); the rest are a page or a post. */
  kind: "page" | "post" | "index";
};

/**
 * What the list_md_pages tool lists as the site's Markdown pages. It comes
 * from the same loops as renderSiteMarkdown, so a page cannot have a .md file
 * and be missing here (the test in test/webmcp/site.test.ts holds the two
 * together); parsing llms.txt in the browser would only cover the English pages
 * and drop titles whenever its prose changes. Paths are root-relative: the tool
 * resolves them against the origin it runs on, so they also work in wrangler dev.
 */
export function renderPagesManifest(ctxFor: (lang: Lang) => RenderCtx): ManifestEntry[] {
  const entries: ManifestEntry[] = [];
  for (const lang of LANGS) {
    const ctx = ctxFor(lang);
    for (const page of PAGES) {
      entries.push({
        path: markdownPath(lang, page.path),
        title: ctx.t.pages[page.id].mapTitle,
        lang,
        kind: page.id === "blog" ? "index" : "page",
      });
    }
    for (const post of ctx.content.posts) {
      entries.push({ path: markdownPath(lang, `/blog/${post.slug}`), title: post.title, lang, kind: "post" });
    }
  }
  return entries;
}

/** The files the build writes into dist for WebMCP: the manifest, or nothing when the feature is off. */
export function renderBuildFiles(ctxFor: (lang: Lang) => RenderCtx): { path: string; content: string }[] {
  if (!WEBMCP_ENABLED) return [];
  return [{ path: MANIFEST_PATH, content: `${JSON.stringify({ pages: renderPagesManifest(ctxFor) }, null, 2)}\n` }];
}
