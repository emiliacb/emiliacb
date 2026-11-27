// WebMCP tools for the black hole the site's gradient can be turned into: the
// same effect a visitor makes by clicking the gradient's bright core. The
// effect lives in its own bundle (src/client/gradient-layers.js), which
// publishes window.siteBlackHole when it runs; these tools only call it, so
// nothing here fakes a pointer event or starts a second copy of the effect.
import { fail, ok } from "../core/result.js";

// Where the effect exists, said in every refusal so the agent can decide where
// to go next. It is a rule and not a list of pages on purpose: the effect needs
// the gradient's stack of sheets, which the layout draws on every page except
// the ones that draw the tree instead (the home and /labs/distortion-bg), so a
// list would fall behind each time a page is added (the docs page at /mcp, for
// one, has it).
const WHERE =
  "It exists on every page that has the background gradient, which is every page except the ones with the tree " +
  "illustration (the home and /labs/distortion-bg, where there is no black hole), in both languages, on a desktop " +
  "browser (a window at least 768px wide with a mouse). For example /about, /services, the blog and /mcp have it.";

// What the whole effect takes, from the click to the page being still again
// (the shockwave included); measured, and only told to the agent as a guide.
const APPROXIMATE_DURATION_MS = 12000;

/** The effect's API, or throws the reason an agent can act on. */
function requireEffect() {
  const api = window.siteBlackHole;
  if (api) return api;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    throw fail(
      "The visitor prefers reduced motion, and the black hole is a large animation, so the site disables it. " +
        "Do not try to work around it; tell the visitor instead.",
    );
  }
  throw fail(`This page has no black hole. ${WHERE} Navigate to one of them (for example /about) and call again.`);
}

const startBlackHole = {
  name: "start_black_hole",
  summary: "turn the background gradient into a black hole for a few seconds",
  title: "Start the black hole",
  description:
    "Plays the site's black hole, as if the visitor had clicked the bright core of the background gradient: " +
    "the gradient collapses into a black sphere, the page bends round it, the cursor is caught, then it " +
    "evaporates in a shockwave and everything returns (about 12 seconds, with sound if the browser allows). " +
    "Purely visual and playful: use it to celebrate or punctuate, not for no reason or repeatedly. Refused on " +
    "the home page, on a phone, and under reduced motion. Full details: get_tool_help.",
  help:
    "# start_black_hole\n" +
    "\n" +
    "Plays the site's black hole, exactly as if the visitor had clicked the bright core of the background gradient. The page trembles, the gradient's coloured sheets collapse into a small black sphere ringed by a glowing disc, the page behind bends round it, the mouse cursor is caught and spun into it (and hidden meanwhile), then the hole evaporates in a flash that sends a shockwave through the page and gives everything back as it was.\n" +
    "\n" +
    "- Purely visual and temporary (about 12 seconds); it makes sound if the browser allows audio.\n" +
    "- A playful moment: use it to celebrate, dramatize or punctuate something, or when the visitor asks for something fun; not for no reason, and not repeatedly.\n" +
    "- The page does not scroll while it runs. It is born at the core of the gradient, which the tool scrolls into view, so it takes no position.\n" +
    "- Returns as soon as it has started, with its expected duration; use `get_black_hole_state` or `stop_black_hole` afterwards.\n" +
    "- Refused while one is already running, on pages without the gradient (every page has it except the ones " +
    "with the tree illustration: the home and /labs/distortion-bg), on a phone or narrow window (it needs a " +
    "desktop browser at least 768px wide with a mouse), and when the visitor prefers reduced motion.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  execute() {
    const api = requireEffect();
    const result = api.start();
    if (!result.started) {
      if (result.reason === "running") {
        throw fail("A black hole is already running. Wait for it to finish (about 12 seconds), or end it with stop_black_hole.");
      }
      throw fail(`The black hole only runs on a desktop browser (a window at least 768px wide with a mouse). ${WHERE}`);
    }
    return ok({
      message: "The black hole has started.",
      phase: api.state().phase,
      approximateDurationMs: APPROXIMATE_DURATION_MS,
      note: "It ends by itself and the page is restored. stop_black_hole ends it early.",
    });
  },
};

const stopBlackHole = {
  name: "stop_black_hole",
  summary: "end the black hole early and restore the gradient",
  title: "Stop the black hole",
  description:
    "Ends a running black hole at once, giving back the gradient, the cursor and scrolling without the final " +
    "flash. Not an error when none is running. Returns the state afterwards.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  execute() {
    const api = requireEffect();
    const wasRunning = api.stop();
    return ok({
      message: wasRunning ? "The black hole was ended and the gradient restored." : "No black hole was running.",
      state: api.state(),
    });
  },
};

const getBlackHoleState = {
  name: "get_black_hole_state",
  summary: "whether a black hole is running, and its phase",
  title: "Get the black hole's state",
  description:
    "Reports whether the black hole is running, its phase (calm, then gather, fall, hold, boom, back) and how " +
    "long ago it started. Read-only. " +
    WHERE,
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true },
  execute() {
    return ok(requireEffect().state());
  },
};

export const blackHoleTools = [startBlackHole, stopBlackHole, getBlackHoleState];
