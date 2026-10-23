/**
 * The hand-drawn tree in the illustration column, bending in the air the
 * pointer moves through it.
 *
 * The drawing is one outline for the wood plus six loose leaves. A skeleton
 * runs down the middle of the wood: a chain of samples per limb, every limb
 * hanging off a point of the one below it. Each limb and each leaf is a damped
 * spring with its own natural frequency, so thin parts give more and swing
 * faster, the trunk barely moves, and the leaves arrive late and settle last.
 * Different frequencies are most of what reads as natural: nothing moves in
 * step with anything else.
 *
 * The wood is bent rather than redrawn. Every point of its outline is held by
 * the limb it sits on (by two, blended, near a fork, so a fork never tears) and
 * follows that limb's frame as it turns. At rest every frame is where it
 * started, so the resting tree is exactly the drawing in the markup.
 *
 * The pointer pushes like air: with the square of its speed, so a drift barely
 * stirs the tree and a flick sets it swinging. A push on any part also bends
 * every limb below it, a share of it, which is how brushing the crown sways the
 * whole tree a little. A breeze keeps it from ever standing dead still.
 *
 * The tree sits behind the page, so it listens to the pointer on the window,
 * the same way the parallax in forest.js does. Nothing here is needed for the
 * page to work: without it the tree is the same SVG, standing still.
 */

const svg = document.querySelector("#tree-illustration .cover-tree");
const woodEl = svg ? svg.querySelector("[data-wood]") : null;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ==========================================================================
   Tuning
   ========================================================================== */

/**
 * The limbs, base first, traced down the middle of the wood in the drawing's
 * own 400 x 800 space. A parent always comes before its children.
 *
 *   freq      natural frequency, in Hz
 *   zeta      damping ratio: low enough to overshoot, high enough to settle
 *   mobility  how readily a push turns into bend
 *   bend      where along the limb the bend happens: 1 is even, 2 is mostly
 *             towards the tip, the way a tapering stem gives
 *   limit     the most the limb ever bends at its tip, in radians
 *   wind      how far the breeze leans it, in radians
 */
const LIMBS = [
  {
    id: "trunk", parent: null, freq: 0.72, zeta: 0.22, mobility: 0.009, bend: 2, limit: 0.08, wind: 0.005,
    pts: [[200, 800], [203, 780], [195, 760], [187, 740], [181, 720], [177, 700], [175, 680], [174, 650], [174, 620],
      [175.4, 600], [178.3, 580], [182.7, 560], [186.4, 540], [189, 520], [190, 512]],
  },
  {
    id: "stem", parent: "trunk", freq: 1.05, zeta: 0.17, mobility: 0.2, bend: 1.7, limit: 0.2, wind: 0.016,
    pts: [[190, 512], [201.4, 500], [208, 470], [213, 440], [214, 415], [213, 400], [211, 382], [207.5, 368],
      [203.5, 358], [205, 345], [207, 330], [209.4, 310], [210.9, 290], [212.2, 270], [213.4, 250], [214.6, 230],
      [215.7, 210], [216.9, 190], [217, 184]],
  },
  {
    id: "left", parent: "trunk", freq: 1.25, zeta: 0.16, mobility: 0.5, bend: 1.6, limit: 0.3, wind: 0.024,
    pts: [[186, 512], [176.6, 500], [169.6, 480], [164.1, 470], [156.9, 460], [147.8, 450], [138.5, 440], [134, 430],
      [133.1, 420], [132.4, 410], [131.7, 400], [129.6, 380], [126.8, 360], [123.1, 340], [118.2, 320], [111.3, 300],
      [106.9, 290], [101.5, 280], [94.7, 270], [92.64, 267.51]],
  },
  {
    id: "right", parent: "stem", freq: 1.45, zeta: 0.15, mobility: 0.45, bend: 1.5, limit: 0.34, wind: 0.028,
    pts: [[212, 425], [220, 413], [226, 405], [229.5, 400], [233.1, 390], [237.6, 380], [243.6, 370], [250, 362],
      [256, 357], [259.6, 350], [262.6, 340], [266.2, 330], [270.4, 320], [275.4, 310], [281.9, 300], [289.11, 294.01]],
  },
  {
    id: "twig", parent: "stem", freq: 1.8, zeta: 0.14, mobility: 0.7, bend: 1.4, limit: 0.42, wind: 0.034,
    pts: [[216, 192], [222, 181], [233, 173], [246, 166], [256, 160], [263, 152], [268, 145], [271.5, 139],
      [273.51, 134.19]],
  },
];

