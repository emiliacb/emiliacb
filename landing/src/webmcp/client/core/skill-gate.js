// The tools that change the page or play on the tree do a better job once the
// agent has read the skill that explains them, and agents skip skills they are
// only told about. So those tools refuse until read_skill has returned that
// skill's SKILL.md once. Which skills were read is kept with the agent's other
// changes (src/client/lib/nav-storage.js): across the pages of this tab, so the
// agent reads each skill once per session, and gone after a reload.
import { navGet, navSet } from "../../../client/lib/nav-storage.js";
import { fail } from "./result.js";

/** The tools that refuse until the skill is read, by skill: what list_skills reports, and what the docs say. */
export const GATED_TOOLS = {
  "modifying-page": ["set_variables", "set_css", "set_css_by_selector"],
  "composing-song": ["play_tree_song", "play_song"],
};

const STORAGE_KEY = "webmcp:skills-read";

/** Used when storage is blocked: the gate then lasts only as long as this page. */
const readHere = new Set();

function readNames() {
  try {
    const parsed = JSON.parse(navGet(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((name) => typeof name === "string") : [];
  } catch {
    return [];
  }
}

/** Records that the agent read the skill's SKILL.md. */
export function markSkillRead(name) {
  readHere.add(name);
  try {
    navSet(STORAGE_KEY, JSON.stringify([...new Set([...readNames(), name])]));
  } catch {
    // Storage blocked or full: the skill still counts for this page.
  }
}

/** Whether the skill was read in this tab since it was loaded (or last reloaded). */
export function wasSkillRead(name) {
  return readHere.has(name) || readNames().includes(name);
}

/** Throws the ToolError that sends the agent to read the skill, unless it did. Call it first in a gated tool's execute. */
export function requireSkill(name) {
  if (wasSkillRead(name)) return;
  throw fail(`Read the skill first: call read_skill({ name: "${name}" }) and follow it, then call this tool again.`);
}
