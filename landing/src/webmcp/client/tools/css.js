// WebMCP tools that read and change the page's CSS. Everything the agent sets
// goes through applyGuarded (css-apply.js), which undoes a change that breaks
// the page and tells the agent why (unless the agent forces it). The CSS is kept while the visitor navigates the site in this tab and a
// reload restores the original (css-state.js, nav-storage.js).
import { applyGuarded, resetAgentCss, unsupportedDeclarations } from "../css/apply.js";
import { getState } from "../css/state.js";
import { mergeRule, parseDeclarations, rulesToCss } from "../css/declarations.js";
import { describeWithText } from "../core/describe.js";
import { fail, ok } from "../core/result.js";
import { MODIFY_HINT } from "../skills/hints.js";

// A stylesheet, not a page: past this it is more likely a mistake than a design.
const MAX_CSS_CHARS = 50000;
const MAX_SELECTOR_CHARS = 500;
const MAX_ELEMENTS = 20;
const DEFAULT_ELEMENTS = 5;
export const SCOPE =
  "The CSS is applied only in this tab: it is kept while the visitor navigates the site in this tab (links, back and forward); a reload restores the original. ";

const INSPECTED_STYLES = [
  "color", "background-color", "font-family", "font-size", "font-weight", "display", "position", "margin",
  "padding", "border", "width", "height", "opacity", "transform",
];

/** The selector, trimmed, or a ToolError saying what is wrong with it. */
function requireSelector(input) {
  const selector = typeof input?.selector === "string" ? input.selector.trim().replace(/\s+/g, " ") : "";
  if (selector === "") throw fail('"selector" is required: a CSS selector such as "h1" or "nav a".');
  if (selector.length > MAX_SELECTOR_CHARS || /[{}@]|\/\*/.test(selector)) {
    throw fail(`"${selector.slice(0, 60)}" is not a plain CSS selector (no braces, @-rules or comments; at most ${MAX_SELECTOR_CHARS} characters).`);
  }
  try {
    document.querySelector(selector);
  } catch {
    throw fail(
      `"${selector}" is not a valid CSS selector. Use one like "h1", "#content p", ".class" or "nav a[href]". ` +
        "Call get_css_by_selector with a simpler selector to check what it matches.",
    );
  }
  return selector;
}

function inspectElement(el) {
  const style = getComputedStyle(el);
  const styles = {};
  for (const property of INSPECTED_STYLES) styles[property] = style.getPropertyValue(property);
  return { element: describeWithText(el), styles };
}

function clampCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_ELEMENTS;
  return Math.min(Math.floor(n), MAX_ELEMENTS);
}

export function checkSize(text, what) {
  if (text.length > MAX_CSS_CHARS) {
    throw fail(`${what} is longer than ${MAX_CSS_CHARS} characters (${text.length}). Send a shorter one.`);
  }
}

function appliedResult(state, warnings, message) {
  return ok({
    message,
    stylesheetChars: state.css.length,
    selectorRules: Object.keys(state.rules).length,
    warnings,
    note: "Kept while the visitor navigates the site in this tab; a reload restores the original.",
  });
}

function entriesOrFail(input) {
  try {
    return parseDeclarations(input);
  } catch (error) {
    throw fail(
      `Invalid declarations: ${error instanceof Error ? error.message : String(error)}. ` +
        'Send an object like {"color": "#222"} or a string like "color: #222; margin: 0".',
    );
  }
}

/** Rejects declarations the browser would silently drop, so the agent hears about them. */
function checkSupported(entries) {
  const bad = unsupportedDeclarations(`x { ${entries.filter(([, v]) => v !== null).map(([p, v]) => `${p}: ${v}`).join("; ")} }`);
  if (bad.length) throw fail(`${bad.join(" ")} Nothing was changed. Fix the property name or the value and try again.`);
}

export const FORCE_PROPERTY = {
  type: "boolean",
  description:
    "Apply even if the page checks flag a problem. Only for an effect you intend; the visitor is then shown a " +
    "notice with a button to restore the original style. Default false.",
};

export const CHECKS =
  "After applying, the page is checked: main content hidden, unreadable or unclickable, a page that cannot scroll, " +
  "text with almost no contrast, or a full-screen layer blocking clicks. If the change breaks the page it is rolled " +
  "back silently and the call is rejected with what broke and how to fix it, so correct it and send it again. " +
  "`force: true` applies it anyway (the problems come back as `warnings`) but shows the visitor a small notice with a " +
  "button to restore the original page, so use it only when the effect is intended. ";

const getCss = {
  name: "get_css",
  summary: "the CSS agents have applied so far",
  title: "Get the CSS applied by agents",
  description:
    "Returns the CSS an agent has applied to this page so far: the variable overrides (set_variables, per mode), " +
    "the full free-form stylesheet (set_css) and the " +
    "per-selector rules (set_css_by_selector), plus the combined stylesheet that is actually in the page. " +
    "Empty when nothing was changed (the page looks as originally designed). Takes no input. " +
    SCOPE,
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: true },
  execute() {
    const state = getState();
    return Promise.resolve(
      ok({ variables: state.variables, stylesheet: state.css, selectorRules: state.rules, selectorRulesAsCss: rulesToCss(state.rules) }),
    );
  },
};