/**
 * The leaves, by their data-leaf name. Same fields as a limb, plus how much a
 * leaf narrows when it turns about its own midrib. The crown is the big one on
 * top of the stem, so it is the heaviest and slowest of them.
 */
const LEAVES = {
  elbow: { freq: 2.4, zeta: 0.15, mobility: 0.27, limit: 0.45, wind: 0.05, squash: 0.14 },
  crown: { freq: 1.35, zeta: 0.17, mobility: 0.17, limit: 0.3, wind: 0.03, squash: 0.08 },
  left: { freq: 1.95, zeta: 0.15, mobility: 0.27, limit: 0.45, wind: 0.05, squash: 0.14 },
  stem: { freq: 2.8, zeta: 0.15, mobility: 0.27, limit: 0.45, wind: 0.05, squash: 0.16 },
  right: { freq: 2.1, zeta: 0.15, mobility: 0.24, limit: 0.45, wind: 0.05, squash: 0.14 },
  twig: { freq: 2.3, zeta: 0.15, mobility: 0.27, limit: 0.45, wind: 0.05, squash: 0.16 },
};

/**
 * The feel, as four knobs over the tables above. They were tuned by hand on a
 * prototype of this same tree that had a slider for each, and its copied
 * settings paste straight in here.
 *
 *   gain       how hard the pointer pushes
 *   bounce     0 settles without a swing, 1 rings on; 0.5 is the damping
 *              written in the tables
 *   stiffness  scales every natural frequency
 *   wind       scales the breeze
 */
const FEEL = { gain: 0.5, bounce: 0.25, stiffness: 0.78, wind: 2.6 };

const TAU = Math.PI * 2;
const STEP = 4; // spacing of the skeleton samples
const BLEND = 14; // how far past the nearest limb a second one still holds the outline
const SEG = 12; // longest piece the outline is cut into, so a bend has somewhere to happen
const H = 1 / 120; // physics step, in seconds
const CONTACT = 24; // reach of the pointer's push
const WAKE = 80; // reach of the weaker air it drags along behind it
const WAKE_SHARE = 0.18;

// The push grows with the square of the pointer's speed, up to a cap. The
// linear part keeps a slow pass from doing nothing at all, and leaves get more
// of it because they catch air that wood does not.
const V_REF = 500;
const V_CAP = 2600;
const V_LIN_WOOD = 300;
const V_LIN_LEAF = 900;
const GAIN = 1.7;

const TRANSMIT = 0.55; // share of a push that reaches the limbs below the part pushed
const INERTIA = 0.7; // how hard a limb lags when the one it hangs from swings
const LEAF_INERTIA = 0.85;
const LEAF_AREA = 1.6;
const TWIST_ZETA = 0.2;
const TWIST_MAX = 1.2;

/** Bounce, as a multiple of the damping in the tables. */
const DAMP = Math.pow(2.6, (0.5 - FEEL.bounce) * 2);

/* ==========================================================================
   Geometry
   ========================================================================== */

/** Squeezes a value into ±lim, gently: no hard stop to bounce off. */
const soft = (v, lim) => lim * Math.tanh(v / lim);

