import type { Lang } from "../../../shared/lang";
import { SITE_URL } from "../../../shared/site";
import { WEBMCP_GROUPS } from "../catalog";
import { SKILLS_URL_PATH } from "../routes";
import { readSkills } from "../skills";
import { DOCS_COPY, type DocsCopy } from "./copy";

/**
 * "md" is the .md file, read by agents without a base URL, so its links are
 * absolute; "html" is rendered into the page, where the same links stay on the
 * site (root-relative) and "<" in a summary must not become a tag.
 */
export type DocsMode = "md" | "html";

const link = (mode: DocsMode, path: string) => (mode === "md" ? `${SITE_URL}${path}` : path);

/** Text from a tool definition, made safe for the Markdown that becomes HTML: "<id>" outside code spans is escaped. */
function plain(text: string, mode: DocsMode): string {
  if (mode === "md") return text;
  return text
    .split(/(`[^`]*`)/)
    .map((part, index) => (index % 2 === 1 ? part : part.replace(/</g, "&lt;").replace(/>/g, "&gt;")))
    .join("");
}

/** Every tool, group by group: its name and the one-line summary, nothing else (the tool's own description has the rest). */
function toolList(copy: DocsCopy, mode: DocsMode): string[] {
  const lines: string[] = [];
  for (const group of WEBMCP_GROUPS) {
    lines.push(`**${copy.groups[group.id] ?? group.id}**`, "");
    for (const tool of group.tools) lines.push(`- \`${tool.name}\`: ${plain(tool.summary, mode)}`);
    lines.push("");
  }
  return lines;
}

function connectSection(copy: DocsCopy): string[] {
  const { connect } = copy;
  return [
    `## ${connect.heading}`,
    "",
    connect.script,
    "",
    "```js",
    "const tools = await document.modelContext.getTools(); // name, description, inputSchema",
    'const raw = await document.modelContext.executeTool("get_variables", { prefix: "--color" });',
    "const text = JSON.parse(raw).content[0].text; // a JSON string",
    "```",
    "",
    ...connect.notes.map((note) => `- ${note}`),
    "",
  ];
}

function skillsSection(copy: DocsCopy, mode: DocsMode): string[] {
  const items = readSkills().map(
    (skill) =>
      `- [\`${skill.name}\`](${link(mode, `${SKILLS_URL_PATH}/${skill.name}/SKILL.md`)}): ${skill.description}`,
  );
  return [`## ${copy.skills.heading}`, "", copy.skills.body, "", ...items, ""];
}

/** The docs page as Markdown, the one source of both its .md file and its HTML. */
export function renderDocsMarkdown(lang: Lang, mode: DocsMode): string {
  const copy = DOCS_COPY[lang];
  return [
    `# ${copy.title}`,
    "",
    copy.intro,
    "",
    ...connectSection(copy),
    ...skillsSection(copy, mode),
    `## ${copy.tools.heading}`,
    "",
    copy.tools.intro,
    "",
    ...toolList(copy, mode),
    `## ${copy.safety.heading}`,
    "",
    ...copy.safety.items.map((item) => `- ${item}`),
    "",
    `## ${copy.notServer.heading}`,
    "",
    copy.notServer.body,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
    .concat("\n");
}
