// One short sentence each, appended to the descriptions of the tools that change
// the page or answer from it. An agent reads a tool's description before it
// acts, which is the one moment a pointer to the skills (src/webmcp/skills/)
// is read for sure; the hidden note on the pages stays a pointer to llms.txt.

export const MODIFY_HINT = "Before restyling or editing the page, read the skill `modifying-page` with read_skill. ";

export const ANSWER_HINT =
  "When a visitor asks about the site or Emilia, read the skill `answering-questions` with read_skill first. ";
