// The one way agent CSS reaches the page: try it, check the page is still
// usable, and either keep it or undo it and raise the shield.
import { MIN_CONTRAST, collectProblems, suspendTransitions } from "./health.js";
import { commitState, emptyState, getState, paint, renderCss } from "./css-state.js";
import { fail } from "./result.js";
import { showShield } from "./shield.js";

const MAX_WARNINGS = 20;
const INNER_BLOCK = /([^{}]*)\{([^{}]*)\}/g;

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

function rejection(problems) {
  const lines = problems.map((found) => `- ${found.message} Fix: ${found.hint}`);
  return fail(
    "The change was NOT applied: it broke the page, so it was rolled back and the page looks as before.\n" +
      `${lines.join("\n")}\n` +
      `(The shield checks that the main elements stay visible, text keeps a contrast of at least ${MIN_CONTRAST}:1, ` +
      "and nothing covers the viewport and blocks clicks.) The visitor was shown a notice with the option to " +
      "apply it anyway. Send a corrected change.",
  );
}

/**
 * Applies `next` (a {css, rules} state) if the page stays usable. Resolves to
 * the warnings (declarations the browser ignores); throws a ToolError, after
 * rolling back and showing the shield, when the change broke the page.
 */
export function applyGuarded(next) {
  const css = renderCss(next);
  checkParses(css);
  const before = getState();
  suspendTransitions();
  const problemsBefore = collectProblems();
  paint(next);
  const problems = newProblems(problemsBefore, collectProblems());
  if (problems.length === 0) {
    commitState(next);
    return unsupportedDeclarations(css);
  }
  paint(before);
  showShield(problems, {
    onApply: () => commitState(next),
    onRestore: () => commitState(emptyState()),
  });
  throw rejection(problems);
}
