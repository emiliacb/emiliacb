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
 * What is pushed pushes back. Where the page draws its own cursor
 * (ink-cursor.js), that cursor is a body of no weight, and it is that body,
 * not the hand, that touches the tree. The hand carries it along through a
 * dashpot, so wherever something drags on it, it moves at a share of the
 * hand's speed; a weak spring beside the dashpot brings it back to the hand
 * afterwards. What drags on it is the bark and the leaves it touches, harder
 * the faster the hand is going, so the faster it comes in the larger the
 * share of its speed it loses. That is the first touch. As it goes on moving
 * through a part, the part gives, and it is slowed less and less, until it
 * moves through freely; the part recovers once it is left alone. Nothing ever
 * holds the cursor still, and away from the tree it is exactly where the hand
 * is.
 *
 * Touching a part inks its construction over it and lets the equations it
 * obeys float beside it; a moment after the pointer leaves, it is gone, and
 * everything fades with distance from the pointer. Between touches the breeze
 * alone inks each part faintly, as much as it is moving. Nothing is labelled,
 * and everything drawn is computed from the same state the tree moves by: the
 * bone and its rest pose; a rule along it in millimetres, and its length,
 * dimensioned in millimetres; circles of curvature (radius 1/κ) where it bends most and under
 * the pointer; a scale at the tip, graduated in degrees of turn; a curl at the
 * tip, which is the part's free decay from where it is now, in the plane of
 * angle and angular speed; a protractor about each leaf's pivot; the force on
 * the part pushed; and the part's angle in radians, live. Each term of the
 * equation of motion shows as strong as it is in the sum.
 *
 * It can be heard. Every part has a note of its own, all from one scale, rung
 * when the cursor first touches it and, on a phone, each time it swings back
 * after a shake, as loud as the swing was wide. A browser plays nothing until
 * the page has been pressed somewhere, so the first notes come after the first
 * click, tap or key; the switch in the page's footer turns it off, and an off
 * is remembered.
 *
 * The tree sits behind the page, so it listens to the pointer on the window.
 * Nothing here is needed for the page to work: without it the tree is the
 * same SVG, standing still, and with reduced motion that is all there is.
 */

import { isDark, onThemeChange } from "./lib/theme.js";

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

// How the tree slows the cursor, as two curves, each a list of points read
// straight between them and level beyond the last.
//
// BRAKE is the share of its speed the cursor loses on first touching wood, by
// the hand's speed in tree units a second: a drift loses little, a flick most
// of it. FADE is how much of that is left once the cursor has moved so many
// tree units through the part: the part gives as it is moved through.
//
// A leaf slows it LEAF_BRAKE as much as wood. A part is felt from SKIN outside
// its edge, and is whole again MEND seconds after it is left. Whatever distance
// the cursor has lost to the hand it makes up over CATCHUP seconds, sooner once
// it is more than SLACK behind.
const BRAKE = [[0, 0], [853.5, 0.395], [2212.1, 0.746], [3533.5, 0.98]];
const FADE = [[0, 1], [25.3, 1], [25.9, 0], [74.9, 0], [117.2, 0], [160, 0]];
const LEAF_BRAKE = 1;
const SKIN = 0.1;
const MEND = 0.01;
const CATCHUP = 0.15;
const SLACK = 50;
// Whether the tree does hold the cursor back. Off for now: what it touches is
// still felt, for its note, but the cursor goes where the hand goes.
const BRAKE_CURSOR = false;

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

