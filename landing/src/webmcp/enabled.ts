/**
 * Turns the whole WebMCP feature off at build time: with false there is no
 * script tag, hidden note, llms.txt section, pages manifest or redirect, and
 * the client code is never referenced by a page. See README.md ("How to
 * remove WebMCP") to delete it instead.
 */
export const WEBMCP_ENABLED: boolean = true;
