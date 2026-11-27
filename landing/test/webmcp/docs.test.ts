import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { LANGS, type Lang } from "../../src/shared/lang";
import { dictionaries } from "../../src/shared/i18n";
import { loadContent } from "../../src/site/content";
import type { RenderCtx } from "../../src/site/context";
import app, { LANGLESS_ROUTES, matchesRoute, type Env } from "../../src/worker/index";
import { enabledTools, toolGroups } from "../../src/webmcp/client/tools/index.js";
import { renderDocsMarkdownFiles, renderDocsPages } from "../../src/webmcp/site/docs";
import { renderAgentNote, renderFooterLink, renderHead, renderRedirects } from "../../src/webmcp/site";
import { WEBMCP_LANGLESS_ROUTES } from "../../src/webmcp/site/routes";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function setup() {
  const content = await loadContent(root);
  const assets = { script: (name: string) => `/assets/${name}.js`, css: "/x.css", buildId: "test" };
  const ctxFor = (lang: Lang): RenderCtx => ({ lang, t: dictionaries[lang], assets, content });
  return { ctxFor };
}

function markup(value: unknown): string {
  const parsed: unknown = JSON.parse(JSON.stringify(value));
  return typeof parsed === "string" ? parsed : "";
}

describe("the /mcp docs page", () => {
  it("is written in both languages as Markdown, with every tool and its group", async () => {
    const { ctxFor } = await setup();
    const files = renderDocsMarkdownFiles(ctxFor);
    expect(files.map((file) => file.path).toSorted()).toEqual(["/en/mcp.md", "/es/mcp.md"]);
    for (const file of files) {
      for (const tool of enabledTools) expect(file.markdown, `${file.path} ${tool.name}`).toContain(`#### \`${tool.name}\``);
      expect(file.markdown).toContain("document.modelContext.getTools()");
      expect(file.markdown).toContain("document.modelContext.executeTool(");
      expect(file.markdown).toContain("/mcp/skills/modifying-page/SKILL.md");
      expect(file.markdown).not.toContain("](/");
      expect(file.markdown).not.toContain("%table-of-contents%");
    }
    expect(files[0].markdown).toContain("not a remote MCP server");
    expect(files[1].markdown).toContain("no son un servidor MCP remoto");
  });

  it("titles every group of the catalog in both languages", async () => {
    const { DOCS_COPY } = await import("../../src/webmcp/site/docs/copy");
    expect(Object.keys(DOCS_COPY.en.groups).toSorted()).toEqual(Object.keys(DOCS_COPY.es.groups).toSorted());
    for (const lang of LANGS) {
      for (const group of toolGroups) expect(DOCS_COPY[lang].groups[group.id], `${lang} ${group.id}`).toBeDefined();
    }
  });

  it("is rendered in the site's layout, with the navbar and the footer", async () => {
    const { ctxFor } = await setup();
    const pages = await renderDocsPages(ctxFor);
    expect(pages.map((page) => page.path).toSorted()).toEqual(["/en/mcp", "/es/mcp"]);
    for (const page of pages) {
      const lang = page.path.startsWith("/en") ? "en" : "es";
      expect(page.html).toContain(`aria-label="${dictionaries[lang].nav.mainNavigation}"`);
      expect(page.html).toContain("<footer");
      expect(page.html).toContain(`rel="canonical" href="https://emiliacabral.com${page.path}"`);
      expect(page.html).toContain(`href="https://emiliacabral.com${page.path}.md"`);
      expect(page.html).not.toContain("[object");
    }
  });

  it("is reached from the Worker's language-less routes and wrangler.jsonc", async () => {
    expect(LANGLESS_ROUTES).toEqual(expect.arrayContaining([...WEBMCP_LANGLESS_ROUTES]));
    const raw = readFileSync(`${root}/wrangler.jsonc`, "utf8");
    const runWorkerFirst = raw.match(/"run_worker_first": \[([\s\S]*?)\]/)?.[1] ?? "";
    for (const path of ["/mcp", "/mcp.md"]) {
      expect(runWorkerFirst, path).toContain(`"${path}"`);
      expect(matchesRoute("/mcp", path.replace(/\.md$/, ""))).toBe(true);
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a stub of the one binding, which only serves a file
    const env = { ASSETS: { fetch: () => Promise.resolve(new Response("asset")) } } as unknown as Env;
    const get = (path: string, headers: Record<string, string>) =>
      app.fetch(new Request(`http://x${path}`, { headers, redirect: "manual" }), env);
    const html = await get("/mcp", { "Accept-Language": "es" });
    expect([html.status, html.headers.get("Location")]).toEqual([302, "/es/mcp"]);
    const md = await get("/mcp.md", { Cookie: "lang=en", "Accept-Language": "es" });
    expect([md.status, md.headers.get("Location")]).toEqual([302, "/en/mcp.md"]);
    // The skills are static: not redirected.
    const skill = await get("/mcp/skills/modifying-page/SKILL.md", {});
    expect(await skill.text()).toBe("asset");
  });

  it("redirects the /webmcp alias and the old lab with a 301", () => {
    const lines = renderRedirects();
    for (const line of [
      "/webmcp /mcp 301",
      "/webmcp.md /mcp.md 301",
      "/en/webmcp /en/mcp 301",
      "/es/webmcp /es/mcp 301",
      "/en/webmcp.md /en/mcp.md 301",
      "/es/webmcp.md /es/mcp.md 301",
      "/en/labs/webmcp /en/mcp 301",
      "/es/labs/webmcp /es/mcp 301",
    ]) {
      expect(lines).toContain(line);
    }
  });

  it("is allowed in robots.txt, with the rest still disallowed", () => {
    const robots = readFileSync(`${root}/public/robots.txt`, "utf8").split("\n");
    for (const path of ["/llms.txt", "/mcp", "/mcp.md", "/en/mcp", "/es/mcp", "/en/mcp.md", "/es/mcp.md", "/mcp/skills/"]) {
      expect(robots, path).toContain(`Allow: ${path}`);
    }
    expect(robots).toContain("Disallow: /");
  });
});

describe("how an agent finds the tools", () => {
  it("has the head links, an actionable hidden note and a footer link", async () => {
    const { ctxFor } = await setup();
    const head = markup(renderHead(ctxFor("es")));
    expect(head).toContain('rel="describedby" href="/mcp.md" type="text/markdown"');
    expect(head).toContain('rel="help" href="/es/mcp"');
    const note = markup(renderAgentNote());
    expect(note).toContain("document.modelContext.getTools()");
    expect(note).toContain("document.modelContext.executeTool(name, input)");
    expect(note).toContain("https://emiliacabral.com/mcp.md");
    expect(note).toContain("https://emiliacabral.com/llms.txt");
    expect(markup(renderFooterLink(ctxFor("es")))).toContain('href="/es/mcp"');
    expect(markup(renderFooterLink(ctxFor("es")))).toContain(">MCP</a");
    expect(markup(renderFooterLink(ctxFor("es")))).toContain('aria-label="MCP: herramientas para agentes de IA"');
    expect(markup(renderFooterLink(ctxFor("en")))).toContain(">MCP</a");
    expect(markup(renderFooterLink(ctxFor("en")))).toContain('aria-label="MCP: tools for AI agents"');
  });
});

describe("with WEBMCP_ENABLED false", () => {
  it("renders no docs, no footer link, no routes and no skills files", async () => {
    vi.resetModules();
    vi.doMock("../../src/webmcp/enabled", () => ({ WEBMCP_ENABLED: false }));
    const off = await import("../../src/webmcp/site");
    const offDocs = await import("../../src/webmcp/site/docs");
    const offRoutes = await import("../../src/webmcp/site/routes");
    const offSkills = await import("../../src/webmcp/site/skills");
    const { ctxFor } = await setup();

    expect(off.renderFooterLink(ctxFor("en"))).toBeNull();
    expect(await offDocs.renderDocsPages(ctxFor)).toEqual([]);
    expect(offDocs.renderDocsMarkdownFiles(ctxFor)).toEqual([]);
    expect(offRoutes.WEBMCP_LANGLESS_ROUTES).toEqual([]);
    expect(offSkills.renderSkillFiles()).toEqual([]);
    vi.doUnmock("../../src/webmcp/enabled");
  });
});
