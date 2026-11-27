// WebMCP tools that change the page's DOM: a sidebar with content of the
// agent's own, elements inserted into the page, and text replaced in place.
// Every piece of markup goes through sanitize.js first and the agent is told
// what was dropped. None of it is saved: a navigation or a reload brings the
// page back as it was.
import { fail, ok } from "./result.js";
import { sanitizeHtmlWithReport } from "./sanitize.js";

// The shield's host element (shield.js keeps the same id): the one thing on the
// page an agent's markup must never go into or around.
const SHIELD_ID = "webmcp-shield";
const INSERTED_ATTRIBUTE = "data-webmcp-inserted";

const MAX_HTML_CHARS = 100000;
const MAX_TITLE_CHARS = 120;
const MAX_TEXT_CHARS = 20000;
const MAX_SELECTOR_CHARS = 500;
const MAX_ALL_MATCHES = 200;
const SHOWN_PREVIOUS = 20;
const PREVIOUS_CHARS = 500;
const SCOPE = "The change lives only in this tab's current page: navigating or reloading brings the page back as it was. ";

const POSITIONS = ["append", "prepend", "before", "after"];
// Tags that cannot hold the markup (void) or whose content is not rendered as markup.
const NO_CHILDREN = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr",
  "script", "style", "template", "textarea", "noscript", "iframe", "title", "svg",
]);
// The page's skeleton: nothing goes next to these, only inside body's own content.
const SKELETON = new Set(["html", "head", "body"]);
// What textContent can replace without wiping anything that matters: text and inline wording.
const INLINE_TAGS = new Set([
  "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "del", "dfn", "em", "i", "ins", "kbd", "mark", "q",
  "s", "samp", "small", "span", "strong", "sub", "sup", "time", "u", "var", "wbr",
]);

let nextInsertion = 1;

/** The selector, trimmed, or a ToolError saying what is wrong with it. */
function requireSelector(value, field) {
  const selector = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (selector === "") throw fail(`"${field}" is required: a CSS selector such as "h1" or "main section".`);
  if (selector.length > MAX_SELECTOR_CHARS || /[{}@]|\/\*/.test(selector)) {
    throw fail(`"${selector.slice(0, 60)}" is not a plain CSS selector (no braces, @-rules or comments; at most ${MAX_SELECTOR_CHARS} characters).`);
  }
  try {
    document.querySelector(selector);
  } catch {
    throw fail(`"${selector}" is not a valid CSS selector. Use one like "h1", "#content p" or "nav a[href]".`);
  }
  return selector;
}

function requireText(value, field, max) {
  if (typeof value !== "string") throw fail(`"${field}" must be a string.`);
  if (value.length > max) throw fail(`"${field}" is longer than ${max} characters (${value.length}). Send a shorter one.`);
  return value;
}

function describeElement(el) {
  const id = el.id ? `#${el.id}` : "";
  const classes = Array.from(el.classList).slice(0, 4).map((name) => `.${name}`).join("");
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50);
  return `${el.tagName.toLowerCase()}${id}${classes}${text ? ` "${text}"` : ""}`;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max)}… (${text.length} characters in all)` : text;
}

/** Why the page's own machinery must not be touched here, or null when `el` is fair game. */
function protectedReason(el) {
  if (el.closest(`#${SHIELD_ID}`)) return "it is the notice the page shows when an agent's style change breaks it";
  if (el.closest("head")) return "it is in <head>, which is not part of what a visitor sees";
  if (el.localName === "html") return "it is the root element";
  return null;
}

/** The elements `selector` matches, or a ToolError when none does. */
function matchesOrFail(selector) {
  const matches = Array.from(document.querySelectorAll(selector));
  if (matches.length === 0) {
    throw fail(`"${selector}" matches no element on this page. Check it with get_css_by_selector, which reports matchCount, and try a different selector.`);
  }
  return matches;
}

function pickIndex(matches, index, selector) {
  const i = index === undefined ? 0 : index;
  if (!Number.isInteger(i) || i < 0 || i >= matches.length) {
    throw fail(`"index" must be a whole number from 0 to ${matches.length - 1}: "${selector}" matches ${matches.length} element(s).`);
  }
  return matches[i];
}

