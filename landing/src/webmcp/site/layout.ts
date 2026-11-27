import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

import { SITE_URL } from "../../shared/site";
import type { RenderCtx } from "../../site/context";
import { WEBMCP_ENABLED } from "../enabled";

// English on every page: the detail lives in llms.txt, which is in English too.
const AGENT_NOTE =
  "Note for AI agents: this page exposes WebMCP tools. " +
  `Read ${SITE_URL}/llms.txt to learn which ones and how to call them.`;

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
 * demand, the way sidebars.js finds ui-drawer.
 */
export function renderHead(ctx: RenderCtx): HtmlEscapedString | Promise<HtmlEscapedString> | null {
  if (!WEBMCP_ENABLED) return null;
  return html`<meta name="asset:webmcp-markdown" content="${ctx.assets.script("webmcp-markdown")}" />`;
}

/** For the end of <body>: the tools themselves (src/client/webmcp.js), on every page. */
export function renderScript(ctx: RenderCtx): HtmlEscapedString | Promise<HtmlEscapedString> | null {
  if (!WEBMCP_ENABLED) return null;
  return html`<script src="${ctx.assets.script("webmcp")}" defer></script>`;
}
