/**
 * The hand-drawn tree in the illustration column, bending in the air the
 * pointer moves through it, and drawing its own anatomy where it is touched.
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
 * The pointer pushes like air: its velocity times a coefficient, and the
 * coefficient is interpolated by the pointer's speed, from K0 for a drift to
 * K1 at V1 and beyond, so a drift barely stirs the tree and a flick sets it
 * swinging. A push on any part also bends every limb below it, a share of it,
 * which is how brushing the crown sways the whole tree a little. A breeze
 * keeps it from ever standing dead still.
 *
 * Touching a part inks its construction over it and lets the equations it
 * obeys float beside it; a moment after the pointer leaves, it is gone, and
 * everything fades with distance from the pointer. Between touches the breeze
 * alone inks each part faintly, as much as it is moving. Nothing is labelled,
 * and everything drawn is computed from the same state the tree moves by: the
 * bone and its rest pose; a rule along it every four units, and its length,
 * dimensioned; circles of curvature (radius 1/κ) where it bends most and under
 * the pointer; a scale at the tip, graduated in degrees of turn; a curl at the
 * tip, which is the part's free decay from where it is now, in the plane of
 * angle and angular speed; a protractor about each leaf's pivot; the force on
 * the part pushed; and the part's angle in radians, live. Each term of the
 * equation of motion shows as strong as it is in the sum.
 *
 * The tree sits behind the page, so it listens to the pointer on the window.
 * Nothing here is needed for the page to work: without it the tree is the
 * same SVG, standing still, and with reduced motion that is all there is.
 */

const box = document.getElementById("tree-illustration");
const svg = box ? box.querySelector(".cover-tree") : null;
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
const DEG = 180 / Math.PI;
const STEP = 4; // spacing of the skeleton samples
const BLEND = 14; // how far past the nearest limb a second one still holds the outline
const SEG = 12; // longest piece the outline is cut into, so a bend has somewhere to happen
const H = 1 / 120; // physics step, in seconds
const CONTACT = 24; // reach of the pointer's push
const WAKE = 80; // reach of the weaker air it drags along behind it
const WAKE_SHARE = 0.18;

// The push is the pointer's velocity times a coefficient, and the coefficient
// is interpolated by the pointer's speed: K0 for a pointer that barely moves,
// K1 for one at V1 or faster. Leaves get more of it because they catch air
// that wood does not.
const V1 = 2600;
const K0 = 0.6;
const K1 = 5.8;
const KL0 = 1.8;
const KL1 = 7;
const GAIN = 1.7;

const TRANSMIT = 0.55; // share of a push that reaches the limbs below the part pushed
const INERTIA = 0.7; // how hard a limb lags when the one it hangs from swings
const LEAF_INERTIA = 0.85;
const LEAF_AREA = 1.6;
const TWIST_ZETA = 0.2;
const TWIST_MAX = 1.2;

/** Bounce, as a multiple of the damping in the tables. */
const DAMP = Math.pow(2.6, (0.5 - FEEL.bounce) * 2);

// How a touched part is inked: fully within 10 units of the pointer, not at
// all past 30; it stays HOLD seconds after the pointer leaves, then fades.
const NEAR = 10;
const FAR = 30;
const HOLD = 0.2;
const RISE = 0.05; // time constants of the ink coming and going, in seconds
const FALL = 0.2;
// With no pointer about, the breeze alone inks each part faintly, as much as
// it is moving: up to BREEZE_INK, reached at BREEZE_V of its full swing speed.
const BREEZE_INK = 0.22;
const BREEZE_V = 0.03;
const GK = 12; // half the samples of each tip's graduated scale

/* ==========================================================================
   The formulas. Each is true of this tree: the equation every part obeys,
   how a bone's turn is spread along it, how the bark follows, what the curls
   and circles on the plate are.
   ========================================================================== */

const INT =
  '<svg class="int" viewBox="0 0 12 30" aria-hidden="true"><path d="M9.8 2.6c-1.9-1.3-3.3.3-3.6 3.1L5 24.3c-.3 2.8-1.7 4.4-3.6 3.1"/></svg>';
const frac = (a, b) => `<span class="frac"><span>${a}</span><span>${b}</span></span>`;
const lim = (hi, lo) => `<span class="lim"><span>${hi}</span><span>${lo}</span></span>`;
const G = (s, cls) => `<i${cls ? ` class="${cls}"` : ""}>${s}</i>`;

/** The equation of motion, each term on its own so it can weigh what it weighs. */
const ode = (s, lo) =>
  `${G(s, "ddot" + lo)} <span class="t">+ 2${G("ζω")}&#8239;${G(s, "dot" + lo)}</span> ` +
  `<span class="t">+ ${G("ω")}<sup>2</sup>[1 + (${G(s)}/${G(s)}<sub>m</sub>)<sup>2</sup>]&#8239;${G(s)}</span> = ` +
  `<span class="t">${G("μτ")}</span> <span class="t">+ ${G("ω")}<sup>2</sup>w B</span> <span class="t">− ${G("λ")} a</span>`;
const decay = (s) => `${G(s)}(t) = A e<sup>−${G("ζω")}t</sup> cos(${G("ω")}<sub>d</sub> t + ${G("φ")}<sub>0</sub>)`;

const F = {
  odeTheta: ode("θ", ""),
  odeAlpha: ode("α", " lo"),
  decayTheta: decay("θ"),
  decayAlpha: decay("α"),
  turn: `${G("φ")}(s) = ${INT}${lim("s", "0")}${G("κ")}(${G("σ")}) d${G("σ")}`,
  curvature: `${G("κ")} = ${G("κ")}<sub>0</sub> + ${frac(G("ϑ") + " p", "L")} (${frac("s", "L")})<sup>p − 1</sup>`,
  radius: `R = ${frac("1", G("κ"))}`,
  chainX: `x(s) = x<sub>0</sub> + ${INT}${lim("s", "0")}cos ${G("ψ")} d${G("σ")}`,
  chainY: `y(s) = y<sub>0</sub> + ${INT}${lim("s", "0")}sin ${G("ψ")} d${G("σ")}`,
  skin: `x′ = ${G("Σ")} w<sub>k</sub> [p<sub>k</sub> + R(${G("φ")}<sub>k</sub>)(x − r<sub>k</sub>)]`,
  energy: `E = ½&#8239;${G("θ", "dot")}<sup>2</sup> + ½&#8239;${G("ω")}<sup>2</sup>${G("θ")}<sup>2</sup>`,
  loss: `${frac("dE", "dt")} = − 2${G("ζω")}&#8239;${G("α", "dot lo")}<sup>2</sup>`,
  soft: `${G("ϑ")} = ${G("θ")}<sub>m</sub> tanh ${frac(G("θ"), G("θ") + "<sub>m</sub>")}`,
  spiral: `r = A e<sup>−${G("ζω")}t</sup>`,
  spiralRate: `${frac("dr", "dt")} = − ${G("ζω")} r`,
  squash: `q = 1 − c ${frac("1 − cos " + G("ξ"), "1 − cos " + G("ξ") + "<sub>m</sub>")}`,
  leafMatrix: `M = R(${G("α")}) (I + (q − 1) n n<sup>T</sup>)`,
  push: `F = k v`,
  lerp: `k = (1 − t) k<sub>0</sub> + t k<sub>1</sub>`,
  lever: `${G("τ")} = r × F`,
};