/** A curve given as points, read at x: straight between them, level beyond the ends. */
function along(curve, x) {
  const n = curve.length;
  if (x <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < n; i++) {
    if (x > curve[i][0]) continue;
    const [x0, y0] = curve[i - 1];
    const [x1, y1] = curve[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
  }
  return curve[n - 1][1];
}

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

/** How far apart two runs are, a to b and c to d: nothing if they cross. */
function runDist(ax, ay, bx, by, cx, cy, dx, dy) {
  const side = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  if (
    side(ax, ay, bx, by, cx, cy) * side(ax, ay, bx, by, dx, dy) < 0 &&
    side(cx, cy, dx, dy, ax, ay) * side(cx, cy, dx, dy, bx, by) < 0
  ) {
    return 0;
  }
  return Math.min(
    segDist(ax, ay, cx, cy, dx, dy),
    segDist(bx, by, cx, cy, dx, dy),
    segDist(cx, cy, ax, ay, bx, by),
    segDist(dx, dy, ax, ay, bx, by)
  );
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
  touch: 0, // how nearly the pointer was touching it in the last step, 0 to 1
  worn: 0, // how far the cursor has moved through it since it was last whole
  met: false, // the cursor is on it, for the note it rings on first being touched
  went: 0, // which way it was last turning, and the angle it last turned back at
  turned: 0,
  rang: -1, // when it last rang, on the sound's own clock
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

const wood = [];
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
    // A coarser outline, for what the cursor touches: as drawn, and as it is now.
    const rim = poly.filter((_, k) => k % 4 === 0);
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
        rimX: Float64Array.from(rim, (q) => q[0]),
        rimY: Float64Array.from(rim, (q) => q[1]),
        nowRimX: Float64Array.from(rim, (q) => q[0]),
        nowRimY: Float64Array.from(rim, (q) => q[1]),
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

// (x, y) is what touches the tree: the hand at (hx, hy), less how far the
// cursor has fallen behind it, (lagX, lagY). (fromX, fromY) is where the hand
// was at the last physics step.
const pointer = {
  x: 0, y: 0, hx: 0, hy: 0, fromX: 0, fromY: 0, lagX: 0, lagY: 0, vx: 0, vy: 0,
  last: -1e9, tracking: false, inBox: false, mouse: false,
};

function track(event) {
  // A finger dragging the page scrolls it; it is not brushing the tree.
  if (event.pointerType === "touch") return;
  // While a sidebar is open the tree is under it, out of the pointer's reach.
  if (document.querySelector("ui-drawer-content[data-open]")) {
    if (pointer.tracking) release();
    return;
  }
  // A hidden tree has no screen position to map onto, and one NaN let into the
  // springs would stay there for good.
  const m = svg.getScreenCTM();
  if (!m || !m.a) return;
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse());
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
  const dt = (event.timeStamp - pointer.last) / 1000;
  if (pointer.tracking && dt > 0.001 && dt < 0.12) {
    // Smoothed, or a single jittery event reads as a slap.
    pointer.vx += ((p.x - pointer.hx) / dt - pointer.vx) * 0.5;
    pointer.vy += ((p.y - pointer.hy) / dt - pointer.vy) * 0.5;
  } else {
    // A pointer coming back after a pause did not sweep across the gap.
    pointer.vx = 0;
    pointer.vy = 0;
    pointer.fromX = p.x;
    pointer.fromY = p.y;
  }
  pointer.hx = p.x;
  pointer.hy = p.y;
  pointer.x = p.x - pointer.lagX;
  pointer.y = p.y - pointer.lagY;
  pointer.last = event.timeStamp;
  pointer.tracking = true;
  pointer.mouse = event.pointerType === "mouse";
  // Only over the illustration's own box can it ink anything.
  const r = box.getBoundingClientRect();
  pointer.inBox =
    event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
}

function release() {
  pointer.tracking = false;
  pointer.inBox = false;
  letGo();
}

/**
 * One step of the cursor, the hand having moved (sx, sy). The hand carries it
 * through a dashpot and what it touches drags on it, `drag` as a multiple of
 * that dashpot, so of every step the hand takes it takes 1 / (1 + drag) and
 * falls behind by the rest; the spring beside the dashpot pays what it is
 * behind by back over CATCHUP, stiffening past SLACK. Returns how far the
 * cursor itself moved.
 */
function trail(sx, sy, drag) {
  const lx = pointer.lagX;
  const ly = pointer.lagY;
  const k = 1 + drag + (H / CATCHUP) * (1 + (lx * lx + ly * ly) / (SLACK * SLACK));
  pointer.lagX = ((1 + drag) * lx + drag * sx) / k;
  pointer.lagY = ((1 + drag) * ly + drag * sy) / k;
  // Close enough to the hand is the hand: nothing is left to write each frame.
  if (!drag && Math.abs(pointer.lagX) + Math.abs(pointer.lagY) < 0.02) pointer.lagX = pointer.lagY = 0;
  return Math.hypot(sx + lx - pointer.lagX, sy + ly - pointer.lagY);
}

// The cursor the page draws, where it does (ink-cursor.js), and how far back
// it was last told to sit, in CSS pixels.
let heldX = 0;
let heldY = 0;

function hold() {
  const x = -pointer.lagX * sc;
  const y = -pointer.lagY * sc;
  if (x === heldX && y === heldY) return;
  heldX = x;
  heldY = y;
  if (window.__inkCursor) window.__inkCursor.offset(x, y);
}

/** Gives the cursor back to the hand. */
function letGo() {
  pointer.lagX = 0;
  pointer.lagY = 0;
  pointer.x = pointer.hx;
  pointer.y = pointer.hy;
  hold();
}

/* ==========================================================================
   The phone's motion
   ========================================================================== */

/**
 * On a phone the tree also feels the phone. Tilted, it keeps pointing at the
 * sky, so it leans toward the raised side; shaken sideways, it lags behind
 * the shake; spun in the screen's plane, it whips against the turn. All three
 * add up to one lean, as a share of each part's limit, felt like the breeze.
 */
const device = { lean: 0, grav: 0, shake: 0, spinAcc: 0, spinPrev: null, last: 0, calm: 0, stirred: -1e9 };
const TILT_SMOOTH = 0.12; // s, low-pass on the gravity's sideways share
const SHAKE_SMOOTH = 0.04;
const SPIN_SMOOTH = 0.05;
const SPIN_GAIN = 0.02; // rad/s² of the phone's turn to a lean

// iOS reports the phone's acceleration with the opposite sign to Android's
// (and the spec's), so the same tilt would lean the tree the other way.
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const SIDE = IOS ? -1 : 1;
let motionSeen = false;
let askMotion = null; // asks the browser for the phone's motion, where it wants a tap for it (iOS)

function onMotion(e) {
  const now = e.timeStamp || performance.now();
  const dt = device.last ? Math.min(0.1, Math.max(0.001, (now - device.last) / 1000)) : 0.016;
  device.last = now;
  const ig = e.accelerationIncludingGravity;
  const a = e.acceleration;
  const r = e.rotationRate;
  if (ig && ig.x != null) {
    if (!motionSeen) {
      motionSeen = true;
      offerTilt();
    }
    device.grav += ((-SIDE * ig.x) / 9.81 - device.grav) * (1 - Math.exp(-dt / TILT_SMOOTH));
  }
  if (a && a.x != null) device.shake += ((-SIDE * a.x) / 9.81 - device.shake) * (1 - Math.exp(-dt / SHAKE_SMOOTH));
  if (r && r.alpha != null) {
    const w = (r.alpha * Math.PI) / 180;
    if (device.spinPrev != null) {
      device.spinAcc += ((w - device.spinPrev) / dt - device.spinAcc) * (1 - Math.exp(-dt / SPIN_SMOOTH));
    }
    device.spinPrev = w;
  }
  const clamp = (v, m) => Math.max(-m, Math.min(m, v));
  const lean = clamp(device.grav, 1) + clamp(device.shake, 2) + clamp(-device.spinAcc * SPIN_GAIN, 2);
  device.lean = Number.isFinite(lean) ? lean : 0;
}

/** Listens to the phone's motion. Where the browser asks first (iOS), it is
 * asked by the press that lets the sound start: Allow, on the sound's window,
 * or a tap anywhere else on the page (onMotionPress). The permission prompt
 * needs a tap of its own, and the window already asks for one; a second
 * button for it would be one too many. */
function listenMotion() {
  setTimeout(offerSound, HINT_AFTER);
  const DM = window.DeviceMotionEvent;
  if (!DM) return;
  window.addEventListener("devicemotion", onMotion, { passive: true });
  if (typeof DM.requestPermission === "function") armMotion(DM);
}

/** Readies the asking: once, from the next tap, unless the motion comes anyway
 * (already allowed in this visit). A tap the browser does not take as one is
 * not an answer: the one after asks again. */
function armMotion(DM) {
  askMotion = () => {
    askMotion = null;
    window.removeEventListener("touchend", onMotionPress, true);
    if (!motionSeen) DM.requestPermission().catch(() => armMotion(DM));
  };
  window.addEventListener("touchend", onMotionPress, { capture: true, passive: true });
}

/** A tap on the page asks for the phone's motion, as it starts the sound
 * (onFirstPress): not one on the sound's window, whose Allow asks itself, nor
 * one on a link or a menu, which leads away. Only a touch's end: iOS takes
 * that, not its start, as the tap a permission prompt needs. */
function onMotionPress(event) {
  if (hint && hint.contains(event.target)) return;
  if (event.target instanceof Element && event.target.closest("a[href], dropdown-trigger")) return;
  if (askMotion) askMotion();
}

// Once the phone's motion reaches the tree, and the sound's window is not
// asking anything, a sign at the foot of the tree says to move
// the phone: a phone rocking side to side, and the words. Without it nobody
// would think to. It goes once the tree has been shaken, or after a while.
// Only where the screen is touched: a laptop's motion moves nothing.
const TILT_AFTER = 450; // ms after the window has gone, so the two do not cross
const TILT_FOR = 9000; // ms it stays if the phone is never moved
let tiltReady = false; // the sound's window has been answered, or was never needed
let tiltShown = false;
let dropTilt = null;

function offerTilt() {
  if (!COARSE || tiltShown || !tiltReady || !motionSeen || hint) return;
  tiltShown = true;
  setTimeout(() => {
    const es = (document.documentElement.lang || "").startsWith("es");
    const sign = document.createElement("div");
    sign.className = "tree-tilt-sign";
    sign.setAttribute("role", "status");
    // Lucide's "smartphone", rocked by styles.css.
    sign.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>' +
      `<span>${es ? "Mové el celular" : "Tilt your phone"}</span>`;
    box.appendChild(sign);
    let up = true;
    const gone = () => {
      if (!up) return;
      up = false;
      if (dropTilt === gone) dropTilt = null;
      sign.classList.add("is-gone");
      setTimeout(() => sign.remove(), 400);
    };
    dropTilt = gone;
    setTimeout(gone, TILT_FOR);
  }, TILT_AFTER);
}

/* ==========================================================================
   Sound
   ========================================================================== */

// Every part's note, in hertz: a Hijaz on D (D E♭ F♯ G A B♭), with its two
// semitones and the wide step between them. The leaves have the scale, the
// bigger the leaf the lower; the wood holds the root, the fourth and the
// fifth beneath them.
const NOTE = {
  "leaf:crown": 293.66, "leaf:left": 311.13, "leaf:twig": 369.99, "leaf:stem": 440, "leaf:elbow": 466.16, "leaf:right": 587.33,
  trunk: 73.42, stem: 110, left: 146.83, right: 196, twig: 220,
};
// The sound is wanted from the start, unless its switch, in the page's footer
// (footer.ts, layout.js), was last left off: the switch keeps that under
// SOUND_KEY and says so with an event of the same name when it is pressed.
// A browser plays nothing until the page has been clicked, tapped or typed
// into, so it is silent until the first of those, wherever it lands.
const SOUND_KEY = "tree-sound";
const sound = { want: true, ac: null, bus: null };
try {
  sound.want = localStorage.getItem(SOUND_KEY) !== "off";
} catch {
  // No storage: wanted, as for a first visit.
}

/** Turns the sound on or off. Called from a press, which is also what lets it start. */
function setSound(yes) {
  sound.want = yes;
  if (yes) startSound();
  else dropHint();
}

/** Starts the sound, if it is wanted. Only does anything from inside a click, a tap or a key press. */
function startSound() {
  if (!sound.want) return;
  try {
    if (!sound.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      // Everything goes out under one soft ceiling, and part of it round an
      // echo that loses its top each time: the air the notes hang in.
      const bus = ac.createGain();
      const out = ac.createBiquadFilter();
      const echo = ac.createDelay(1);
      const back = ac.createGain();
      const dull = ac.createBiquadFilter();
      const wet = ac.createGain();
      out.type = "lowpass";
      out.frequency.value = 5200;
      echo.delayTime.value = 0.27;
      back.gain.value = 0.42;
      dull.type = "lowpass";
      dull.frequency.value = 1800;
      wet.gain.value = 0.5;
      // An ear on what goes out, echo and all, for the page to listen to
      // (tree-warp.js): it bends as loud as the tree sounds.
      const ear = ac.createAnalyser();
      ear.fftSize = 2048;
      ear.smoothingTimeConstant = 0;
      out.connect(ear);
      window.__treeEar = ear;
      bus.connect(out).connect(ac.destination);
      bus.connect(echo).connect(dull).connect(back).connect(echo);
      dull.connect(wet).connect(out);
      ac.addEventListener("statechange", () => {
        if (ac.state === "running") answerHint();
      });
      sound.ac = ac;
      sound.bus = bus;
    }
    if (sound.ac.state === "suspended") sound.ac.resume();
  } catch {
    // No sound on this browser: the tree stays as quiet as it was.
  }
}

// Where the browser is still waiting for a press before it plays, a small
// window on the tree's trunk asks for it the way a browser asks for the
// microphone, titled Choice: tree wants to be heard, Ignore
// or Allow. Allowing is that press. Ignoring (or its close box, or Escape)
// leaves the tree quiet for this visit, as the footer's switch would, without
// keeping it: the switch shows it and can turn the sound back on. Any other
// press on the page still starts the sound and takes the window away; presses
// on the window itself do not, so it can be dragged by its title bar without
// answering it. It is given a moment first, for a browser that needs no press
// to show it. On iOS, Allow (or the tap elsewhere) also asks for the phone's
// motion (listenMotion).
const HINT_AFTER = 600;
const HINT_UP = 0.5; // how far up the trunk its centre sits, from the ground
const HINT_EDGE = 8; // px kept clear of the screen's edges
let hint = null;
let hintMoved = false; // once dragged, it stays where it was put

/** Keeps a window position on screen: its top-left corner, for its size. With
 * `x` alone, only across: the page may have scrolled it out of view, and it is
 * left there. */
function onScreen(el, x, y) {
  const html = document.documentElement;
  const across = Math.max(HINT_EDGE, Math.min(html.clientWidth - el.offsetWidth - HINT_EDGE, x));
  if (y == null) return [across];
  return [across, Math.max(HINT_EDGE, Math.min(html.clientHeight - el.offsetHeight - HINT_EDGE, y))];
}

/** Puts the window at a place on the screen. It is laid out on the page's
 * scrolling box (absolute, in #scroll-wrapper: styles.css), so that place is
 * turned into one on the page, and from there it scrolls with the page, the
 * tree under it. */
function putHint(x, y) {
  const page = hint.offsetParent || document.documentElement;
  const r = page.getBoundingClientRect();
  hint.style.left = `${(x - r.left + page.scrollLeft - page.clientLeft).toFixed(1)}px`;
  hint.style.top = `${(y - r.top + page.scrollTop - page.clientTop).toFixed(1)}px`;
}

// On a phone the trunk runs down behind the contact links at the foot of the
// home (contacts.ts): there the window sits on the trunk just above them,
// never on them.
const PHONE = window.matchMedia("(max-width: 767px)");
const HINT_GAP = 12; // px between the window and the links under it

/** Centres the window on the trunk, wherever the drawing is on the screen now
 * (on a phone, above the contact links if the trunk runs behind them), and on
 * screen when it first comes. Once it has been moved it stays where it was put.
 * Either way it is only kept from running off the sides when the page is
 * resized: up and down, it is where the page has scrolled it. */
function placeHint() {
  if (!hint) return;
  let x;
  let y;
  if (hintMoved) {
    const r = hint.getBoundingClientRect();
    x = r.left;
    y = r.top;
  } else {
    const trunk = limbs[0];
    const i = Math.round((trunk.n - 1) * HINT_UP);
    const r = box.getBoundingClientRect();
    x = r.left + ox + trunk.rx[i] * sc - hint.offsetWidth / 2;
    y = r.top + oy + trunk.ry[i] * sc - hint.offsetHeight / 2;
    const links = PHONE.matches && document.querySelector("#content footer");
    if (links) y = Math.min(y, links.getBoundingClientRect().top - HINT_GAP - hint.offsetHeight);
  }
  if (hint.style.top) [x] = onScreen(hint, x);
  else [x, y] = onScreen(hint, x, y);
  putHint(x, y);
}

// The combining marks the tree's name is written with (U+0300 to U+036F), by
// where each sits on its letter: through it, under it, or (all the rest) over it.
const MARK = /[\u0300-\u036f]/;
const THROUGH = /[\u0334-\u0338]/;
const UNDER = /[\u0316-\u0319\u031c-\u0333\u0339-\u033c\u0345\u0347-\u0349\u034d\u034e\u0353-\u0356\u0359\u035a\u035c\u035f\u0362]/;

/** The tree's garbled name, with its marks taken off their letters and stacked
 * by hand, each one a step further out than the last, over and under the
 * window and whatever is near: left to the browser, they may all be drawn in
 * one place, piled on the letter. Each sits on a no-break space of its own,
 * and grows out after the window has come in, the furthest last (--n). */
function curse(text) {
  let html = "";
  let open = false;
  let up = 0;
  let down = 0;
  for (const ch of text) {
    if (open && MARK.test(ch)) {
      if (ch === "\u034f") continue; // the grapheme joiner, which draws nothing
      const at = THROUGH.test(ch) ? 0 : UNDER.test(ch) ? down++ : -up++;
      html += `<span class="tree-sound-ask-mark" style="--at:${at};--n:${Math.abs(at)}">\u00a0${ch}</span>`;
    } else {
      html += `${open ? "</span>" : ""}<span class="tree-sound-ask-letter">${ch}`;
      open = true;
      up = 0;
      down = 0;
    }
  }
  return open ? `${html}</span>` : html;
}

/** Leaves the tree quiet for this visit: told as the footer's switch tells it, so the switch shows it too. */
function ignoreSound() {
  window.dispatchEvent(new CustomEvent(SOUND_KEY, { detail: false }));
  dropHint();
}

/** Drags the window by its title bar, anywhere on the screen. */
function dragHint(event) {
  if (event.button !== 0 || event.target.closest("button")) return;
  const el = hint;
  const bar = event.currentTarget;
  event.preventDefault();
  bar.setPointerCapture(event.pointerId);
  const at = el.getBoundingClientRect();
  const dx = event.clientX - at.left;
  const dy = event.clientY - at.top;
  const move = (e) => {
    if (hint !== el) return;
    hintMoved = true;
    const [x, y] = onScreen(el, e.clientX - dx, e.clientY - dy);
    putHint(x, y);
  };
  const end = () => {
    bar.removeEventListener("pointermove", move);
    bar.removeEventListener("pointerup", end);
    bar.removeEventListener("pointercancel", end);
  };
  bar.addEventListener("pointermove", move);
  bar.addEventListener("pointerup", end);
  bar.addEventListener("pointercancel", end);
}

function offerSound() {
  if (hint) return;
  if (!sound.want || !sound.ac || sound.ac.state === "running") {
    // Nothing to ask: the phone's sign may come.
    tiltReady = true;
    return offerTilt();
  }
  const es = (document.documentElement.lang || "").startsWith("es");
  const t = es
    ? { title: "Decisión", name: "árbol", spell: "ą̨̙͔͙͖̜̟̩̹̗̏̀̐̑̂͞r͇̘̳̀̔̆b͚̟̘͈͖̹̬̙͔̱̾̑̋ͩ͋ͣ̌̍͛͑͐o̸̶̡̩̘̘ͤͬͦ͋̒̏̀̒͛̏ͮl̡͚͍̹̭͓͈̠̇͑̈̍̆ͩ̂ͨ̔̓̓͢͝", wants: "quiere ser escuchado", ignore: "Ignorar", allow: "Permitir", close: "Cerrar" }
    : { title: "Choice", name: "tree", spell: "ț̙̹̹͖͌̒̋̃͋̅̒ͪ̎͑͊̄͗r̶̛̻̜̟̟̫̄̅̑̿̀ͥ̇ͧ̃̉̏e̴̛̮͓͇ͫ̂̿ͮ̓ͦe̷̷̛̗̠̳͙͓̱̝̹̔ͧ͒̃͑", wants: "wants to be heard", ignore: "Ignore", allow: "Allow", close: "Close" };
  hint = document.createElement("div");
  hint.className = "tree-sound-ask";
  hint.setAttribute("role", "dialog");
  hint.setAttribute("aria-label", `${t.name} ${t.wants}`);
  hint.innerHTML =
    `<div class="tree-sound-ask-bar"><span>${t.title}</span>` +
    `<button type="button" class="tree-sound-ask-close" data-act="ignore" aria-label="${t.close}">` +
    '<svg viewBox="0 0 9 9" aria-hidden="true"><path d="M1 1l7 7M8 1L1 8" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>' +
    "</button></div>" +
    // Its name comes through garbled, the way a voice does from far off;
    // a screen reader is given it whole.
    `<p><span aria-hidden="true"><span class="tree-sound-ask-name">${curse(t.spell)}</span> ${t.wants}</span>` +
    `<span class="sr-only">${t.name} ${t.wants}</span></p>` +
    '<div class="tree-sound-ask-buttons">' +
    `<button type="button" data-act="ignore">${t.ignore}</button>` +
    `<button type="button" data-act="allow" class="is-default">${t.allow}</button>` +
    "</div>";
  hint.querySelector(".tree-sound-ask-bar").addEventListener("pointerdown", dragHint);
  hint.addEventListener("click", (event) => {
    const act = event.target.closest("[data-act]");
    if (!act) return;
    if (act.dataset.act === "allow") {
      if (askMotion) askMotion();
      startSound();
      dropHint();
    } else ignoreSound();
  });
  hint.addEventListener("keydown", (event) => {
    if (event.key === "Escape") ignoreSound();
  });
  hintMoved = false;
  (document.getElementById("scroll-wrapper") || document.body).appendChild(hint);
  placeHint();
}

function dropHint() {
  if (!hint) return;
  const el = hint;
  hint = null;
  el.classList.add("is-gone");
  setTimeout(() => el.remove(), 400);
  tiltReady = true;
  offerTilt();
}

// Pressed anywhere else, the page starts the sound all the same (that press is
// what the browser was waiting for), but the window is not just taken away: a
// ghost of the cursor, the same arrow fainter, leaves from where the press
// landed, flies to Allow, turns into the hand over it and presses it, and only
// then does the window go. Where motion is reduced, the window simply goes.
const GHOST = {
  arrow: { hot: [4, 3], d: "M4 3L4 24L9.5 18.5L13 27L16.5 25.5L13 17L20.5 17Z" },
  hand: {
    hot: [12, 4],
    d: "M10.5 5.5A1.5 1.5 0 0 1 13.5 5.5V13A1.5 1.5 0 0 1 16.5 13V14A1.5 1.5 0 0 1 19.5 14V15A1.5 1.5 0 0 1 22.5 15V21C22.5 25 20.5 28 17 28H14C11.5 28 10 26.5 8.5 24.5L5.2 19.6A1.6 1.6 0 0 1 7.8 17.6L10.5 20Z" +
      "M13.5 13V17M16.5 14V17M19.5 15V17",
  },
};
let ghostFrom = null; // where the press that started the sound landed
let ghosting = false;

/** The sound runs: the window is answered, by the ghost if a press elsewhere started it. */
function answerHint() {
  if (!hint || ghosting) return;
  if (!ghostFrom || reduced) return dropHint();
  ghosting = true;
  const [x0, y0] = ghostFrom;
  ghostFrom = null;
  const NS = "http://www.w3.org/2000/svg";
  const ghost = document.createElement("div");
  ghost.className = "tree-sound-ghost";
  ghost.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 32 32");
  const paths = ["ic-halo", "ic-fill", "ic-ink"].map((c) => {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("class", c);
    svg.appendChild(path);
    return path;
  });
  ghost.appendChild(svg);
  const wear = (shape) => {
    for (const path of paths) path.setAttribute("d", shape.d);
    svg.style.left = `${-shape.hot[0]}px`;
    svg.style.top = `${-shape.hot[1]}px`;
    svg.style.transformOrigin = `${shape.hot[0]}px ${shape.hot[1]}px`;
  };
  wear(GHOST.arrow);
  ghost.style.transform = `translate(${x0}px, ${y0}px)`;
  document.body.appendChild(ghost);

  const button = () => hint && hint.querySelector('[data-act="allow"]');
  const target = () => {
    const r = button().getBoundingClientRect();
    return [r.left + r.width * 0.55, r.top + r.height * 0.55];
  };
  const [x1, y1] = target();
  const far = Math.hypot(x1 - x0, y1 - y0);
  const dur = Math.max(650, Math.min(1200, 450 + far * 0.6)); // ms
  // A curve, not a rule: bowed a fifth of the way out, up over the way.
  const bow = 0.2;
  const leave = () => {
    ghost.classList.add("is-gone");
    setTimeout(() => ghost.remove(), 300);
    ghosting = false;
  };
  const t0 = performance.now();
  let hand = false;
  const fly = (now) => {
    if (!button()) return leave(); // answered meanwhile
    const u = Math.min(1, (now - t0) / dur);
    const k = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const [tx, ty] = target(); // the window may be dragged meanwhile
    const side = tx >= x0 ? 1 : -1; // so the bow is always upward
    const cx = (x0 + tx) / 2 + (ty - y0) * bow * side;
    const cy = (y0 + ty) / 2 - (tx - x0) * bow * side;
    const x = (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * cx + k * k * tx;
    const y = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * cy + k * k * ty;
    ghost.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    if (!hand && u > 0.85) {
      hand = true;
      wear(GHOST.hand);
    }
    if (u < 1) return requestAnimationFrame(fly);
    // There: it presses, holds a moment, lets go, and the window goes.
    const b = button();
    ghost.classList.add("press");
    b.classList.add("is-pressed");
    setTimeout(() => {
      ghost.classList.remove("press");
      b.classList.remove("is-pressed");
      setTimeout(() => {
        dropHint();
        leave();
      }, 120);
    }, 160);
  };
  requestAnimationFrame(fly);
}

const FIRST_PRESS = ["pointerdown", "keydown", "touchend"];

/** Where a press landed on the screen, or null for a key. */
function pressedAt(event) {
  const touch = event.changedTouches && event.changedTouches[0];
  if (touch) return [touch.clientX, touch.clientY];
  if (event.type === "keydown" || event.clientX == null) return null;
  return [event.clientX, event.clientY];
}
const middle = () => [document.documentElement.clientWidth / 2, document.documentElement.clientHeight / 2];

/** Any first press on the page is what lets the sound start; once it is running
 * there is nothing left to wait for. Not one on the window that asks for it:
 * that one is answered by its own buttons. Nor one on the page's navigation:
 * a link, or a dropdown (the navbar's About, the language menu), which only
 * opens a menu whose links lead away. Starting the sound there would answer
 * the window before it is seen. */
function onFirstPress(event) {
  if (hint && hint.contains(event.target)) return;
  if (event.target instanceof Element && event.target.closest("a[href], dropdown-trigger")) return;
  // Where the ghost leaves from: where the finger or the pointer came down.
  // A touch's end carries its place in its touches, not on itself, and a key
  // has none: then the place already known stands, or the screen's middle.
  if (hint) ghostFrom = pressedAt(event) || ghostFrom || middle();
  startSound();
  if (sound.ac && sound.ac.state === "running") {
    for (const type of FIRST_PRESS) window.removeEventListener(type, onFirstPress, true);
  }
}

/**
 * Rings a part's note, `strength` from 0 to 1: quiet at its loudest, and a
 * little louder the harder it was struck. A leaf is a small glass bell, a pure
 * tone with partials out of tune with it that die away sooner; wood is rounder
 * and shorter. Each sounds from its own side of the tree.
 */
function ring(p, strength) {
  const ac = sound.ac;
  if (!sound.want || !ac || ac.state !== "running") return;
  // Not while the window still asks: a press elsewhere starts the sound at
  // once (the browser needs that press), but it is heard only once the ghost
  // has pressed Allow and the window has gone.
  if (hint) return;
  const t = ac.currentTime;
  if (t - p.rang < 0.14) return;
  p.rang = t;
  const leaf = p.kind === "leaf";
  const f = (NOTE[p.key] || NOTE.trunk * 4) * Math.pow(2, (Math.random() - 0.5) / 200);
  const vol = (leaf ? 0.035 : 0.05) + (leaf ? 0.07 : 0.06) * Math.min(1, strength);
  const long = leaf ? 1.6 : 1.1;
  let to = sound.bus;
  if (ac.createStereoPanner) {
    const side = ac.createStereoPanner();
    side.pan.value = Math.max(-0.7, Math.min(0.7, ((leaf ? p.cx : p.rx[p.n >> 1]) - 200) / 200));
    side.connect(sound.bus);
    to = side;
  }
  const voice = (mult, level, rise, fall) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.frequency.value = f * mult;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + rise);
    g.gain.exponentialRampToValueAtTime(0.0001, t + rise + fall);
    osc.connect(g).connect(to);
    osc.start(t);
    osc.stop(t + rise + fall + 0.05);
  };
  // Wakes the page to listen (tree-warp.js); it hears the note through the ear.
  window.dispatchEvent(new Event("tree-note"));
  if (leaf) {
    voice(1, vol, 0.012, long);
    voice(2, vol * 0.22, 0.012, long * 0.55);
    voice(2.76, vol * 0.16, 0.006, long * 0.3);
    voice(5.4, vol * 0.05, 0.004, long * 0.14);
  } else {
    // A laptop's speakers give almost nothing below about 150 Hz, where the
    // trunk's D (73 Hz) and the stem's A sit. The lower the note, the more of
    // it goes to its overtones, which they do play: given the series, the ear
    // hears the fundamental the speaker leaves out, and the note keeps its
    // pitch. Only up to the fourth, so the wood stays round, in the low
    // register tree-warp.js listens to it in.
    const low = Math.max(0, Math.min(1, (200 - f) / 130));
    voice(1, vol * (1 + 0.3 * low), 0.02, long);
    voice(2, vol * (0.22 + 0.6 * low), 0.014, long * 0.55);
    voice(3, vol * (0.08 + 0.42 * low), 0.016, long * 0.38);
    if (low > 0) voice(4, vol * 0.22 * low, 0.016, long * 0.24);
  }
}

