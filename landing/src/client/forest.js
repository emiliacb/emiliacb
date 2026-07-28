/**
 * Depth for the illustration: a ruled ground plane, a forest standing on it,
 * and parallax over the whole thing.
 *
 * The ground is ruled first and everything else hangs off it. Rows recede
 * toward a horizon and columns converge on the vanishing point; a tree occupies
 * one of the intersections or it does not exist. That one decision settles
 * things that used to be tuned by hand — a tree's size comes from the depth of
 * its row, and the far rows hold many small trunks while the front rows hold a
 * few big ones simply because that is what converging columns do.
 *
 * The plane is distorted in depth and in height, never sideways. Sideways is
 * the one direction a floor cannot move without shearing, and a sheared floor
 * stops reading as a floor.
 *
 * The hand-drawn tree in front joins the parallax, but sideways only. It has no
 * roots — its trunk is cut off flat at the bottom of the frame — so any vertical
 * drift would peel its base off the ground. Its placement is deliberate and
 * stays untouched; only a horizontal sway is layered on top.
 *
 * Nothing here is required for the page to work: if this bundle never runs, the
 * canvas stays blank, the bands stay empty, and the page is what it was.
 */
import { animateTree } from "../components/tree/generate";

const field = document.getElementById("forest-field");
const forestPlane = document.getElementById("forest-plane");
const front = document.getElementById("tree-illustration");

const bands = {
  far: document.getElementById("forest-far"),
  mid: document.getElementById("forest-mid"),
  near: document.getElementById("forest-near"),
};

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ctx = field ? field.getContext("2d") : null;

/* ==========================================================================
   Ground space

   A pinhole camera looking at a flat floor: a point at depth Z lands
   s = HEIGHT / Z below the horizon, and lateral position U lands at
   x = centre + U * s. Both directions are used — the ruling projects out of
   floor coordinates, and a tree's crossing projects back into them.
   ========================================================================== */

const HORIZON = 0.52; // fraction of the viewport height, from the top
const FIRST_ROW = 0.05; // depth of the row nearest the horizon, in viewport heights
const ROW_RATIO = 1.457; // each row is this much further forward than the last
const COLUMN_GAP = 0.55; // lateral spacing between columns, in floor units
const REACH = 0.62; // how much of the viewport width the floor is ruled across

/** Which rows may hold a tree, as depths in viewport heights. */
const PLANT_NEAREST = 1.15;
const PLANT_FURTHEST = 0.11;
/** Fraction of a row's *eligible* intersections that get one. */
const PLANT_SHARE = 0.55;

/** Canopy width at the depth where s reaches a full viewport height. */
const TREE_SCALE = 520;

/** Ruling weight, and how strongly the floor is displaced. */
const LINE_WIDTH = 0.3;
const WARP = 2;

/**
 * How far below its crossing a tree takes to disappear, as a fraction of its
 * own height. Small: enough that a hint of root dissolves into the ground
 * rather than the trunk ending on a clean edge.
 */
const SINK = 0.03;

let W = 0;
let H = 0;
let yh = 0;
let cx = 0;

function measure() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  field.width = Math.round(W * dpr);
  field.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  yh = HORIZON * H;
  cx = W / 2;
}

/* ---- value noise --------------------------------------------------------- */