// Where each part's formulas float, in the drawing's own units at rest:
// [formula, x, y, align, tilt in degrees, size in px]. "num" is the part's
// own angle, in radians, as it is this instant.
const FRAGS = {
  trunk: [["odeTheta", 136, 646, "r", -2, 19], ["skin", 236, 590, "l", 3, 15], ["num", 240, 704, "l", -4, 15]],
  stem: [["turn", 236, 232, "l", -3, 19], ["chainX", 146, 212, "r", -2, 15], ["chainY", 150, 240, "r", -2, 15]],
  left: [["odeTheta", 84, 404, "r", -2, 19], ["decayTheta", 118, 474, "r", 3, 16], ["num", 96, 358, "r", -5, 14]],
  right: [["curvature", 298, 362, "l", -3, 18], ["radius", 330, 420, "l", 4, 19], ["energy", 262, 462, "l", 2, 15],
    ["num", 356, 330, "l", -6, 13]],
  twig: [["soft", 250, 34, "l", 2, 17], ["spiral", 290, 204, "l", -4, 17], ["num", 232, 70, "l", 5, 13]],
  "leaf:crown": [["odeAlpha", 96, 62, "r", -3, 18], ["num", 92, 104, "r", 4, 14]],
  "leaf:left": [["squash", 8, 296, "r", 2, 16], ["num", 14, 344, "r", -4, 13]],
  "leaf:stem": [["decayAlpha", 148, 270, "r", 2, 15]],
  "leaf:elbow": [["spiralRate", 236, 474, "l", -3, 17], ["spiral", 250, 520, "l", 3, 15]],
  "leaf:right": [["loss", 366, 262, "l", 4, 17], ["num", 372, 304, "l", -3, 13]],
  "leaf:twig": [["leafMatrix", 346, 92, "l", -2, 15], ["num", 350, 128, "l", 5, 13]],
};

/* ==========================================================================
   Geometry
   ========================================================================== */

/** Squeezes a value into ±lim, gently: no hard stop to bounce off. */
const soft = (v, bound) => bound * Math.tanh(v / bound);
const smooth = (x) => x * x * (3 - 2 * x);

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

function segDist(px, py, x0, y0, x1, y1) {
  const vx = x1 - x0;
  const vy = y1 - y0;
  const t = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(px - x0 - vx * t, py - y0 - vy * t);
}

/** The circle through three points: centre and radius into `out`. False if they are in line. */
function circle3(x1, y1, x2, y2, x3, y3, out) {
  const a = x2 - x1;
  const b = y2 - y1;
  const c = x3 - x1;
  const d = y3 - y1;
  const e = a * (x1 + x2) + b * (y1 + y2);
  const f = c * (x1 + x3) + d * (y1 + y3);
  const den = 2 * (a * (y3 - y2) - b * (x3 - x2));
  if (Math.abs(den) < 1e-6) return false;
  out[0] = (d * e - b * f) / den;
  out[1] = (a * f - c * e) / den;
  out[2] = Math.hypot(out[0] - x1, out[1] - y1);
  return true;
}

/* ==========================================================================
   The tree
   ========================================================================== */

/** What every part, bone or leaf, carries for its anatomy. */
const plateState = () => ({
  rv: 0, // how much of this part is inked, 0 to 1
  gap: 1e9, // pointer to its surface, in tree units
  hold: 0,
  fresh: false,
  amb: 0, // the breeze's own faint ink
  // Each term of its equation of motion, summed over a frame and eased:
  // brake, spring, push, wind, drag.
  sum: new Float64Array(5),
  shown: new Float64Array(5),
  felt: 0,
  frags: [],
});

const limbs = LIMBS.map((def, index) => {
  const r = resample(def.pts, STEP);
  const shape = new Float64Array(r.n);
  const nx = new Float64Array(r.n);
  const ny = new Float64Array(r.n);
  for (let i = 0; i < r.n; i++) {
    shape[i] = Math.pow(r.s[i] / r.len, def.bend);
    // The normal at rest, for drawing across the bone.
    const a = Math.max(0, i - 1);
    const b = Math.min(r.n - 1, i + 1);
    const tx = r.x[b] - r.x[a];
    const ty = r.y[b] - r.y[a];
    const d = Math.hypot(tx, ty) || 1;
    nx[i] = -ty / d;
    ny[i] = tx / d;
  }
  return {
    ...def,
    ...plateState(),
    key: def.id,
    kind: "limb",
    n: r.n,
    len: r.len,
    rx: r.x,
    ry: r.y,
    shape,
    nx,
    ny,
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
    // Where it is being pushed, for the arrow of the force.
    pcx: 0,
    pcy: 0,
    // The tip's locus, for its scale, and how finely the scale is cut.
    gx: new Float64Array(2 * GK + 1),
    gy: new Float64Array(2 * GK + 1),
    tick: 0.03,
    major: 5,
    // The sample under the pointer, and an eased copy of it.
    ai: Math.round(0.5 * (r.n - 1)),
    aiF: Math.round(0.5 * (r.n - 1)),
    veil: 30,
    osc: [],
  };
});

const byId = Object.fromEntries(limbs.map((l) => [l.id, l]));
for (const l of limbs) {
  if (!l.parent) continue;
  l.up = byId[l.parent];
  l.attach = nearest(l.up, l.rx[0], l.ry[0]).at;
}

// Where each tip lands for every turn it can take: the same chain the pose
// runs, from a base that has not moved. The scale at the tip is drawn on it.
for (const l of limbs) {
  for (let k = -GK; k <= GK; k++) {
    const th = (l.limit * k) / GK;
    let px = 0;
    let py = 0;
    let prev = 0;
    for (let i = 1; i < l.n; i++) {
      const r = th * l.shape[i];
      const mid = 0.5 * (r + prev);
      const c = Math.cos(mid);
      const s = Math.sin(mid);
      const vx = l.rx[i] - l.rx[i - 1];
      const vy = l.ry[i] - l.ry[i - 1];
      px += c * vx - s * vy;
      py += s * vx + c * vy;
      prev = r;
    }
    l.gx[k + GK] = px;
    l.gy[k + GK] = py;
  }
}

function tipAt(l, th, out) {
  const u = Math.max(-1, Math.min(1, th / l.limit)) * GK + GK;
  const i = Math.min(2 * GK - 1, Math.floor(u));
  const f = u - i;
  out[0] = l.gx[i] + (l.gx[i + 1] - l.gx[i]) * f;
  out[1] = l.gy[i] + (l.gy[i + 1] - l.gy[i]) * f;
}

