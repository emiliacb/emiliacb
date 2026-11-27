import { html } from "hono/html";
import { SITE_TITLE } from "../../shared/site";
import type { RenderCtx } from "../context";

/** Path after the language prefix. Outside PAGES: no nav entry, no .md, no sitemap line. */
export const LABS_WEBMCP_PATH = "/labs/webmcp";

// ponytail: Chrome's WebMCP origin trial token for emiliacabral.com. Empty, the
// page still works in a Chrome with chrome://flags/#enable-webmcp-testing on.
const WEBMCP_ORIGIN_TRIAL_TOKEN: string = "";

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
        <title>${title}</title>
        <style>
          html,
          body {
            margin: 0;
            height: 100%;
            overflow: hidden;
            background: #fafaf9;
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
        <iframe id="webmcp-frame" src="/${ctx.lang}" title="${SITE_TITLE}" allow="autoplay"></iframe>
        <script src="${ctx.assets.script("webmcp-css")}" defer></script>
      </body>
    </html>`
  );
}
