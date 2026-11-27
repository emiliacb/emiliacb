// The entry of the on-demand Markdown bundle (src/client/webmcp-markdown.js).
// It only hands the renderer to content/markdown-loader.js, which asked for it.
import { renderBody } from "./render-markdown.js";

export function exposeMarkdownRenderer() {
  window.webmcpMarkdown = { render: renderBody };
}