/** "M x,y C ... Z" back into cubics of [x0, y0, x1, y1, x2, y2, x3, y3]. */
function cubicsOf(d) {
  const n = (d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
  const out = [];
  let x = n[0];
  let y = n[1];
  for (let i = 2; i + 5 < n.length; i += 6) {
    out.push([x, y, n[i], n[i + 1], n[i + 2], n[i + 3], n[i + 4], n[i + 5]]);
    x = n[i + 4];
    y = n[i + 5];
  }
  return out;
}

function bez(c, t) {
  const m = 1 - t;
  const a = m * m * m;
  const b = 3 * m * m * t;
  const e = 3 * m * t * t;
  const f = t * t * t;
  return [a * c[0] + b * c[2] + e * c[4] + f * c[6], a * c[1] + b * c[3] + e * c[5] + f * c[7]];
}

function cubicLength(c) {
  let len = 0;
  let p = bez(c, 0);
  for (let i = 1; i <= 16; i++) {
    const q = bez(c, i / 16);
    len += Math.hypot(q[0] - p[0], q[1] - p[1]);
    p = q;
  }
  return len;
}

/** De Casteljau: one cubic into two, at t. */
function split(c, t) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = c;
  const ax = x0 + (x1 - x0) * t;
  const ay = y0 + (y1 - y0) * t;
  const bx = x1 + (x2 - x1) * t;
  const by = y1 + (y2 - y1) * t;
  const cx = x2 + (x3 - x2) * t;
  const cy = y2 + (y3 - y2) * t;
  const dx = ax + (bx - ax) * t;
  const dy = ay + (by - ay) * t;
  const ex = bx + (cx - bx) * t;
  const ey = by + (cy - by) * t;
  const fx = dx + (ex - dx) * t;
  const fy = dy + (ey - dy) * t;
  return [
    [x0, y0, ax, ay, dx, dy, fx, fy],
    [fx, fy, ex, ey, cx, cy, x3, y3],
  ];
}

function subdivide(c, pieces) {
  const out = [];
  let rest = c;
  for (let i = pieces; i > 1; i--) {
    const [head, tail] = split(rest, 1 / i);
    out.push(head);
    rest = tail;
  }
  out.push(rest);
  return out;
}

/** A polyline as evenly spaced samples along its length. */
function resample(pts, step) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const len = cum[cum.length - 1];
  const n = Math.max(2, Math.round(len / step) + 1);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const s = new Float64Array(n);
  let k = 1;
  for (let i = 0; i < n; i++) {
    const at = (i / (n - 1)) * len;
    while (k < pts.length - 1 && cum[k] < at) k++;
    const t = (at - cum[k - 1]) / (cum[k] - cum[k - 1] || 1);
    x[i] = pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t;
    y[i] = pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t;
    s[i] = at;
  }
  return { x, y, s, len, n };
}

function nearest(limb, x, y) {
  let best = Infinity;
  let at = 0;
  for (let i = 0; i < limb.n; i++) {
    const d = (limb.rx[i] - x) ** 2 + (limb.ry[i] - y) ** 2;
    if (d < best) {
      best = d;
      at = i;
    }
  }
  return { at, dist: Math.sqrt(best) };
}

/* ==========================================================================
   The tree
   ========================================================================== */

const limbs = LIMBS.map((def, index) => {
  const r = resample(def.pts, STEP);
  const shape = new Float64Array(r.n);
  for (let i = 0; i < r.n; i++) shape[i] = Math.pow(r.s[i] / r.len, def.bend);
  return {
    ...def,
    n: r.n,
    len: r.len,
    rx: r.x,
    ry: r.y,
    shape,
    // The bent pose, and each sample's turn away from rest.
    dx: Float64Array.from(r.x),
    dy: Float64Array.from(r.y),
    rot: new Float64Array(r.n),
    cos: new Float64Array(r.n).fill(1),
    sin: new Float64Array(r.n),
    // Half the limb's thickness at each sample, so the pointer touches bark
    // rather than the line down its middle.
    half: new Float64Array(r.n),
    up: null,
    attach: 0,
    theta: 0,
    omega: 0,
    acc: 0,
    baseAcc: 0,
    torque: 0,
    seed: 101 + index * 17,
  };
});

const byId = Object.fromEntries(limbs.map((l) => [l.id, l]));
for (const l of limbs) {
  if (!l.parent) continue;
  l.up = byId[l.parent];
  l.attach = nearest(l.up, l.rx[0], l.ry[0]).at;
}

let wood = [];
let anchors = [];
let leaves = [];
// The bent anchors, reused every frame.
let ax = new Float64Array(0);
let ay = new Float64Array(0);

/**
 * Which limbs hold a point of the outline, and how much. The nearest one
 * always does; another joins in only within BLEND of it.
 */
function holdersOf(x, y) {
  const found = limbs.map((l, i) => ({ i, ...nearest(l, x, y) })).sort((a, b) => a.dist - b.dist);
  const out = [];
  let sum = 0;
  for (const f of found) {
    const u = (f.dist - found[0].dist) / BLEND;
    if (u >= 1) break;
    const w = 1 - u * u * (3 - 2 * u);
    out.push([f.i, f.at, w]);
    sum += w;
  }
  for (const o of out) o[2] /= sum;
  return out;
}

