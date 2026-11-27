import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parseSkill, type Skill } from "../client/skills/parse.js";
import { WEBMCP_ENABLED } from "../enabled";
import { SKILLS_URL_PATH } from "./routes";

const SKILLS_DIR = fileURLToPath(new URL("../skills/", import.meta.url));

export type SkillOnDisk = Skill & {
  /** The folder's other Markdown files by name (regions.md). */
  files: Record<string, string>;
};

/**
 * The skills, read from src/webmcp/skills/<name>/SKILL.md at build time. The
 * browser bundle imports the same files as text (client/skills/index.js), so
 * the page, list_skills and the published files all say the same thing; the
 * tests check the two lists agree and that every folder is named for its skill.
 */
export function readSkills(): SkillOnDisk[] {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = `${SKILLS_DIR}${entry.name}/`;
      const files = readdirSync(dir).filter((file) => file.endsWith(".md") && file !== "SKILL.md");
      return Object.assign(parseSkill(readFileSync(`${dir}SKILL.md`, "utf8")), {
        files: Object.fromEntries(files.map((file) => [file, readFileSync(`${dir}${file}`, "utf8")])),
      });
    })
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

/** The published path of one of a skill's files, SKILL.md by default: "/mcp/skills/modifying-page/SKILL.md". */
export function skillPath(name: string, file = "SKILL.md"): string {
  return `${SKILLS_URL_PATH}/${name}/${file}`;
}

/** The files the build writes for the skills: each one's files, as they are in the repo. */
export function renderSkillFiles(): { path: string; content: string }[] {
  if (!WEBMCP_ENABLED) return [];
  const written: { path: string; content: string }[] = [];
  for (const skill of readSkills()) {
    written.push({ path: skillPath(skill.name), content: skill.markdown });
    for (const [file, content] of Object.entries(skill.files)) written.push({ path: skillPath(skill.name, file), content });
  }
  return written;
}