// A shaken tree rings each part as it swings back, by how far it swung. Only
// a shake counts, not a phone held at a tilt or the breeze: the lean has to
// have changed by STIR within the last RING_FOR seconds, and the swing has to
// be this share of the part's limit.
const STIR = 0.25;
const RING_FOR = 1.6;
const SWING_LEAF = 0.2;
const SWING_WOOD = 0.25;

function chime(dt) {
  device.calm += (device.lean - device.calm) * (1 - Math.exp(-dt / 0.5));
  if (Math.abs(device.lean - device.calm) > STIR) {
    device.stirred = clock;
    // Shaken: the sign has been understood.
    const drop = dropTilt;
    if (drop) {
      dropTilt = null;
      setTimeout(() => drop(), 1200);
    }
  }
  const live = clock - device.stirred < RING_FOR;
  for (const p of parts) {
    if (p.omega * p.went < 0) {
      const swing = Math.abs(p.theta - p.turned) / (2 * p.limit);
      p.turned = p.theta;
      if (live && swing > (p.kind === "leaf" ? SWING_LEAF : SWING_WOOD)) ring(p, swing * 0.6);
    }
    if (p.omega) p.went = p.omega;
  }
}

/* ==========================================================================
   Physics
   ========================================================================== */

/**
 * How much of the pointer's push lands on a point this far from its edge: by
 * contact, and through the air it drags along.
 */