/** Sanitizes the agent's markup; fails on markup that is not a string or too long. */
function cleanMarkup(html) {
  requireText(html, "html", MAX_HTML_CHARS);
  return sanitizeHtmlWithReport(html);
}

function removedNote(removed) {
  return removed.length === 0 ? "Nothing was removed from the HTML." : `Removed from the HTML for safety: ${removed.join("; ")}.`;
}

const openCustomSidebar = {
  name: "open_custom_sidebar",
  title: "Open a sidebar with your own content",
  description:
    "Opens a sidebar on the page with a title and the HTML you give it. It is the same panel the site uses for its " +
    "GitHub, LinkedIn, email and booking sidebars (a panel from the right on a desktop, a bottom sheet on a phone), " +
    "with a dimmed backdrop and a close button; it closes with the button, a click on the backdrop, Escape, or a " +
    "downward drag on the phone sheet. Use it to show the visitor something that does not belong in the page: a " +
    "summary, a list of results, an answer with links. " +
    "Input: `title` (string, up to 120 characters); `html` (the content, up to 100000 characters; headings, " +
    "paragraphs, lists, links, images and tables are styled in the sheet's type); optional `side`: \"auto\" " +
    "(default: right on a desktop, bottom on a phone), \"right\" or \"bottom\". " +
    "The HTML is sanitized: scripts, styles, forms, iframes, event handlers, javascript: links and ids the page " +
    "already uses are removed, and the result lists what was dropped in `removed`. " +
    "Calling it again REPLACES the title and content of that same sidebar (an open one stays open, and keeps its " +
    "edge until it is closed). Returns whether it replaced an open sidebar and the edge it uses. " +
    "Opening it closes any other sidebar. " +
    SCOPE,
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "The sidebar's heading." },
      html: { type: "string", description: "The content as an HTML fragment (no <html> or <body> needed)." },
      side: { type: "string", enum: ["auto", "right", "bottom"], description: "Which edge it opens from. Default auto." },
    },
    required: ["title", "html"],
  },
  async execute(input) {
    const title = requireText(input?.title, "title", MAX_TITLE_CHARS).trim();
    if (title === "") throw fail('"title" must not be empty.');
    const side = input.side ?? "auto";
    if (!["auto", "right", "bottom"].includes(side)) throw fail('"side" must be "auto", "right" or "bottom".');
    const { fragment, removed } = cleanMarkup(input.html);
    if (fragment.childNodes.length === 0) {
      throw fail(`Nothing is left of "html" after sanitizing, so there is nothing to show. ${removedNote(removed)} Send plain HTML such as "<p>Text</p>".`);
    }
    const api = window.siteSidebars;
    if (!api) throw fail("This page has no sidebars to open. Open the page again (they are part of every page of the site).");
    let opened;
    try {
      opened = await api.openCustom({ title, content: fragment, side });
    } catch {
      throw fail("The sidebar could not open because its component failed to load (network). Try again in a moment.");
    }
    return ok({
      message: opened.replaced ? "The open sidebar's content was replaced." : "Sidebar opened.",
      side: opened.side,
      removed,
      note: `${removedNote(removed)} Close it with close_sidebar; it is gone when the page is reloaded.`,
    });
  },
};

const closeSidebar = {
  name: "close_sidebar",
  title: "Close the open sidebar",
  description:
    "Closes whichever sidebar is open (one of the site's own or the one from open_custom_sidebar). Takes no input. " +
    "Not an error when none is open: it says so. The content of the custom sidebar is kept, and open_custom_sidebar " +
    "replaces it the next time.",
  inputSchema: { type: "object", properties: {} },
  async execute() {
    const api = window.siteSidebars;
    const closed = api ? await api.close() : null;
    return ok(closed ? `Closed the sidebar "${closed.id}".` : "No sidebar was open.");
  },
};

/** The refusal for a parent that cannot take the markup in that position, or null. */
function insertionProblem(parent, position) {
  const tag = parent.localName;
  const why = protectedReason(parent);
  if (why) return `"${describeElement(parent)}" is off limits: ${why}.`;
  const inside = position === "append" || position === "prepend";
  if (inside && NO_CHILDREN.has(tag)) {
    return `<${tag}> cannot contain HTML elements. Pick its parent, or use position "before" or "after".`;
  }
  if (!inside && SKELETON.has(tag)) {
    return `Nothing can be put ${position} <${tag}>: that would break the page's structure. Use "append" or "prepend" on <body> or a section.`;
  }
  return null;
}

