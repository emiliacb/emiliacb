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
import { MODIFY_GATED_HINT, MODIFY_HINT } from "../skills/hints.js";
import { requireSkill } from "../core/skill-gate.js";
import { CHECKS, FORCE_PROPERTY, checkSize } from "./css.js";

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
  if (input?.prefix !== undefined && input.prefix !== null && typeof input.prefix !== "string") {
    throw fail('"prefix" must be a string such as "--color".');
  }
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
    "Call before writing any CSS. Returns the BASE design tokens, the ones meant to be edited: `light` and " +
    "`dark` values, `computed` now, `purpose`, what `derives` from it and your `agentOverrides`. " +
    "`includeDerived: true` or a `prefix` such as \"--color\" also lists the derived tokens with their " +
    "declarations. Read-only. " +
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

// What follows from what is in the tokens' metadata (css/tokens.js), where get_variables reads it from:
// --color-on-accent, -on-ink and -on-strong are derived from their ground (overridable), and the tree
// and the sound window are painted from --tree-grad-a/b as set in each mode, with no inversion in dark.
const setVariables = {
  name: "set_variables",
  summary: "change design tokens (colours, fonts, sizes) in light, dark or both",
  title: "Change the site's design tokens",
  description:
    "Changes design tokens (CSS variables such as --color-paper, --color-accent, --tree-hue, " +
    "--font-size-base); everything built on them follows (tree, gradient and cotas too). " +
    "Prefer it to CSS, and call get_variables first. `variables` maps --name to a value (null removes your " +
    "override); `mode` is light, dark or both (default). A value that does not fit is rejected. " +
    "Returns before and after values. " +
    CHECKS +
    MODIFY_GATED_HINT,
  inputSchema: {
    type: "object",
    properties: {
      variables: {
        type: "object",
        additionalProperties: { type: ["string", "number", "null"] },
        description:
          'Object {"--name": value}; null or "" removes the override. A colour token takes a colour; --g-a, --g-b and --tree-grad-* take "r g b" channels ("252 190 80"); --tree-hue a number.',
      },
      mode: { type: "string", enum: MODES, description: 'Which colour mode the values are for: "light", "dark" or "both" (default).' },
      force: FORCE_PROPERTY,
    },
    required: ["variables"],
  },
  execute(input) {
    requireSkill("modifying-page");
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
