import { enabledTools, toolGroups } from "../client/tools/index.js";

/**
 * Name and one-line summary of every tool the pages register. It is read from
 * the tool definitions themselves (the same list the browser registers), so
 * llms.txt cannot describe a tool that does not exist or miss one that does.
 */
export const WEBMCP_TOOLS: readonly (readonly [name: string, summary: string])[] = enabledTools.map((tool) => [
  tool.name,
  tool.summary,
]);

/** The same tools, group by group and in full (description and input schema), for the /mcp docs page. */
export const WEBMCP_GROUPS = toolGroups;