function contact(gap) {
  const g = Math.max(0, gap);
  return Math.exp((-g * g) / (2 * CONTACT * CONTACT));
}

/** How nearly the cursor is touching something this far from its edge. */
function skin(gap) {
  const g = Math.max(0, gap);
  return Math.exp((-g * g) / (2 * SKIN * SKIN));
}

/**
 * How nearly the cursor touched each part on its way from (ax, ay) to
 * (bx, by): the whole run is measured, against the bone of each limb less its
 * thickness and against each leaf's outline, so that neither a twig thinner
 * than the samples along it nor a step longer than a branch is wide is missed.
 */
function feel(ax, ay, bx, by) {
  const far = 3 * SKIN + 40;
  const out =
    Math.max(ax, bx) < -far || Math.min(ax, bx) > 400 + far || Math.max(ay, by) < -far || Math.min(ay, by) > 800 + far;
  for (const l of limbs) {
    let gap = 1e9;
    if (!out) {
      for (let i = 0; i < l.n - 1; i++) {
        const d = runDist(ax, ay, bx, by, l.dx[i], l.dy[i], l.dx[i + 1], l.dy[i + 1]) - 0.5 * (l.half[i] + l.half[i + 1]);
        if (d < gap) gap = d;
      }
    }
    l.touch = gap < 3 * SKIN ? skin(gap) : 0;
  }
  for (const f of leaves) {
    f.touch = 0;
    if (out || segDist(f.nowX, f.nowY, ax, ay, bx, by) > 2.5 * f.radius + 3 * SKIN) continue;
    const x = f.nowRimX;
    const y = f.nowRimY;
    const n = x.length;
    // Ending inside the outline is touching it; otherwise, how near the run came to its edge.
    let inside = false;
    let gap = 1e9;
    for (let k = 0, j = n - 1; k < n; j = k++) {
      if (y[k] > by !== y[j] > by && bx < ((x[j] - x[k]) * (by - y[k])) / (y[j] - y[k]) + x[k]) inside = !inside;
      const d = runDist(ax, ay, bx, by, x[j], y[j], x[k], y[k]);
      if (d < gap) gap = d;
    }
    f.touch = inside ? 1 : gap < 3 * SKIN ? skin(gap) : 0;
  }
}