const insertElement = {
  name: "insert_element",
  title: "Insert HTML into the page",
  description:
    "Adds HTML to the page, next to or inside an existing element. " +
    "Input: `html` (a fragment, up to 100000 characters); `parentSelector` (CSS selector of the reference element); " +
    "optional `position` relative to it: \"append\" (default: as its last child), \"prepend\" (first child), " +
    "\"before\" or \"after\" (as its sibling); optional `index` (0-based) to pick one when the selector matches " +
    "several elements (default 0, the first). " +
    "The HTML is sanitized (scripts, styles, forms, iframes, event handlers, javascript: links and ids the page " +
    "already uses are removed) and `removed` lists what was dropped. Insertion into <head>, around <html>, <head> or " +
    "<body>, inside elements that cannot hold markup (<img>, <script>...) and into the page's own error notice is " +
    "refused. The inserted elements get a `data-webmcp-inserted` attribute; the result gives the selector that " +
    "finds them and an `id` for remove_inserted_elements. Style them with set_css_by_selector. " +
    "Returns where it went (parent, position), the tags inserted and that selector. " +
    SCOPE,
  inputSchema: {
    type: "object",
    properties: {
      html: { type: "string", description: "The HTML fragment to insert." },
      parentSelector: { type: "string", description: 'CSS selector of the reference element, e.g. "main" or "article h2".' },
      position: { type: "string", enum: POSITIONS, description: "append (default), prepend, before or after the reference element." },
      index: { type: "number", description: "Which match of parentSelector to use (0-based). Default 0." },
    },
    required: ["html", "parentSelector"],
  },
  execute(input) {
    const selector = requireSelector(input?.parentSelector, "parentSelector");
    const position = input.position ?? "append";
    if (!POSITIONS.includes(position)) throw fail(`"position" must be one of ${POSITIONS.join(", ")}.`);
    const matches = matchesOrFail(selector);
    const parent = pickIndex(matches, input.index, selector);
    const problem = insertionProblem(parent, position);
    if (problem) throw fail(`${problem} Nothing was inserted.`);

    const { fragment, removed } = cleanMarkup(input.html);
    const elements = Array.from(fragment.children);
    if (elements.length === 0) {
      throw fail(`No element is left of "html" after sanitizing (only text or nothing). ${removedNote(removed)} Nothing was inserted. Wrap the content in an element such as <p>.`);
    }
    const id = nextInsertion;
    nextInsertion += 1;
    for (const el of elements) el.setAttribute(INSERTED_ATTRIBUTE, String(id));
    parent[position](fragment);

    return Promise.resolve(
      ok({
        message: `Inserted ${elements.length} element(s) (${position}) "${describeElement(parent)}".`,
        id,
        tags: elements.map((el) => el.localName),
        selector: `[${INSERTED_ATTRIBUTE}="${id}"]`,
        reference: describeElement(parent),
        position,
        matchesOfParentSelector: matches.length,
        removed,
        note: `${removedNote(removed)} Undo with remove_inserted_elements.`,
      }),
    );
  },
};

const removeInsertedElements = {
  name: "remove_inserted_elements",
  title: "Remove what insert_element added",
  description:
    "Removes the elements added with insert_element. Input: optional `id` (the number insert_element returned) " +
    "to remove only that insertion; without it, every inserted element on the page is removed. It does not " +
    "undo set_text_content or close a sidebar (use close_sidebar). Returns how many elements were removed; " +
    "zero is not an error.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "number", description: "The id insert_element returned. Omit to remove all insertions." } },
  },
  execute(input) {
    const wanted = input?.id === undefined ? null : String(input.id);
    const found = Array.from(document.querySelectorAll(`[${INSERTED_ATTRIBUTE}]`));
    const targets = found.filter((el) => wanted === null || el.getAttribute(INSERTED_ATTRIBUTE) === wanted);
    for (const el of targets) el.remove();
    return Promise.resolve(ok(`Removed ${targets.length} inserted element(s)${wanted === null ? "" : ` of insertion ${wanted}`}.`));
  },
};

