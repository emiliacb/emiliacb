// A stylesheet's shape as the agent wrote it, without the DOM (so it is
// unit-tested): which rules it declares, and what a browser would swallow
// without a word. The CSS parser recovers from nearly everything, so
// `h1{` is "fine" to it (the block is closed at the end of the file) and a rule
// with a bad selector just disappears; comparing this scan with what the
// browser parsed is how those are told to the agent.

const QUOTES = new Set(['"', "'"]);

/** The index just after the string that starts at `start` (a newline ends an unterminated one, as in CSS). */
function stringEnd(css, start) {
  const quote = css[start];
  for (let i = start + 1; i < css.length; i += 1) {
    if (css[i] === "\\") i += 1;
    else if (css[i] === quote || css[i] === "\n") return i + 1;
  }
  return css.length;
}

/** The source with comments blanked, so braces and semicolons inside them are never read as syntax. */
function withoutComments(css) {
  let out = "";
  for (let i = 0; i < css.length; i += 1) {
    const char = css[i];
    if (QUOTES.has(char)) {
      const end = stringEnd(css, i);
      out += css.slice(i, end);
      i = end - 1;
    } else if (char === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      out += " ";
      if (end === -1) break;
      i = end + 1;
    } else {
      out += char;
    }
  }
  return out;
}

function addStatement(found, text) {
  if (text === "" || /^@charset\b/i.test(text)) return;
  if (/^@import\b/i.test(text)) found.imports.push(text);
  else if (text.startsWith("@")) found.rules.push({ prelude: text, block: false });
  else found.stray.push(text);
}

// What each character that matters does to the scan; `state` is the position in the
// stylesheet: how deep in braces and parentheses, where the current prelude or
// statement started, and the prelude of the block that is open.
const ON_CHAR = {
  "(": (text, i, state) => {
    state.parens += 1;
  },
  ")": (text, i, state) => {
    state.parens = Math.max(0, state.parens - 1);
  },
  "{": (text, i, state) => {
    if (state.depth === 0) state.prelude = text.slice(state.start, i).trim();
    state.depth += 1;
  },
  "}": (text, i, state) => {
    if (state.depth === 0) {
      state.found.extraClosers += 1;
      state.start = i + 1;
      return;
    }
    state.depth -= 1;
    if (state.depth > 0) return;
    state.found.rules.push({ prelude: state.prelude, block: true });
    state.start = i + 1;
  },
  ";": (text, i, state) => {
    if (state.depth > 0 || state.parens > 0) return;
    addStatement(state.found, text.slice(state.start, i).trim());
    state.start = i + 1;
  },
};

/**
 * Splits a stylesheet at its top level.
 * Returns `rules` ({prelude, block}: a style rule, an at-rule with a block, or a
 * statement like `@layer a, b;`), the `@import` statements, `stray` text that is
 * neither (`color: red;` outside any rule), the preludes of blocks never closed
 * (`unclosed`) and how many `}` close nothing.
 */
export function scanCss(css) {
  const text = withoutComments(css);
  const found = { rules: [], imports: [], stray: [], unclosed: [], extraClosers: 0 };
  const state = { found, depth: 0, parens: 0, start: 0, prelude: "" };
  for (let i = 0; i < text.length; i += 1) {
    if (QUOTES.has(text[i])) i = stringEnd(text, i) - 1;
    else ON_CHAR[text[i]]?.(text, i, state);
  }
  if (state.depth > 0) {
    // The parser closes it at the end of the file, so it is a rule like any other, only not the one meant.
    found.unclosed.push(state.prelude);
    found.rules.push({ prelude: state.prelude, block: true });
  } else {
    addStatement(found, text.slice(state.start).trim());
  }
  return found;
}
