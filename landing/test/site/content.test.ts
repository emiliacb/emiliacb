import { readFile } from "fs/promises";
import { fileURLToPath } from "url";

import { marked } from "marked";
import { describe, it, expect } from "vitest";

import { loadContent, renderMarkdown } from "../../src/site/content";

const root = fileURLToPath(new URL("../..", import.meta.url));

describe("renderMarkdown", () => {
  it("keeps accented letters in heading ids", () => {
    const html = renderMarkdown("## Qué es", "es");
    expect(html).toContain('id="qué-es"');
  });

  it("renders the table of contents in the page language", () => {
    const source = "# Título\n\n%table-of-contents%\n\n## Qué es\n";
    expect(renderMarkdown(source, "es")).toContain("Tabla de Contenidos");
    expect(renderMarkdown(source, "en")).toContain("Table of Contents");
  });

  it("does not leave the table of contents <ul> inside a <p>", () => {
    const html = renderMarkdown("# Título\n\n%table-of-contents%\n\n## Uno\n", "en");
    const ul = html.indexOf("<ul>");
    expect(ul).toBeGreaterThan(-1);
    expect(html.lastIndexOf("</p>", ul)).toBeGreaterThan(html.lastIndexOf("<p>", ul));
    expect(html).not.toContain("%table-of-contents%");
  });

  it("does not touch the global marked defaults", () => {
    const before = marked.parse("## Hola", { async: false });
    renderMarkdown("## Qué es", "es");
    expect(marked.parse("## Hola", { async: false })).toBe(before);
    expect(before).not.toContain("aria-label");
  });
});

describe("loadContent", () => {
  it("loads the three published posts, newest first", async () => {
    const content = await loadContent(root);

    expect(content.posts.map((post) => post.slug)).toEqual([
      "2026-07-27-limits-of-autonomous-assistants",
      "2025-04-09-voice-ai-bloat-building-lean-agent",
      "2025-03-22-handling-multiple-languages-in-a-single-prompt",
    ]);
  });

  it("renders every post in both languages", async () => {
    const content = await loadContent(root);

    for (const post of content.posts) {
      expect(post.html.en).toBeTruthy();
      expect(post.html.es).toBeTruthy();
      expect(post.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      const source = await readFile(`${root}content/blog/${post.slug}.md`, "utf8");
      if (source.includes("%table-of-contents%")) {
        expect(post.html.es).toContain("Tabla de Contenidos");
      }
    }
  });

  it("renders the static pages in both languages", async () => {
    const content = await loadContent(root);

    expect(content.pages.en.home).toContain("AI Engineer");
    expect(content.pages.es.home).toContain("AI Engineer");
    expect(content.pages.es.about).toBeTruthy();
    expect(content.pages.en.services).toBeTruthy();
  });
});