/** The descendants of `el` that textContent would wipe: anything beyond plain inline wording. */
function wipedChildren(el) {
  return Array.from(el.querySelectorAll("*")).filter((child) => !INLINE_TAGS.has(child.localName));
}

function refusalFor(el) {
  const why = protectedReason(el);
  if (why) return `"${describeElement(el)}" is off limits: ${why}.`;
  if (el.localName === "body") return "<body> holds the whole page.";
  const wiped = wipedChildren(el);
  if (wiped.length === 0) return null;
  const kinds = [...new Set(wiped.map((child) => `<${child.localName}>`))].slice(0, 6).join(", ");
  return (
    `"${describeElement(el)}" contains ${kinds} (${wiped.length} element(s)) that setting its text would delete.`
  );
}

const setTextContent = {
  name: "set_text_content",
  title: "Change the text of elements",
  description:
    "Replaces the text of an element with plain text (never HTML: `<b>` stays as the characters, it is not " +
    "interpreted). Input: `selector`; `text` (string, up to 20000 characters); optional `index` (0-based, which " +
    "match; default 0); optional `all: true` to change every match (up to 200) instead of one; optional " +
    "`force: true`. " +
    "Setting the text removes all the element's children. So an element that contains links, buttons, images, lists, " +
    "other blocks or any structure beyond inline wording (<span>, <em>, <strong>, <code>...) is refused with an " +
    "explanation, and nothing is changed; use a more specific selector that reaches the element that holds just " +
    "the text (for example \"h1\" or \"p.lead\" rather than \"header\"), or `force: true` if wiping the children is " +
    "intended. <body>, <head> and the page's error notice are never changed. With `all`, one refused match refuses " +
    "the whole call. " +
    "Returns the previous text of each changed element (truncated at 500 characters; up to 20 listed) so you can " +
    "restore it by calling the tool again with that text; inline wording like <em> inside it is not restored. " +
    SCOPE,
  inputSchema: {
    type: "object",
    properties: {
      selector: { type: "string", description: 'CSS selector of the element(s), e.g. "h1".' },
      text: { type: "string", description: "The new plain text." },
      index: { type: "number", description: "Which match to change (0-based). Default 0. Ignored with all." },
      all: { type: "boolean", description: "Change every match instead of one." },
      force: { type: "boolean", description: "Allow wiping children such as links or lists." },
    },
    required: ["selector", "text"],
  },
  execute(input) {
    const selector = requireSelector(input?.selector, "selector");
    const text = requireText(input.text, "text", MAX_TEXT_CHARS);
    const matches = matchesOrFail(selector);
    let targets;
    if (input.all === true) {
      if (matches.length > MAX_ALL_MATCHES) {
        throw fail(`"${selector}" matches ${matches.length} elements; "all" changes at most ${MAX_ALL_MATCHES}. Use a more specific selector.`);
      }
      targets = matches;
    } else {
      targets = [pickIndex(matches, input.index, selector)];
    }

    const refusals = targets.map(refusalFor).filter((reason) => reason !== null);
    const hardRefusal = targets.some((el) => protectedReason(el) !== null || el.localName === "body");
    if (refusals.length > 0 && (input.force !== true || hardRefusal)) {
      const shown = refusals.slice(0, 3).join(" ");
      const advice = hardRefusal
        ? "Nothing was changed."
        : "Nothing was changed. Use a more specific selector for the element that holds just the text (for example \"h1\" or \"p\" instead of its container), or pass force: true to delete those children on purpose.";
      throw fail(`${shown} ${advice}`);
    }

    const previous = targets.map((el) => {
      // Described before the change, so the excerpt in it is the old text too.
      const element = describeElement(el);
      const before = (el.textContent ?? "").trim();
      el.textContent = text;
      return { element, text: truncate(before, PREVIOUS_CHARS) };
    });
    return Promise.resolve(
      ok({
        message: `Text changed on ${targets.length} element(s) matching "${selector}".`,
        changed: targets.length,
        previous: previous.slice(0, SHOWN_PREVIOUS),
        previousNotShown: Math.max(0, previous.length - SHOWN_PREVIOUS),
      }),
    );
  },
};

export const domTools = [openCustomSidebar, closeSidebar, insertElement, removeInsertedElements, setTextContent];