let wood = [];
let anchors = [];
let leaves = [];
let parts = [];
// The bent anchors, reused every frame.
let ax = new Float64Array(0);
let ay = new Float64Array(0);
let woodD = "";
const c3 = [0, 0, 0];

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
    let widest = 0;
    for (let i = 0; i < l.n; i++) {
      let best = Infinity;
      for (const [x, y] of outline) best = Math.min(best, (x - l.rx[i]) ** 2 + (y - l.ry[i]) ** 2);
      l.half[i] = Math.sqrt(best);
      widest = Math.max(widest, l.half[i]);
    }
    l.veil = Math.max(30, Math.min(130, 2.4 * widest));

    // Where the bone bends most at rest: its circles of curvature go there.
    const k = [];
    for (let i = 4; i < l.n - 4; i++) {
      const ok = circle3(l.rx[i - 3], l.ry[i - 3], l.rx[i], l.ry[i], l.rx[i + 3], l.ry[i + 3], c3);
      k.push({ i, bend: ok ? 1 / c3[2] : 0 });
    }
    k.sort((a, b) => b.bend - a.bend);
    for (const c of k) {
      if (l.osc.length >= 3 || c.bend < 1 / 170) break;
      if (l.osc.every((j) => Math.abs(j - c.i) >= 9)) l.osc.push(c.i);
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

    // The line from the pivot to the far tip: the midrib it turns about.
    const tx = cubics[0][6];
    const ty = cubics[0][7];
    const axis = Math.atan2(ty - py, tx - px);
    const rib = Math.hypot(tx - px, ty - py);

    return [
      {
        ...tune,
        ...plateState(),
        key: "leaf:" + el.dataset.leaf,
        kind: "leaf",
        el,
        path,
        // Its outline, inked on the plate, and whether the wood is painted
        // over it: the elbow leaf hangs behind the trunk.
        edge: new Path2D(path.getAttribute("d")),
        behind: !!(woodEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING),
        limb,
        attach: nearest(limb, px, py).at,
        px,
        py,
        cx,
        cy,
        radius,
        lever: Math.max(20, Math.hypot(cx - px, cy - py)),
        axis,
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
        tx,
        ty,
        rib,
        halfW: (Math.abs(area) / rib) * 0.6,
        tipX: tx,
        tipY: ty,
        ghost: 0, // the turn of the limb it hangs from
        ang: 0, // its own turn on top of that
        m: [1, 0, 0, 1, 0, 0],
        fleshO: -1,
      },
    ];
  });

  parts = [...limbs, ...leaves];
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

const pointer = { x: 0, y: 0, fromX: 0, fromY: 0, vx: 0, vy: 0, last: -1e9, tracking: false, inBox: false };

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
  // Only over the illustration's own box can it ink anything.
  const r = box.getBoundingClientRect();
  pointer.inBox =
    event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
}

function release() {
  pointer.tracking = false;
  pointer.inBox = false;
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
 * and leaves with (lx, ly). Each term of each part's sum is also kept apart,
 * so the equation on the page can weigh them.
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
      const own = (mx - w * l.dx[0]) * fy - (my - w * l.dy[0]) * fx;
      l.torque += own;
      const felt = (GAIN * FEEL.gain * l.mobility * Math.abs(own)) / (l.len * l.len);
      if (felt > l.felt) {
        l.felt = felt;
        l.pcx = mx / w;
        l.pcy = my / w;
      }
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
    const aSpring = -k * l.theta;
    const aBrake = -2 * l.zeta * DAMP * wn * l.omega;
    const aPush = (GAIN * FEEL.gain * l.mobility * l.torque) / (l.len * l.len);
    const aWind = wn * wn * l.wind * breeze(t, l.rx[l.n - 1], l.seed, 0.7);
    const aDrag = -INERTIA * l.baseAcc;
    l.acc = aSpring + aBrake + aPush + aWind + aDrag;
    l.sum[0] += aBrake;
    l.sum[1] += aSpring;
    l.sum[2] += aPush;
    l.sum[3] += aWind;
    l.sum[4] += aDrag;
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
    const aSpring = -k * f.theta;
    const aBrake = -2 * f.zeta * DAMP * wn * f.omega;
    const aWind = wn * wn * f.wind * air;
    const aDrag = -LEAF_INERTIA * baseAcc;
    f.acc = aSpring + aBrake + drive + aWind + aDrag;
    f.sum[0] += aBrake;
    f.sum[1] += aSpring;
    f.sum[2] += drive;
    f.sum[3] += aWind;
    f.sum[4] += aDrag;
    if (Math.abs(drive) > f.felt) f.felt = Math.abs(drive);
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
   Drawing the tree
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
  woodD = d + "Z";
  woodEl.setAttribute("d", woodD);
}

function drawLeaves() {
  for (const f of leaves) {
    const L = f.limb;
    const j = f.attach;
    const ox = f.px - L.rx[j];
    const oy = f.py - L.ry[j];
    const px = L.dx[j] + L.cos[j] * ox - L.sin[j] * oy;
    const py = L.dy[j] + L.sin[j] * ox + L.cos[j] * oy;
    const turn = soft(f.theta, f.limit);
    const ang = L.rot[j] + turn;
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
    f.m[0] = a;
    f.m[1] = b;
    f.m[2] = cc;
    f.m[3] = dd;
    f.m[4] = e;
    f.m[5] = ff;
    f.tipX = a * f.tx + cc * f.ty + e;
    f.tipY = b * f.tx + dd * f.ty + ff;
    f.ghost = L.rot[j];
    f.ang = turn;
  }
}

/* ==========================================================================
   Touch: which parts the pointer is on, and how much of each is inked
   ========================================================================== */

let clock = 0;
let near = false; // the pointer is within its wake of some part

function touch(dt) {
  const on = pointer.inBox;
  let closest = 1e9;
  for (const l of limbs) {
    let gap = 1e9;
    let at = l.ai;
    if (on) {
      for (let i = 0; i < l.n; i++) {
        const d = Math.hypot(l.dx[i] - pointer.x, l.dy[i] - pointer.y) - l.half[i];
        if (d < gap) {
          gap = d;
          at = i;
        }
      }
    }
    l.gap = gap;
    if (gap < FAR) l.ai = at;
    l.aiF += (l.ai - l.aiF) * (1 - Math.exp(-dt / 0.08));
    closest = Math.min(closest, gap);
  }
  for (const f of leaves) {
    f.gap = on ? segDist(pointer.x, pointer.y, f.pivX, f.pivY, f.tipX, f.tipY) - f.halfW : 1e9;
    closest = Math.min(closest, f.gap);
  }
  near = closest < WAKE;

  for (const p of parts) {
    const c = p.gap >= FAR ? 0 : p.gap <= NEAR ? 1 : smooth((FAR - p.gap) / (FAR - NEAR));
    if (c > 0.5) p.hold = HOLD;
    else p.hold = Math.max(0, p.hold - dt);
    const sway = Math.abs(p.omega) / (TAU * p.freq * FEEL.stiffness * p.limit * BREEZE_V);
    p.amb += (BREEZE_INK * smooth(Math.min(1, sway)) - p.amb) * (1 - Math.exp(-dt / 0.3));
    const want = Math.max(c, p.hold > 0 ? 1 : 0, p.amb);
    const was = p.rv;
    p.rv += (want - p.rv) * (1 - Math.exp(-dt / (want > p.rv ? RISE : FALL)));
    if (p.rv < 0.004) p.rv = 0;
    p.fresh = was < 0.03 && p.rv >= 0.03;
  }
}

