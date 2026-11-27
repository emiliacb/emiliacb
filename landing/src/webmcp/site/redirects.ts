import { WEBMCP_ENABLED } from "../enabled";

/**
 * Lines for dist/_redirects. The WebMCP lab is gone (the tools are on every
 * page now); the docs page will take over these URLs.
 */
export function renderRedirects(): string[] {
  if (!WEBMCP_ENABLED) return [];
  return ["/en/labs/webmcp /en 302", "/es/labs/webmcp /es 302"];
}