function wake(gap) {
  const g = Math.max(0, gap);
  return WAKE_SHARE * Math.exp((-g * g) / (2 * WAKE * WAKE));
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
        const k = ((contact(gap) + wake(gap)) * STEP) / CONTACT;
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
    const gap = Math.hypot(f.nowX - qx, f.nowY - qy) - 0.75 * f.radius;
    const w = LEAF_AREA * (contact(gap) + wake(gap));
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
    const aDev = wn * wn * l.limit * 0.5 * device.lean;
    l.acc = aSpring + aBrake + aPush + aWind + aDrag + aDev;
    l.sum[0] += aBrake;
    l.sum[1] += aSpring;
    l.sum[2] += aPush;
    l.sum[3] += aWind + aDev;
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
    const aDev = wn * wn * f.limit * 0.5 * device.lean;
    f.acc = aSpring + aBrake + drive + aWind + aDrag + aDev;
    f.sum[0] += aBrake;
    f.sum[1] += aSpring;
    f.sum[2] += drive;
    f.sum[3] += aWind + aDev;
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
    for (let k = 0; k < f.rimX.length; k++) {
      f.nowRimX[k] = a * f.rimX[k] + cc * f.rimY[k] + e;
      f.nowRimY[k] = b * f.rimX[k] + dd * f.rimY[k] + ff;
    }
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

// The same ink is not equally strong on both grounds: a little light on a
// dark ground reads as more than the same little dark on a light one. In the
// light theme every opacity is lifted along 1 − (1 − a)^LIFT, which matches
// the two themes' perceived contrast (in L*) where the ink is faint and
// leaves full strength alone.
const LIFT = 1.3;
let lift = 1;

function A(x) {
  if (lift === 1) return x;
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), lift);
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
    gr.addColorStop(d / FOCUS_OUT, `rgba(0,0,0,${A(dim(fcx + d, fcy)).toFixed(3)})`);
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
    fr.el.style.opacity = A(o).toFixed(2);
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
  lift = isDark() ? 1 : LIFT;
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
  placeHint();
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
    g.globalAlpha = A(0.3 * l.rv);
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
    g.globalAlpha = A(0.85 * l.rv);
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
  g.globalAlpha = A(a);
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

