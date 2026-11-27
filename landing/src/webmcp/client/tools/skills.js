// WebMCP has no "prompt" or "skill" primitive, so the skills (procedures an
// agent follows to do something well here) are offered as two tools: one lists
// them, one returns the Markdown. They are the same files published at
// /mcp/skills/<name>/SKILL.md, for agents that can install a skill instead.
import { fail, ok } from "../core/result.js";
import { GATED_TOOLS, markSkillRead } from "../core/skill-gate.js";
import { getSkills } from "../skills/store.js";

const listSkills = {
  name: "list_skills",
  summary: "the skills (procedures) for working well on this site, with a description each",
  title: "List the skills",
  description:
    "Lists the skills this site offers: short procedures for doing something well here, such as restyling the " +
    "page or composing a song for the tree. Returns `name`, `description`, `files` (other files, for read_skill's " +
    "`file`) and `requiredBy`: the tools that fail until you have read that skill. No input.",
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: true },
  execute() {
    return Promise.resolve(ok(
        getSkills().map(({ name, description, files }) => ({
          name,
          description,
          files: Object.keys(files),
          requiredBy: GATED_TOOLS[name] ?? [],
        })),
      ));
  },
};

/** The skill called `name`, or a ToolError that lists the ones there are. */
function findSkill(name) {
  const known = getSkills().map((candidate) => candidate.name).join(", ");
  if (name === "") throw fail(`"name" is required, one of: ${known}. Call list_skills to see what each is for.`);
  const skill = getSkills().find((candidate) => candidate.name === name);
  if (!skill) throw fail(`There is no skill named "${name}". The skills are: ${known}. Call list_skills to see them.`);
  return skill;
}

const readSkill = {
  name: "read_skill",
  summary: "read one skill in full, as Markdown",
  title: "Read a skill",
  description:
    "Returns the full Markdown of one skill. `name` is one of list_skills' names; `file` (optional) is one of " +
    "its other files instead of SKILL.md. Read the skill before you do what it covers, and follow it. Reading " +
    "SKILL.md is what unlocks the tools that require it; another file does not.",
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
    const skill = findSkill(name);
    const file = typeof input?.file === "string" ? input.file.trim() : "";
    if (file === "" || file === "SKILL.md") {
      markSkillRead(name);
      return Promise.resolve(ok(skill.markdown));
    }
    if (!(file in skill.files)) {
      const names = Object.keys(skill.files).join(", ") || "none";
      throw fail(`The skill "${name}" has no file "${file}". Its other files: ${names}.`);
    }
    return Promise.resolve(ok(skill.files[file]));
  },
};

export const skillsTools = [listSkills, readSkill];
