// The checks that look at the main content the way a visitor does: is the text
// still there to read, can it be clicked, can the rest of the page be reached by
// scrolling. They need the page's real geometry, so they are measured on a
// sample of its text rather than asked of one element (health.js has the checks
// of single elements). They only read, they never change anything.
//
// The sample is taken BEFORE a change, from the text that is readable and
// clickable then, and measured again after it. Judging the same pieces of text
// twice keeps what the page legitimately hides (a menu for the other
// breakpoint, a sticky bar over a corner) out of the verdict: only what the
// change took away counts.
import { describeElement } from "../core/describe.js";
import { mostCommon, overlap, parseFilter, transformScale } from "./measure.js";

/** Below this the page, or what holds it, is for practical purposes not there. */
export const MIN_OPACITY = 0.1;
const MIN_SCALE = 0.3;
const MAX_BLUR_PX = 4;
const MIN_BRIGHTNESS = 0.1;

const MAX_SAMPLES = 40;
const MAX_TEXT_NODES = 600;
// Of the sampled text that was readable before, this share has to stay so.
const KEEP_SHARE = 0.5;
const MIN_TEXT_PX = 3;
const PUSHED_VIEWPORTS = 4;
// A few pixels of overflow are rounding and sub-pixel layout, not a page taller than the screen.
const SCROLL_SLACK_PX = 8;
const SKIPPED_PARENTS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA"]);

export function problem(code, message, hint) {
  return { code, message, hint };
}

/**
 * The sidebars' own shell (backdrop, sheet) and the restore notice. They
 * legitimately sit over the page, so they are never a blocker. What an agent
 * puts inside a sidebar is not exempt: that is `.sidebar-scroll`'s content.
 */
export function isChrome(el) {
  if (el.id === "webmcp-shield") return true;
  const drawer = el.closest("ui-drawer");
  if (!drawer) return false;
  const content = drawer.querySelector(".sidebar-scroll");
  return !(content && content !== el && content.contains(el));
}

// --- What an element's ancestors do to it ----------------------------------

function round2(value) {
  return Number(value.toFixed(2));
}

/** What an element's own style does to what it holds, and the first reason (from the root down) it makes the page unreadable. */
function ownEffect(style) {
  const filter = parseFilter(style.filter);
  return {
    opacity: Number(style.opacity) * filter.opacity,
    blur: filter.blur,
    brightness: filter.brightness,
    scale: transformScale(style.transform, style.scale || "none"),
  };
}

/**
 * The cumulative effect of `el` and its ancestors on how visible it is:
 * `{ opacity, scale, reason }`, `reason` being null or why it cannot be read (an
 * element up the chain is blurred, fades the page out, or shrinks it). It
 * names the element highest up the chain that does it. `memo` is shared by one measurement.
 */
export function chainEffect(el, memo) {
  if (!el) return { opacity: 1, scale: 1, reason: null };
  const known = memo.get(el);
  if (known) return known;
  const up = chainEffect(el.parentElement, memo);
  const own = ownEffect(getComputedStyle(el));
  const opacity = up.opacity * own.opacity;
  const scale = up.scale * own.scale;
  let reason = up.reason;
  if (!reason) {
    const name = describeElement(el);
    if (own.blur >= MAX_BLUR_PX) reason = `<${name}> has filter: blur(${round2(own.blur)}px)`;
    else if (own.brightness < MIN_BRIGHTNESS) reason = `<${name}> has a filter that turns everything black`;
    else if (opacity < MIN_OPACITY) reason = `<${name}> makes it almost transparent (opacity ${round2(opacity)} in all)`;
    else if (scale < MIN_SCALE) reason = `<${name}> shrinks it to ${Math.round(scale * 100)}% of its size`;
  }
  const effect = { opacity, scale, reason };
  memo.set(el, effect);
  return effect;
}

// --- Sampling the main content ---------------------------------------------

function viewport() {
  const wrapper = document.getElementById("scroll-wrapper");
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    // The page scrolls itself, or #scroll-wrapper does with the AI layout on: only one of them is not at 0.
    scrolled: window.scrollY + (wrapper ? wrapper.scrollTop : 0),
    memo: new Map(),
    boxes: new Map(),
  };
}

function firstRect(range) {
  for (const rect of range.getClientRects()) if (rect.width >= 1 && rect.height >= 1) return rect;
  return null;
}

function boxOf(el, view) {
  let box = view.boxes.get(el);
  if (!box) {
    box = el.getBoundingClientRect();
    view.boxes.set(el, box);
  }
  return box;
}

/** The ancestor, up to the main content, that has display: none, or null. */
function displayNoneAncestor(el) {
  for (let node = el; node; node = node.parentElement) {
    if (getComputedStyle(node).display === "none") return node;
  }
  return null;
}

