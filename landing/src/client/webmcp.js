// WebMCP tools on every page (https://webmachinelearning.github.io/webmcp/).
// The agent runs on the visitor's side: there is no endpoint and no API key.
//
// Adding tools: write a module in ./webmcp/ that exports an array of tool
// definitions ({ name, title, description, inputSchema, annotations, execute }),
// import it below and spread it into the registerTools call. Return results
// with ok() and reject with fail() from ./webmcp/result.js. Planned modules:
// interaction-tools.js, content-tools.js, theme-tools.js.
import { registerTools } from "./webmcp/context.js";
import { restoreSavedCss } from "./webmcp/css-state.js";
import { contentTools } from "./webmcp/content-tools.js";
import { cssTools } from "./webmcp/css-tools.js";
import { interactionTools } from "./webmcp/interaction-tools.js";
import { fontTools } from "./webmcp/font-tools.js";

// First, so the agent's CSS from earlier pages of this tab is back as early as a deferred script allows.
restoreSavedCss();

registerTools([...cssTools, ...interactionTools, ...fontTools, ...contentTools]);
