// WebMCP tools that read and change the site's colour mode (light, dark, or
// the system's). The mode itself belongs to src/client/lib/theme.js; this
// bundle imports it and so gets its own copy of the module, which is safe
// because that module keeps no state of its own: the `data-theme` attribute on
// <html> and the `theme` key in navigation storage are the shared state, and the
// `themechange` event on window is how the canvases in other bundles repaint.
import { navGet } from "../../../client/lib/nav-storage.js";
import { getThemeMode, isDark, setThemeMode } from "../../../client/lib/theme.js";
import { fail, ok } from "../core/result.js";

const MODES = ["light", "dark", "system"];
// Must match the key theme.js writes (through nav-storage.js) and the inline script in the layout reads.
const STORAGE_KEY = "theme";

function systemMode() {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Whether this tab holds a forced mode for its next pages; false when storage is unavailable. */
function isStored() {
  try {
    const value = navGet(STORAGE_KEY);
    return value === "light" || value === "dark";
  } catch {
    return false;
  }
}

function readState() {
  return {
    mode: getThemeMode(),
    effective: isDark() ? "dark" : "light",
    system: systemMode(),
    stored: isStored(),
  };
}

const getThemeModeTool = {
  name: "get_theme_mode",
  summary: "the colour mode: light, dark or system, and what is showing now",
  title: "Get the colour mode",
  description:
    "Returns the colour mode: `mode` (light, dark, or system when nothing is forced), `effective` (what is " +
    "painted now), `system` (the operating system's preference) and `stored` (whether this tab keeps a forced " +
    "mode). No input.",
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: true },
  execute() {
    return Promise.resolve(ok(readState()));
  },
};

const setThemeModeTool = {
  name: "set_theme_mode",
  summary: "switch to light, dark or the system's colour mode",
  title: "Set the colour mode",
  description:
    "Switches the colour mode to \"light\", \"dark\" or \"system\" (follow the visitor's operating system) and " +
    "returns the new state like get_theme_mode. It applies at once, canvases included. A forced mode is kept " +
    "while the visitor navigates in this tab; a reload restores the original, and \"system\" hands the " +
    "decision back. A token set on `:root` alone shows only in light mode: use set_variables. Full details: " +
    "get_tool_help.",
  help:
    "# set_theme_mode\n" +
    "\n" +
    "Switches the site to `light`, `dark` or `system`. It applies at once (the tree, the cotas and the gradient repaint) and returns the new state like `get_theme_mode`.\n" +
    "\n" +
    "A forced `light` or `dark` is kept while the visitor navigates the site in this tab and a reload restores the original; it never reaches another tab or a later visit. `system` clears the choice at once.\n" +
    "\n" +
    "To make a CSS or token change show in dark mode too: a token set on `:root` alone only changes light " +
    "mode, because the site redefines its tokens for dark under `:root[data-theme=\"dark\"]` and under `@media " +
    "(prefers-color-scheme: dark)`, which win over it. Use `set_variables` with `mode: both`, or write the " +
    "override in both places (the attribute selector, and the media query with " +
    "`:root:not([data-theme=\"light\"])`), or add `!important` on `:root`, and check the result in each mode.",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: MODES, description: '"light", "dark", or "system" to follow the visitor\'s OS.' },
    },
    required: ["mode"],
  },
  annotations: { readOnlyHint: false, idempotentHint: true },
  execute(input) {
    const mode = input?.mode;
    if (typeof mode !== "string" || !MODES.includes(mode)) {
      throw fail(`"mode" must be one of ${MODES.map((m) => `"${m}"`).join(", ")}. Nothing was changed.`);
    }
    setThemeMode(mode);
    return Promise.resolve(ok(readState()));
  },
};

export const themeTools = [getThemeModeTool, setThemeModeTool];
