// "Is the page still usable?": the checks the shield runs after every CSS
// change. They read computed styles and hit-test the viewport, they never
// change anything. Each problem has a stable `code`, so a problem the page
// already had before the change is not blamed on it (see css-apply.js).
import { blend, contrastRatio, parseRgb } from "./contrast.js";

/** Below this the main text is, for practical purposes, the color of its background. */
export const MIN_CONTRAST = 1.5;
const MIN_OPACITY = 0.05;
const COVER = 0.8;

const REQUIRED = [
  ["html", "the page"],
  ["body", "the body"],
  ["#page-shell", "the page shell"],
  ["#content", "the main content"],
];

function problem(code, message, hint) {
  return { code, message, hint };
}

function effectiveOpacity(el) {
  let opacity = 1;
  for (let node = el; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
  return opacity;
}

/** Why `el` cannot be seen, or null. */
function hiddenReason(el) {
  const style = getComputedStyle(el);
  if (style.display === "none") return "has display: none";
  if (style.visibility === "hidden" || style.visibility === "collapse") return "has visibility: hidden";
  if (effectiveOpacity(el) < MIN_OPACITY) return "is (almost) fully transparent";
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return "has no size";
  if (rect.right <= 0 || rect.left >= window.innerWidth || rect.bottom + window.scrollY <= 0) {
    return "was moved fully off-screen";
  }
  return null;
}

function checkVisible() {
  const found = [];
  for (const [selector, label] of REQUIRED) {
    const el = document.querySelector(selector);
    const reason = el ? hiddenReason(el) : null;
    if (reason) {
      found.push(
        problem(
          `hidden:${selector}`,
          `${label} (${selector}) ${reason}.`,
          `Remove or narrow the rule that affects ${selector}; never hide, shrink or move the page itself.`,
        ),
      );
    }
  }
  return found;
}

/** Any CSS color as rgba: computed colors are rgb() almost always; a canvas converts the rest (oklch, color-mix). */
function toRgba(color) {
  const direct = parseRgb(color);
  if (direct) return direct;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return null;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = "#000";
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
}

/**
 * The color behind `el`, from its ancestors' background colors. Null when it
 * cannot be told: a background image or gradient is somewhere in the way, or
 * nothing opaque is (the site draws its backdrop in a separate layer).
 */
function backgroundBehind(el) {
  let color = { r: 0, g: 0, b: 0, a: 0 };
  for (let node = el; node && color.a < 1; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.backgroundImage !== "none") return null;
    const layer = toRgba(style.backgroundColor);
    if (!layer) return null;
    color = blend(color, layer);
  }
  return color.a < 1 ? null : color;
}

function describe(el) {
  const id = el.id ? `#${el.id}` : "";
  return `${el.tagName.toLowerCase()}${id}`;
}

function sampleTexts() {
  const picks = ["#content h1", "#content h2", "#content p", "#content a", "nav a"];
  const found = [];
  for (const selector of picks) {
    const el = document.querySelector(selector);
    if (el && (el.textContent ?? "").trim().length >= 3 && !found.includes(el)) found.push(el);
  }
  return found;
}

function contrastProblem(el) {
  const style = getComputedStyle(el);
  const fontSize = Number.parseFloat(style.fontSize);
  if (fontSize < 4) {
    return problem(
      `font-size:${describe(el)}`,
      `Text in <${describe(el)}> has a font size of ${style.fontSize}.`,
      "Keep body text at a readable size (about 12px or more).",
    );
  }
  const background = backgroundBehind(el);
  const text = toRgba(style.color);
  if (!background || !text) return null;
  const ratio = contrastRatio(blend(text, background), background);
  if (ratio >= MIN_CONTRAST) return null;
  return problem(
    `contrast:${describe(el)}`,
    `Text in <${describe(el)}> is almost the same color as its background (contrast ${ratio.toFixed(2)}:1, ` +
      `text ${style.color} on ${style.backgroundColor}).`,
    "Change the text and the background colors together, and keep them clearly apart (contrast of 4.5:1 or more).",
  );
}

function checkContrast() {
  return sampleTexts()
    .map((el) => contrastProblem(el))
    .filter((found) => found !== null);
}

function covers(rect) {
  return rect.width * rect.height >= window.innerWidth * window.innerHeight * COVER;
}

/** Is `el` (or one of its pseudo-elements) a positioned layer over the viewport that takes the clicks? */
function blocksClicks(el) {
  for (const pseudo of [null, "::before", "::after"]) {
    const style = getComputedStyle(el, pseudo);
    const layered = style.position === "fixed" || style.position === "absolute";
    if (!layered || style.pointerEvents === "none" || style.display === "none") continue;
    if (pseudo === null ? covers(el.getBoundingClientRect()) : covers(pseudoRect(style))) return true;
  }
  return false;
}

function pseudoRect(style) {
  return { width: Number.parseFloat(style.width) || 0, height: Number.parseFloat(style.height) || 0 };
}

function checkOverlay() {
  const found = [];
  const points = [0.5, 0.15, 0.85].flatMap((x) => [0.2, 0.5, 0.8].map((y) => [x, y]));
  for (const [x, y] of points) {
    const hit = document.elementFromPoint(window.innerWidth * x, window.innerHeight * y);
    // The root and the body can be the hit too: their ::before/::after are layers like any other.
    if (!hit || hit.id === "webmcp-shield" || !blocksClicks(hit)) continue;
    found.push(
      problem(
        `overlay:${describe(hit)}`,
        `<${describe(hit)}> covers the viewport and takes every click, so the page cannot be used.`,
        "Do not add full-screen fixed/absolute layers (or ::before/::after) that receive pointer events; add pointer-events: none.",
      ),
    );
    break;
  }
  return found;
}

/**
 * Switches transitions off for a moment. Right after a change a transition would
 * still report the old colors, and after a rollback it would animate the page
 * from the broken look back to the original one: a flash the visitor should not
 * see. It stays off for a few frames, long enough for the final style to be
 * computed without one.
 */
export function suspendTransitions() {
  const style = document.createElement("style");
  style.textContent = "*, *::before, *::after { transition: none !important; }";
  document.head.appendChild(style);
  setTimeout(() => style.remove(), 150);
}

/** Every problem the page has right now. */
export function collectProblems() {
  return [...checkVisible(), ...checkContrast(), ...checkOverlay()];
}
