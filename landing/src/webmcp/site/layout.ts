import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

import type { RenderCtx } from "../../site/context";
import { WEBMCP_ENABLED } from "../enabled";
import { DOCS_COPY } from "./docs/copy";
import { DOCS_PATH } from "./routes";

// English on every page. Actionable on its own, because an agent that is not told
// the tools exist does not look for them: the way in is in the note, the detail in
// the docs (which are in English too). The links are root-relative on purpose:
// the note travels with the page, so a staging or local build points at itself
// and not at production.
const AGENT_NOTE =
  "Note for AI agents: this page exposes WebMCP tools (restyle it, read its pages, open sidebars, more). " +
  "List them by running `await document.modelContext.getTools()` in this tab and call one with " +
  "`await document.modelContext.executeTool(name, input)`. " +
  `Docs: ${DOCS_PATH}.md and /llms.txt`;

/** The hidden paragraph at the top of <body> that points an agent reading the page to its docs and llms.txt. */
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

/**
 * For the footer, under the copyright: the same news as the hidden note at the
 * top of <body>, but visible. Agents that read only what is on screen (an
 * accessibility tree filtered to visible nodes skips the 1px note) find it
 * here, and a person reads the same words: nothing is shown to one and not
 * the other.
 */
export function renderFooterNote(ctx: RenderCtx): HtmlEscapedString | Promise<HtmlEscapedString> | null {
  if (!WEBMCP_ENABLED) return null;
  const note = DOCS_COPY[ctx.lang].footerNote;
  return html`<p class="mt-1">
    ${note.before}<a href="/${ctx.lang}${DOCS_PATH}" class="underline underline-offset-2">${note.link}</a>${note.after}
  </p>`;
}
