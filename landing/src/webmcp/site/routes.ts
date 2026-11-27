import { WEBMCP_ENABLED } from "../enabled";

/**
 * Where the docs page for agents lives, after the language prefix. It is not in
 * PAGES (src/shared/site.ts) on purpose: PAGES feeds the manifest list_md_pages
 * reads, llms.txt's page list, the 404's site map and the build's own checks, and
 * a docs page about the tools belongs in none of those (llms.txt links it from
 * the WebMCP section instead). So the Worker, the build and robots.txt all
 * learn about it from here, and removing WebMCP removes the page with it.
 */
export const DOCS_PATH = "/mcp";

/** The page's old and shorter-lived name: every URL of it redirects to DOCS_PATH. */
export const DOCS_ALIAS_PATH = "/webmcp";

/** Where the skills are published: /mcp/skills/<name>/SKILL.md, for agents that install skills. */
export const SKILLS_URL_PATH = `${DOCS_PATH}/skills`;

/**
 * The language-less URLs the Worker redirects to /{lang}{path}, like PAGES'
 * ("/mcp.md" too: the Worker drops the ".md" before matching). No imports but
 * the flag, so the Worker's bundle stays free of the tool catalog.
 */
export const WEBMCP_LANGLESS_ROUTES: readonly string[] = WEBMCP_ENABLED ? [DOCS_PATH] : [];
