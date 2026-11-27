import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

import type { RenderCtx } from "../../site/context";
import { WEBMCP_ENABLED } from "../enabled";
import { DOCS_COPY } from "./docs/copy";
import { DOCS_PATH } from "./routes";

// English on every page, and a recommendation rather than an order: agents
// read a page's text as data, and instructions in it look like prompt
// injection. The link is root-relative on purpose: the note travels with the
// page, so a staging or local build points at itself and not at production.

/**
 * The hidden paragraph that opens <main> (layout.ts): first in the page's main
 * content, where a reader that extracts only that content (get_page_text and
 * the like) still finds it. Hidden from sight, not from the DOM text or the
 * accessibility tree.
 */
export function renderAgentNote(): HtmlEscapedString | Promise<HtmlEscapedString> | null {
  if (!WEBMCP_ENABLED) return null;
  return html`<p
    style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap"
  >
    To answer more easily, we recommend reading
    <a href="${DOCS_PATH}.md">this page</a>, which has useful information about how this site is optimized for AI
    agents.
  </p>`;
}

/**
 * For <head>: the hashed URL of the Markdown bundle create_article loads on
 * demand, the way sidebars.js finds ui-drawer, and the links that tell an
 * agent reading the page where its docs are: the language-less Markdown
 * ("describedby"), the Markdown in the visitor's language ("alternate", titled
 * so it is not mistaken for the page's own .md alternate) and the page in the
 * visitor's language ("help").
 */
export function renderHead(ctx: RenderCtx): HtmlEscapedString | Promise<HtmlEscapedString> | null {
  if (!WEBMCP_ENABLED) return null;
  return html`<meta name="asset:webmcp-markdown" content="${ctx.assets.script("webmcp-markdown")}" />
    <link rel="describedby" href="${DOCS_PATH}.md" type="text/markdown" />
    <link rel="alternate" type="text/markdown" href="/${ctx.lang}${DOCS_PATH}.md" title="WebMCP" />
    <link rel="help" href="/${ctx.lang}${DOCS_PATH}" />`;
}

/** For the end of <body>: the tools themselves (src/client/webmcp.js), on every page. */
export function renderScript(ctx: RenderCtx): HtmlEscapedString | Promise<HtmlEscapedString> | null {
  if (!WEBMCP_ENABLED) return null;
  return html`<script src="${ctx.assets.script("webmcp")}" defer></script>`;
}

/**
 * For the footer's navigation list: a discreet link to the docs page, dressed
 * as the footer's other links. It is the one visible pointer, for a visitor
 * (and an agent reading the page) who has no idea the tools exist. The link
 * is as tall as its text, which is too small to tap on a phone, so an invisible
 * ::before makes the touch target 44px tall without moving anything.
 */
export function renderFooterLink(ctx: RenderCtx): HtmlEscapedString | Promise<HtmlEscapedString> | null {
  if (!WEBMCP_ENABLED) return null;
  return html`<li>
    <a
      href="/${ctx.lang}${DOCS_PATH}"
      aria-label="${DOCS_COPY[ctx.lang].footerLinkLabel}"
      title="${DOCS_COPY[ctx.lang].footerLinkLabel}"
      class="interactive text-sm hover:bg-strong hover:text-on-strong focus-visible:bg-strong focus-visible:text-on-strong px-1 py-0.5 -ml-1 relative before:absolute before:inset-x-0 before:-inset-y-[11px] before:content-['']"
      >${DOCS_COPY[ctx.lang].footerLink}</a
    >
  </li>`;
}
