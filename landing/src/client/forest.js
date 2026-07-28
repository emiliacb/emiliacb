/**
 * Depth for the illustration: a generated forest behind the page, and parallax
 * on every plane.
 *
 * Three bands of generated trees sit behind the page copy, each drifting by a
 * different amount. Two inputs feed one transform per band: scroll progress
 * moves them vertically, pointer position sways them sideways. Both are written
 * from a single rAF loop so they never fight over `transform`.
 *
 * The hand-drawn tree joins in, but sideways only. It has no roots — its trunk
 * is cut off flat at the bottom of the frame — so any vertical drift would peel
 * its base off the ground. Its placement is deliberate and stays untouched;
 * only a horizontal sway is layered on top.
 *
 * Nothing here is required for the page to work: if this bundle never runs, the
 * bands stay empty and the page is exactly what it was.
 */
import { animateTree } from "../components/tree/generate";

const bandFar = document.getElementById("forest-far");
const bandMid = document.getElementById("forest-mid");
const bandNear = document.getElementById("forest-near");
const front = document.getElementById("tree-illustration");

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * How far each plane drifts over the *whole page*, in viewport heights.
 *
 * Multiplying scroll position by a factor is the obvious way to do this and it
 * is wrong: the offset grows without bound, so on a long page the foreground
 * climbs clean out of frame. Tying travel to scroll progress caps it by
 * construction — every plane is still on screen at the bottom.
 */
const TRAVEL = { far: 0.04, mid: 0.09, near: 0.16, front: 0 };

/** Sideways sway at full pointer deflection, in pixels. Nearer sways more. */
const SWAY = { far: 6, mid: 16, near: 32, front: 44 };

/**
 * Planes that may only move sideways. A rootless tree is drawn sitting on the
 * bottom edge of its own frame, so lifting it vertically lifts it off the
 * ground — the drawn one is cut off exactly that way.
 */
const HORIZONTAL_ONLY = new Set(["front"]);

/**
 * The bands, back to front. Size is what sells depth, so the ranges are wide
 * and overlap a little between neighbours: a uniform row of same-size trees
 * reads as a pattern no matter how the parallax moves it.
 *
 * Count falls off sharply towards the viewer for the same reason a real stand
 * does — a crowd of small trunks far away, a handful of big ones close. It also
 * keeps the near band from walling off the copy.
 */
const BANDS = [
  { plane: "far", count: 26, minWidth: 38, maxWidth: 96 },
  { plane: "mid", count: 13, minWidth: 88, maxWidth: 170 },
  { plane: "near", count: 4, minWidth: 175, maxWidth: 310 },
];

/** Vertical sway is a fraction of the horizontal, or it reads like a wobble. */
const SWAY_Y = 0.3;

/** Pause before the first tree, then the random gap between each one, in ms. */
const FIRST_SPROUT = 260;
const SEQUENCE_GAP = [0, 10000];

const nodes = { far: bandFar, mid: bandMid, near: bandNear, front };
const planes = Object.entries(nodes).filter(([, node]) => node);

const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
let progress = 0;
let frame = 0;

function write() {
  const vh = window.innerHeight;
  for (const [plane, node] of planes) {
    const x = -pointer.x * SWAY[plane];
    const y = HORIZONTAL_ONLY.has(plane)
      ? 0
      : -progress * TRAVEL[plane] * vh - pointer.y * SWAY[plane] * SWAY_Y;
    node.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
  }
}

function tick() {
  frame = 0;
  // Ease towards the pointer instead of tracking it: locked to the cursor the
  // planes feel stuck to the glass, and every jitter of the hand shows up.
  pointer.x += (pointer.targetX - pointer.x) * 0.08;
  pointer.y += (pointer.targetY - pointer.y) * 0.08;
  write();

  const settling =
    Math.abs(pointer.targetX - pointer.x) > 0.0005 ||
    Math.abs(pointer.targetY - pointer.y) > 0.0005;
  if (settling) request();
}

function request() {
  if (!frame && !reduced) frame = window.requestAnimationFrame(tick);
}

function readScroll() {
  const runway = Math.max(
    1,
    document.documentElement.scrollHeight - window.innerHeight
  );
  progress = Math.min(1, Math.max(0, window.scrollY / runway));
  request();
}

/**
 * Lays out the empty slots of one band and returns them, unplanted.
 *
 * Every slot exists before anything grows, so the sequencing below only decides
 * *when* a tree appears — sizes and positions never shift under it.
 *
 * Placement is a jittered slot rather than an even row: real stands clump, and
 * evenly spaced trunks read as a fence however varied their sizes are.
 */
function layout(band, { count, minWidth, maxWidth }) {
  if (!band) return [];
  band.replaceChildren();

  const slots = [];
  for (let i = 0; i < count; i++) {
    const width = minWidth + Math.random() * (maxWidth - minWidth);
    const slot = document.createElement("div");
    slot.className = "forest-tree";
    slot.style.width = `${width}px`;
    slot.style.left = `${((i + 0.1 + Math.random() * 0.8) / count) * 100}%`;
    // Break the flat baseline: some trees stand a little further back.
    slot.style.bottom = `${Math.round(Math.random() * width * 0.14)}px`;
    band.append(slot);
    slots.push(slot);
  }
  return slots;
}

/** Starts one tree growing in a slot that is already laid out. */
function sprout(slot) {
  animateTree(slot, {
    seed: Math.floor(Math.random() * 1e9).toString(36),
    width: 300,
    height: 620,
    padding: 10,
    roots: false,
    duration: 1900 + Math.random() * 1300,
    reducedMotion: reduced,
  });
}

/** Fisher-Yates, so the stand fills in scattered instead of sweeping across. */
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const narrow = window.matchMedia("(max-width: 768px)").matches;
const queue = shuffle(
  BANDS.flatMap((band) =>
    layout(nodes[band.plane], {
      ...band,
      count: narrow ? Math.ceil(band.count * 0.5) : band.count,
    })
  )
);

// One tree at a time, with an irregular gap between them. A single shuffled
// queue rather than a per-band cascade: the bands used to start within a few
// hundred milliseconds of each other, so most of the forest came up at once.
// Sequencing also caps how many trees rebuild their paths in the same frame.
if (reduced) {
  queue.forEach(sprout);
} else {
  let next = 0;
  const step = () => {
    if (next >= queue.length) return;
    sprout(queue[next++]);
    window.setTimeout(step, SEQUENCE_GAP[0] + Math.random() * (SEQUENCE_GAP[1] - SEQUENCE_GAP[0]));
  };
  window.setTimeout(step, FIRST_SPROUT);
}

if (planes.length) {
  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("resize", readScroll, { passive: true });

  window.addEventListener(
    "pointermove",
    (event) => {
      // Filter on the event's own pointer type rather than a (hover: hover)
      // query: the query is wrong on hybrid laptops, which do have a trackpad,
      // and this way a finger drag never yanks the planes around.
      if (event.pointerType === "touch") return;
      // -1 at one edge, +1 at the other, so sway is resolution independent.
      pointer.targetX = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.targetY = (event.clientY / window.innerHeight) * 2 - 1;
      request();
    },
    { passive: true }
  );

  // Drift back to centre when the cursor leaves, rather than freezing off-axis.
  window.addEventListener("pointerleave", () => {
    pointer.targetX = 0;
    pointer.targetY = 0;
    request();
  });

  readScroll();
  write();
}
