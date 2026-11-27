// The tool groups this site enables, in the order they register. Removing a
// group from here removes its tools from the page and, because the build reads
// this same list (src/webmcp/site/catalog.ts), from llms.txt.
import { contentTools } from "./content.js";
import { cssTools } from "./css.js";
import { domTools } from "./dom.js";
import { fontTools } from "./fonts.js";
import { interactionTools } from "./interaction.js";
import { themeTools } from "./theme.js";

export const enabledTools = [...cssTools, ...interactionTools, ...fontTools, ...contentTools, ...domTools, ...themeTools];