/** The ancestor whose overflow clips `rect` away entirely, or null. */
function clippedBy(el, rect, view) {
  for (let node = el; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.overflowX === "visible" && style.overflowY === "visible") continue;
    const shared = overlap(rect, boxOf(node, view));
    if (shared.width < 1 || shared.height < 1) return node;
  }
  return null;
}

/** Why a text node whose box is `rect` is still not readable there, or null. */
function misplacedReason(el, rect, view) {
  const effect = chainEffect(el, view.memo);
  if (effect.reason) return effect.reason;
  if (rect.height < MIN_TEXT_PX) return "is squeezed to no height";
  if (rect.right <= 0 || rect.left >= view.width) return "is moved out of the viewport sideways (a negative margin or text-indent?)";
  if (rect.bottom + view.scrolled <= 0) return "is moved above the top of the page, where no scrolling reaches it";
  const clipper = clippedBy(el, rect, view);
  return clipper ? `is cut off by <${describeElement(clipper)}> (overflow hidden, or a box with no height)` : null;
}

/**
 * How one text node looks now: `{ gone: true }` when it left the page, `{ reason }`
 * when a visitor cannot read it, else `{ rect, docTop }`.
 */
function measureText(node, view) {
  const el = node.parentElement;
  if (!el || !node.isConnected) return { gone: true };
  const range = document.createRange();
  range.selectNodeContents(node);
  const rect = firstRect(range);
  if (!rect) {
    const hider = displayNoneAncestor(el);
    return { reason: hider ? `<${describeElement(hider)}> has display: none` : "is squeezed to no size" };
  }
  const style = getComputedStyle(el);
  if (style.visibility !== "visible") return { reason: `<${describeElement(el)}> has visibility: ${style.visibility}` };
  const reason = misplacedReason(el, rect, view);
  return reason ? { reason } : { rect, docTop: rect.top + view.scrolled };
}

function reaches(hit, el, main) {
  return hit !== null && main.contains(hit) && (hit === el || el.contains(hit) || hit.contains(el));
}

/** What a click at the middle of `rect` would land on, undefined when the middle is off screen. */
function hitAt(rect, view) {
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  if (x < 0 || y < 0 || x >= view.width || y >= view.height) return undefined;
  return document.elementFromPoint(x, y);
}

function textNodesOf(main) {
  const nodes = [];
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node && nodes.length < MAX_TEXT_NODES; node = walker.nextNode()) {
    const el = node.parentElement;
    if (el && !SKIPPED_PARENTS.has(el.tagName) && (node.nodeValue ?? "").trim().length >= 2) nodes.push(node);
  }
  return nodes;
}

/** A sample for `node` if it is readable now, noting whether a click on it lands on it. */
function sampleOf(node, view, main) {
  const measured = measureText(node, view);
  if (!measured.rect) return null;
  const hit = hitAt(measured.rect, view);
  const clickable = hit !== undefined && hit !== null && !isChrome(hit) && reaches(hit, node.parentElement, main);
  return { node, docTop: measured.docTop, clickable };
}

/**
 * The text of the main content to judge a change by: a spread of its text
 * nodes that are readable now, each noted as clickable when a click on it lands
 * on it. Take it before the change; hand it to `checkMainContent` after.
 */
export function pickSamples() {
  const main = document.getElementById("content");
  if (!main) return [];
  const nodes = textNodesOf(main);
  const view = viewport();
  const stride = Math.max(1, Math.ceil(nodes.length / MAX_SAMPLES));
  const samples = [];
  for (let i = 0; i < nodes.length; i += stride) {
    const sample = sampleOf(nodes[i], view, main);
    if (sample) samples.push(sample);
  }
  return samples;
}

// --- The verdicts ----------------------------------------------------------

/** The topmost element whose pointer-events: none (inherited) is what takes the clicks away from `el`, or null. */
function pointerEventsOff(el) {
  let culprit = null;
  for (let node = el; node && getComputedStyle(node).pointerEvents === "none"; node = node.parentElement) culprit = node;
  return culprit;
}

/** The nearest ancestor of `el` that cuts away part of what it holds with clip-path or a mask, or null. */
function cutterOf(el) {
  for (let node = el; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.clipPath !== "none" || (style.maskImage && style.maskImage !== "none")) return node;
  }
  return null;
}

