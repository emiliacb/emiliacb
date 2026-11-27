// The one way an agent's change reaches the page: try it, check the page is
// still usable, and either keep it or undo it and tell the agent what to fix.
// The feedback is for the agent, which made the mistake and can correct it, so
// the visitor only hears about it (the shield) when the agent deliberately
// forces a change the checks flagged and the page is therefore left that way.
//
// CSS goes through applyGuarded; the changes to the DOM (insert_element,
// set_text_content, open_custom_sidebar) through guardDomChange, which runs the
// same checks around a change and an undo the tool provides.
import { MIN_CONTRAST, collectProblems, measureBaseline, suspendTransitions } from "./health.js";
import { commitState, emptyState, getState, paint, renderCss } from "./state.js";
import { fail } from "../core/result.js";
import { hideShield, isShieldOpen, showShield } from "./shield.js";
import { scanCss } from "./scan.js";

const MAX_WARNINGS = 20;
const MAX_QUOTED_CHARS = 60;
const INNER_BLOCK = /([^{}]*)\{([^{}]*)\}/g;

function quoted(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > MAX_QUOTED_CHARS ? `${flat.slice(0, MAX_QUOTED_CHARS - 1)}…` : flat;
}

/** Splits a rule body's declarations (a plain split on ";" is enough for a warning). */
function declarationsOf(body) {
  return body
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.includes(":"))
    .map((part) => [part.slice(0, part.indexOf(":")).trim(), part.slice(part.indexOf(":") + 1).trim()]);
}

/**
 * The CSS parser drops what it cannot parse without a word, so declarations
 * the browser rejects are found in the source: each one that CSS.supports
 * refuses is a warning (the agent probably misspelled a property or a value).
 */
export function unsupportedDeclarations(css) {
  const warnings = [];
  for (const [, prelude, body] of css.matchAll(INNER_BLOCK)) {
    if (prelude.trim().startsWith("@")) continue;
    for (const [property, raw] of declarationsOf(body)) {
      const value = raw.replace(/\s*!\s*important\s*$/i, "");
      if (property.startsWith("--") || CSS.supports(property, value)) continue;
      warnings.push(`The browser ignores "${property}: ${value}" (unknown property or invalid value).`);
    }
  }
  return warnings.slice(0, MAX_WARNINGS);
}

