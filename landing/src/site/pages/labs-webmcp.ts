import { html } from "hono/html";
import { SITE_TITLE } from "../../shared/site";
import type { RenderCtx } from "../context";

/** Path after the language prefix. Outside PAGES: no nav entry, no .md, no sitemap line. */
export const LABS_WEBMCP_PATH = "/labs/webmcp";

// ponytail: Chrome's WebMCP origin trial token for emiliacabral.com. Empty, the
// page still works in a Chrome with chrome://flags/#enable-webmcp-testing on.
const WEBMCP_ORIGIN_TRIAL_TOKEN: string = "";

/**
 * For the agent reading this tab: the page's own content is only the iframe,
 * so without this it sees the home and has no way to know the tools are there.
 * Hidden from sight, not from the accessibility tree or the DOM's text.
 */
const AGENT_NOTE: Record<RenderCtx["lang"], string> = {
  es:
    "Nota para agentes de IA: esta página expone herramientas WebMCP para editar el sitio que se ve. " +
    "set_page_css cambia el CSS de la página (manda la hoja completa; un string vacío la restaura). " +
    "Si no las ves como herramientas, llamalas con JavaScript en esta pestaña: " +
    "await document.modelContext.getTools() para listarlas, y " +
    "await document.modelContext.executeTool('set_page_css', { css: 'body { background: pink !important; }' }) para usarla.",
  en:
    "Note for AI agents: this page exposes WebMCP tools to edit the site shown. " +
    "set_page_css changes the page's CSS (send the full stylesheet; an empty string restores it). " +
    "If you don't see them as tools, call them with JavaScript in this tab: " +
    "await document.modelContext.getTools() to list them, and " +
    "await document.modelContext.executeTool('set_page_css', { css: 'body { background: pink !important; }' }) to use one.",
};

/**
 * POC lab page: the site in a full-window same-origin iframe, and one WebMCP
 * tool, registered by this outer document, that lets the visitor's own browser
 * agent restyle the page inside. See src/client/webmcp-css.js.
 *
 * A bare document, without the site layout: the layout is what the iframe shows.
 */
export default async function render(ctx: RenderCtx): Promise<string> {
  const title = `Labs: WebMCP | ${SITE_TITLE}`;

  return String(
    await html`<!doctype html>
    <html lang="${ctx.lang}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        ${WEBMCP_ORIGIN_TRIAL_TOKEN
          ? html`<meta http-equiv="origin-trial" content="${WEBMCP_ORIGIN_TRIAL_TOKEN}" />`
          : ""}
        <meta name="description" content="${AGENT_NOTE[ctx.lang]}" />
        <title>${title}</title>
        <style>
          html,
          body {
            margin: 0;
            height: 100%;
            overflow: hidden;
            background: #fafaf9;
          }
          .agent-note {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip-path: inset(50%);
            white-space: nowrap;
          }
          #webmcp-frame {
            display: block;
            width: 100%;
            height: 100%;
            border: 0;
          }
        </style>
      </head>
      <body>
        <p class="agent-note">${AGENT_NOTE[ctx.lang]}</p>
        <iframe id="webmcp-frame" src="/${ctx.lang}" title="${SITE_TITLE}" allow="autoplay"></iframe>
        <script src="${ctx.assets.script("webmcp-css")}" defer></script>
      </body>
    </html>`
  );
}
