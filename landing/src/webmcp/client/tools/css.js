// WebMCP tools that read and change the page's CSS. Everything the agent sets
// goes through applyGuarded (css-apply.js), which undoes a change that breaks
// the page. The CSS is local to the visitor's tab and follows it across the
// site's pages (css-state.js).
import { applyGuarded, unsupportedDeclarations } from "../css/apply.js";
import { emptyState, commitState, getState, STYLE_ID } from "../css/state.js";
import { mergeRule, parseDeclarations, rulesToCss } from "../css/declarations.js";
import { fail, ok } from "../core/result.js";

// A stylesheet, not a page: past this it is more likely a mistake than a design.
const MAX_CSS_CHARS = 50000;
const MAX_SELECTOR_CHARS = 500;
const MAX_ELEMENTS = 20;
const DEFAULT_ELEMENTS = 5;
const SCOPE =
  "The CSS is applied only in this tab: it survives navigation to other pages of the site in this tab and disappears when the tab is closed. ";

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

function describeElement(el) {
  const id = el.id ? `#${el.id}` : "";
  const classes = Array.from(el.classList).slice(0, 6).map((name) => `.${name}`).join("");
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  return `${el.tagName.toLowerCase()}${id}${classes}${text ? ` "${text}"` : ""}`;
}

function inspectElement(el) {
  const style = getComputedStyle(el);
  const styles = {};
  for (const property of INSPECTED_STYLES) styles[property] = style.getPropertyValue(property);
  return { element: describeElement(el), styles };
}

function clampCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_ELEMENTS;
  return Math.min(Math.floor(n), MAX_ELEMENTS);
}

/** True for selectors whose subject is the root element: :root, html, html.dark, :root[data-theme="x"]. */
function isRootSelector(selector) {
  return /^(:root|html)(?![\w-])/i.test(selector.trim());
}

function conditionOf(rule) {
  if (rule instanceof CSSMediaRule) return `@media ${rule.conditionText || rule.media.mediaText}`;
  if (rule instanceof CSSSupportsRule) return `@supports ${rule.conditionText}`;
  if (rule.constructor.name === "CSSLayerBlockRule") return `@layer ${rule.name}`;
  return null;
}

function variablesOfRule(rule, conditions, found) {
  const selectors = rule.selectorText.split(",").filter(isRootSelector);
  if (selectors.length === 0) return;
  for (let i = 0; i < rule.style.length; i += 1) {
    const name = rule.style[i];
    if (!name.startsWith("--")) continue;
    found.push({
      name,
      selector: selectors.map((s) => s.trim()).join(", "),
      condition: conditions.length ? conditions.join(" and ") : null,
      value: rule.style.getPropertyValue(name).trim(),
    });
  }
}

function walkRules(rules, conditions, found) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) variablesOfRule(rule, conditions, found);
    const condition = conditionOf(rule);
    const nested = rule.cssRules;
    if (nested) walkRules(nested, condition ? [...conditions, condition] : conditions, found);
  }
}

/** The site's own custom properties on the root, from every readable stylesheet. */
function readRootVariables() {
  const found = [];
  let skipped = 0;
  for (const sheet of Array.from(document.styleSheets)) {
    if (sheet.ownerNode?.id === STYLE_ID) continue;
    try {
      walkRules(sheet.cssRules, [], found);
    } catch {
      skipped += 1;
    }
  }
  return { found, skipped };
}

function groupVariables(found, prefix) {
  const computed = getComputedStyle(document.documentElement);
  const byName = new Map();
  for (const entry of found) {
    if (prefix && !entry.name.startsWith(prefix)) continue;
    const { name, ...declaration } = entry;
    const item = byName.get(name) ?? { name, computed: computed.getPropertyValue(name).trim(), declarations: [] };
    item.declarations.push(declaration);
    byName.set(name, item);
  }
  return Array.from(byName.values());
}

function normalizePrefix(input) {
  const prefix = typeof input?.prefix === "string" ? input.prefix.trim() : "";
  if (prefix === "") return "";
  return prefix.startsWith("--") ? prefix : `--${prefix.replace(/^-+/, "")}`;
}

function summarize(variables) {
  const groups = {};
  for (const { name } of variables) {
    const group = name.split("-").slice(0, 3).join("-");
    groups[group] = (groups[group] ?? 0) + 1;
  }
  return groups;
}

function checkSize(text, what) {
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
    note: "Local to this tab; survives navigation within it.",
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

const getCss = {
  name: "get_css",
  summary: "the CSS agents have applied so far",
  title: "Get the CSS applied by agents",
  description:
    "Returns the CSS an agent has applied to this page so far: the full free-form stylesheet (set_css) and the " +
    "per-selector rules (set_css_by_selector), plus the combined stylesheet that is actually in the page. " +
    "Empty when nothing was changed (the page looks as originally designed). Takes no input. " +
    SCOPE,
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: true },
  execute() {
    const state = getState();
    return Promise.resolve(
      ok({ stylesheet: state.css, selectorRules: state.rules, selectorRulesAsCss: rulesToCss(state.rules) }),
    );
  },
};