function isValidSelector(selector) {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

/**
 * What the browser does to the stylesheet's shape without a word: an @import
 * (not supported here), a block never closed (it is closed at the end of the
 * file, swallowing whatever follows), stray text, and rules dropped for a bad
 * selector. Found by reading the source, and by comparing the rules it declares
 * with the ones the browser kept.
 */
export function structureWarnings(css) {
  const scan = scanCss(css);
  const warnings = [];
  for (const statement of scan.imports) {
    warnings.push(
      `"${quoted(statement)}" is not supported: @import is dropped, so nothing is loaded from it. ` +
        "Put the rules in the stylesheet itself, and use set_google_font for a Google font.",
    );
  }
  for (const prelude of scan.unclosed) {
    warnings.push(
      `The "{" of "${quoted(prelude)} {" is never closed. The browser closes it at the end of the stylesheet, so ` +
        'everything written after it is read as part of that block. Add the missing "}".',
    );
  }
  if (scan.extraClosers > 0) warnings.push(`The stylesheet has ${scan.extraClosers} "}" that close nothing; the browser ignores them.`);
  for (const text of scan.stray.slice(0, 3)) warnings.push(`"${quoted(text)}" is outside any rule, so the browser ignores it.`);
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  if (sheet.cssRules.length < scan.rules.length) {
    const invalid = scan.rules.filter((rule) => rule.block && !rule.prelude.startsWith("@") && !isValidSelector(rule.prelude));
    for (const rule of invalid.slice(0, 5)) {
      warnings.push(
        rule.prelude === ""
          ? "A block has no selector, so the browser drops it."
          : `The selector "${quoted(rule.prelude)}" is not valid CSS, so the browser drops its whole rule.`,
      );
    }
    if (invalid.length === 0) {
      warnings.push(`The browser dropped ${scan.rules.length - sheet.cssRules.length} rule(s) of the stylesheet it could not parse.`);
    }
  }
  return warnings.slice(0, MAX_WARNINGS);
}

/** Throws a ToolError when the browser cannot parse the stylesheet at all. */
function checkParses(css) {
  try {
    new CSSStyleSheet().replaceSync(css);
  } catch (error) {
    throw fail(
      `The CSS could not be parsed (${error instanceof Error ? error.message : String(error)}). ` +
        "Nothing was changed. Send valid CSS without @import and try again.",
    );
  }
}

function newProblems(before, after) {
  const known = new Set(before.map((found) => found.code));
  return after.filter((found) => !known.has(found.code));
}

function describe(found) {
  return `${found.message} Fix: ${found.hint}`;
}

const CHECKS_SUMMARY =
  "(The checks are that the page's main elements stay visible, readable and clickable, that the main content's text " +
  `is still there to read, that a page taller than the screen can still be scrolled, text keeps a contrast of at least ${MIN_CONTRAST}:1, ` +
  "and nothing covers the viewport and blocks clicks.)";

function rejection(problems, outcome, advice) {
  const lines = problems.map((found) => `- ${describe(found)}`);
  return fail(`The change was NOT applied: it broke the page, so ${outcome}\n${lines.join("\n")}\n${CHECKS_SUMMARY} ${advice}`);
}

// What a forced change left behind, while the shield is showing: the problems
// it was shown for (and the text they were measured on), and how to undo it. The
// shield closes by itself once none of those problems remain, however that came
// about (reset_css, a fix, removing what was inserted), and not before.
const forced = { codes: new Set(), samples: [], undo: new Map() };

function forget() {
  forced.codes.clear();
  forced.samples = [];
  forced.undo.clear();
}

function restoreForced() {
  const undos = [...forced.undo.values()];
  forget();
  for (const undo of undos) undo();
}

/** Keeps the shield open for `problems`, which a change the agent forced left in the page. `undo` is its way back, one per `key`. */
function holdShield(problems, samples, key, undo) {
  if (!isShieldOpen()) forget();
  for (const found of problems) forced.codes.add(found.code);
  forced.samples.push(...samples);
  forced.undo.set(key, undo);
  showShield({ onRestore: restoreForced });
}

/**
 * Closes the shield when what it was shown for is gone. Every way back
 * (reset_css, a later change that fixes it, removing an inserted element) calls it.
 */
export function settleShield() {
  if (!isShieldOpen()) {
    forget();
    return;
  }
  const remaining = new Set(collectProblems(forced.samples).map((found) => found.code));
  for (const code of forced.codes) if (!remaining.has(code)) forced.codes.delete(code);
  if (forced.codes.size > 0) return;
  forget();
  hideShield();
}

let nextForcedKey = 0;
const restoreCss = () => commitState(emptyState());

/** Removes everything an agent applied (reset_css). A forced change's restore notice has nothing left to offer once it is gone. */
export function resetAgentCss() {
  suspendTransitions();
  commitState(emptyState());
  settleShield();
}

const FORCE_CSS_ADVICE =
  "Send a corrected change. If the effect is intended despite this (for example a deliberately faint decorative style), " +
  'send the same change with "force": true; it is then applied and the visitor is offered a button to restore the original page.';

/**
 * Applies `next` (a {css, rules} state) if the page stays usable. Resolves to
 * the warnings (declarations the browser ignores, stylesheet text it swallowed).
 * When the change broke the page it is rolled back silently and a ToolError
 * tells the agent what to fix, unless `force` is set: then it is kept, the
 * problems are returned as warnings, and the visitor gets the shield with a way back.
 */
export function applyGuarded(next, force = false) {
  const css = renderCss(next);
  checkParses(css);
  const before = getState();
  suspendTransitions();
  const baseline = measureBaseline();
  paint(next);
  const problems = newProblems(baseline.problems, collectProblems(baseline.samples));
  if (problems.length === 0) {
    commitState(next);
    settleShield();
    return [...structureWarnings(next.css), ...unsupportedDeclarations(css)].slice(0, MAX_WARNINGS);
  }
  if (!force) {
    paint(before);
    throw rejection(problems, "it was rolled back and the page looks as before.", FORCE_CSS_ADVICE);
  }
  commitState(next);
  holdShield(problems, baseline.samples, "css", restoreCss);
  return [
    ...problems.map((found) => `Applied anyway (force): ${describe(found)}`),
    ...structureWarnings(next.css),
    ...unsupportedDeclarations(css),
  ].slice(0, MAX_WARNINGS);
}

/**
 * Runs a change to the DOM under the same checks. `change` makes it (it may be
 * async) and returns what `undo` needs to take it back. When the page got worse
 * it is undone and a ToolError says what to fix; with `force` it stays, the
 * visitor gets the shield with a way back (`undo`), and the problems come back
 * as warnings. `sidebar` is for a change that opens one: see collectProblems.
 * Resolves to `{ result, warnings }`.
 */
export async function guardDomChange({ change, undo, force = false, sidebar = false, advice }) {
  const baseline = measureBaseline({ sidebar });
  const result = await change();
  const problems = newProblems(baseline.problems, collectProblems(baseline.samples, { sidebar }));
  if (problems.length === 0) {
    settleShield();
    return { result, warnings: [] };
  }
  if (!force || sidebar) {
    await undo(result);
    throw rejection(problems, "it was undone and the page looks as before.", advice);
  }
  nextForcedKey += 1;
  holdShield(problems, baseline.samples, `dom:${nextForcedKey}`, () => undo(result));
  return { result, warnings: problems.map((found) => `Applied anyway (force): ${describe(found)}`) };
}
