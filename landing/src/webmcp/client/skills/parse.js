// Reads a skill file: Markdown with a YAML frontmatter (the standard agent-skill
// format). Only what the format needs is parsed, `name` and `description` as
// one-line values (plain or in quotes), so no YAML library goes into the page.
// The build reads the same files with the same function (src/webmcp/site/skills.ts),
// so what the page serves and what read_skill returns cannot be told apart.

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function unquote(value) {
  const quoted = /^"(.*)"$/s.exec(value) ?? /^'(.*)'$/s.exec(value);
  return quoted ? quoted[1] : value;
}

/**
 * The skill's name, description and the Markdown as written (frontmatter
 * included: an agent that installs the file needs it). Throws on a file with no
 * frontmatter or no name or description, which is a mistake to catch at build.
 */
export function parseSkill(source) {
  const match = FRONTMATTER.exec(source);
  if (!match) throw new Error("A skill starts with a --- frontmatter block holding its name and description.");
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([a-z-]+):\s*(.*)$/.exec(line);
    if (pair) fields[pair[1]] = unquote(pair[2].trim());
  }
  if (!fields.name || !fields.description) throw new Error("The frontmatter needs a name and a description.");
  return { name: fields.name, description: fields.description, body: source.slice(match[0].length), markdown: source };
}