// Arrowheads as AutoCAD draws them: closed and filled, three times as long
// as they are wide. head() queues one; fillHeads() fills the queue.
const HEADS = [];
function head(x, y, ux, uy, len) {
  const L = len * 1.5, w = L / 6, bx = x - ux * L, by = y - uy * L;
  HEADS.push([x, y, bx - uy * w, by + ux * w, bx + uy * w, by - ux * w]);
}
function fillHeads() {
  g.beginPath();
  for (const t of HEADS) { g.moveTo(t[0], t[1]); g.lineTo(t[2], t[3]); g.lineTo(t[4], t[5]); g.closePath(); }
  HEADS.length = 0;
  g.fill();
}

// A touch screen sets the cotas' values smaller, as the page's do.
const COARSE = matchMedia("(hover: none), (pointer: coarse)").matches;
// CSS millimetres: CSS fixes 1in = 96px, so a millimetre is 96/25.4 px.
// CSS pixels to the millimetre: CSS's 96 to the inch on a desktop; on a
// phone its narrow side over the 65 mm a phone's glass measures across, on a
// tablet an iPad's 132 to the inch (the same guess as page-cotas.js), so a
// length reads about what it measures.
const MM = (() => {
  if (!COARSE) return 96 / 25.4;
  const short = Math.min(screen.width, screen.height);
  return short > 0 && short <= 480 ? short / 65 : 132 / 25.4;
})();
/** A length in CSS px, in millimetres as seen on the screen. */
const mm = (px) => {
  const v = px / MM;
  return `${v < 100 ? v.toFixed(1) : Math.round(v)} mm`;
};

