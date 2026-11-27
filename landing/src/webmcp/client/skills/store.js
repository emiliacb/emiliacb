// Where the skill tools find the bundled skills. The skills' files are imported
// as text, which esbuild can do (build.ts) and Node cannot, yet the build also
// imports the tool definitions to write the docs page and llms.txt. So the tools
// read from here, and only the browser entry fills it (client/index.js): the
// build never runs a tool, it only reads definitions.

let skills = [];

export function setSkills(bundled) {
  skills = bundled;
}

export function getSkills() {
  return skills;
}