/* ==========================================================================
   Formulas afloat
   ========================================================================== */

// The plate the construction is drawn on, and the layer the formulas float
// in, both laid over the illustration's box. Made here: without the script
// there is nothing to show.
let plate = null;
let g = null;
let floats = null;
let curA = null; // F = k v, by the pointer while it moves
let curB = null; // and how k is interpolated
let levF = null; // τ = r × F, by the point a part is pushed at

// The drawing's place on the plate: one tree unit is `sc` CSS pixels, and
// (ox, oy) is where the drawing's own origin lands.
let W = 0;
let Hh = 0;
let dpr = 1;
let sc = 1;
let ox = 0;
let oy = 0;
let small = 1; // formulas shrink with a small tree

function makeFrags(p) {
  for (const [name, x, y, align, tilt, size] of FRAGS[p.key] || []) {
    const el = document.createElement("div");
    el.className = "fx" + (align === "r" ? " r" : "");
    el.style.fontSize = `calc(var(--k, 1) * ${size}px)`;
    const num = name === "num";
    el.innerHTML = num ? '<span class="n">0.0000000</span>' : F[name];
    floats.appendChild(el);
    // The bit of the part this formula rides on.
    const j = p.kind === "limb" ? nearest(p, x, y).at : 0;
    p.frags.push({
      el,
      x,
      y,
      right: align === "r",
      tilt,
      j,
      num,
      n: num ? el.firstChild : null,
      terms: name.startsWith("ode") ? [...el.querySelectorAll(".t")].map((node) => ({ node, o: -1 })) : null,
      w: 0,
      h: 0,
      px: 0,
      py: 0,
      vis: false,
      o: -1,
      text: "",
      phase: p.seed * 0.37 + x * 0.05,
    });
  }
}

function loose(name, size, tilt) {
  const el = document.createElement("div");
  el.className = "fx force";
  el.style.fontSize = `calc(var(--k, 1) * ${size}px)`;
  el.innerHTML = F[name];
  floats.appendChild(el);
  return { el, w: 0, h: 0, vis: false, o: -1, phase: size, tilt };
}

function measure() {
  for (const p of parts) {
    for (const fr of p.frags) {
      fr.w = fr.el.offsetWidth;
      fr.h = fr.el.offsetHeight;
    }
  }
  for (const fr of [curA, curB, levF]) {
    fr.w = fr.el.offsetWidth;
    fr.h = fr.el.offsetHeight;
  }
}

// Everything within FOCUS_IN CSS pixels of the pointer is at full strength;
// past it, the plate and the formulas fade with distance, down to FOCUS_MIN
// at FOCUS_OUT. `focus` eases the whole effect in while the pointer is here.
const FOCUS_IN = 50;
const FOCUS_OUT = 320;
const FOCUS_MIN = 0.12;
let focus = 0;
let fcx = 0;
let fcy = 0;

function dim(x, y) {
  if (focus <= 0.001) return 1;
  const u = Math.min(1, Math.max(0, (Math.hypot(x - fcx, y - fcy) - FOCUS_IN) / (FOCUS_OUT - FOCUS_IN)));
  return 1 - focus * (1 - FOCUS_MIN) * smooth(u);
}

