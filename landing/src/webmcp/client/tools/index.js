// The tool groups this site enables, in the order they register. Removing a
// group from here removes its tools from the page and, because the build reads
// this same list (src/webmcp/site/catalog.ts), from llms.txt and from the /mcp
// docs page, which lists the tools group by group (`id` is the key of the
// group's title in src/webmcp/site/docs/copy.ts).
import { blackHoleTools } from "./black-hole.js";
import { contentTools } from "./content.js";
import { cssTools } from "./css.js";
import { domTools } from "./dom.js";
import { fontTools } from "./fonts.js";
import { interactionTools } from "./interaction.js";
import { skillsTools } from "./skills.js";
import { themeTools } from "./theme.js";
import { treeSongTools } from "./tree-song.js";

export const toolGroups = [
  { id: "css", tools: cssTools },
  { id: "theme", tools: themeTools },
  { id: "interaction", tools: interactionTools },
  { id: "fonts", tools: fontTools },
  { id: "content", tools: contentTools },
  { id: "dom", tools: domTools },
  { id: "tree-song", tools: treeSongTools },
  { id: "black-hole", tools: blackHoleTools },
  { id: "skills", tools: skillsTools },
];

export const enabledTools = toolGroups.flatMap((group) => group.tools);
