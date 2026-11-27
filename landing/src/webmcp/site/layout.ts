import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

import { SITE_URL } from "../../shared/site";
import type { RenderCtx } from "../../site/context";
import { WEBMCP_ENABLED } from "../enabled";
import { DOCS_COPY } from "./docs/copy";
import { DOCS_PATH } from "./routes";

// English on every page. Actionable on its own, because an agent that is not told
// the tools exist does not look for them: the way in is in the note, the detail in
// the docs (which are in English too).
const AGENT_NOTE =
  "Note for AI agents: this page exposes WebMCP tools (restyle it, read its pages, open sidebars, more). " +
  "List them by running `await document.modelContext.getTools()` in this tab and call one with " +
  "`await document.modelContext.executeTool(name, input)`. " +
  `Docs: ${SITE_URL}${DOCS_PATH}.md and ${SITE_URL}/llms.txt`;

/** The hidden paragraph at the top of <body> that points an agent reading the page to llms.txt. */
export function renderAgentNote(): HtmlEscapedString | Promise<HtmlEscapedString> | null {
  if (!WEBMCP_ENABLED) return null;
  // For AI agents: hidden from sight, not from the DOM text or the accessibility tree.
  return html`<p
    style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap"
  >
    ${AGENT_NOTE}
  </p>`;
}

/**
 * For <head>: the hashed URL of the Markdown bundle create_article loads on
 * demand, the way sidebars.js finds ui-drawer, and the two links that tell an
 * agent reading the page where its docs are: the language-less Markdown
 * ("describedby") and the page in the visitor's language ("help").
 */
export function renderHead(ctx: RenderCtx): HtmlEscapedString | Promise<HtmlEscapedString> | null {
  if (!WEBMCP_ENABLED) return null;
  return html`<meta name="asset:webmcp-markdown" content="${ctx.assets.script("webmcp-markdown")}" />
    <link rel="describedby" href="${DOCS_PATH}.md" type="text/markdown" />
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
 * (and an agent reading the page) who has no idea the tools exist.
 */
export function renderFooterLink(ctx: RenderCtx): HtmlEscapedString | Promise<HtmlEscapedString> | null {
  if (!WEBMCP_ENABLED) return null;
  return html`<li>
    <a
      href="/${ctx.lang}${DOCS_PATH}"
      aria-label="${DOCS_COPY[ctx.lang].footerLinkLabel}"
      title="${DOCS_COPY[ctx.lang].footerLinkLabel}"
      class="interactive text-sm hover:bg-black hover:text-white hover:dark:bg-white hover:dark:text-black focus-visible:bg-black focus-visible:text-white focus-visible:dark:bg-white focus-visible:dark:text-black px-1 py-0.5 -ml-1"
      >${DOCS_COPY[ctx.lang].footerLink}</a
    >
  </li>`;
}
