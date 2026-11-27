// WebMCP tools that load Google Fonts into the page. Loading is all they do:
// the agent applies a font afterwards with set_css / set_css_by_selector, so
// the CSS stays in one place (css-state.js) and the guard that undoes a
// change that breaks the page covers it too.
//
// Only https://fonts.googleapis.com/css2 is ever requested, and only with a
// URL built here from a validated family name and numeric weights, so nothing
// the agent sends can reach another host or add parameters.
//
// Loaded fonts are kept in sessionStorage, like the agent's CSS: CSS that
// uses a font keeps working on the next page of the tab, and the tab's end
// ends them.
import { fail, ok } from "../core/result.js";

const STORAGE_KEY = "webmcp:fonts";
const LINK_ATTRIBUTE = "data-webmcp-font";
const CSS_HOST = "https://fonts.googleapis.com";
const FILES_HOST = "https://fonts.gstatic.com";
const LOAD_TIMEOUT_MS = 8000;
const DEFAULT_WEIGHTS = [400, 700];
const MAX_WEIGHTS = 9;
// Google's names are letters, digits, spaces and hyphens ("Space Grotesk", "Source Serif 4").
const FAMILY_PATTERN = /^[A-Za-z][A-Za-z0-9 -]{0,63}$/;

/** @type {Map<string, { family: string, weights: number[], italic: boolean }>} */
const loaded = new Map();

/** The family with single spaces, or a ToolError saying what is wrong with it. */
function requireFamily(input) {
  const family = typeof input?.family === "string" ? input.family.trim().replace(/\s+/g, " ") : "";
  if (family === "") throw fail('"family" is required: a Google Fonts family name such as "Lora" or "Space Grotesk".');
  if (!FAMILY_PATTERN.test(family)) {
    throw fail(
      `"${family.slice(0, 60)}" is not a font family name. Use only letters, digits, spaces and hyphens, exactly as ` +
        'fonts.google.com spells it (for example "Space Grotesk"). Nothing was loaded.',
    );
  }
  return family;
}

function isWeight(w) {
  return Number.isInteger(w) && w >= 1 && w <= 1000;
}

/** Sorted, unique weights, or a ToolError. Absent means the default pair. */
function requireWeights(input) {
  if (input?.weights === undefined || input.weights === null) return DEFAULT_WEIGHTS;
  const list = input.weights;
  const valid = Array.isArray(list) && list.length > 0 && list.length <= MAX_WEIGHTS && list.every(isWeight);
  if (!valid) {
    throw fail(`"weights" must be 1 to ${MAX_WEIGHTS} whole numbers between 1 and 1000, such as [400, 700].`);
  }
  return Array.from(new Set(list)).sort((a, b) => a - b);
}

/** The CSS2 API URL. Italic asks for every weight in both styles, which is what the axis syntax requires. */
function buildUrl(family, weights, italic) {
  const name = family.replace(/ /g, "+");
  const axis = italic
    ? `ital,wght@${[0, 1].flatMap((i) => weights.map((w) => `${i},${w}`)).join(";")}`
    : `wght@${weights.join(";")}`;
  return `${CSS_HOST}/css2?family=${name}:${axis}&display=swap`;
}

/** A guess at the generic family to fall back on, from the name alone: the agent can still pick its own. */
function genericFor(family) {
  if (/mono|code|console/i.test(family)) return "monospace";
  if (/script|hand|brush|cursive|marker/i.test(family)) return "cursive";
  if (/sans|grotesk|grotesque/i.test(family)) return "sans-serif";
  if (/serif|slab|garamond|playfair|merriweather|lora|bitter|baskerville|didot|caslon|crimson|cormorant/i.test(family)) {
    return "serif";
  }
  return "sans-serif";
}

function cssFamilyOf(family) {
  return `'${family}', ${genericFor(family)}`;
}

/** One preconnect pair per page, however many fonts are loaded. */
function ensurePreconnect() {
  for (const [href, crossorigin] of [[CSS_HOST, false], [FILES_HOST, true]]) {
    if (document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    if (crossorigin) link.crossOrigin = "";
    document.head.appendChild(link);
  }
}

/** Puts the stylesheet link in the page, replacing this family's earlier one. `done` settles on load or error. */
function insertLink({ family, weights, italic }) {
  ensurePreconnect();
  for (const old of document.head.querySelectorAll(`link[${LINK_ATTRIBUTE}]`)) {
    if (old.getAttribute(LINK_ATTRIBUTE) === family) old.remove();
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.setAttribute(LINK_ATTRIBUTE, family);
  link.href = buildUrl(family, weights, italic);
  const done = new Promise((resolve, reject) => {
    link.addEventListener("load", () => resolve(link), { once: true });
    link.addEventListener("error", () => reject(new Error("stylesheet")), { once: true });
  });
  document.head.appendChild(link);
  return { link, done };
}

function save() {
  try {
    if (loaded.size === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(loaded.values())));
  } catch {
    // Storage blocked or full: the font still works here, it just will not follow the next navigation.
  }
}

function isSavedFont(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.family === "string" &&
    FAMILY_PATTERN.test(value.family) &&
    typeof value.italic === "boolean" &&
    Array.isArray(value.weights) &&
    value.weights.length > 0 &&
    value.weights.length <= MAX_WEIGHTS &&
    value.weights.every(isWeight)
  );
}

