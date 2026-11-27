// The browser entry of WebMCP: what src/client/webmcp.js runs on every page.
// The agent runs on the visitor's side: there is no endpoint and no API key.
// See src/webmcp/README.md for how a tool is defined and added.
import { registerTools } from "./core/context.js";
import { restoreSavedCss } from "./css/state.js";
import { SKILLS } from "./skills/index.js";
import { setSkills } from "./skills/store.js";
import { enabledTools } from "./tools/index.js";

export function startWebmcp() {
  // First, so the agent's CSS from earlier pages of this tab is back as early as a deferred script allows.
  restoreSavedCss();

  setSkills(SKILLS);
  registerTools(enabledTools);
}