function build() {
  for (const c of cubicsOf(woodEl.getAttribute("d"))) {
    wood.push(...subdivide(c, Math.max(1, Math.ceil(cubicLength(c) / SEG))));
  }

  const outline = [];
  for (const c of wood) for (let i = 0; i < 4; i++) outline.push(bez(c, i / 4));
  for (const l of limbs) {
    for (let i = 0; i < l.n; i++) {
      let best = Infinity;
      for (const [x, y] of outline) best = Math.min(best, (x - l.rx[i]) ** 2 + (y - l.ry[i]) ** 2);
      l.half[i] = Math.sqrt(best);
    }
  }

  // A handle follows the anchor it leaves from, so curves stay smooth through
  // a bend: the only anchors are the ones the pieces share.
  anchors = wood.map((c) => ({ x: c[0], y: c[1], holders: holdersOf(c[0], c[1]) }));
  ax = new Float64Array(wood.length);
  ay = new Float64Array(wood.length);

  leaves = [...svg.querySelectorAll("[data-leaf]")].flatMap((el, index) => {
    const tune = LEAVES[el.dataset.leaf];
    const limb = byId[el.dataset.limb];
    const path = el.querySelector("path");
    if (!tune || !limb || !path) return [];
    const [px, py] = el.dataset.pivot.split(" ").map(Number);
    const cubics = cubicsOf(path.getAttribute("d"));

    // Where the leaf's weight is, and how far it reaches, off its outline.
    const poly = [];
    for (const c of cubics) for (let k = 0; k < 32; k++) poly.push(bez(c, k / 32));
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let k = 0; k < poly.length; k++) {
      const [x0, y0] = poly[k];
      const [x1, y1] = poly[(k + 1) % poly.length];
      const cross = x0 * y1 - x1 * y0;
      area += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    area /= 2;
    cx /= 6 * area;
    cy /= 6 * area;
    let radius = 0;
    for (const [x, y] of poly) radius += Math.hypot(x - cx, y - cy);
    radius /= poly.length;

    return [
      {
        ...tune,
        el,
        limb,
        attach: nearest(limb, px, py).at,
        px,
        py,
        cx,
        cy,
        radius,
        lever: Math.max(20, Math.hypot(cx - px, cy - py)),
        // The line from the pivot to the far tip: the midrib it turns about.
        axis: Math.atan2(cubics[0][7] - py, cubics[0][6] - px),
        pivX: px,
        pivY: py,
        nowX: cx,
        nowY: cy,
        theta: 0,
        omega: 0,
        acc: 0,
        twist: 0,
        twistV: 0,
        torque: 0,
        seed: 401 + index * 23,
      },
    ];
  });
}

/* ==========================================================================
   Breeze
   ========================================================================== */

function hash1(i, seed) {
  let h = (i * 374761393 + seed * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Smooth value noise in -1..1. */
function noise1(x, seed) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash1(i, seed) * (1 - u) + hash1(i + 1, seed) * u) * 2 - 1;
}

/**
 * The breeze at a part, as a multiple of that part's own lean. It reaches the
 * left of the tree a moment before the right, so the crown never moves as one
 * flat sheet, and it has a small steady push to one side, the way real wind
 * does, which keeps the sway from ticking like a metronome. The slowest octave
 * only ever adds, and squared, so it arrives as the odd gust.
 */
function breeze(t, x, seed, flutter) {
  const tt = t - x / 520;
  return (
    FEEL.wind *
    (0.22 +
      0.6 * noise1(tt * 0.15, 11) +
      0.35 * noise1(tt * 0.37, 23) +
      1.4 * Math.max(0, noise1(tt * 0.06, 37)) ** 2 +
      0.3 * noise1(t * flutter, seed))
  );
}

/* ==========================================================================
   Pointer
   ========================================================================== */

const pointer = { x: 0, y: 0, fromX: 0, fromY: 0, vx: 0, vy: 0, last: -1e9, tracking: false };