const getVariables = {
  name: "get_variables",
  summary: "the site's CSS variables (design tokens), declared and computed",
  title: "List the site's CSS variables",
  description:
    "Lists the CSS custom properties (--name) the site defines on :root / html, the design tokens it is built " +
    "from (colors, fonts, sizes). Read from the site's own stylesheets (same-origin only), including inside @media " +
    "blocks, which are reported as the `condition` of each declaration. Each variable has its `computed` value now " +
    "(which reflects any override you applied) and its `declarations` (selector, condition, declared value). " +
    "Input: optional `prefix` (for example \"--color\") to list only variables whose name starts with it. " +
    "Overriding a variable with set_css (`:root { --color-x: ... }`) restyles everything that uses it, which is " +
    "usually better than overriding many selectors. " +
    SCOPE,
  inputSchema: {
    type: "object",
    properties: {
      prefix: { type: "string", description: 'Only variables whose name starts with this, e.g. "--color".' },
    },
  },
  annotations: { readOnlyHint: true },
  execute(input) {
    const { found, skipped } = readRootVariables();
    const variables = groupVariables(found, normalizePrefix(input));
    return Promise.resolve(ok({ count: variables.length, groups: summarize(variables), unreadableStylesheets: skipped, variables }));
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
    "Restyles the page with a CSS stylesheet. It REPLACES the free-form stylesheet applied before with this one, so " +
    "always send the complete stylesheet (call get_css first to extend it). An empty string removes the stylesheet " +
    "but keeps the per-selector rules from set_css_by_selector; use reset_css to clear everything. The stylesheet is " +
    "added last in <head>, after the site's own styles; use !important where an inline style or a more specific rule " +
    "may win. Maximum 50000 characters. Dark mode is html[data-theme=dark], or the system preference when html has no data-theme; " +
    "the design tokens (get_variables) are redefined for dark in :root[data-theme=dark] and the dark media query. " +
    "After applying, the page is checked: if the change makes it unusable (main content hidden, text with no contrast, " +
    "a full-screen layer blocking clicks) it is rolled back and the call is rejected with what broke. " +
    "Returns what was applied and `warnings` for declarations the browser ignores. " +
    "Input: `css` (string). " +
    SCOPE,
  inputSchema: {
    type: "object",
    properties: { css: { type: "string", description: "The full stylesheet, as plain CSS. Empty string removes it." } },
    required: ["css"],
  },
  execute(input) {
    if (typeof input?.css !== "string") throw fail('"css" must be a string with the complete stylesheet (empty to remove it).');
    checkSize(input.css, "The css");
    const next = { ...getState(), css: input.css };
    const warnings = applyGuarded(next);
    return Promise.resolve(appliedResult(next, warnings, "Stylesheet applied."));
  },
};

const setCssBySelector = {
  name: "set_css_by_selector",
  summary: "set or remove declarations for one selector",
  title: "Style a selector",
  description:
    "Sets, changes or removes CSS declarations for one selector, without touching the rest. The rules are merged " +
    "with those you set for the same selector before, and are applied after the stylesheet from set_css. " +
    "Input: `selector` (e.g. \"h1\"); `declarations`: an object of property to value ({\"color\": \"#222\", " +
    "\"font-size\": \"2rem\"}) or a CSS declaration string (\"color: #222; font-size: 2rem\"); optional `important` " +
    "(default true) adds !important so the rule beats the site's own styles. A null or empty value removes that " +
    "property; empty declarations remove the selector's rules. Properties or values the browser does not understand " +
    "are rejected. After applying, the page is checked and the change is rolled back and rejected if it breaks the " +
    "page (see set_css). Returns what is applied. " +
    SCOPE,
  inputSchema: {
    type: "object",
    properties: {
      selector: { type: "string", description: 'A CSS selector, e.g. "h1" or "nav a".' },
      declarations: {
        anyOf: [{ type: "object", additionalProperties: { type: ["string", "number", "null"] } }, { type: "string" }],
        description: 'Object {property: value} or a string "property: value; ...". null/empty value removes a property.',
      },
      important: { type: "boolean", description: "Add !important to values (default true)." },
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
    const warnings = applyGuarded(next);
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
    "Removes everything applied with set_css and set_css_by_selector, so the page looks as originally designed. " +
    "Takes no input. (set_css with an empty string only removes the free-form stylesheet.) " +
    SCOPE,
  inputSchema: { type: "object", properties: {} },
  execute() {
    commitState(emptyState());
    return Promise.resolve(ok("All agent CSS removed; the page looks as originally designed."));
  },
};

export const cssTools = [getCss, getVariables, getCssBySelector, setCss, setCssBySelector, resetCss];
