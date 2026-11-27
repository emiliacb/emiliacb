// WebMCP tools that read and change the site's colour mode (light, dark, or
// the system's). The mode itself belongs to src/client/lib/theme.js; this
// bundle imports it and so gets its own copy of the module, which is safe
// because that module keeps no state of its own: the `data-theme` attribute on
// <html> and the `theme` key in localStorage are the shared state, and the
// `themechange` event on window is how the canvases in other bundles repaint.
import { getThemeMode, isDark, setThemeMode } from "../../../client/lib/theme.js";
import { fail, ok } from "../core/result.js";

const MODES = ["light", "dark", "system"];
// Must match the key theme.js writes and the inline script in the layout reads.
const STORAGE_KEY = "theme";

function systemMode() {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Whether the visitor's browser holds a forced mode; false when storage is unavailable. */
function isStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
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
    "Returns the site's colour mode. `mode` is what the page was told to be (\"light\", \"dark\", or \"system\" when " +
    "nothing is forced and the visitor's operating system decides); `effective` is what is painted right now " +
    "(\"light\" or \"dark\"); `system` is the operating system's preference; `stored` says whether the visitor's " +
    "browser remembers a forced mode across visits (localStorage). Takes no input.",
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
    "Switches the site to \"light\", \"dark\", or \"system\" (follow the visitor's operating system). It applies at " +
    "once, canvases included (the tree, the cotas, the gradient repaint), and returns the new state like " +
    "get_theme_mode. Unlike CSS set by an agent, which lasts only in this tab, a forced \"light\" or \"dark\" is " +
    "stored in the visitor's browser (localStorage) and persists across visits and tabs; \"system\" clears that " +
    "stored choice, so use it to hand the decision back. " +
    "To make a CSS or token change (set_css, set_css_by_selector, an override of a variable from get_variables) " +
    "show in dark mode too: a token set on `:root` alone only changes light mode, because the site redefines its " +
    "tokens for dark under `:root[data-theme=\"dark\"]` and under `@media (prefers-color-scheme: dark)`, which " +
    "win over it. Either write the override in both places (the attribute selector, and the media query with " +
    "`:root:not([data-theme=\"light\"])`), or add `!important` on `:root`, then check the result with this tool " +
    "in each mode. " +
    "Input: `mode`, one of \"light\", \"dark\", \"system\".",
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
