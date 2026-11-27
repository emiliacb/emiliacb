// Types for the plain-JS module next to it, so the build and the tests can import it.
export type Skill = {
  name: string;
  description: string;
  /** The Markdown after the frontmatter. */
  body: string;
  /** The whole file, frontmatter included. */
  markdown: string;
};

export function parseSkill(source: string): Skill;
