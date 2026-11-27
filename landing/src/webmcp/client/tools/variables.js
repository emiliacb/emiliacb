// WebMCP tools for the site's design tokens (the CSS custom properties on the
// root): get_variables, which summarises the base tokens an agent should edit,
// and set_variables, which changes them for light, dark or both. They share the
// CSS state with set_css (css/state.js), so a change goes through the same
// guarded apply (undone if it breaks the page, unless forced) and the canvases
// are told when it is committed.
import { applyGuarded } from "../css/apply.js";
import { getState, renderCss, STYLE_ID } from "../css/state.js";
import { BASE_TOKENS, overridesOf } from "../css/tokens.js";
import { MODES, kindOf, kindProblem, literalProblem, mergeVariables, parseVariables } from "../css/variables.js";
import { isDark } from "../../../client/lib/theme.js";
import { fail, ok } from "../core/result.js";
import { MODIFY_HINT } from "../skills/hints.js";
import { CHECKS, FORCE_PROPERTY, SCOPE, checkSize } from "./css.js";

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

function declaredIn(rules, names) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) Array.from(rule.style).filter((property) => property.startsWith("--")).forEach((property) => names.add(property));
    if (rule.cssRules) declaredIn(rule.cssRules, names);
  }
}

/** Every custom property name any readable site stylesheet declares, on any selector. */
function declaredNames() {
  const names = new Set();
  for (const sheet of Array.from(document.styleSheets)) {
    if (sheet.ownerNode?.id === STYLE_ID) continue;
    try {
      declaredIn(sheet.cssRules, names);
    } catch {
      // A cross-origin stylesheet cannot be read; its names are then reported as unknown.
    }
  }
  return names;
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

/** The site's declared value of a token for one mode: light is plain :root, dark the data-theme="dark" block. */
function declaredValue(found, name, mode) {
  const own = found.filter((entry) => entry.name === name);
  const dark = own.find((entry) => entry.selector.replace(/\s/g, "").includes('[data-theme="dark"]'));
  const light = own.find((entry) => entry.condition === null && entry.selector.trim() === ":root");
  if (mode === "dark") return (dark ?? light)?.value ?? null;
  return light?.value ?? null;
}

function baseSummary(found) {
  const computed = getComputedStyle(document.documentElement);
  const { variables } = getState();
  return BASE_TOKENS.map((token) => {
    const overrides = overridesOf(variables, token.name);
    return {
      name: token.name,
      light: declaredValue(found, token.name, "light"),
      dark: declaredValue(found, token.name, "dark"),
      computed: computed.getPropertyValue(token.name).trim(),
      purpose: token.purpose,
      derives: token.derives,
      ...(overrides.length ? { agentOverrides: overrides } : {}),
    };
  });
}

const getVariables = {
  name: "get_variables",
  summary: "the site's design tokens: base ones first, with light, dark and what derives from them",
  title: "List the site's CSS variables",
  description:
    "Call this before writing any CSS: colours, fonts, sizes and radii are design tokens, and changing a token " +
    "(set_variables) restyles everything built on it, canvases included. By default returns a compact summary of " +
    "the BASE tokens, the ones meant to be edited: `name`, `light` and `dark` (the site's declared values), " +
    "`computed` now, `purpose`, what `derives` from it, and `agentOverrides` if you changed it. The DERIVED " +
    "tokens (the neutral scale, shades, roles, the tree's and the cotas' inks) follow the base ones and are " +
    "listed only with `includeDerived: true`, each with its `computed` value and its `declarations` (selector, " +
    "condition, declared value), read from the site's own stylesheets (same-origin only). " +
    "Input: optional `includeDerived` (boolean, default false) and `prefix` (for example \"--color\") to " +
    "list only variables whose name starts with it (which also returns the matching derived ones). " +
    SCOPE +
    MODIFY_HINT,
  inputSchema: {
    type: "object",
    properties: {
      includeDerived: { type: "boolean", description: "Also list the derived tokens, with every declaration. Default false." },
      prefix: { type: "string", description: 'Only variables whose name starts with this, e.g. "--color".' },
    },
  },
  annotations: { readOnlyHint: true },
  execute(input) {
    const { found, skipped } = readRootVariables();
    const prefix = normalizePrefix(input);
    const base = baseSummary(found).filter((token) => token.name.startsWith(prefix));
    const baseNames = new Set(BASE_TOKENS.map((token) => token.name));
    const derived = groupVariables(found, prefix).filter((item) => !baseNames.has(item.name));
    const wantDerived = input?.includeDerived === true || prefix !== "";
    return Promise.resolve(
      ok({
        hint: "Change base tokens with set_variables (light, dark or both); write CSS only for what no token covers.",
        count: base.length,
        base,
        derivedCount: derived.length,
        ...(wantDerived ? { derivedGroups: summarize(derived), derived } : { derivedNote: "Pass includeDerived: true to list them." }),
        unreadableStylesheets: skipped,
      }),
    );
  },
};

/** What is wrong with each value against what its token holds now, one line per variable. */
function valueProblems(entries) {
  const root = getComputedStyle(document.documentElement);
  const supports = (property, value) => CSS.supports(property, value);
  const problems = [];
  for (const [name, value] of entries) {
    if (value === null) continue;
    const kind = kindOf(root.getPropertyValue(name).trim(), supports);
    const problem = literalProblem(value) ?? kindProblem(kind, value, supports);
    if (problem) problems.push(`${name}: ${problem}.`);
  }
  return problems;
}

/** A warning for each variable no site stylesheet declares: the site does not read it. */
function unusedWarnings(entries) {
  const known = declaredNames();
  return entries
    .filter(([name, value]) => value !== null && !known.has(name))
    .map(([name]) => `${name} is not used by the site: no stylesheet declares it, so setting it changes nothing unless your own CSS reads it.`);
}

/** The mode and the [name, value] pairs, or a ToolError saying what to fix. Nothing has been changed then. */
function readInput(input) {
  const mode = input?.mode ?? "both";
  if (!MODES.includes(mode)) throw fail(`"mode" must be one of ${MODES.join(", ")}.`);
  let entries;
  try {
    entries = parseVariables(input?.variables);
  } catch (error) {
    throw fail(`Invalid variables: ${error instanceof Error ? error.message : String(error)}. Nothing was changed.`);
  }
  const problems = valueProblems(entries);
  if (problems.length) throw fail(`Nothing was changed.\n${problems.join("\n")}`);
  return { mode, entries };
}

const setVariables = {
  name: "set_variables",
  summary: "change design tokens (colours, fonts, sizes) in light, dark or both",
  title: "Change the site's design tokens",
  description:
    "Changes CSS variables (design tokens) such as --color-paper, --color-ink, --color-accent, --tree-hue, --g-a or " +
    "--font-size-base, and everything built on them follows: the page, and also the tree, the gradient and the " +
    "cotas, which repaint at once. Prefer this to writing CSS; call get_variables first to see the base tokens, " +
    "their light and dark values and what each is for. `mode` says which colour mode the values are for: " +
    "\"light\", \"dark\", or \"both\" (default), so you do not have to know how the site writes its dark " +
    "values; set a dark value only while it should differ from light. Only custom properties (--name) are " +
    "accepted. A value is checked against what the token holds (a colour for a colour token; \"r g b\" " +
    "channels such as \"252 190 80\" for --g-a, --g-b and --tree-grad-*; a number for --tree-hue); one that does " +
    "not fit is rejected and nothing changes. A name no site stylesheet declares is applied but returned as a " +
    "warning: it is not used by the site. A null or empty value removes your override of that variable in that " +
    "mode. " +
    CHECKS +
    "Returns, per variable and mode, `before` and `after` (the computed value in the mode showing now; a change " +
    "for the other mode shows when you switch with set_theme_mode) and `warnings`. " +
    "Input: `variables` (object of --name to value), optional `mode`, optional `force` (boolean). " +
    SCOPE +
    MODIFY_HINT,
  inputSchema: {
    type: "object",
    properties: {
      variables: {
        type: "object",
        additionalProperties: { type: ["string", "number", "null"] },
        description: 'Object {"--name": "value"}, for example {"--color-paper": "#fff8e7", "--tree-hue": 200}. null or "" removes the override.',
      },
      mode: { type: "string", enum: MODES, description: 'Which colour mode the values are for: "light", "dark" or "both" (default).' },
      force: FORCE_PROPERTY,
    },
    required: ["variables"],
  },
  execute(input) {
    const { mode, entries } = readInput(input);
    const current = getState();
    const variables = mergeVariables(current.variables, entries, mode);
    checkSize(renderCss({ ...current, variables }), "The variables");
    const root = getComputedStyle(document.documentElement);
    const before = Object.fromEntries(entries.map(([name]) => [name, root.getPropertyValue(name).trim()]));
    const warnings = applyGuarded({ ...current, variables }, input.force === true);
    warnings.push(...unusedWarnings(entries));
    const changes = [];
    for (const [name, value] of entries) {
      const change = { name, mode, before: before[name], after: root.getPropertyValue(name).trim() };
      change[value === null ? "removed" : "value"] = value ?? true;
      changes.push(change);
    }
    return Promise.resolve(
      ok({
        message: "Variables applied; the tree, the gradient and the cotas repaint with them.",
        showing: isDark() ? "dark" : "light",
        changes,
        overrides: getState().variables,
        warnings,
      }),
    );
  },
};

export const variableTools = [getVariables, setVariables];