function hash2(ix, iy, seed) {
  let h = ix * 374761393 + iy * 668265263 + seed * 1274126177;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const smooth = (t) => t * t * (3 - 2 * t);

function noise2(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

/** Two octaves is enough: this is a rolling field, not a rock face. */
function fbm(x, y, seed) {
  return noise2(x, y, seed) * 0.68 + noise2(x * 2.3, y * 2.3, seed + 91) * 0.32;
}

/* ---- distortion ---------------------------------------------------------- */

/**
 * Displacement in depth and in height, sampled on the floor rather than on the
 * glass so it shrinks with distance like everything standing on it.
 */
function warp(u, z) {
  // Log depth, so the geometric row spacing turns into even noise cells.
  const v = Math.log(z) * 1.1;
  const dz = (fbm(u * 0.5 + 3.1, v * 0.9, 17) - 0.5) * WARP * 0.36;
  const dy = (fbm(u * 0.5 + 21.7, v * 0.85 + 8.3, 43) - 0.5) * WARP * 0.5;
  return [dz, dy];
}

/**
 * Height the trees themselves add: every trunk sits on a rise, and the ruling
 * rides over it. The map is not decorated by the terrain — it is the terrain.
 */
const MOUND_WIDTH = 0.34;
const MOUND_DEPTH = 0.26;
const MOUND_HEIGHT = 0.032;
const MOUND_CEILING = 1.6;

function mound(u, z) {
  let total = 0;
  for (const a of anchors) {
    const du = (u - a.u) / MOUND_WIDTH;
    const dz = (z - a.z) / (MOUND_DEPTH * a.z);
    const d2 = du * du + dz * dz;
    if (d2 > 7) continue;
    total += Math.exp(-d2);
  }
  // Neighbours a column apart overlap, and a dozen summing unchecked stops
  // being terrain and becomes a knot the floor cannot be read through.
  return Math.min(total, MOUND_CEILING) * MOUND_HEIGHT * (0.5 + WARP);
}

/** Floor to screen. Returns [x, y, s]; `s` is the drop below the horizon. */
function place(u, z) {
  const [dz, dy] = warp(u, z);
  const shifted = Math.max(0.03, z * (1 + dz));
  const s = H / shifted;
  const height = dy + mound(u, shifted);
  return [cx + u * s, yh + s - height * s, s];
}

/* ---- the ruling ---------------------------------------------------------- */

/** Row depths, from just under the horizon to well past the bottom edge. */
function floorRows() {
  const out = [];
  let k = 0;
  for (let s = FIRST_ROW * H; s < H * 1.9; s *= ROW_RATIO, k++) {
    out.push({ k, s, z: H / s });
  }
  return out;
}

/**
 * Depths sampled finer than the rows, for lines that run *into* the screen: a
 * column joining one row to the next as a straight segment ignores whatever the
 * warp does in between, which is most of it.
 */
function fineDepths() {
  const ratio = Math.pow(ROW_RATIO, 1 / 4);
  const out = [];
  for (let s = FIRST_ROW * H; s < H * 1.9; s *= ratio) out.push(H / s);
  return out;
}

/** How many columns each side of centre are on screen at this depth. */
const columnSpan = (s) => Math.floor((REACH * W) / s / COLUMN_GAP);

/**
 * Fades the plane out at the horizon, as a gradient on the stroke rather than
 * an alpha per line. Lines that run into the screen span the whole fade, so one
 * alpha for the whole polyline has to pick a depth to be right at — and picking
 * the far end, where every column starts, makes the columns vanish entirely.
 */
function mistGradient(color) {
  const hex = color.replace("#", "");
  const n = parseInt(hex.length === 3 ? hex.replace(/./g, "$&$&") : hex, 16);
  const rgb = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  const g = ctx.createLinearGradient(0, yh, 0, yh + H * 0.2);
  g.addColorStop(0, `rgba(${rgb}, 0)`);
  g.addColorStop(1, `rgba(${rgb}, 1)`);
  return g;
}

/* ==========================================================================
   The forest
   ========================================================================== */

let anchors = [];

/** Fisher-Yates, so which intersections stay empty is evenly scattered. */
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * Lays the forest out and returns the trees, ungrown.
 *
 * Every tree exists before anything grows, so the sequencing below only decides
 * *when* one appears — sizes and positions never shift under it.
 */
function plant() {
  anchors = [];
  for (const band of Object.values(bands)) band.replaceChildren();

  // Columns converge, so two trees on the same column — however far apart in
  // depth — sit on one radial line and stack up on screen. Rows are therefore
  // interleaved: each takes the opposite parity of column from the row in front
  // of it, and also avoids what the row two back used, which shares its parity.
  // Every tree is still exactly on an intersection.
  let lastRow = new Set();
  let twoRowsBack = new Set();

  for (const row of floorRows()) {
    if (row.s > H * PLANT_NEAREST || row.s < H * PLANT_FURTHEST) continue;

    const span = columnSpan(row.s);
    let slots = [];
    for (let j = -span; j <= span; j++) {
      if (Math.abs(j - row.k) % 2) continue;
      if (twoRowsBack.has(j)) continue;
      slots.push(j);
    }
    // Narrow front rows can be squeezed out entirely by the avoidance; there,
    // being on the grid matters more than never repeating a column.
    if (slots.length < 2) {
      slots = [];
      for (let j = -span; j <= span; j++) {
        if (!(Math.abs(j - row.k) % 2)) slots.push(j);
      }
    }

    shuffle(slots);
    const planted = slots.slice(
      0,
      Math.max(1, Math.round(slots.length * PLANT_SHARE))
    );
    twoRowsBack = lastRow;
    lastRow = new Set(planted);

    for (const j of planted) {
      // Size comes from depth, not from a per-band range: one rule, and the
      // near/far difference then agrees with the floor by construction.
      const width = TREE_SCALE * (row.s / H) * (0.85 + Math.random() * 0.3);
      const band = row.s < H * 0.22 ? "far" : row.s < H * 0.6 ? "mid" : "near";

      const slot = document.createElement("div");
      slot.className = "forest-tree";
      slot.style.width = `${width}px`;
      bands[band].append(slot);

      const anim = animateTree(slot, {
        seed: Math.floor(Math.random() * 1e9).toString(36),
        width: 300,
        height: 620,
        padding: 10,
        roots: true,
        duration: 1900 + Math.random() * 1300,
        reducedMotion: reduced,
      });

      // Mounted but held at nothing, so the sequencing below can start it. The
      // model is needed now either way: it is the only thing that knows where
      // the trunk meets the roots inside the drawing.
      if (!reduced) {
        anim.stop();
        anim.seek(0);
      }

      anchors.push({
        u: j * COLUMN_GAP,
        z: row.z,
        width,
        slot,
        anim,
        ground: anim.model.place.ty / anim.model.height,
        aspect: anim.model.height / anim.model.width,
      });
    }
  }

  settle();
  return anchors.map((a) => a.anim);
}

/**
 * Puts every tree on its intersection and cuts it off there.
 *
 * The mask is computed per tree from the crossing rather than set to a fixed
 * percentage of the box. A percentage is only right for one tree size and one
 * flat ground; here the floor rolls, so where a trunk meets it is a different
 * height in every box.
 *
 * The cut is also tilted. The row a tree stands on is not horizontal on screen
 * once the floor is warped — under a near tree it can run visibly downhill —
 * and a horizontal fade across a sloped crossing buries one side of the trunk
 * while the other still floats.
 */
function settle() {
  for (const a of anchors) {
    const [x, y, s] = place(a.u, a.z);
    const h = a.width * a.aspect;

    a.slot.style.left = `${x.toFixed(1)}px`;
    a.slot.style.top = `${(y - a.ground * h).toFixed(1)}px`;

    // The row's slope across this trunk's own footprint — the span the mask
    // covers. Clamped, or a small tree on a steep patch is sliced at an angle
    // that reads as a mistake.
    const reach = (a.width * 0.5) / s;
    const [xa, ya] = place(a.u - reach, a.z);
    const [xb, yb] = place(a.u + reach, a.z);
    const raw = xb - xa === 0 ? 0 : (yb - ya) / (xb - xa);
    const slope = Math.max(-0.45, Math.min(0.45, raw));

    // A rotated gradient measures its stops along its own axis, not down the
    // box, so the crossing has to be projected onto that axis or the cut drifts
    // as the slope grows.
    const axis = Math.abs(slope) * a.width + h;
    const cut = 0.5 + (h * (a.ground - 0.5)) / axis;
    const fade = (h * SINK) / axis;
    const angle = (Math.atan2(-slope, -1) * 180) / Math.PI;

    const mask =
      `linear-gradient(${angle.toFixed(2)}deg, ` +
      `#000 ${(cut * 100).toFixed(2)}%, ` +
      `transparent ${((cut + fade) * 100).toFixed(2)}%)`;
    a.slot.style.webkitMaskImage = mask;
    a.slot.style.maskImage = mask;
  }
}

/* ==========================================================================
   Drawing
   ========================================================================== */

/** Strokes a polyline given as flat [x, y, x, y, ...], skipping tiny runs. */
function stroke(points, alpha) {
  if (points.length < 4) return;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.stroke();
}

/**
 * Light ink on a dark ground carries further than dark ink on a light one, so
 * matching alphas do not read as matching weights.
 */
const darkMedia = window.matchMedia("(prefers-color-scheme: dark)");
const contrast = () => (darkMedia.matches ? 1 : 1.32);

function draw() {
  ctx.clearRect(0, 0, W, H);

  const ink = getComputedStyle(field).getPropertyValue("--field-line").trim();
  ctx.strokeStyle = mistGradient(ink || "#57534e");
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const weight = contrast();
  const rows = floorRows();

  for (const row of rows) {
    const span = columnSpan(row.s) + 1;
    const pts = [];
    for (let t = -span; t <= span; t += 0.2) {
      const [x, y] = place(t * COLUMN_GAP, row.z);
      pts.push(x, y);
    }
    stroke(pts, 0.5 * weight);
  }

  const depths = fineDepths();
  const widest = columnSpan(rows[0].s);
  for (let j = -widest; j <= widest; j++) {
    const u = j * COLUMN_GAP;
    const pts = [];
    for (const z of depths) {
      const [x, y] = place(u, z);
      // Columns fan apart as they come forward, so one comfortably in frame at
      // the back leaves the side of the screen long before the front row.
      if (x < -W * 0.2 || x > W * 1.2) {
        if (pts.length) break;
        continue;
      }
      if (y > H * 1.3) break;
      pts.push(x, y);
    }
    stroke(pts, 0.38 * weight);
  }

  ctx.globalAlpha = 1;
}

/* ==========================================================================
   Parallax
   ========================================================================== */

/**
 * How far each plane drifts over the *whole page*, in viewport heights.
 *
 * Multiplying scroll position by a factor is the obvious way to do this and it
 * is wrong: the offset grows without bound, so on a long page the foreground
 * climbs clean out of frame. Tying travel to scroll progress caps it by
 * construction — every plane is still on screen at the bottom.
 */
const TRAVEL = { forest: 0.09, front: 0 };

/** Sideways sway at full pointer deflection, in pixels. Nearer sways more. */
const SWAY = { forest: 16, front: 44 };

/**
 * Planes that may only move sideways. A rootless tree is drawn sitting on the
 * bottom edge of its own frame, so lifting it vertically lifts it off the
 * ground — the drawn one is cut off exactly that way.
 */
const HORIZONTAL_ONLY = new Set(["front"]);

/** Vertical sway is a fraction of the horizontal, or it reads like a wobble. */
const SWAY_Y = 0.3;

const planes = Object.entries({ forest: forestPlane, front }).filter(
  ([, node]) => node
);

const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
let progress = 0;
let frame = 0;

function write() {
  for (const [name, node] of planes) {
    const x = -pointer.x * SWAY[name];
    const y = HORIZONTAL_ONLY.has(name)
      ? 0
      : -progress * TRAVEL[name] * window.innerHeight -
        pointer.y * SWAY[name] * SWAY_Y;
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

/* ==========================================================================
   Run
   ========================================================================== */

/** Pause before the first tree, then the random gap between each one, in ms. */
const FIRST_SPROUT = 260;
const SEQUENCE_GAP = [0, 10000];

/** One tree at a time, with an irregular gap between them. */
function sprout(queue) {
  if (reduced) return;
  let next = 0;
  const step = () => {
    if (next >= queue.length) return;
    queue[next++].replay();
    window.setTimeout(
      step,
      SEQUENCE_GAP[0] + Math.random() * (SEQUENCE_GAP[1] - SEQUENCE_GAP[0])
    );
  };
  window.setTimeout(step, FIRST_SPROUT);
}

if (field && ctx) {
  measure();
  draw();
  sprout(shuffle(plant()));

  // The canvas is not styled by CSS, so a theme change does not touch it — it
  // has to be redrawn by hand. Miss this and switching to light leaves white
  // lines on a white ground, which is to say no ground at all.
  darkMedia.addEventListener("change", draw);
}

if (planes.length) {
  window.addEventListener("scroll", readScroll, { passive: true });

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

let resizing = 0;
window.addEventListener(
  "resize",
  () => {
    readScroll();
    if (!field || !ctx) return;
    // Replanting throws away a forest that is still coming up, and on mobile
    // the address bar sliding away fires a resize on every scroll. Only a real
    // change of frame is worth re-ruling the ground for.
    const moved =
      Math.abs(window.innerWidth - W) > 60 ||
      Math.abs(window.innerHeight - H) > 140;
    if (!moved) return;
    clearTimeout(resizing);
    resizing = window.setTimeout(() => {
      measure();
      draw();
      for (const anim of plant()) anim.replay();
    }, 200);
  },
  { passive: true }
);
