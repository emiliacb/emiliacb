// The pure parts of set_variables (no DOM, so they are unit-tested): which
// names and values an agent may send, how a value is checked against what the
// token holds now, how overrides are merged per mode, and how they are printed
// as the three blocks the site's own dark values are written in.
import { splitDeclarations } from "./declarations.js";

const NAME = /^--[a-z0-9_-]+$/i;
const CHANNELS = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/;
const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;
const LENGTH = /^-?(\d+\.?\d*|\.\d+)(px|rem|em|%|vw|vh|ch|ex)$/;
// A value that refers to other things is checked by the browser when it is
// used, not here: only what is literal can be judged now.
const DEFERRED = /\b(var|calc|min|max|clamp|env)\(/i;

export const MODES = ["light", "dark", "both"];

export function emptyVariables() {
  return { light: {}, dark: {} };
}

export function hasVariables(variables) {
  return Object.keys(variables.light).length + Object.keys(variables.dark).length > 0;
}

/** Whether `value` has the shape of the saved per-mode maps of strings. */
export function isVariables(value) {
  const isMap = (map) =>
    typeof map === "object" && map !== null && Object.entries(map).every(([k, v]) => NAME.test(k) && typeof v === "string");
  return typeof value === "object" && value !== null && isMap(value.light) && isMap(value.dark);
}

/**
 * [name, value|null] pairs from the agent's object; null (or an empty string)
 * means "remove my override". Throws an Error saying what is wrong.
 */
export function parseVariables(input) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error('"variables" must be an object like {"--color-paper": "#fff"}');
  }
  const entries = Object.entries(input).map(([name, raw]) => {
    if (!NAME.test(name)) {
      throw new Error(
        `"${name}" is not a custom property name (it must start with "--" and use letters, digits, "-" or "_"); ` +
          "set_variables only changes variables, use set_css for other properties",
      );
    }
    if (raw === null || raw === undefined) return [name, null];
    if (typeof raw !== "string" && typeof raw !== "number") throw new Error(`the value of "${name}" must be a string, a number or null`);
    const value = String(raw).trim();
    return [name, value === "" ? null : value];
  });
  if (entries.length === 0) throw new Error('"variables" is empty');
  return entries;
}

/** The reason a value cannot be a custom property's value on its own, or null. */
export function literalProblem(value) {
  if (/\/\*|\*\//.test(value)) return "comments are not allowed";
  if (/!\s*important/i.test(value)) return 'no "!important": the mode you choose already decides which block wins';
  try {
    if (splitDeclarations(value).length !== 1) return 'it must be one value, without ";"';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return null;
}

/**
 * What kind of value a token holds, judged from its computed value now:
 * "colour", "channels" (an "r g b" triple), "number", "length", or "any" when
 * nothing can be said (keywords, font stacks, tokens nobody declares).
 * @param {string} current
 * @param {(property: string, value: string) => boolean} supports
 */
export function kindOf(current, supports) {
  if (current === "") return "any";
  if (CHANNELS.test(current)) return "channels";
  if (NUMBER.test(current)) return "number";
  if (LENGTH.test(current)) return "length";
  return supports("color", current) ? "colour" : "any";
}

/**
 * The reason `value` does not fit a token of `kind`, or null when it does (or
 * when it cannot be told).
 * @param {string} kind
 * @param {string} value
 * @param {(property: string, value: string) => boolean} supports
 */
export function kindProblem(kind, value, supports) {
  if (DEFERRED.test(value)) return null;
  return CHECKS[kind]?.(value, supports) ?? null;
}

function channelsProblem(value) {
  const match = CHANNELS.exec(value);
  if (match && match.slice(1).every((channel) => Number(channel) <= 255)) return null;
  return 'this token is "r g b" channels, three numbers from 0 to 255 separated by spaces, like "252 190 80" (not a colour)';
}

// One check per kind; a kind with none ("any") accepts everything.
const CHECKS = {
  colour: (value, supports) => (supports("color", value) ? null : "it is not a CSS colour (use #rrggbb, rgb(), hsl(), oklch() or a name)"),
  channels: channelsProblem,
  number: (value) => (NUMBER.test(value) ? null : "this token is a plain number"),
  length: (value, supports) => (supports("width", value) ? null : "this token is a length or percentage such as 2rem or 110%"),
};

/** Light, dark or both: which of the two maps a change goes to. */
function targets(mode) {
  return mode === "both" ? ["light", "dark"] : [mode];
}

/** The merged overrides; the old ones are not touched. A null value removes the override. */
export function mergeVariables(variables, entries, mode) {
  const next = { light: { ...variables.light }, dark: { ...variables.dark } };
  for (const side of targets(mode)) {
    for (const [name, value] of entries) {
      if (value === null) delete next[side][name];
      else next[side][name] = value;
    }
  }
  return next;
}

function block(selector, map, indent) {
  const names = Object.keys(map);
  if (names.length === 0) return "";
  const lines = names.map((name) => `${indent}  ${name}: ${map[name]};`);
  return `${indent}${selector} {\n${lines.join("\n")}\n${indent}}`;
}

/**
 * The overrides as a stylesheet. Light goes on :root. Dark goes where the
 * site's own dark values are: under the attribute and under the system's
 * preference unless light is forced, so the agent does not have to know the
 * rules. A light override never leaks into dark: the site's dark blocks are
 * more specific than a bare :root, so they keep winning over it.
 */
export function variablesToCss(variables) {
  const media = block(':root:not([data-theme="light"])', variables.dark, "  ");
  return [
    block(":root", variables.light, ""),
    block(':root[data-theme="dark"]', variables.dark, ""),
    media === "" ? "" : `@media (prefers-color-scheme: dark) {\n${media}\n}`,
  ]
    .filter((part) => part !== "")
    .join("\n");
}
