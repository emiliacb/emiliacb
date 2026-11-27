import { SITE_URL, markdownPath } from "../../shared/site";
import { WEBMCP_ENABLED } from "../enabled";
import { WEBMCP_TOOLS } from "./catalog";
import { DOCS_PATH } from "./routes";
import { readSkills, skillPath } from "./skills";

/**
 * The "WebMCP tools" section of /llms.txt, as lines to splice into the file
 * (with its trailing blank line), or none when the feature is off. This is
 * how an agent that cannot see native WebMCP tools learns to call them. The
 * docs page and the skills come first: they are what to read before the list.
 */
export function renderLlmsSection(): string[] {
  if (!WEBMCP_ENABLED) return [];
  return [
    "## WebMCP tools",
    "",
    `- [WebMCP tools for agents](${SITE_URL}${markdownPath("en", DOCS_PATH)}): how to connect, every tool with its input, safety (also in Spanish: ${SITE_URL}${markdownPath("es", DOCS_PATH)})`,
    ...readSkills().map(
      (skill) => `- [Skill \`${skill.name}\`](${SITE_URL}${skillPath(skill.name)}): ${skill.description}`,
    ),
    "",
    "Every page exposes WebMCP tools that let a browser agent restyle the page it is looking at. " +
      "The changes live in that tab only: styles, fonts, articles and the colour mode are kept while the visitor navigates the site in it (inserted elements and changed text are not: navigating clears them), and a reload restores the original. If your browser does not show them as tools, call them " +
      "from JavaScript in the tab: `await document.modelContext.getTools()` lists them and " +
      "`await document.modelContext.executeTool(name, input)` runs one: it resolves to a JSON string of " +
      "`{content:[{type:\"text\", text}]}` (parse it, and parse `text` too: it is JSON), and rejects with an Error " +
      "whose message says what happened and what to do next. " +
      "The skills are also tools: `list_skills` and `read_skill({ name })`. `set_variables`, `set_css` and " +
      "`set_css_by_selector` fail until you have read `modifying-page`, and `play_tree_song` and `play_song` until " +
      "you have read `composing-song`. A tool's description is cut short: `get_tool_help({ name })` returns the full one.",
    "",
    ...WEBMCP_TOOLS.map(([name, summary]) => `- \`${name}\`: ${summary}`),
    "",
  ];
}