/** Brings back, without waiting for them, the fonts earlier pages of this tab loaded. */
function restoreSavedFonts() {
  let saved = [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    if (Array.isArray(parsed)) saved = parsed.filter(isSavedFont);
  } catch {
    // No storage, or something else wrote there: start clean.
  }
  for (const font of saved) {
    loaded.set(font.family, font);
    // A failure here is not worth reporting: the page simply falls back to the next family in the CSS.
    insertLink(font).done.catch(() => {});
  }
}

/** Resolves when the browser has really fetched the font files; rejects with a message for the agent. */
async function confirmLoaded({ family, weights, italic }) {
  const style = italic ? "italic " : "";
  const results = await Promise.all(weights.map((w) => document.fonts.load(`${style}${w} 1em "${family}"`)));
  if (results.some((faces) => faces.length === 0)) {
    throw fail(
      `The stylesheet for "${family}" loaded but the browser found no font files for weights [${weights.join(", ")}]` +
        `${italic ? " in italic" : ""}. Try other weights or italic: false.`,
    );
  }
}

function timeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("timeout")), ms);
  });
}

async function loadFont(font) {
  const { link, done } = insertLink(font);
  try {
    await Promise.race([done, timeout(LOAD_TIMEOUT_MS)]);
    await Promise.race([confirmLoaded(font), timeout(LOAD_TIMEOUT_MS)]);
  } catch (error) {
    link.remove();
    // The previous version of this family, if any, was replaced by the link just removed: put it back.
    const before = loaded.get(font.family);
    if (before) insertLink(before).done.catch(() => {});
    if (error instanceof Error && error.message === "stylesheet") {
      throw fail(
        `Google Fonts has no "${font.family}" with weights [${font.weights.join(", ")}]${font.italic ? " in italic" : ""} ` +
          "(or the request was blocked). Check the exact family name on fonts.google.com, or try other weights " +
          "(many families have no 500 or 600, and not all have italics).",
      );
    }
    if (error instanceof Error && error.message === "timeout") {
      throw fail(
        `Loading "${font.family}" took longer than ${LOAD_TIMEOUT_MS / 1000} seconds. The network may be slow or ` +
          "blocked; try again.",
      );
    }
    throw error;
  }
}

function describe({ family, weights, italic }) {
  return { family, cssFamily: cssFamilyOf(family), weights, italic };
}

const setGoogleFont = {
  name: "set_google_font",
  summary: "load a Google Fonts family (apply it afterwards with the CSS tools)",
  title: "Load a Google Font",
  description:
    "Loads a Google Fonts family into the page. It ONLY loads the font: it does not apply it to anything. " +
    "Apply it afterwards with set_css or set_css_by_selector, using the returned `cssFamily`, for example " +
    "set_css_by_selector({ selector: \"body\", declarations: { \"font-family\": \"'Lora', serif\" } }). " +
    "Input: `family` (required, the exact name on fonts.google.com, such as \"Lora\" or \"Space Grotesk\"; letters, " +
    "digits, spaces and hyphens only), `weights` (optional array of numbers, default [400, 700]), `italic` " +
    "(optional boolean, default false: also load the italic of each weight). Resolves once the font files are " +
    "really loaded, so CSS applied right after uses it with no flash. Rejects with a hint if Google does not " +
    "know the family or the weights, or if loading takes more than 8 seconds. Loading a family again adds the " +
    "new weights to it. Only fonts.googleapis.com is contacted. The font stays loaded on the other pages of the " +
    "site in this tab and is gone when the tab is closed. " +
    "Returns `family`, `cssFamily` (the value for font-family, with a generic fallback guessed from the name), " +
    "`weights` and `italic`.",
  inputSchema: {
    type: "object",
    properties: {
      family: { type: "string", description: 'Google Fonts family name, e.g. "Lora" or "Space Grotesk".' },
      weights: {
        type: "array",
        items: { type: "number" },
        description: "Weights to load, e.g. [400, 700] (the default). Not every family has every weight.",
      },
      italic: { type: "boolean", description: "Also load the italic of each weight (default false)." },
    },
    required: ["family"],
  },
  async execute(input) {
    const family = requireFamily(input);
    const requested = requireWeights(input);
    const before = loaded.get(family);
    const wanted = {
      family,
      weights: before ? Array.from(new Set([...before.weights, ...requested])).sort((a, b) => a - b) : requested,
      italic: input?.italic === true || before?.italic === true,
    };
    const unchanged = before !== undefined && before.italic === wanted.italic && before.weights.join() === wanted.weights.join();
    if (!unchanged) {
      await loadFont(wanted);
      loaded.set(family, wanted);
      save();
    }
    return ok({
      ...describe(wanted),
      alreadyLoaded: unchanged,
      hint: `Loaded, not applied yet: use set_css_by_selector with "font-family": "${cssFamilyOf(family)}" on the selector you want.`,
    });
  },
};

const listLoadedFonts = {
  name: "list_loaded_fonts",
  summary: "the Google Fonts loaded in this tab",
  title: "List the loaded Google Fonts",
  description:
    "Lists the Google Fonts loaded with set_google_font in this tab (family, the `cssFamily` value to use in " +
    "font-family, weights, italic). Empty when none. Takes no input.",
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: true },
  execute() {
    return Promise.resolve(ok({ fonts: Array.from(loaded.values(), describe) }));
  },
};

// At import time, so a font that CSS from an earlier page relies on is requested as early as possible.
restoreSavedFonts();

export const fontTools = [setGoogleFont, listLoadedFonts];