/** Fades what is already on the plate by its distance from the pointer. */
function mask() {
  if (focus <= 0.001) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const gr = g.createRadialGradient(fcx, fcy, 0, fcx, fcy, FOCUS_OUT);
  gr.addColorStop(0, "#000");
  for (let k = 0; k <= 12; k++) {
    const d = FOCUS_IN + ((FOCUS_OUT - FOCUS_IN) * k) / 12;
    gr.addColorStop(d / FOCUS_OUT, `rgba(0,0,0,${dim(fcx + d, fcy).toFixed(3)})`);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "destination-in";
  g.fillStyle = gr;
  g.fillRect(0, 0, W, Hh);
  g.globalCompositeOperation = "source-over";
}

function show(fr, x, y, o, tilt) {
  o *= dim(x + fr.w / 2, y + fr.h / 2);
  if (o < 0.01) {
    if (fr.vis) {
      fr.vis = false;
      fr.el.style.visibility = "hidden";
      fr.el.style.opacity = "0";
      fr.o = 0;
    }
    return;
  }
  if (!fr.vis) {
    fr.vis = true;
    fr.el.style.visibility = "visible";
  }
  // A slow drift, so they read as afloat and not pinned.
  const bx = 2.6 * Math.sin(clock * 1.05 + fr.phase);
  const by = 3.4 * Math.sin(clock * 0.8 + fr.phase * 1.7);
  fr.el.style.transform = `translate3d(${(x + bx).toFixed(1)}px,${(y + by).toFixed(1)}px,0) rotate(${tilt.toFixed(2)}deg)`;
  if (Math.abs(o - fr.o) > 0.01) {
    fr.o = o;
    fr.el.style.opacity = o.toFixed(2);
  }
}

/** Puts a part's formulas where its drawing is, riding on its swing. */
function float(p, dt) {
  const e = 1 - Math.exp(-dt / 0.13);
  for (const fr of p.frags) {
    if (p.rv <= 0.01) {
      show(fr, 0, 0, 0, 0);
      continue;
    }
    let mx;
    let my;
    if (p.kind === "limb") {
      mx = p.dx[fr.j] - p.rx[fr.j];
      my = p.dy[fr.j] - p.ry[fr.j];
    } else {
      mx = p.nowX - p.cx;
      my = p.nowY - p.cy;
    }
    let x = ox + (fr.x + mx) * sc;
    const y = oy + (fr.y + my) * sc - fr.h / 2;
    if (fr.right) x = Math.max(6 + fr.w, Math.min(W - 6, x)) - fr.w;
    else x = Math.max(6, Math.min(W - 6 - fr.w, x));
    if (p.fresh) {
      fr.px = x;
      fr.py = y + 7;
    }
    fr.px += (x - fr.px) * e;
    fr.py += (y - fr.py) * e;
    // They lean a little with the part's own turn.
    show(fr, fr.px, fr.py, p.rv * 0.95, fr.tilt + soft(p.theta, p.limit) * DEG * 0.35);
  }
}

/* ==========================================================================
   The plate, in one ink
   ========================================================================== */

let INK = "#0d5729";
let PAPER = "#f5f5f4";

// Each kind of mark has its own ink, set in styles.css: spirals and angles
// lead, the equations sit back, the length mark further, the circles of
// curvature and the pointer's rings barely there.
const KINDS = ["bone", "spiral", "angle", "num", "eq", "measure", "length", "construct", "circle", "force"];
const TONE = {};

function ink(kind) {
  g.strokeStyle = g.fillStyle = TONE[kind] || INK;
}

function readTheme() {
  const cs = getComputedStyle(box);
  INK = cs.getPropertyValue("--tree-ink").trim() || INK;
  PAPER = cs.getPropertyValue("--tree-paper").trim() || PAPER;
  for (const k of KINDS) TONE[k] = cs.getPropertyValue("--tree-ink-" + k).trim() || INK;
}

let airA = 0; // the pointer's own air, drawn round it
let curAl = 0; // its formula
let curHold = 0;
let leverA = 0;
let lever = null; // the part being pushed
let leverFx = 0;
let leverFy = 0;
let tNow = 0; // where the push is between k0 and k1, eased

/** Fits the plate to the illustration's box and finds the drawing on it. */
function layout() {
  const r = box.getBoundingClientRect();
  const m = svg.getScreenCTM();
  if (!r.width || !r.height || !m || !m.a) return;
  W = r.width;
  Hh = r.height;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  plate.width = Math.round(W * dpr);
  plate.height = Math.round(Hh * dpr);
  drawn = false;
  sc = m.a;
  ox = m.e - r.left;
  oy = m.f - r.top;
  small = Math.max(0.72, Math.min(1, sc));
  floats.style.setProperty("--k", String(small));

  // Graduate each tip's scale as finely as the screen can show.
  for (const l of limbs) {
    tipAt(l, l.limit, tmp);
    const span = Math.hypot(tmp[0] - l.gx[GK], tmp[1] - l.gy[GK]) * sc;
    const perDeg = span / (l.limit * DEG);
    const stepDeg = [0.5, 1, 2, 5, 10].find((s) => s * perDeg >= 2.6) || 10;
    l.tick = stepDeg / DEG;
    l.major = stepDeg === 0.5 || stepDeg === 5 ? 2 : 5;
  }
  measure();
}

const ghx = new Float64Array(200);
const ghy = new Float64Array(200);
const cnx = new Float64Array(200);
const cny = new Float64Array(200);

function arrow(x0, y0, x1, y1, headLen) {
  const d = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / d;
  const uy = (y1 - y0) / d;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.moveTo(x1 - headLen * (ux * 0.9 - uy * 0.45), y1 - headLen * (uy * 0.9 + ux * 0.45));
  g.lineTo(x1, y1);
  g.lineTo(x1 - headLen * (ux * 0.9 + uy * 0.45), y1 - headLen * (uy * 0.9 - ux * 0.45));
}

/** Thins the flesh along each touched bone, back to the page, and inks its bark. */
function drawVeil(u) {
  let any = false;
  for (const l of limbs) if (l.rv > 0.01) any = true;
  if (!any || !woodD) return;
  const bark = new Path2D(woodD);
  g.save();
  g.clip(bark);
  g.strokeStyle = PAPER;
  for (const l of limbs) {
    if (l.rv <= 0.01) continue;
    g.beginPath();
    g.moveTo(l.dx[0], l.dy[0]);
    for (let i = 1; i < l.n; i++) g.lineTo(l.dx[i], l.dy[i]);
    g.globalAlpha = 0.3 * l.rv;
    for (let k = 0; k < 4; k++) {
      g.lineWidth = l.veil * (1 - 0.2 * k);
      g.stroke();
    }
  }
  g.restore();

  // The bark's own outline, only along the touched bone.
  ink("bone");
  for (const l of limbs) {
    if (l.rv <= 0.01) continue;
    const n = l.n;
    g.save();
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const nx = l.cos[i] * l.nx[i] - l.sin[i] * l.ny[i];
      const ny = l.sin[i] * l.nx[i] + l.cos[i] * l.ny[i];
      const h = l.half[i] + 7;
      cnx[i] = nx;
      cny[i] = ny;
      if (i) g.lineTo(l.dx[i] + nx * h, l.dy[i] + ny * h);
      else g.moveTo(l.dx[i] + nx * h, l.dy[i] + ny * h);
    }
    // A cap past the tip, so the bark's end is inside the band too.
    const ex = l.dx[n - 1] - l.dx[n - 2];
    const ey = l.dy[n - 1] - l.dy[n - 2];
    const el = Math.hypot(ex, ey) || 1;
    const hx = l.dx[n - 1] + (ex / el) * 12;
    const hy = l.dy[n - 1] + (ey / el) * 12;
    g.lineTo(hx + cnx[n - 1] * 9, hy + cny[n - 1] * 9);
    g.lineTo(hx - cnx[n - 1] * 9, hy - cny[n - 1] * 9);
    for (let i = n - 1; i >= 0; i--) {
      const h = l.half[i] + 7;
      g.lineTo(l.dx[i] - cnx[i] * h, l.dy[i] - cny[i] * h);
    }
    g.closePath();
    g.clip();
    g.globalAlpha = 0.85 * l.rv;
    g.lineWidth = 1.1 * u;
    g.stroke(bark);
    g.restore();
  }
}

/**
 * A part's free decay from where it is now, drawn as a curl at its tip: its
 * path in the plane of angle and angular speed, which is a spiral winding
 * into rest. The damping sets how tight it winds; a push unfurls it.
 */
function drawCurl(p, x0, y0, tx, ty, size, u, a) {
  const wn = TAU * p.freq * FEEL.stiffness;
  const bound = p.limit;
  const brake = 2 * p.zeta * DAMP * wn;
  const nx = -ty;
  const ny = tx;
  let th = p.theta;
  let om = p.omega;
  let ex = x0;
  let ey = y0;
  g.beginPath();
  for (let i = 0; i < 240; i++) {
    let A = th / bound;
    let B = om / (wn * bound);
    const r = Math.hypot(A, B);
    // Very large swings are drawn a little closer in, so the curl stays by its tip.
    const f = r > 1e-6 ? (size * 1.8 * Math.tanh(r / 1.8)) / r : 0;
    A *= f;
    B *= f;
    const X = x0 + A * nx + B * tx;
    const Y = y0 + A * ny + B * ty;
    if (i) g.lineTo(X, Y);
    else {
      g.moveTo(X, Y);
      ex = X;
      ey = Y;
    }
    if (i > 12 && Math.abs(A) + Math.abs(B) < 0.5 * u) break;
    for (let k = 0; k < 2; k++) {
      const acc = -wn * wn * (1 + (th / bound) ** 2) * th - brake * om;
      om += acc * H;
      th += om * H;
    }
  }
  g.lineTo(x0, y0);
  g.globalAlpha = a;
  g.lineWidth = 1.35 * u;
  g.stroke();
  g.beginPath();
  g.arc(ex, ey, 2.4 * u, 0, TAU);
  g.fill();
}

/* ==========================================================================
   The length mark: the bone's arc length, as a dimension on a technical
   drawing, on a line that follows the bone on the side the rule is not on.
   ========================================================================== */

function head(x, y, ux, uy, len) {
  g.moveTo(x - len * (ux * 0.9 - uy * 0.4), y - len * (uy * 0.9 + ux * 0.4));
  g.lineTo(x, y);
  g.lineTo(x - len * (ux * 0.9 + uy * 0.4), y - len * (uy * 0.9 - ux * 0.4));
}