function track(event) {
  // A finger dragging the page scrolls it; it is not brushing the tree.
  if (event.pointerType === "touch") return;
  // A hidden tree has no screen position to map onto, and one NaN let into the
  // springs would stay there for good.
  const m = svg.getScreenCTM();
  if (!m || !m.a) return;
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse());
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
  const dt = (event.timeStamp - pointer.last) / 1000;
  if (pointer.tracking && dt > 0.001 && dt < 0.12) {
    // Smoothed, or a single jittery event reads as a slap.
    pointer.vx += ((p.x - pointer.x) / dt - pointer.vx) * 0.5;
    pointer.vy += ((p.y - pointer.y) / dt - pointer.vy) * 0.5;
  } else {
    // A pointer coming back after a pause did not sweep across the gap.
    pointer.vx = 0;
    pointer.vy = 0;
    pointer.fromX = p.x;
    pointer.fromY = p.y;
  }
  pointer.x = p.x;
  pointer.y = p.y;
  pointer.last = event.timeStamp;
  pointer.tracking = true;
}

function release() {
  pointer.tracking = false;
}

/* ==========================================================================
   Physics
   ========================================================================== */

/** How much of the pointer's push lands on a point this far from its edge. */
function reach(gap) {
  const g = Math.max(0, gap);
  return Math.exp((-g * g) / (2 * CONTACT * CONTACT)) + WAKE_SHARE * Math.exp((-g * g) / (2 * WAKE * WAKE));
}

/**
 * One physics step, with the pointer at (qx, qy) pushing wood with (fx, fy)
 * and leaves with (lx, ly).
 */
function step(t, qx, qy, fx, fy, lx, ly) {
  // Far from the drawing the push is nothing; not worth measuring.
  const near = qx > -3 * WAKE && qx < 400 + 3 * WAKE && qy > -3 * WAKE && qy < 800 + 3 * WAKE;
  const pushing = near && (fx !== 0 || fy !== 0);
  for (const l of limbs) l.torque = 0;

  if (pushing) {
    // A push anywhere on a limb bends that limb, and every limb below it too.
    for (const l of limbs) {
      let w = 0;
      let mx = 0;
      let my = 0;
      for (let i = 0; i < l.n; i++) {
        const gap = Math.hypot(l.dx[i] - qx, l.dy[i] - qy) - l.half[i];
        if (gap > 3 * WAKE) continue;
        const k = (reach(gap) * STEP) / CONTACT;
        w += k;
        mx += k * l.dx[i];
        my += k * l.dy[i];
      }
      if (!w) continue;
      l.torque += (mx - w * l.dx[0]) * fy - (my - w * l.dy[0]) * fx;
      for (let a = l.up; a; a = a.up) {
        a.torque += TRANSMIT * ((mx - w * a.dx[0]) * fy - (my - w * a.dy[0]) * fx);
      }
    }
  }

  for (const f of leaves) {
    f.torque = 0;
    if (!pushing) continue;
    const w = LEAF_AREA * reach(Math.hypot(f.nowX - qx, f.nowY - qy) - 0.75 * f.radius);
    if (w < 1e-4) continue;
    f.torque = w * ((f.nowX - f.pivX) * ly - (f.nowY - f.pivY) * lx);
    for (let a = f.limb; a; a = a.up) {
      a.torque += TRANSMIT * w * ((f.nowX - a.dx[0]) * ly - (f.nowY - a.dy[0]) * lx);
    }
  }

  // Parents first, so a child knows how its base is swinging this step.
  for (const l of limbs) {
    const wn = TAU * l.freq * FEEL.stiffness;
    // Stiffer the further it is bent: wood resists more the more it gives.
    const k = wn * wn * (1 + (l.theta / l.limit) ** 2);
    l.baseAcc = l.up ? l.up.baseAcc + l.up.acc * l.up.shape[l.attach] : 0;
    l.acc =
      -k * l.theta -
      2 * l.zeta * DAMP * wn * l.omega +
      (GAIN * FEEL.gain * l.mobility * l.torque) / (l.len * l.len) +
      wn * wn * l.wind * breeze(t, l.rx[l.n - 1], l.seed, 0.7) -
      INERTIA * l.baseAcc;
    l.omega += l.acc * H;
    l.theta += l.omega * H;
    // Never reached in practice; there so a freak frame cannot blow it up.
    if (!(Math.abs(l.theta) <= 4 * l.limit)) {
      l.theta = Number.isFinite(l.theta) ? Math.sign(l.theta) * 4 * l.limit : 0;
      l.omega = 0;
    }
  }

  for (const f of leaves) {
    const L = f.limb;
    const baseAcc = L.baseAcc + L.acc * L.shape[f.attach];
    const wn = TAU * f.freq * FEEL.stiffness;
    const k = wn * wn * (1 + (f.theta / f.limit) ** 2);
    const drive = (GAIN * FEEL.gain * f.mobility * f.torque) / (f.lever * f.lever);
    const air = breeze(t, f.px, f.seed, 1.4);
    f.acc =
      -k * f.theta - 2 * f.zeta * DAMP * wn * f.omega + drive + wn * wn * f.wind * air - LEAF_INERTIA * baseAcc;
    f.omega += f.acc * H;
    f.theta += f.omega * H;
    if (!(Math.abs(f.theta) <= 4 * f.limit)) {
      f.theta = Number.isFinite(f.theta) ? Math.sign(f.theta) * 4 * f.limit : 0;
      f.omega = 0;
    }

    // A leaf hit side-on also turns about its own midrib, which from the front
    // reads as it narrowing and widening again.
    const tw = wn * 1.5;
    const twistAcc =
      -tw * tw * f.twist - 2 * TWIST_ZETA * DAMP * tw * f.twistV + 0.8 * drive + 0.4 * wn * wn * f.wind * air;
    f.twistV += twistAcc * H;
    f.twist += f.twistV * H;
  }
}