function clicksProblem(blocked, tested) {
  const cutter = cutterOf(blocked[0].el);
  if (cutter) {
    return problem(
      "content:clicks",
      `<${describeElement(cutter)}> cuts the main content away (clip-path or mask), so clicks pass through it to what is behind ` +
        `(${blocked.length} of ${tested} sampled texts could not be clicked).`,
      "Remove the clip-path or mask from #content and the page's wrappers; clip a smaller element instead.",
    );
  }
  const off = pointerEventsOff(blocked[0].el);
  if (off) {
    return problem(
      "content:clicks",
      `Clicks do not reach the page: <${describeElement(off)}> has pointer-events: none, which every element inside it inherits ` +
        `(${blocked.length} of ${tested} sampled texts could not be clicked).`,
      "Remove pointer-events: none from html, body, * and the page's wrappers; use it only on a small decorative element.",
    );
  }
  const [name] = mostCommon(blocked.map((entry) => (entry.hit ? describeElement(entry.hit) : "something")));
  return problem(
    "content:clicks",
    `<${name}> sits on top of the main content and takes the clicks (${blocked.length} of ${tested} sampled texts could not be clicked).`,
    "Do not put a layer over the content; if it must sit there, give it pointer-events: none.",
  );
}

function hiddenProblem(reasons, total) {
  const [reason, count] = mostCommon(reasons);
  return problem(
    "content:hidden",
    `Most of the main content is no longer readable: ${total - reasons.length} of ${total} sampled pieces of its text are left; ` +
      `the commonest cause (${count}): ${reason.startsWith("<") ? reason : `the text ${reason}`}.`,
    "Keep the content in view: remove the rule that hides, shrinks, clips or moves it (target a smaller element, never the page or #content).",
  );
}

/**
 * How one sample fares now: `{ gone }` when it left the page, `{ reason }` when it
 * can no longer be read, `{ blocked, hit }` when a click on it lands elsewhere,
 * `{ tested: true }` when it was clicked fine, `{}` when that could not be told.
 */
function judge(sample, view, main) {
  const measured = measureText(sample.node, view);
  if (measured.gone) return { gone: true };
  if (measured.reason) return { reason: measured.reason };
  if (measured.docTop - sample.docTop > PUSHED_VIEWPORTS * view.height) return { reason: "is pushed several screens below where it was" };
  if (!sample.clickable) return {};
  const hit = hitAt(measured.rect, view);
  // Where a sidebar's shell is, the clicks are meant for it.
  if (hit === undefined || (hit !== null && isChrome(hit))) return {};
  return reaches(hit, sample.node.parentElement, main) ? { tested: true } : { tested: true, blocked: true, hit };
}

/**
 * Whether the sampled text is still readable and clickable. Returns the problems,
 * at most one of each kind.
 */
export function checkMainContent(samples) {
  const main = document.getElementById("content");
  if (!main || samples.length === 0) return [];
  const view = viewport();
  const verdicts = samples.map((sample) => ({ ...judge(sample, view, main), el: sample.node.parentElement })).filter((verdict) => !verdict.gone);
  const reasons = verdicts.filter((verdict) => verdict.reason).map((verdict) => verdict.reason);
  const tested = verdicts.filter((verdict) => verdict.tested).length;
  const blocked = verdicts.filter((verdict) => verdict.blocked);
  const found = [];
  if (verdicts.length > 0 && (verdicts.length - reasons.length) / verdicts.length < KEEP_SHARE) {
    found.push(hiddenProblem(reasons, verdicts.length));
  }
  if (tested > 0 && blocked.length / tested >= KEEP_SHARE) found.push(clicksProblem(blocked, tested));
  return found;
}

function locked(overflow) {
  return overflow === "hidden" || overflow === "clip";
}

/**
 * A page taller than the screen must still scroll: it is the only way to the
 * rest of it. The viewport scrolls by the root's overflow (the body's when the
 * root leaves it alone) and #scroll-wrapper with the AI layout on; whichever
 * has something to scroll and is locked is a trap. A sidebar locks the page
 * on purpose, which is why this is only ever judged against the page as it was.
 */
export function checkScrollable() {
  const found = [];
  const root = document.scrollingElement ?? document.documentElement;
  const rootOverflow = getComputedStyle(document.documentElement).overflowY;
  const viewportOverflow = rootOverflow === "visible" ? getComputedStyle(document.body).overflowY : rootOverflow;
  const wrapper = document.getElementById("scroll-wrapper");
  const traps = [];
  if (root.scrollHeight > window.innerHeight + SCROLL_SLACK_PX && locked(viewportOverflow)) traps.push("html or body");
  if (wrapper && wrapper.scrollHeight > wrapper.clientHeight + SCROLL_SLACK_PX && locked(getComputedStyle(wrapper).overflowY)) {
    traps.push("#scroll-wrapper");
  }
  if (traps.length > 0) {
    found.push(
      problem(
        "content:scroll",
        `The page is taller than the screen but cannot be scrolled: ${traps.join(" and ")} has overflow: hidden, so the rest of it is out of reach.`,
        "Do not set overflow: hidden (or clip) on html, body or the page wrappers; clip a smaller element instead.",
      ),
    );
  }
  return found;
}
