// Pure CSS-declaration helpers for set_css_by_selector (no DOM, so they are
// unit-tested): parse "a: b; c: d" or {a: "b"}, merge into the per-selector
// rules, and print those rules back as a stylesheet.

// Strings and parentheses are one token, so a ";" inside url(data:...;base64,x)
// or content: "a;b" is never taken for the end of a declaration.
const TOKEN = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\(|\)|;|[{}]|[^"'();{}]+/g;
const DEPTH_STEP = { "(": 1, ")": -1 };
const PROPERTY = /^(--[\w-]+|-?[a-z][a-z0-9-]*)$/i;
const IMPORTANT = /\s*!\s*important\s*$/i;

/** Splits on the semicolons that end a declaration. Throws on braces and unbalanced quotes or parentheses. */
export function splitDeclarations(text) {
  const parts = [];
  let current = "";
  let depth = 0;
  let consumed = 0;
  for (const [token] of text.matchAll(TOKEN)) {
    consumed += token.length;
    if (token === "{" || token === "}") throw new Error('braces ("{" or "}") are not allowed in declarations');
    if (token === ";" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    depth += DEPTH_STEP[token] ?? 0;
    if (depth < 0) throw new Error('unbalanced ")"');
    current += token;
  }
  if (depth !== 0) throw new Error('unbalanced "("');
  if (consumed !== text.length) throw new Error("unterminated quote");
  parts.push(current);
  return parts;
}

function parsePart(part) {
  const index = part.indexOf(":");
  if (index < 1) throw new Error(`"${part.trim()}" is not "property: value"`);
  return [part.slice(0, index).trim(), part.slice(index + 1)];
}

/** One [property, value] pair; an empty or null value is null, which means "remove". */
function toEntry(rawProperty, rawValue) {
  if (!PROPERTY.test(rawProperty)) throw new Error(`"${rawProperty}" is not a CSS property name`);
  const property = rawProperty.startsWith("--") ? rawProperty : rawProperty.toLowerCase();
  if (rawValue === null || rawValue === undefined) return [property, null];
  if (typeof rawValue !== "string" && typeof rawValue !== "number") {
    throw new Error(`the value of "${property}" must be a string, a number or null`);
  }
  const value = String(rawValue).trim();
  return [property, value === "" ? null : value];
}

/**
 * Declarations as [property, value|null] pairs, in order (a later pair for the
 * same property wins). Accepts a declaration string or a plain object.
 */
export function parseDeclarations(input) {
  if (input === null || input === undefined) return [];
  if (typeof input === "string") {
    return splitDeclarations(input)
      .filter((part) => part.trim() !== "")
      .map((part) => toEntry(...parsePart(part)));
  }
  if (typeof input === "object" && !Array.isArray(input)) {
    return Object.entries(input).map(([property, value]) => toEntry(property, value));
  }
  throw new Error("declarations must be an object or a CSS declaration string");
}

/** Splits a trailing "!important" off a value. */
export function splitImportant(value) {
  const important = IMPORTANT.test(value);
  return { value: value.replace(IMPORTANT, ""), important };
}

/**
 * Merges entries into the per-selector rules and returns the new rules (the
 * old ones are not touched). A null value removes the property; no entries at
 * all remove the whole selector. `important` adds !important to values that
 * lack it; one that already has it keeps it either way.
 */
export function mergeRule(rules, selector, entries, important) {
  const next = { ...rules };
  if (entries.length === 0) {
    delete next[selector];
    return next;
  }
  const declared = { ...rules[selector] };
  for (const [property, value] of entries) {
    if (value === null) {
      delete declared[property];
      continue;
    }
    const parts = splitImportant(value);
    declared[property] = important || parts.important ? `${parts.value} !important` : parts.value;
  }
  if (Object.keys(declared).length === 0) delete next[selector];
  else next[selector] = declared;
  return next;
}

/** The per-selector rules as a stylesheet. */
export function rulesToCss(rules) {
  return Object.entries(rules)
    .map(([selector, declared]) => {
      const lines = Object.entries(declared).map(([property, value]) => `  ${property}: ${value};`);
      return `${selector} {\n${lines.join("\n")}\n}`;
    })
    .join("\n");
}
