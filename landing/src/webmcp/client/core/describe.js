// How an element is named in what an agent reads: short and recognisable
// (tag#id.class), never its text. An error that printed `html`'s textContent
// used to quote the whole inline stylesheet, which says nothing about the element.

const MAX_DESCRIPTION_CHARS = 60;
const MAX_EXCERPT_CHARS = 60;
const MAX_CLASSES = 2;
// Their textContent is the page's scripts and styles, not something to read.
const NO_EXCERPT = new Set(["html", "head", "body"]);

function clip(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** `tag#id`, or `tag.class.class` for an element with no id (just `tag` for html and body, whose classes are the theme's); at most 60 characters. */
export function describeElement(el) {
  if (el.id) return clip(`${el.localName}#${el.id}`, MAX_DESCRIPTION_CHARS);
  if (el === document.documentElement || el === document.body) return el.localName;
  const classes = Array.from(el.classList)
    .slice(0, MAX_CLASSES)
    .map((name) => `.${name}`)
    .join("");
  return clip(`${el.localName}${classes}`, MAX_DESCRIPTION_CHARS);
}

/** The same, followed by an excerpt of the element's text, for results that help an agent find it. */
export function describeWithText(el) {
  const text = NO_EXCERPT.has(el.localName) ? "" : (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_EXCERPT_CHARS);
  return `${describeElement(el)}${text ? ` "${text}"` : ""}`;
}
