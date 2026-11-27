import { WEBMCP_ENABLED } from "../enabled";
import { WEBMCP_TOOLS } from "./catalog";

/**
 * The "WebMCP tools" section of /llms.txt, as lines to splice into the file
 * (with its trailing blank line), or none when the feature is off. This is
 * how an agent that cannot see native WebMCP tools learns to call them.
 */
export function renderLlmsSection(): string[] {
  if (!WEBMCP_ENABLED) return [];
  return [
    "## WebMCP tools",
    "",
    "Every page exposes WebMCP tools that let a browser agent restyle the page it is looking at. " +
      "The changes live in that tab only. If your browser does not show them as tools, call them " +
      "from JavaScript in the tab: `await document.modelContext.getTools()` lists them and " +
      "`await document.modelContext.executeTool(name, input)` runs one.",
    "",
    ...WEBMCP_TOOLS.map(([name, summary]) => `- \`${name}\`: ${summary}`),
    "",
  ];
}
