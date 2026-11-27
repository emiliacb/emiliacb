import { html, raw } from "hono/html";

import { LANGS, type Lang } from "../../../shared/lang";
import { SITE_TITLE, markdownPath } from "../../../shared/site";
import layout from "../../../site/components/layout";
import { renderMarkdown } from "../../../site/content";
import type { RenderCtx } from "../../../site/context";
import { toServedMarkdown } from "../../../site/markdown";
import { WEBMCP_ENABLED } from "../../enabled";
import { DOCS_PATH } from "../routes";
import { DOCS_COPY } from "./copy";
import { renderDocsMarkdown } from "./markdown";

/**
 * The /{lang}/mcp pages, for the build to write beside the site's own. They are
 * not in PAGES (see routes.ts), so renderSite does not know them. This file is
 * not re-exported by site/index.ts: it renders through the site's layout, which
 * imports that index, and the build imports it from here instead.
 */
export async function renderDocsPages(ctxFor: (lang: Lang) => RenderCtx): Promise<{ path: string; html: string }[]> {
  if (!WEBMCP_ENABLED) return [];
  return Promise.all(
    LANGS.map(async (lang) => {
      const ctx = ctxFor(lang);
      const copy = DOCS_COPY[lang];
      const body = renderMarkdown(renderDocsMarkdown(lang, "html"), lang);
      const page = await layout({
        ctx,
        path: DOCS_PATH,
        siteData: { title: `${copy.title} | ${SITE_TITLE}`, description: copy.description },
        withFooter: true,
        children: html`<div class="markdown-content webmcp-docs">${raw(body)}</div>`,
      });
      return { path: `/${lang}${DOCS_PATH}`, html: String(page) };
    }),
  );
}

/** The .md version of each language's page, with the same checks as the site's own (build.ts). */
export function renderDocsMarkdownFiles(ctxFor: (lang: Lang) => RenderCtx): { path: string; markdown: string }[] {
  if (!WEBMCP_ENABLED) return [];
  return LANGS.map((lang) => ({
    path: markdownPath(lang, DOCS_PATH),
    markdown: toServedMarkdown(renderDocsMarkdown(lang, "md"), ctxFor(lang), new Set()),
  }));
}
