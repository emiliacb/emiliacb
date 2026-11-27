// WebMCP has no "prompt" or "skill" primitive, so the skills (procedures an
// agent follows to do something well here) are offered as two tools: one lists
// them, one returns the Markdown. They are the same files published at
// /mcp/skills/<name>/SKILL.md, for agents that can install a skill instead.
import { fail, ok } from "../core/result.js";
import { getSkills } from "../skills/store.js";

const listSkills = {
  name: "list_skills",
  summary: "the skills (procedures) for working well on this site, with a description each",
  title: "List the skills",
  description:
    "Lists the skills this site offers to agents: short procedures written for you, such as how to restyle the " +
    "page completely or how to answer a visitor's question using the page. Takes no input. Returns a list of " +
    "`name`, `description` and `files` (the skill's other files, for read_skill's `file`); read one in full with read_skill. Reading a skill changes nothing.",
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: true },
  execute() {
    return Promise.resolve(ok(getSkills().map(({ name, description, files }) => ({ name, description, files: Object.keys(files) }))));
  },
};

const readSkill = {
  name: "read_skill",
  summary: "read one skill in full, as Markdown",
  title: "Read a skill",
  description:
    "Returns the full Markdown of one skill, frontmatter included. Input: `name` (required), one of the names " +
    "list_skills returns, and optionally `file`, one of that skill's other files (listed by list_skills) to read " +
    "instead of SKILL.md. Read the skill before you do what it covers and follow its steps in order. " +
    "Reading a skill changes nothing.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: 'The skill\'s name, e.g. "modifying-page".' },
      file: { type: "string", description: 'Another file of the skill, e.g. "regions.md". Default: SKILL.md.' },
    },
    required: ["name"],
  },
  annotations: { readOnlyHint: true },
  execute(input) {
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    const skill = getSkills().find((candidate) => candidate.name === name);
    if (!skill) {
      const known = getSkills().map((candidate) => candidate.name).join(", ");
      throw fail(`There is no skill named "${name}". The skills are: ${known}. Call list_skills to see them.`);
    }
    const file = typeof input?.file === "string" ? input.file.trim() : "";
    if (file === "" || file === "SKILL.md") return Promise.resolve(ok(skill.markdown));
    if (!(file in skill.files)) {
      const names = Object.keys(skill.files).join(", ") || "none";
      throw fail(`The skill "${name}" has no file "${file}". Its other files: ${names}.`);
    }
    return Promise.resolve(ok(skill.files[file]));
  },
};

export const skillsTools = [listSkills, readSkill];
