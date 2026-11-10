import { fileURLToPath } from "url";

import { describe, expect, it } from "vitest";

import { LANGS, type Lang } from "../../src/shared/lang";
import { PAGES, SITE_URL } from "../../src/shared/site";
import { dictionaries } from "../../src/shared/i18n";
import { loadContent } from "../../src/site/content";
import type { RenderCtx } from "../../src/site/context";
import { renderLlmsTxt, renderSiteMarkdown } from "../../src/site/markdown";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function setup() {
  const content = await loadContent(root);
  const assets = { script: () => "/x.js", css: "/x.css", buildId: "test" };
  const ctxFor = (lang: Lang): RenderCtx => ({ lang, t: dictionaries[lang], assets, content });
  const files = renderSiteMarkdown(ctxFor);
  const byPath = new Map(files.map((f) => [f.path, f.markdown]));
  return { content, ctxFor, files, byPath };
}

describe("renderSiteMarkdown", () => {
  it("writes a .md version of every page and post in both languages", async () => {
    const { content, byPath } = await setup();
    for (const lang of LANGS) {
      for (const page of PAGES) expect(byPath.has(`/${lang}${page.path}.md`), page.path).toBe(true);
      for (const post of content.posts) expect(byPath.has(`/${lang}/blog/${post.slug}.md`)).toBe(true);
    }
    expect(byPath.has("/en.md")).toBe(true);
    expect(byPath.has("/es/about.md")).toBe(true);
  });

  it("turns the table of contents into a Markdown list in the page language", async () => {
    const { byPath } = await setup();
    const es = byPath.get("/es/services.md")!;
    expect(es).not.toContain("%table-of-contents%");
    expect(es).toContain("**Tabla de Contenidos**");
    expect(es).toContain("- [Mentoría](#mentoría)");
  });

  it("makes every link absolute and points page links at their .md", async () => {
    const { files, byPath } = await setup();
    for (const { path, markdown } of files) expect(markdown, path).not.toContain("](/");

    expect(byPath.get("/en.md")).toContain(`[Who I Am](${SITE_URL}/en/about.md)`);
    expect(byPath.get("/en/services.md")).toContain(`(${SITE_URL}/en/courses.md)`);
    expect(byPath.get("/en/blog/2025-04-09-voice-ai-bloat-building-lean-agent.md")).toContain(
      `(${SITE_URL}/public/agent.jpg)`,
    );
  });

  it("drops the inline HTML of the home", async () => {
    const { byPath } = await setup();
    const home = byPath.get("/es.md")!;
    expect(home).not.toMatch(/<br|<a /);
    expect(home).toContain("mailto:");
  });

  it("puts the post's description and date under its title", async () => {
    const { content, byPath } = await setup();
    const post = content.posts[0];
    const md = byPath.get(`/en/blog/${post.slug}.md`)!;
    expect(md.startsWith("# ")).toBe(true);
    expect(md).toContain(post.description);
    expect(md).not.toContain("draft:");
  });

  it("lists the posts in the blog index", async () => {
    const { content, byPath } = await setup();
    const index = byPath.get("/es/blog.md")!;
    for (const post of content.posts) expect(index).toContain(`${SITE_URL}/es/blog/${post.slug}.md`);
  });
});

describe("renderLlmsTxt", () => {
  it("follows the llms.txt shape and links the .md versions", async () => {
    const { content, ctxFor, byPath } = await setup();
    const txt = renderLlmsTxt(ctxFor);

    expect(txt.startsWith("# ")).toBe(true);
    expect(txt).toMatch(/^> /m);
    expect(txt).toContain("## Optional");

    const links = [...txt.matchAll(/\]\((https:\/\/[^)]+\.md)\)/g)].map((m) => m[1].slice(SITE_URL.length));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(byPath.has(link), link).toBe(true);
    for (const post of content.posts) expect(links).toContain(`/en/blog/${post.slug}.md`);
  });
});
