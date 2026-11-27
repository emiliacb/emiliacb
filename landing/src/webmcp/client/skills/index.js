// The skills bundled into the page, for list_skills and read_skill. The files
// are src/webmcp/skills/<name>/SKILL.md, imported as text (build.ts gives
// esbuild the .md loader; vitest.config.ts does the same for the tests). To add
// a skill: write its folder, import its files here, add it to the list. A test holds
// this list and the folders together.
import answeringQuestions from "../../skills/answering-questions/SKILL.md";
import composingSong from "../../skills/composing-song/SKILL.md";
import modifyingPage from "../../skills/modifying-page/SKILL.md";
import modifyingRegions from "../../skills/modifying-page/regions.md";
import { parseSkill } from "./parse.js";

// `files` are the other Markdown files of the skill's folder (read_skill's `file`).
export const SKILLS = [
  { ...parseSkill(answeringQuestions), files: {} },
  { ...parseSkill(composingSong), files: {} },
  { ...parseSkill(modifyingPage), files: { "regions.md": modifyingRegions } },
];