/** A value written along a direction, kept upright. */
function label(text, x, y, ang, u) {
  if (Math.cos(ang) < 0) ang += Math.PI;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.font = `300 ${(COARSE ? 12 : 13) * u}px "Barlow Condensed", sans-serif`;
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
  g.globalAlpha = A(a * 0.85);
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
  fillHeads();
  const m = Math.round(n / 2);
  const mo = off(m) + 9 * u;
  const ta = Math.atan2(l.dy[m + 1] - l.dy[m - 1], l.dx[m + 1] - l.dx[m - 1]);
  label(mm(l.len * sc), l.dx[m] - cnx[m] * mo, l.dy[m] - cny[m] * mo, ta, u);
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
  g.globalAlpha = A(a * 0.75);
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
  g.globalAlpha = A(a * 0.16);
  g.fill();
  g.beginPath();
  g.moveTo(ghx[0], ghy[0]);
  for (let i = 1; i < n; i++) g.lineTo(ghx[i], ghy[i]);
  g.globalAlpha = A(a * 0.5);
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
    g.globalAlpha = A(a * (own ? 0.8 : 0.5));
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
  // A rule along the bone, graduated in CSS millimetres as drawn on screen:
  // a mark every millimetre, a longer one every five.
  g.globalAlpha = A(a * 0.7);
  g.lineWidth = 0.7 * u;
  g.beginPath();
  const step = MM * u; // one millimetre, in tree units
  let run = 0, k = 1;
  for (let i = 1; i < n; i++) {
    const seg = Math.hypot(l.dx[i] - l.dx[i - 1], l.dy[i] - l.dy[i - 1]);
    while (k * step <= run + seg) {
      const f = (k * step - run) / (seg || 1);
      const x = l.dx[i - 1] + (l.dx[i] - l.dx[i - 1]) * f;
      const y = l.dy[i - 1] + (l.dy[i] - l.dy[i - 1]) * f;
      const nx = cnx[i - 1] + (cnx[i] - cnx[i - 1]) * f;
      const ny = cny[i - 1] + (cny[i] - cny[i - 1]) * f;
      const w = (1.7 - 1.15 * ((i - 1 + f) / (n - 1))) * u;
      const len = (k % 5 === 0 ? 6 : 2.8) * u;
      g.moveTo(x + nx * (w + u), y + ny * (w + u));
      g.lineTo(x + nx * (w + u + len), y + ny * (w + u + len));
      k++;
    }
    run += seg;
  }
  g.stroke();

  ink("bone");
  // The bone itself, a stroke that thins towards its tip.
  g.globalAlpha = A(a);
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
  g.globalAlpha = A(a);
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
  g.globalAlpha = A(a * 0.9);
  g.lineWidth = 1.1 * u;
  g.stroke(f.edge);
  g.restore();

  ink("angle");
  // A protractor about the pivot, a mark every five degrees, and the turn so far.
  g.beginPath();
  g.moveTo(f.pivX, f.pivY);
  g.arc(f.pivX, f.pivY, rad, a0, a1, f.ang < 0);
  g.closePath();
  g.globalAlpha = A(a * 0.18);
  g.fill();
  g.globalAlpha = A(a * 0.75);
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
  g.globalAlpha = A(a);
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
  g.globalAlpha = A(a);
  g.beginPath();
  g.arc(f.pivX, f.pivY, 2.2 * u, 0, TAU);
  g.fill();
}

