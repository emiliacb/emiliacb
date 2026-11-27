import type { Lang } from "../../../shared/lang";
import { SITE_URL } from "../../../shared/site";
import type { JsonSchema, ToolSpec } from "../../client/tools/index.js";
import { WEBMCP_GROUPS } from "../catalog";
import { SKILLS_URL_PATH } from "../routes";
import { readSkills } from "../skills";
import { DOCS_COPY, type DocsCopy } from "./copy";

/**
 * "md" is the .md file, read by agents without a base URL, so its links are
 * absolute; "html" is rendered into the page, where the same links stay on the
 * site (root-relative) and "<" in a description must not become a tag.
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

const cell = (text: string, mode: DocsMode) => plain(text, mode).replace(/\|/g, "\\|").replace(/\s+/g, " ");

function typeOf(schema: JsonSchema): string {
  if (schema.enum) return schema.enum.map((value) => `\`${String(value)}\``).join(", ");
  if (schema.anyOf) return schema.anyOf.map(typeOf).join(" or ");
  const type = Array.isArray(schema.type) ? schema.type.join(" or ") : (schema.type ?? "any");
  if (type === "array" && schema.items) return `list of ${typeOf(schema.items)}`;
  return type;
}

function inputTable(tool: ToolSpec, copy: DocsCopy, mode: DocsMode): string[] {
  const entries = Object.entries(tool.inputSchema.properties ?? {});
  if (entries.length === 0) return [copy.tools.none, ""];
  const required = new Set(tool.inputSchema.required ?? []);
  const t = copy.tools;
  return [
    `| ${t.input} | ${t.type} | ${t.required} | ${t.description} |`,
    "| --- | --- | --- | --- |",
    ...entries.map(
      ([name, schema]) =>
        `| \`${name}\` | ${cell(typeOf(schema), mode)} | ${required.has(name) ? t.yes : t.no} | ${cell(schema.description ?? "", mode)} |`,
    ),
    "",
  ];
}

function toolSection(tool: ToolSpec, copy: DocsCopy, mode: DocsMode): string[] {
  return [`#### \`${tool.name}\``, "", plain(tool.description.trim(), mode), "", ...inputTable(tool, copy, mode)];
}

function groupSections(copy: DocsCopy, mode: DocsMode): string[] {
  const lines: string[] = [];
  for (const group of WEBMCP_GROUPS) {
    const text = copy.groups[group.id] ?? { title: group.id, blurb: "" };
    lines.push(`### ${text.title}`, "", text.blurb, "");
    for (const tool of group.tools) lines.push(...toolSection(tool, copy, mode));
  }
  return lines;
}

function connectSection(copy: DocsCopy): string[] {
  const { connect } = copy;
  return [
    `## ${connect.heading}`,
    "",
    `### ${connect.nativeHeading}`,
    "",
    connect.native,
    "",
    `### ${connect.scriptHeading}`,
    "",
    connect.script,
    "",
    "```js",
    "// The tools, each with name, title, description and inputSchema.",
    "const tools = await document.modelContext.getTools();",
    "",
    "// Run one by name. It resolves to a JSON string: { content: [{ type: \"text\", text }] }.",
    "const raw = await document.modelContext.executeTool(\"get_variables\", { prefix: \"--color\" });",
    "const text = JSON.parse(raw).content[0].text;",
    "```",
    "",
    ...connect.scriptNotes.flatMap((note) => [`- ${note}`]),
    "",
    connect.start,
    "",
  ];
}

function skillsSection(copy: DocsCopy, mode: DocsMode): string[] {
  const items = readSkills().map(
    (skill) =>
      `- \`${skill.name}\`: ${skill.description} ([SKILL.md](${link(mode, `${SKILLS_URL_PATH}/${skill.name}/SKILL.md`)}))`,
  );
  return [`## ${copy.skills.heading}`, "", ...copy.skills.body.flatMap((p) => [p, ""]), copy.skills.listIntro, "", ...items, ""];
}

/** The docs page as Markdown, the one source of both its .md file and its HTML. */
export function renderDocsMarkdown(lang: Lang, mode: DocsMode): string {
  const copy = DOCS_COPY[lang];
  return [
    `# ${copy.title}`,
    "",
    copy.intro,
    "",
    "%table-of-contents%",
    "",
    `## ${copy.what.heading}`,
    "",
    ...copy.what.body.flatMap((p) => [p, ""]),
    ...connectSection(copy),
    ...skillsSection(copy, mode),
    `## ${copy.tools.heading}`,
    "",
    copy.tools.intro,
    "",
    ...groupSections(copy, mode),
    `## ${copy.safety.heading}`,
    "",
    ...copy.safety.items.map((item) => `- ${item}`),
    "",
    `## ${copy.notServer.heading}`,
    "",
    ...copy.notServer.body.flatMap((p) => [p, ""]),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
    .concat("\n");
}