/* ==========================================================================
   Drawing
   ========================================================================== */

/** Lays every limb out along its bend, base first, each starting where its parent carries it. */
function pose() {
  for (const l of limbs) {
    const theta = soft(l.theta, l.limit);
    let base = 0;
    let bx = l.rx[0];
    let by = l.ry[0];
    if (l.up) {
      const p = l.up;
      const j = l.attach;
      const ox = l.rx[0] - p.rx[j];
      const oy = l.ry[0] - p.ry[j];
      base = p.rot[j];
      bx = p.dx[j] + p.cos[j] * ox - p.sin[j] * oy;
      by = p.dy[j] + p.sin[j] * ox + p.cos[j] * oy;
    }
    l.rot[0] = base;
    l.cos[0] = Math.cos(base);
    l.sin[0] = Math.sin(base);
    l.dx[0] = bx;
    l.dy[0] = by;
    for (let i = 1; i < l.n; i++) {
      const r = base + theta * l.shape[i];
      // Each short run turns by the angle at its middle, so the limb keeps its
      // length instead of stretching as it bends.
      const mid = 0.5 * (r + l.rot[i - 1]);
      const c = Math.cos(mid);
      const s = Math.sin(mid);
      const vx = l.rx[i] - l.rx[i - 1];
      const vy = l.ry[i] - l.ry[i - 1];
      l.dx[i] = l.dx[i - 1] + c * vx - s * vy;
      l.dy[i] = l.dy[i - 1] + s * vx + c * vy;
      l.rot[i] = r;
      l.cos[i] = Math.cos(r);
      l.sin[i] = Math.sin(r);
    }
  }
}

/** Moves one point of the outline with whatever limbs hold it. */
function carry(x, y, holders, out) {
  let nx = 0;
  let ny = 0;
  for (const [li, j, w] of holders) {
    const l = limbs[li];
    const ox = x - l.rx[j];
    const oy = y - l.ry[j];
    nx += w * (l.dx[j] + l.cos[j] * ox - l.sin[j] * oy);
    ny += w * (l.dy[j] + l.sin[j] * ox + l.cos[j] * oy);
  }
  out[0] = nx;
  out[1] = ny;
}

const tmp = [0, 0];
const r1 = (v) => Math.round(v * 10) / 10;

function drawWood() {
  const n = wood.length;
  for (let k = 0; k < n; k++) {
    carry(anchors[k].x, anchors[k].y, anchors[k].holders, tmp);
    ax[k] = tmp[0];
    ay[k] = tmp[1];
  }
  let d = `M${r1(ax[0])},${r1(ay[0])}`;
  for (let k = 0; k < n; k++) {
    const c = wood[k];
    const next = (k + 1) % n;
    carry(c[2], c[3], anchors[k].holders, tmp);
    const h1x = tmp[0];
    const h1y = tmp[1];
    carry(c[4], c[5], anchors[next].holders, tmp);
    d += `C${r1(h1x)},${r1(h1y)} ${r1(tmp[0])},${r1(tmp[1])} ${r1(ax[next])},${r1(ay[next])}`;
  }
  woodEl.setAttribute("d", d + "Z");
}