/** The pointer's push and its wake, and its velocity on a rule from k0 to k1. */
function drawAir(u) {
  if (airA < 0.01) return;
  ink("circle");
  g.lineWidth = (0.8 + 1.2 * tNow) * u;
  g.globalAlpha = A(airA * (0.4 + 0.5 * tNow));
  g.beginPath();
  g.arc(pointer.x, pointer.y, CONTACT, 0, TAU);
  g.stroke();
  g.lineWidth = 0.7 * u;
  g.globalAlpha = A(airA * 0.3);
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
    g.globalAlpha = A(airA * curAl * 0.55);
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
    g.globalAlpha = A(airA * curAl);
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
  g.globalAlpha = A(leverA * 0.7);
  g.lineWidth = 0.8 * u;
  g.beginPath();
  g.moveTo(bx, by);
  g.lineTo(cx, cy);
  g.stroke();
  g.globalAlpha = A(leverA);
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
  // Only a cursor the page draws can be held back: the system's own is
  // wherever the hand is.
  const held = pointer.mouse && window.__inkCursor && window.__inkCursor.on;
  let hx = pointer.fromX;
  let hy = pointer.fromY;
  for (let i = 0; i < steps; i++) {
    const u = (i + 1) / steps;
    clock += H;
    const toX = pointer.fromX + (pointer.hx - pointer.fromX) * u;
    const toY = pointer.fromY + (pointer.hy - pointer.fromY) * u;
    step(
      clock,
      toX - pointer.lagX,
      toY - pointer.lagY,
      pointer.vx * kWood,
      pointer.vy * kWood,
      pointer.vx * kLeaf,
      pointer.vy * kLeaf
    );
    // What it touches drags on the cursor: by how fast the hand is going, and
    // by how much of each part has not yet given way. A share of its speed
    // lost is that share over what is kept, as drag.
    let drag = 0;
    if (held) {
      feel(hx - pointer.lagX, hy - pointer.lagY, toX - pointer.lagX, toY - pointer.lagY);
      for (const l of limbs) drag += l.touch * along(FADE, l.worn);
      for (const f of leaves) drag += LEAF_BRAKE * f.touch * along(FADE, f.worn);
      const lost = Math.max(0, Math.min(0.98, along(BRAKE, speed)));
      drag = Math.max(0, drag) * (lost / (1 - lost));
    }
    const moved = trail(toX - hx, toY - hy, BRAKE_CURSOR ? drag : 0);
    // A part wears by how far the cursor has moved through it, and mends.
    for (const p of parts) {
      p.worn = (p.worn + p.touch * moved) * Math.exp(-H / MEND);
      if (!held) p.touch = 0;
      // Its note, on first being touched, by the share of its speed the cursor loses.
      const on = p.touch > 0.5;
      if (on && !p.met && drag > 0.02) ring(p, drag / (1 + drag));
      p.met = on;
    }
    hx = toX;
    hy = toY;
  }
  chime(dt);
  pointer.fromX = pointer.hx;
  pointer.fromY = pointer.hy;
  pointer.x = pointer.hx - pointer.lagX;
  pointer.y = pointer.hy - pointer.lagY;
  hold();

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
  letGo();
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
  if (COARSE) listenMotion();
  else setTimeout(offerSound, HINT_AFTER);
  // Where the browser already lets this page play (it was pressed on the way
  // here from another page of the site, or its visitor allows it sound), the
  // tree is heard at once. Everywhere else it waits for the first press.
  startSound();
  for (const type of FIRST_PRESS) window.addEventListener(type, onFirstPress, { capture: true, passive: true });
  window.addEventListener(SOUND_KEY, (event) => setSound(!!event.detail));
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
  // The system's mode changing, or the page being given one: the ink is read
  // again and the plate drawn in it at once, since at rest nothing else would.
  onThemeChange(() => {
    readTheme();
    drawPlate();
  });
  // The formulas' faces arrive after the first layout; measure them again.
  if (document.fonts) {
    // The cotas' face is used only on the canvas, so ask for it outright.
    document.fonts.load(`300 13px "Barlow Condensed"`).catch(() => {});
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