/** A value written along a direction, kept upright. */
function label(text, x, y, ang, u) {
  if (Math.cos(ang) < 0) ang += Math.PI;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.font = `italic ${14 * u}px "EB Garamond", serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 0, 0);
  g.restore();
}

/** Expects cnx/cny to hold the bone's normals, as drawLimb leaves them. */
function drawLength(l, u, a) {
  const n = l.n;
  const hl = 6 * u;
  ink("length");
  g.lineWidth = 0.75 * u;
  const off = (i) => l.half[i] + 16 * u;
  g.globalAlpha = a * 0.85;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const x = l.dx[i] - cnx[i] * off(i);
    const y = l.dy[i] - cny[i] * off(i);
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  for (const i of [0, n - 1]) {
    g.moveTo(l.dx[i] - cnx[i] * (l.half[i] + 3 * u), l.dy[i] - cny[i] * (l.half[i] + 3 * u));
    g.lineTo(l.dx[i] - cnx[i] * (off(i) + 5 * u), l.dy[i] - cny[i] * (off(i) + 5 * u));
  }
  const e0x = l.dx[0] - cnx[0] * off(0);
  const e0y = l.dy[0] - cny[0] * off(0);
  const e1x = l.dx[n - 1] - cnx[n - 1] * off(n - 1);
  const e1y = l.dy[n - 1] - cny[n - 1] * off(n - 1);
  const wx0 = l.dx[1] - l.dx[0];
  const wy0 = l.dy[1] - l.dy[0];
  const wd = Math.hypot(wx0, wy0) || 1;
  head(e0x, e0y, -wx0 / wd, -wy0 / wd, hl);
  const vx = l.dx[n - 1] - l.dx[n - 2];
  const vy = l.dy[n - 1] - l.dy[n - 2];
  const vd = Math.hypot(vx, vy) || 1;
  head(e1x, e1y, vx / vd, vy / vd, hl);
  g.stroke();
  const m = Math.round(n / 2);
  const mo = off(m) + 9 * u;
  const ta = Math.atan2(l.dy[m + 1] - l.dy[m - 1], l.dx[m + 1] - l.dx[m - 1]);
  label(`L = ${l.len.toFixed(1)}`, l.dx[m] - cnx[m] * mo, l.dy[m] - cny[m] * mo, ta, u);
}

function drawLimb(l, u) {
  const a = l.rv;
  const n = l.n;
  const gap = 6 * u;
  const tk = 4 * u;
  const cb = l.cos[0];
  const sb = l.sin[0];
  const bx = l.dx[0];
  const by = l.dy[0];
  const tx = l.dx[n - 1];
  const ty = l.dy[n - 1];
  ink("angle");

  // The scale at the tip: where the tip lands for each degree of turn.
  g.lineWidth = 0.8 * u;
  g.globalAlpha = a * 0.75;
  g.beginPath();
  for (let k = 0; k <= 2 * GK; k++) {
    const px = l.gx[k];
    const py = l.gy[k];
    const q = (Math.hypot(px, py) + gap) / Math.hypot(px, py);
    const x = bx + cb * px * q - sb * py * q;
    const y = by + sb * px * q + cb * py * q;
    if (k) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  const ticks = Math.floor(l.limit / l.tick + 1e-6);
  for (let k = -ticks; k <= ticks; k++) {
    tipAt(l, k * l.tick, tmp);
    const d = Math.hypot(tmp[0], tmp[1]);
    const len = k === 0 ? 2.4 * tk : k % l.major === 0 ? 1.7 * tk : tk;
    const q0 = (d + gap) / d;
    const q1 = (d + gap + len) / d;
    g.moveTo(bx + cb * tmp[0] * q0 - sb * tmp[1] * q0, by + sb * tmp[0] * q0 + cb * tmp[1] * q0);
    g.lineTo(bx + cb * tmp[0] * q1 - sb * tmp[1] * q1, by + sb * tmp[0] * q1 + cb * tmp[1] * q1);
  }
  g.stroke();

  ink("construct");
  // The bone at rest, carried by the bone below it, and the gap it has opened.
  for (let i = 0; i < n; i++) {
    const offX = l.rx[i] - l.rx[0];
    const offY = l.ry[i] - l.ry[0];
    ghx[i] = bx + cb * offX - sb * offY;
    ghy[i] = by + sb * offX + cb * offY;
    cnx[i] = l.cos[i] * l.nx[i] - l.sin[i] * l.ny[i];
    cny[i] = l.sin[i] * l.nx[i] + l.cos[i] * l.ny[i];
  }
  g.beginPath();
  g.moveTo(ghx[0], ghy[0]);
  for (let i = 1; i < n; i++) g.lineTo(ghx[i], ghy[i]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(l.dx[i], l.dy[i]);
  g.closePath();
  g.globalAlpha = a * 0.16;
  g.fill();
  g.beginPath();
  g.moveTo(ghx[0], ghy[0]);
  for (let i = 1; i < n; i++) g.lineTo(ghx[i], ghy[i]);
  g.globalAlpha = a * 0.5;
  g.lineWidth = 0.7 * u;
  g.stroke();

  ink("circle");
  // Circles of curvature: where the bone bends most, and under the pointer.
  const at = Math.max(3, Math.min(n - 4, Math.round(l.aiF)));
  g.lineWidth = 0.8 * u;
  for (let k = 0; k <= l.osc.length; k++) {
    const i = k < l.osc.length ? l.osc[k] : at;
    const own = k === l.osc.length;
    if (own && l.gap >= FAR) continue;
    if (!circle3(l.dx[i - 3], l.dy[i - 3], l.dx[i], l.dy[i], l.dx[i + 3], l.dy[i + 3], c3)) continue;
    const R = c3[2];
    if (R > 260 || R < 6) continue;
    g.globalAlpha = a * (own ? 0.8 : 0.5);
    g.beginPath();
    g.arc(c3[0], c3[1], R, 0, TAU);
    // its radius, and a cross at its centre
    g.moveTo(c3[0], c3[1]);
    g.lineTo(l.dx[i], l.dy[i]);
    g.moveTo(c3[0] - 3.5 * u, c3[1]);
    g.lineTo(c3[0] + 3.5 * u, c3[1]);
    g.moveTo(c3[0], c3[1] - 3.5 * u);
    g.lineTo(c3[0], c3[1] + 3.5 * u);
    g.stroke();
  }

  ink("measure");
  // A rule along the bone: a mark every four units of its length.
  g.globalAlpha = a * 0.7;
  g.lineWidth = 0.7 * u;
  g.beginPath();
  for (let i = 1; i < n - 1; i++) {
    const w = (1.7 - 1.15 * (i / (n - 1))) * u;
    const len = (i % 5 === 0 ? 6 : 2.8) * u;
    g.moveTo(l.dx[i] + cnx[i] * (w + u), l.dy[i] + cny[i] * (w + u));
    g.lineTo(l.dx[i] + cnx[i] * (w + u + len), l.dy[i] + cny[i] * (w + u + len));
  }
  g.stroke();

  ink("bone");
  // The bone itself, a stroke that thins towards its tip.
  g.globalAlpha = a;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const w = (1.7 - 1.25 * (i / (n - 1))) * u;
    if (i) g.lineTo(l.dx[i] + cnx[i] * w, l.dy[i] + cny[i] * w);
    else g.moveTo(l.dx[i] + cnx[i] * w, l.dy[i] + cny[i] * w);
  }
  for (let i = n - 1; i >= 0; i--) {
    const w = (1.7 - 1.25 * (i / (n - 1))) * u;
    g.lineTo(l.dx[i] - cnx[i] * w, l.dy[i] - cny[i] * w);
  }
  g.closePath();
  g.fill();

  ink("angle");
  // The tip is the needle of its scale, and it ends in its curl.
  const d = Math.hypot(tx - bx, ty - by) || 1;
  g.beginPath();
  g.moveTo(tx, ty);
  g.lineTo(tx + ((tx - bx) / d) * (gap + 2.6 * tk), ty + ((ty - by) / d) * (gap + 2.6 * tk));
  g.lineWidth = 0.9 * u;
  g.stroke();
  const ex = tx - l.dx[n - 2];
  const ey = ty - l.dy[n - 2];
  const el = Math.hypot(ex, ey) || 1;
  ink("spiral");
  drawCurl(l, tx, ty, ex / el, ey / el, 44, u, a);

  drawLength(l, u, a);

  // The joint it turns about.
  ink("bone");
  g.globalAlpha = a;
  g.lineWidth = 1 * u;
  g.beginPath();
  g.arc(bx, by, 3.6 * u, 0, TAU);
  g.fillStyle = PAPER;
  g.fill();
  g.stroke();
  ink("bone");
}

function drawLeaf(f, u) {
  const a = f.rv;
  const a0 = f.axis + f.ghost;
  const a1 = a0 + f.ang;
  const rad = f.rib * 0.62;
  const m = f.m;
  ink("bone");

  // Its own edge, where the flesh has thinned. A leaf the wood hides keeps
  // its edge hidden there too.
  g.save();
  if (f.behind && woodD) {
    const rest = new Path2D();
    rest.rect(-1000, -1000, 2400, 2800);
    rest.addPath(new Path2D(woodD));
    g.clip(rest, "evenodd");
  }
  g.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  g.globalAlpha = a * 0.9;
  g.lineWidth = 1.1 * u;
  g.stroke(f.edge);
  g.restore();

  ink("angle");
  // A protractor about the pivot, a mark every five degrees, and the turn so far.
  g.beginPath();
  g.moveTo(f.pivX, f.pivY);
  g.arc(f.pivX, f.pivY, rad, a0, a1, f.ang < 0);
  g.closePath();
  g.globalAlpha = a * 0.18;
  g.fill();
  g.globalAlpha = a * 0.75;
  g.lineWidth = 0.8 * u;
  g.beginPath();
  g.arc(f.pivX, f.pivY, rad, a0 - f.limit, a0 + f.limit);
  const marks = Math.floor((f.limit * DEG) / 5);
  for (let k = -marks; k <= marks; k++) {
    const t = a0 + (k * 5) / DEG;
    const len = (k === 0 ? 9 : k % 3 === 0 ? 6 : 3.4) * u;
    g.moveTo(f.pivX + Math.cos(t) * rad, f.pivY + Math.sin(t) * rad);
    g.lineTo(f.pivX + Math.cos(t) * (rad + len), f.pivY + Math.sin(t) * (rad + len));
  }
  g.moveTo(f.pivX, f.pivY);
  g.lineTo(f.pivX + Math.cos(a0) * f.rib, f.pivY + Math.sin(a0) * f.rib);
  g.stroke();

  ink("bone");
  // The midrib, and the curl it ends in.
  g.globalAlpha = a;
  g.lineWidth = 1.5 * u;
  g.beginPath();
  g.moveTo(f.pivX, f.pivY);
  g.lineTo(f.tipX, f.tipY);
  g.stroke();
  const ex = f.tipX - f.pivX;
  const ey = f.tipY - f.pivY;
  const el = Math.hypot(ex, ey) || 1;
  ink("spiral");
  drawCurl(f, f.tipX, f.tipY, ex / el, ey / el, 30, u, a);
  ink("bone");
  g.globalAlpha = a;
  g.beginPath();
  g.arc(f.pivX, f.pivY, 2.2 * u, 0, TAU);
  g.fill();
}

/** The pointer's push and its wake, and its velocity on a rule from k0 to k1. */
function drawAir(u) {
  if (airA < 0.01) return;
  ink("circle");
  g.lineWidth = (0.8 + 1.2 * tNow) * u;
  g.globalAlpha = airA * (0.4 + 0.5 * tNow);
  g.beginPath();
  g.arc(pointer.x, pointer.y, CONTACT, 0, TAU);
  g.stroke();
  g.lineWidth = 0.7 * u;
  g.globalAlpha = airA * 0.3;
  g.beginPath();
  g.arc(pointer.x, pointer.y, WAKE, 0, TAU);
  g.stroke();
  // The arrow reaches as far along the rule as t.
  ink("force");
  const sp = Math.hypot(pointer.vx, pointer.vy);
  if (sp > 30 && curAl > 0.01) {
    const ux = pointer.vx / sp;
    const uy = pointer.vy / sp;
    const x0 = pointer.x + ux * CONTACT;
    const y0 = pointer.y + uy * CONTACT;
    const full = 110;
    g.globalAlpha = airA * curAl * 0.55;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x0 + ux * full, y0 + uy * full);
    for (let k = 0; k <= 10; k++) {
      const len = (k % 5 === 0 ? 6 : 3) * u;
      const px = x0 + ux * full * (k / 10);
      const py = y0 + uy * full * (k / 10);
      g.moveTo(px, py);
      g.lineTo(px - uy * len, py + ux * len);
    }
    g.stroke();
    arrow(x0, y0, x0 + ux * full * tNow, y0 + uy * full * tNow, 6 * u);
    g.globalAlpha = airA * curAl;
    g.lineWidth = 1.7 * u;
    g.stroke();
  }
}

function leverPoint(p, out) {
  out[0] = p.kind === "limb" ? p.pcx : p.nowX;
  out[1] = p.kind === "limb" ? p.pcy : p.nowY;
}

/** The force on the part pushed, from where it is pushed, and its lever to the pivot. */
function drawLever(u) {
  if (leverA < 0.02 || !lever) return;
  const p = lever;
  const bx = p.kind === "limb" ? p.dx[0] : p.pivX;
  const by = p.kind === "limb" ? p.dy[0] : p.pivY;
  leverPoint(p, tmp);
  const cx = tmp[0];
  const cy = tmp[1];
  ink("force");
  g.globalAlpha = leverA * 0.7;
  g.lineWidth = 0.8 * u;
  g.beginPath();
  g.moveTo(bx, by);
  g.lineTo(cx, cy);
  g.stroke();
  g.globalAlpha = leverA;
  arrow(cx, cy, cx + leverFx * 52, cy + leverFy * 52, 7 * u);
  g.lineWidth = 1.7 * u;
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, 2.6 * u, 0, TAU);
  g.fill();
}

let drawn = false; // whether the plate has anything on it to clear

function drawPlate() {
  if (!W) return;
  let any = airA >= 0.01 || (lever && leverA >= 0.02);
  for (const p of parts) if (p.rv > 0.01) any = true;
  // Most of the time nothing is touched: one clear, then nothing to do.
  if (!any && !drawn) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, Hh);
  drawn = any;
  if (!any) return;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
  const u = 1 / sc; // one CSS pixel, in tree units
  drawVeil(u);
  for (const l of limbs) if (l.rv > 0.01) drawLimb(l, u);
  for (const f of leaves) if (f.rv > 0.01) drawLeaf(f, u);
  drawAir(u);
  drawLever(u);
  mask();
  g.globalAlpha = 1;
}

/* ==========================================================================
   Run
   ========================================================================== */

let spare = 0;
let lastFrame = 0;
let frame = 0;
let lastText = -1;

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
  // The push: the pointer's velocity times a coefficient interpolated by its
  // speed, from K0 (still) to K1 (at V1 and beyond).
  const speed = Math.hypot(pointer.vx, pointer.vy);
  const t = Math.min(1, speed / V1);
  const going = speed > 1 ? 1 : 0;
  const kWood = (K0 + (K1 - K0) * t) * going;
  const kLeaf = (KL0 + (KL1 - KL0) * t) * going;

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
  for (const p of parts) {
    p.sum.fill(0);
    p.felt = 0;
  }
  for (let i = 0; i < steps; i++) {
    const u = (i + 1) / steps;
    clock += H;
    step(
      clock,
      pointer.fromX + (pointer.x - pointer.fromX) * u,
      pointer.fromY + (pointer.y - pointer.fromY) * u,
      pointer.vx * kWood,
      pointer.vy * kWood,
      pointer.vx * kLeaf,
      pointer.vy * kLeaf
    );
  }
  pointer.fromX = pointer.x;
  pointer.fromY = pointer.y;

  pose();
  drawWood();
  drawLeaves();

  touch(dt);

  const ease = 1 - Math.exp(-dt / 0.07);
  for (const p of parts) for (let k = 0; k < 5; k++) p.shown[k] += (p.sum[k] / steps - p.shown[k]) * ease;

  // The part the pointer is levering, and the force on it.
  let pushed = null;
  for (const p of parts) if (p.gap < FAR && p.felt > 0.5 && (!pushed || p.felt > pushed.felt)) pushed = p;
  if (pushed && speed > 1) {
    lever = pushed;
    const out = 0.25 + 0.75 * t;
    leverFx = (pointer.vx / speed) * out;
    leverFy = (pointer.vy / speed) * out;
    leverA += (1 - leverA) * (1 - Math.exp(-dt / 0.04));
  } else {
    leverA *= Math.exp(-dt / 0.16);
  }

  // The pointer's own air, and its formula while it moves, near the tree.
  airA += ((near ? 1 : 0) - airA) * (1 - Math.exp(-dt / 0.1));
  if (airA < 0.004) airA = 0;
  tNow += (t - tNow) * (1 - Math.exp(-dt / 0.05));
  if (near && speed > 40) curHold = 0.16;
  else curHold = Math.max(0, curHold - dt);
  const wantCur = curHold > 0 ? 1 : 0;
  curAl += (wantCur - curAl) * (1 - Math.exp(-dt / (wantCur > curAl ? RISE : FALL)));
  if (curAl < 0.004) curAl = 0;

  // Where the pointer is, for how strongly everything shows.
  focus += ((pointer.inBox ? 1 : 0) - focus) * (1 - Math.exp(-dt / 0.12));
  fcx = ox + pointer.x * sc;
  fcy = oy + pointer.y * sc;

  // Float what is inked.
  for (const p of parts) {
    float(p, dt);
    if (p.rv <= 0.01) continue;
    for (const fr of p.frags) {
      if (!fr.terms) continue;
      // Every term of the equation weighs on the page what it weighs in the sum.
      for (let k = 0; k < 5; k++) {
        const o = 0.5 + 0.5 * Math.min(1, Math.sqrt(Math.abs(p.shown[k]) / 30));
        const term = fr.terms[k];
        if (Math.abs(o - term.o) > 0.015) {
          term.o = o;
          term.node.style.opacity = o.toFixed(2);
        }
      }
    }
  }
  // A touched leaf thins back to the page, so its anatomy reads through it.
  for (const f of leaves) {
    const o = 1 - 0.78 * f.rv;
    if (Math.abs(o - f.fleshO) > 0.008) {
      f.fleshO = o;
      f.path.style.fillOpacity = o.toFixed(3);
    }
  }
  {
    const px = ox + pointer.x * sc;
    const py = oy + pointer.y * sc;
    let x = px + 26;
    let y = py + 30;
    if (x + curB.w > W - 8) x = px - 26 - curB.w;
    if (y + 56 * small > Hh - 6) y = py - 30 - 56 * small;
    x = Math.max(6, Math.min(W - 6 - curB.w, x));
    y = Math.max(6, y);
    show(curA, x, y, curAl, curA.tilt);
    show(curB, x + 4, y + 30 * small, curAl * 0.9, curB.tilt);
    if (lever) {
      leverPoint(lever, tmp);
      show(levF, ox + tmp[0] * sc + 10, oy + tmp[1] * sc + 10, leverA, levF.tilt);
    }
  }
  if (clock - lastText > 0.06) {
    lastText = clock;
    for (const p of parts) {
      if (p.rv <= 0.01) continue;
      for (const fr of p.frags) {
        if (!fr.num) continue;
        // The part's own angle, in radians, as it is this instant.
        const text = (p.theta < 0 ? "−" : "") + Math.abs(p.theta).toFixed(7);
        if (text !== fr.text) {
          fr.text = text;
          fr.n.textContent = text;
        }
      }
    }
  }

  drawPlate();
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

function setup() {
  plate = document.createElement("canvas");
  g = plate.getContext("2d");
  if (!g) return false;
  plate.className = "tree-plate";
  plate.setAttribute("aria-hidden", "true");
  floats = document.createElement("div");
  floats.className = "tree-floats";
  floats.setAttribute("aria-hidden", "true");
  box.append(plate, floats);

  build();
  for (const p of parts) makeFrags(p);
  curA = loose("push", 19, -3);
  curB = loose("lerp", 15, -3);
  levF = loose("lever", 17, 4);
  return true;
}

if (box && svg && woodEl && !reduced && setup()) {
  readTheme();
  layout();
  pose();
  drawWood();
  drawLeaves();

  window.addEventListener("pointermove", track, { passive: true });
  document.documentElement.addEventListener("pointerleave", release);
  window.addEventListener("blur", release);

  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      layout();
      drawPlate();
    }).observe(box);
  } else {
    window.addEventListener("resize", layout);
  }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readTheme);
  // The formulas' faces arrive after the first layout; measure them again.
  if (document.fonts) {
    document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
  }

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