function drawLeaves() {
  for (const f of leaves) {
    const L = f.limb;
    const j = f.attach;
    const ox = f.px - L.rx[j];
    const oy = f.py - L.ry[j];
    const px = L.dx[j] + L.cos[j] * ox - L.sin[j] * oy;
    const py = L.dy[j] + L.sin[j] * ox + L.cos[j] * oy;
    const ang = L.rot[j] + soft(f.theta, f.limit);
    const twist = soft(f.twist, TWIST_MAX);
    const q = 1 - (f.squash * (1 - Math.cos(twist))) / (1 - Math.cos(TWIST_MAX));

    // Narrow across the midrib, then turn about the pivot.
    const nx = -Math.sin(f.axis);
    const ny = Math.cos(f.axis);
    const k = q - 1;
    const m00 = 1 + k * nx * nx;
    const m01 = k * nx * ny;
    const m11 = 1 + k * ny * ny;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const a = c * m00 - s * m01;
    const b = s * m00 + c * m01;
    const cc = c * m01 - s * m11;
    const dd = s * m01 + c * m11;
    const e = px - (a * f.px + cc * f.py);
    const ff = py - (b * f.px + dd * f.py);
    f.el.setAttribute(
      "transform",
      `matrix(${a.toFixed(5)} ${b.toFixed(5)} ${cc.toFixed(5)} ${dd.toFixed(5)} ${e.toFixed(2)} ${ff.toFixed(2)})`
    );
    f.pivX = px;
    f.pivY = py;
    f.nowX = a * f.cx + cc * f.cy + e;
    f.nowY = b * f.cx + dd * f.cy + ff;
  }
}

/* ==========================================================================
   Run
   ========================================================================== */

let clock = 0;
let spare = 0;
let lastFrame = 0;
let frame = 0;

function tick(now) {
  frame = 0;
  // A long gap (a background tab, the tree scrolled away) resumes from here
  // rather than replaying everything it missed.
  const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 1 / 60;
  lastFrame = now;

  // The pointer coasts to a stop once its events stop coming.
  if (performance.now() - pointer.last > 34) {
    const fade = Math.exp(-dt / 0.045);
    pointer.vx *= fade;
    pointer.vy *= fade;
  }
  const speed = Math.hypot(pointer.vx, pointer.vy);
  const moving = speed > 1 ? 1 / V_REF : 0;
  const capped = Math.min(speed, V_CAP);
  const woodDrag = (capped + V_LIN_WOOD) * moving;
  const leafDrag = (capped + V_LIN_LEAF) * moving;

  // Fixed steps, walking the pointer along the path it took since the last
  // one, so a fast swipe cannot jump clean over a thin branch. On a fast
  // display some frames fall between steps; they leave everything for the next.
  spare += dt;
  const steps = Math.floor(spare / H);
  spare -= steps * H;
  if (!steps) {
    start();
    return;
  }
  for (let i = 0; i < steps; i++) {
    const u = (i + 1) / steps;
    clock += H;
    step(
      clock,
      pointer.fromX + (pointer.x - pointer.fromX) * u,
      pointer.fromY + (pointer.y - pointer.fromY) * u,
      pointer.vx * woodDrag,
      pointer.vy * woodDrag,
      pointer.vx * leafDrag,
      pointer.vy * leafDrag
    );
  }
  pointer.fromX = pointer.x;
  pointer.fromY = pointer.y;

  pose();
  drawWood();
  drawLeaves();
  start();
}

let visible = true;

function start() {
  if (!frame && visible) frame = window.requestAnimationFrame(tick);
}

function stop() {
  if (frame) window.cancelAnimationFrame(frame);
  frame = 0;
  lastFrame = 0;
}

if (svg && woodEl && !reduced) {
  build();

  window.addEventListener("pointermove", track, { passive: true });
  document.documentElement.addEventListener("pointerleave", release);
  window.addEventListener("blur", release);

  // Scrolled out of view, the tree costs nothing.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) start();
      else stop();
    }).observe(svg);
  }

  start();
}
