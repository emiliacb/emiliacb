import type { Skill } from "./parse.js";

export type BundledSkill = Skill & {
  /** The skill's other files by name (regions.md), as text. */
  files: Record<string, string>;
};

export const SKILLS: readonly BundledSkill[];
