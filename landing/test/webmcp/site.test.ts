import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import type { Lang } from "../../src/shared/lang";
import { dictionaries } from "../../src/shared/i18n";
import { loadContent } from "../../src/site/content";
import type { RenderCtx } from "../../src/site/context";
import { renderLlmsTxt, renderSiteMarkdown } from "../../src/site/markdown";
import { enabledTools } from "../../src/webmcp/client/tools/index.js";
import {
  MANIFEST_PATH,
  renderAgentNote,
  renderBuildFiles,
  renderHead,
  renderPagesManifest,
  renderRedirects,
  renderScript,
} from "../../src/webmcp/site";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function setup() {
  const content = await loadContent(root);
  const assets = { script: (name: string) => `/assets/${name}.js`, css: "/x.css", buildId: "test" };
  const ctxFor = (lang: Lang): RenderCtx => ({ lang, t: dictionaries[lang], assets, content });
  return { content, ctxFor };
}

// hono's html`` returns a String object (or a promise of one): this is its markup.
function markup(value: unknown): string {
  const parsed: unknown = JSON.parse(JSON.stringify(value));
  return typeof parsed === "string" ? parsed : "";
}

describe("llms.txt WebMCP section", () => {
  it("lists every tool the client registers, from the tool definitions themselves", async () => {
    const { ctxFor } = await setup();
    const txt = renderLlmsTxt(ctxFor);

    expect(enabledTools.length).toBeGreaterThan(0);
    for (const tool of enabledTools) expect(txt, tool.name).toContain(`- \`${tool.name}\`: ${tool.summary}`);
    expect(txt).toContain("document.modelContext.getTools()");
    expect(txt).not.toContain("](/");
  });
});

describe("renderPagesManifest", () => {
  it("lists exactly the .md files the build writes, with a title and a kind each", async () => {
    const { ctxFor } = await setup();
    const files = renderSiteMarkdown(ctxFor);
    const manifest = renderPagesManifest(ctxFor);

    expect(manifest.map((entry) => entry.path).toSorted()).toEqual(files.map((file) => file.path).toSorted());
    for (const entry of manifest) {
      expect(entry.title, entry.path).not.toBe("");
      expect(entry.path.startsWith(`/${entry.lang}`), entry.path).toBe(true);
    }
  });

  it("marks posts, the blog index and plain pages", async () => {
    const { content, ctxFor } = await setup();
    const byPath = new Map(renderPagesManifest(ctxFor).map((entry) => [entry.path, entry]));

    expect(byPath.get("/en/blog.md")?.kind).toBe("index");
    expect(byPath.get("/es/about.md")?.kind).toBe("page");
    const post = content.posts[0];
    expect(byPath.get(`/en/blog/${post.slug}.md`)).toMatchObject({ kind: "post", title: post.title, lang: "en" });
  });

  it("is written where the list_md_pages tool fetches it from", async () => {
    const { ctxFor } = await setup();
    const source = readFileSync(`${root}/src/webmcp/client/tools/content.js`, "utf8");

    expect(source).toContain(`const MANIFEST_URL = "${MANIFEST_PATH}";`);
    expect(renderBuildFiles(ctxFor).map((file) => file.path)).toContain(MANIFEST_PATH);
  });
});

describe("page integration", () => {
  it("renders the hidden note, the on-demand bundle's meta tag and the script", async () => {
    const { ctxFor } = await setup();
    const ctx = ctxFor("en");

    expect(markup(renderAgentNote())).toContain('href="/mcp.md"');
    expect(markup(renderHead(ctx))).toContain('name="asset:webmcp-markdown" content="/assets/webmcp-markdown.js"');
    expect(markup(renderScript(ctx))).toContain('src="/assets/webmcp.js"');
    expect(renderRedirects()).toContain("/en/labs/webmcp /en/mcp 301");
  });
});

describe("with WEBMCP_ENABLED false", () => {
  it("renders nothing anywhere", async () => {
    vi.resetModules();
    vi.doMock("../../src/webmcp/enabled", () => ({ WEBMCP_ENABLED: false }));
    const off = await import("../../src/webmcp/site");
    const { ctxFor } = await setup();

    expect(off.renderAgentNote()).toBeNull();
    expect(off.renderHead(ctxFor("en"))).toBeNull();
    expect(off.renderScript(ctxFor("en"))).toBeNull();
    expect(off.renderLlmsSection()).toEqual([]);
    expect(off.renderBuildFiles(ctxFor)).toEqual([]);
    expect(off.renderRedirects()).toEqual([]);
    vi.doUnmock("../../src/webmcp/enabled");
  });
});
