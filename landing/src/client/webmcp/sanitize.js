// Turns agent-supplied HTML into a DocumentFragment that is safe to put in the
// live page. Allowlist, not blocklist: a tag or attribute this file does not
// know is dropped, so a new browser feature cannot become a hole.
//
// The markup is parsed by DOMParser, whose document is inert (no script runs,
// no image loads), and only the cleaned nodes are moved into the page.

/** Removed together with everything inside them. */
const DROP_WITH_CONTENT = new Set([
  "script", "style", "link", "meta", "base", "iframe", "frame", "frameset", "object", "embed", "applet",
  "form", "input", "textarea", "select", "option", "template", "noscript", "foreignobject", "title", "head",
]);

/** Kept as they are. Any other tag is unwrapped: its children stay, the tag goes. */
const ALLOWED_TAGS = new Set([
  "a", "abbr", "address", "article", "aside", "b", "blockquote", "br", "button", "caption", "cite", "code",
  "col", "colgroup", "dd", "del", "details", "div", "dl", "dt", "em", "figcaption", "figure", "footer",
  "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "i", "img", "ins", "kbd", "li", "main", "mark", "nav",
  "ol", "p", "picture", "pre", "q", "s", "samp", "section", "small", "span", "strong", "sub", "summary",
  "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "u", "ul",
  // Basic SVG shapes.
  "svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "text", "tspan", "defs",
  "lineargradient", "radialgradient", "stop", "desc",
]);

const URL_ATTRIBUTES = new Set(["href", "src", "xlink:href", "action", "poster", "srcset"]);
const ALWAYS_REMOVED = new Set(["srcdoc", "formaction", "form", "formmethod", "formtarget", "ping"]);
const SAFE_SCHEME = /^(https?:|mailto:|tel:)/i;
const SAFE_DATA_IMAGE = /^data:image\/(png|jpeg|gif|webp)[;,]/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const RISKY_STYLE = /url\s*\(|expression|javascript:|@import|behavior\s*:|-moz-binding/i;

/** Relative URLs and the safe schemes pass; javascript:, data:text/html and the like do not. */
function isSafeUrl(value) {
  // Browsers ignore control characters and spaces inside a scheme ("java\tscript:").
  const url = value.replace(/[\p{Cc}\s]/gu, "");
  if (SAFE_DATA_IMAGE.test(url) || SAFE_SCHEME.test(url)) return true;
  return !HAS_SCHEME.test(url);
}

/** Why `attribute` must go, or null to keep it. */
function attributeProblem(tag, attribute) {
  const name = attribute.name.toLowerCase();
  if (name.startsWith("on")) return "event handler";
  if (ALWAYS_REMOVED.has(name)) return "unsafe attribute";
  if (name === "style" && RISKY_STYLE.test(attribute.value)) return "style with url() or script";
  if (URL_ATTRIBUTES.has(name) && !isSafeUrl(attribute.value)) return "unsafe URL";
  if (tag === "button" && name === "type") return "button type";
  return null;
}

function cleanAttributes(el, removed) {
  const tag = el.localName;
  for (const attribute of Array.from(el.attributes)) {
    const reason = attributeProblem(tag, attribute);
    if (!reason) continue;
    removed.push(`${reason}: ${tag}[${attribute.name}]`);
    el.removeAttribute(attribute.name);
  }
  if (tag === "button") el.setAttribute("type", "button");
  if (tag === "a" && el.getAttribute("target") === "_blank") el.setAttribute("rel", "noopener noreferrer");
}

function cleanChildren(parent, removed) {
  for (const child of Array.from(parent.childNodes)) cleanNode(child, removed);
}

function cleanNode(node, removed) {
  if (node.nodeType === Node.TEXT_NODE) return;
  if (node.nodeType !== Node.ELEMENT_NODE) {
    node.remove();
    return;
  }
  const tag = node.localName.toLowerCase();
  if (DROP_WITH_CONTENT.has(tag)) {
    removed.push(`element: <${tag}>`);
    node.remove();
    return;
  }
  cleanChildren(node, removed);
  if (!ALLOWED_TAGS.has(tag)) {
    removed.push(`element (kept its content): <${tag}>`);
    node.replaceWith(...Array.from(node.childNodes));
    return;
  }
  cleanAttributes(node, removed);
}

/**
 * Sanitizes `html`. Returns the fragment and `removed`: one line per thing that
 * was dropped, for a tool to tell the agent what did not make it.
 */
export function sanitizeHtmlWithReport(html) {
  const removed = [];
  const parsed = new DOMParser().parseFromString(String(html), "text/html");
  cleanChildren(parsed.body, removed);
  const fragment = document.createDocumentFragment();
  fragment.append(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)));
  return { fragment, removed: [...new Set(removed)] };
}

/** Sanitizes `html` into a DocumentFragment; use sanitizeHtmlWithReport to also learn what was dropped. */
export function sanitizeHtml(html) {
  return sanitizeHtmlWithReport(html).fragment;
}