const getCssBySelector = {
  name: "get_css_by_selector",
  summary: "computed styles of the elements a selector matches",
  title: "Inspect the styles of elements",
  description:
    "Finds the elements matching a CSS selector and returns, for up to `limit` of them (default 5, max 20), a short " +
    "description (tag, id, classes, text excerpt) and their computed styles (color, background-color, font-family, " +
    "font-size, font-weight, display, position, margin, padding, border, width, height, opacity, transform), plus the " +
    "rules an agent has set for exactly that selector. Zero matches is not an error: `matchCount` is 0. " +
    "An invalid selector is rejected with a message. Use it before set_css_by_selector to see what a selector hits. " +
    "Input: `selector` (required string), `limit` (optional number).",
  inputSchema: {
    type: "object",
    properties: {
      selector: { type: "string", description: 'A CSS selector, e.g. "h1" or "nav a".' },
      limit: { type: "number", description: "How many matched elements to describe (default 5, max 20)." },
    },
    required: ["selector"],
  },
  annotations: { readOnlyHint: true },
  execute(input) {
    const selector = requireSelector(input);
    const matches = Array.from(document.querySelectorAll(selector));
    const shown = matches.slice(0, clampCount(input.limit)).map(inspectElement);
    return Promise.resolve(
      ok({ selector, matchCount: matches.length, shown: shown.length, elements: shown, agentRules: getState().rules[selector] ?? null }),
    );
  },
};

const setCss = {
  name: "set_css",
  summary: "replace the page's custom stylesheet",
  title: "Replace the page's custom CSS",
  description:
    "Before writing CSS, call get_variables: colours, fonts, sizes and radii are tokens; change them with " +
    "set_variables (which also repaints the tree, the gradient and the cotas). Use CSS only for what tokens don't " +
    "cover. Restyles the page with a CSS stylesheet. It REPLACES the free-form stylesheet applied before with this one, so " +
    "always send the complete stylesheet (call get_css first to extend it). An empty string removes the stylesheet " +
    "but keeps the per-selector rules from set_css_by_selector; use reset_css to clear everything. The stylesheet is " +
    "added last in <head>, after the site's own styles; use !important where an inline style or a more specific rule " +
    "may win. Maximum 50000 characters. Dark mode is html[data-theme=dark], or the system preference when html has no data-theme. " +
    "Do not set design tokens here (a token on :root alone only affects light mode): use set_variables, " +
    "which handles light and dark. " +
    CHECKS +
    "Returns what was applied and `warnings` for declarations the browser ignores. " +
    "Input: `css` (string), optional `force` (boolean). " +
    SCOPE +
    MODIFY_HINT,
  inputSchema: {
    type: "object",
    properties: {
      css: { type: "string", description: "The full stylesheet, as plain CSS. Empty string removes it." },
      force: FORCE_PROPERTY,
    },
    required: ["css"],
  },
  execute(input) {
    if (typeof input?.css !== "string") throw fail('"css" must be a string with the complete stylesheet (empty to remove it).');
    checkSize(input.css, "The css");
    const next = { ...getState(), css: input.css };
    const warnings = applyGuarded(next, input.force === true);
    return Promise.resolve(appliedResult(next, warnings, "Stylesheet applied."));
  },
};

const setCssBySelector = {
  name: "set_css_by_selector",
  summary: "set or remove declarations for one selector",
  title: "Style a selector",
  description:
    "Before writing CSS, call get_variables: colours, fonts, sizes and radii are tokens; change them with " +
    "set_variables (which also repaints the tree, the gradient and the cotas). Use CSS only for what tokens don't " +
    "cover. Sets, changes or removes CSS declarations for one selector, without touching the rest. The rules are merged " +
    "with those you set for the same selector before, and are applied after the stylesheet from set_css. " +
    "Input: `selector` (e.g. \"h1\"); `declarations`: an object of property to value ({\"color\": \"#222\", " +
    "\"font-size\": \"2rem\"}) or a CSS declaration string (\"color: #222; font-size: 2rem\"); optional `important` " +
    "(default true) adds !important so the rule beats the site's own styles. A null or empty value removes that " +
    "property; empty declarations remove the selector's rules. Properties or values the browser does not understand " +
    "are rejected. " +
    CHECKS +
    "Optional `force` (boolean). Returns what is applied. " +
    SCOPE +
    MODIFY_HINT,
  inputSchema: {
    type: "object",
    properties: {
      selector: { type: "string", description: 'A CSS selector, e.g. "h1" or "nav a".' },
      declarations: {
        anyOf: [{ type: "object", additionalProperties: { type: ["string", "number", "null"] } }, { type: "string" }],
        description: 'Object {property: value} or a string "property: value; ...". null/empty value removes a property.',
      },
      important: { type: "boolean", description: "Add !important to values (default true)." },
      force: FORCE_PROPERTY,
    },
    required: ["selector", "declarations"],
  },
  execute(input) {
    const selector = requireSelector(input);
    const entries = entriesOrFail(input.declarations);
    checkSupported(entries);
    const current = getState();
    const rules = mergeRule(current.rules, selector, entries, input.important !== false);
    checkSize(rulesToCss(rules), "The per-selector rules");
    const next = { ...current, rules };
    const warnings = applyGuarded(next, input.force === true);
    const matches = document.querySelectorAll(selector).length;
    const message = matches === 0 ? `Rules saved, but "${selector}" matches no element on this page right now.` : `Rules updated for ${matches} element(s).`;
    return Promise.resolve(appliedResult(next, warnings, message));
  },
};

const resetCss = {
  name: "reset_css",
  summary: "remove all custom CSS",
  title: "Restore the original design",
  description:
    "Removes everything applied with set_variables, set_css and set_css_by_selector, so the page looks as originally designed. " +
    "Takes no input. (set_css with an empty string only removes the free-form stylesheet; a null value in " +
    "set_variables removes one variable.) " +
    SCOPE,
  inputSchema: { type: "object", properties: {} },
  execute() {
    resetAgentCss();
    return Promise.resolve(ok("All agent CSS removed; the page looks as originally designed."));
  },
};

export const cssTools = [getCss, getCssBySelector, setCss, setCssBySelector, resetCss];
