/**
 * Procedural generator for the site's tree illustration.
 *
 * It reproduces the *language* of the original hand-drawn tree (the one baked
 * into public/tree.lottie) rather than any single instance of it. The rules
 * that actually define the look:
 *
 *   - The skeleton is polygonal, not a smooth arc: each branch is a chain of
 *     nearly straight segments meeting at visible elbows.
 *   - Those elbows are the event points. Some sprout a child branch, some grow
 *     a petal, some do neither — never all of them, and that irregularity is
 *     most of the character.
 *   - Branches never overlap each other. Candidates that would cross or crowd
 *     an existing limb are rejected, which is also what keeps the tree sparse.
 *   - Branches are filled tapered ribbons, not strokes, each narrowing to a
 *     point at its tip; the trunk flares at the base and bleeds off-frame.
 *   - Petals are fat asymmetric blobs: two cubic segments between two sharp
 *     tips, the sharp one planted on the elbow, the body swinging out to the
 *     convex side of the turn.
 *   - Colour is two shared vertical ramps, amber -> teal: one across the whole
 *     tree, one across just the petal cluster. That second ramp is why the low
 *     petals read green while only the crown goes amber.
 *
 * Everything is driven by a seeded PRNG: the same seed always yields the same
 * tree, so a generated tree can be pinned once it is worth keeping.
 */

// ---------------------------------------------------------------------------
// randomness
// ---------------------------------------------------------------------------

export type Rng = () => number;

/** Small, fast, well-distributed seeded PRNG. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turns any string into a seed, so seeds can be readable words. */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// options
// ---------------------------------------------------------------------------

export interface TreeOptions {
  /** Number, or a string that gets hashed into one. Same seed = same tree. */
  seed?: number | string;
  width?: number;
  height?: number;
  /** Gradient stops, top colour first. */
  colors?: [string, string];
  /**
   * "art" reproduces the source: branches share one ramp over the whole tree,
   * petals share a second ramp over just the petal cluster. "tree" is a single
   * ramp for everything; "shape" gives every path its own ramp.
   */
  gradient?: "art" | "tree" | "shape";
  /** Padding in viewport units. The trunk base always bleeds off the bottom. */
  padding?: number;
  /** Elbows per branch chain — the polygonal joints where things can happen. */
  joints?: [number, number];
  /** Chance an elbow sprouts a child branch. */
  branchChance?: number;
  /** Chance an elbow grows a petal. */
  petalChance?: number;
  /** Nesting depth. 2 keeps the sparse, minimal feel of the original. */
  maxDepth?: number;
  /** Grow one oversized petal off the top of the trunk. */
  crown?: boolean;
}

interface Config {
  rng: Rng;
  width: number;
  height: number;
  colors: [string, string];
  gradient: "art" | "tree" | "shape";
  padding: number;
  joints: [number, number];
  branchChance: number;
  petalChance: number;
  maxDepth: number;
  crown: boolean;
}

// Growth constants, tuned against the original artwork. Deliberately not part
// of the public options — they are what makes it *this* tree and not a fractal.
const TRUNK_LENGTH = 480;
const TRUNK_WIDTH = 0.062 * TRUNK_LENGTH;
const ROOT_FLARE = 1.25; // extra width multiplier right at the base
const FLARE_FALLOFF = 0.06; // as a fraction of trunk length
const SAMPLES_PER_SEGMENT = 5; // straightness of each segment between elbows
const SEGMENT_BOW = 0.16; // how much a segment bows between its elbows, in rad
const ELBOW = [0.22, 0.62] as const; // how hard the skeleton kinks at a joint
const UPRIGHT = 0.8; // odds an elbow turns back towards vertical
const RECOVERY = 0.9; // how much of its lean a branch sheds at every elbow
const CLEARANCE = 5; // extra gap enforced between branches, in model units
const PLACEMENT_TRIES = 12;
/** Cone around vertical a branch may wander in, by depth. */
const CONE = [0.34, 1.0, 1.25] as const;
/** Joints thinner than this fraction of the trunk cannot carry a child. */
const MIN_SPROUT_WIDTH = 0.22;
/** How far apart petal discs must stay, as a fraction of their radii sum. */
const PETAL_SPACING = 0.78;
/** Floor on branch width relative to its length, so no limb reads as a wire. */
const MIN_ASPECT = 0.038;
/** A trunk with fewer limbs than this gets a second chance at its spare elbows. */
const MIN_LIMBS = 2;
const MIN_PETALS = 4;
const MAX_PETALS = 10;

// ---------------------------------------------------------------------------
// geometry helpers
// ---------------------------------------------------------------------------

interface Vec {
  x: number;
  y: number;
}

interface Branch {
  spine: Vec[];
  widths: number[];
  /** Indices into `spine` that are elbows, and so must stay creased. */
  corners: number[];
  depth: number;
}

interface Joint {
  pos: Vec;
  /** Direction of travel arriving at and leaving the elbow, radians from up. */
  dirIn: number;
  dirOut: number;
  width: number;
  depth: number;
  /** Length still available to whatever grows here. */
  budget: number;
  /** What has already been planted here, so later passes don't double up. */
  hasBranch: boolean;
  hasPetal: boolean;
}

interface Petal {
  at: Vec;
  angle: number;
  length: number;
  mirror: number;
  fat: number;
}

const rand = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
const randInt = (rng: Rng, min: number, max: number) =>
  Math.floor(rand(rng, min, max + 1 - 1e-9));
const round = (n: number) => Math.round(n * 100) / 100;

/** Width along a branch: stays solid for most of its run, then points sharply. */
function widthAt(base: number, t: number): number {
  return base * Math.pow(1 - Math.pow(t, 1.8), 0.62);
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Squared distance from point p to segment ab. */
function distSqToSegment(p: Vec, a: Vec, b: Vec): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;
  const len = vx * vx + vy * vy;
  let t = len > 0 ? (wx * vx + wy * vy) / len : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = wx - vx * t;
  const dy = wy - vy * t;
  return dx * dx + dy * dy;
}

// ---------------------------------------------------------------------------
// skeleton
// ---------------------------------------------------------------------------

interface World {
  cfg: Config;
  branches: Branch[];
  petals: Petal[];
  /** Every elbow the tree grew, kept for the second petal pass. */
  joints: Joint[];
}

/**
 * Walks one polygonal branch: a chain of nearly straight segments meeting at
 * elbows. Returns the branch plus the elbows, which are the only places where
 * children and petals are allowed to appear.
 */
function traceBranch(
  cfg: Config,
  start: Vec,
  angle: number,
  length: number,
  baseWidth: number,
  depth: number
): { branch: Branch; joints: Joint[] } {
  const rng = cfg.rng;
  const jointCount = Math.max(
    1,
    randInt(rng, cfg.joints[0], cfg.joints[1]) - depth
  );

  // Segments get shorter towards the tip, so elbows crowd near the top the way
  // they do in the original.
  const weights: number[] = [];
  for (let i = 0; i < jointCount + 1; i++) weights.push(rand(rng, 0.6, 1.4) * (1 - i * 0.12));
  const total = weights.reduce((a, b) => a + b, 0);

  const spine: Vec[] = [{ ...start }];
  const widths: number[] = [widthAt(baseWidth, 0)];
  const corners: number[] = [];
  const joints: Joint[] = [];

  let p = { ...start };
  let a = angle;
  let travelled = 0;

  for (let s = 0; s < weights.length; s++) {
    const segLen = (weights[s] / total) * length;
    // Each segment bows a little, so the straights are not mechanical.
    const bow = rand(rng, -1, 1) * SEGMENT_BOW;
    const dirIn = a;

    for (let i = 1; i <= SAMPLES_PER_SEGMENT; i++) {
      a += bow / SAMPLES_PER_SEGMENT;
      const ds = segLen / SAMPLES_PER_SEGMENT;
      p = { x: p.x + Math.sin(a) * ds, y: p.y - Math.cos(a) * ds };
      travelled += ds;
      spine.push(p);
      widths.push(widthAt(baseWidth, travelled / length));
    }

    const isLast = s === weights.length - 1;
    if (isLast) break;

    // The elbow: a decisive kink, biased back towards vertical and clamped to
    // a cone, so the tree zigzags upright instead of wandering off sideways.
    const dirBefore = a;
    const mag = rand(rng, ELBOW[0], ELBOW[1]);
    const towardsUp = a > 0 ? -1 : 1;
    const sign = rng() < UPRIGHT ? towardsUp : -towardsUp;
    const cone = Math.max(Math.abs(angle), CONE[Math.min(depth, CONE.length - 1)]);
    a = clamp(a * RECOVERY + mag * sign, -cone, cone);

    const idx = spine.length - 1;
    corners.push(idx);
    joints.push({
      pos: spine[idx],
      dirIn: dirBefore,
      dirOut: a,
      width: widths[idx],
      depth,
      budget: length - travelled,
      hasBranch: false,
      hasPetal: false,
    });
  }

  // The tip is a joint too — it is where crowns and end petals hang.
  const tipIdx = spine.length - 1;
  joints.push({
    pos: spine[tipIdx],
    dirIn: a,
    dirOut: a,
    width: 0,
    depth,
    budget: 0,
    hasBranch: false,
    hasPetal: false,
  });

  return { branch: { spine, widths, corners, depth }, joints };
}

/**
 * True if a candidate spine crowds any branch already in the world.
 *
 * Samples inside `exempt` of the joint the candidate grows from are ignored:
 * right at the fork a child is *supposed* to be touching its parent, and
 * testing there would reject every branch the tree ever tries to make.
 */
function collides(
  world: World,
  spine: Vec[],
  widths: number[],
  origin: Vec,
  exempt: number
): boolean {
  const exemptSq = exempt * exempt;
  for (let i = 0; i < spine.length; i++) {
    const p = spine[i];
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    if (dx * dx + dy * dy < exemptSq) continue;

    const r = widths[i] / 2 + CLEARANCE;
    for (const other of world.branches) {
      for (let j = 0; j < other.spine.length - 1; j++) {
        const clear = r + Math.max(other.widths[j], other.widths[j + 1]) / 2;
        if (distSqToSegment(p, other.spine[j], other.spine[j + 1]) < clear * clear) {
          return true;
        }
      }
    }
  }
  return false;
}

/** Rough disc a petal occupies: it hangs off its sharp tip, so it sits forward. */
function petalDisc(p: Petal): { x: number; y: number; r: number } {
  return {
    x: p.at.x + Math.cos(p.angle) * p.length * 0.55,
    y: p.at.y + Math.sin(p.angle) * p.length * 0.55,
    r: p.length * 0.5,
  };
}

/** True if a candidate petal would pile onto one already placed. */
function crowded(placed: Petal[], candidate: Petal): boolean {
  const c = petalDisc(candidate);
  for (const other of placed) {
    const o = petalDisc(other);
    const min = (c.r + o.r) * PETAL_SPACING;
    if ((c.x - o.x) ** 2 + (c.y - o.y) ** 2 < min * min) return true;
  }
  return false;
}

/** Direction pointing out of the convex side of an elbow. */
function outwardAngle(joint: Joint): number {
  const bend = joint.dirOut - joint.dirIn;
  // Bisector between the reversed incoming leg and the outgoing leg. For a
  // straight-through joint (a tip) that degenerates, so fall back to a
  // perpendicular kick.
  if (Math.abs(bend) < 1e-3) return joint.dirOut;
  return joint.dirIn + bend / 2 + (bend > 0 ? -Math.PI / 2 : Math.PI / 2);
}

/**
 * Grows a branch, then walks its elbows rolling for a child branch and/or a
 * petal at each one. Children that would crowd an existing limb are dropped.
 *
 * The candidate a child is tested with is the exact one that gets planted —
 * re-tracing after the test would draw a branch nobody checked.
 */
function grow(
  world: World,
  start: Vec,
  angle: number,
  length: number,
  baseWidth: number,
  depth: number
): void {
  const traced = traceBranch(world.cfg, start, angle, length, baseWidth, depth);
  world.branches.push(traced.branch);
  populate(world, traced.joints, length, depth);
}

/** Rolls the events at each elbow of a branch that is already planted. */
function populate(world: World, joints: Joint[], length: number, depth: number): void {
  const cfg = world.cfg;
  const rng = cfg.rng;
  world.joints.push(...joints);

  for (let i = 0; i < joints.length; i++) {
    const joint = joints[i];
    const isTip = i === joints.length - 1;

    // --- child branch -----------------------------------------------------
    // Sub-branches are rarer than trunk branches, which is what keeps the
    // silhouette a sapling instead of a shrub.
    const wants = rng() < cfg.branchChance * (depth === 0 ? 1 : 0.45);
    const sprouted = !isTip && wants && trySprout(world, joint, length, depth);
    joint.hasBranch = sprouted;

    // --- petal ------------------------------------------------------------
    // Tips are terminal — nothing sprouts from them — so they always get a
    // petal. Interior elbows are the ones that roll for it.
    const crown = isTip && depth === 0 && cfg.crown;
    const chance = isTip ? 1 : cfg.petalChance * (sprouted ? 0.3 : 1);
    if (rng() < chance) joint.hasPetal = tryPetal(world, joint, crown, isTip);
  }
}

/**
 * Tries to sprout a child branch from an elbow, re-aiming it until it finds a
 * gap. Returns false if every attempt would have crowded an existing limb —
 * that rejection is most of what keeps the tree readable.
 */
function trySprout(world: World, joint: Joint, length: number, depth: number): boolean {
  const cfg = world.cfg;
  const rng = cfg.rng;

  if (depth >= cfg.maxDepth) return false;
  if (joint.width <= TRUNK_WIDTH * MIN_SPROUT_WIDTH) return false;

  const childLength = Math.max(length * 0.28, joint.budget * rand(rng, 0.6, 1.0));
  // A branch thin enough to read as a wire is worse than no branch, so width
  // has a floor tied to how far the branch travels.
  const childWidth = Math.min(
    joint.width * 0.85,
    Math.max(joint.width * rand(rng, 0.55, 0.78), childLength * MIN_ASPECT)
  );
  const exempt = joint.width * 2.2 + CLEARANCE * 2;

  // Prefer the side the parent is not turning into: that is where there is
  // room, and it keeps limbs from folding back over the trunk.
  const bend = joint.dirOut - joint.dirIn;
  let side = bend > 0 ? -1 : 1;

  for (let attempt = 0; attempt < PLACEMENT_TRIES; attempt++) {
    const spread = rand(rng, 0.42, 1.0) + attempt * 0.06;
    const len = childLength * (1 - attempt * 0.04);
    const dir = joint.dirOut + side * spread;
    const probe = traceBranch(cfg, joint.pos, dir, len, childWidth, depth + 1);
    if (!collides(world, probe.branch.spine, probe.branch.widths, joint.pos, exempt)) {
      world.branches.push(probe.branch);
      joint.hasBranch = true;
      populate(world, probe.joints, len, depth + 1);
      return true;
    }
    if (attempt % 3 === 2) side *= -1;
  }
  return false;
}

/**
 * Plants a petal on an elbow if there is room for it. Petals in the original
 * touch but never pile up, so crowded candidates are simply dropped — except
 * the crown, which always gets its spot.
 */
function tryPetal(world: World, joint: Joint, crown: boolean, insist = false): boolean {
  const rng = world.cfg.rng;
  if (world.petals.length >= MAX_PETALS) return false;

  const petal: Petal = {
    at: { ...joint.pos },
    // Angles here are measured from up; SVG angles from +x, hence the turn.
    angle: outwardAngle(joint) - Math.PI / 2 + rand(rng, -0.35, 0.35),
    length: TRUNK_LENGTH * (crown ? rand(rng, 0.18, 0.24) : rand(rng, 0.09, 0.16)),
    mirror: rng() < 0.5 ? -1 : 1,
    fat: rand(rng, 0.5, 0.82),
  };

  if (!crown && crowded(world.petals, petal)) {
    // A branch tip has to carry something — a bare tapering wire is the one
    // thing the original never does. Shrink it until it fits, and if it still
    // does not, take the overlap over the wire.
    if (!insist) return false;
    for (const shrink of [0.72, 0.5]) {
      petal.length *= shrink;
      if (!crowded(world.petals, petal)) break;
    }
  }

  world.petals.push(petal);
  joint.hasPetal = true;
  return true;
}

// ---------------------------------------------------------------------------
// ribbon outline
// ---------------------------------------------------------------------------

/**
 * Mitred perpendicular offset of the spine. Mitring matters here: a plain
 * per-point normal notches the outside of every elbow, and elbows are the
 * whole point of this shape.
 */
function offsetSide(spine: Vec[], widths: number[], sign: number): Vec[] {
  const out: Vec[] = [];
  const n = spine.length;

  const normalAt = (i: number, j: number): Vec => {
    const dx = spine[j].x - spine[i].x;
    const dy = spine[j].y - spine[i].y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: (dy / len) * sign, y: (-dx / len) * sign };
  };

  for (let i = 0; i < n; i++) {
    const nPrev = i > 0 ? normalAt(i - 1, i) : normalAt(0, 1);
    const nNext = i < n - 1 ? normalAt(i, i + 1) : normalAt(n - 2, n - 1);
    let mx = nPrev.x + nNext.x;
    let my = nPrev.y + nNext.y;
    const len = Math.hypot(mx, my) || 1;
    mx /= len;
    my /= len;
    const cos = mx * nPrev.x + my * nPrev.y;
    const miter = Math.min(2.5, 1 / Math.max(0.4, cos));
    const h = (widths[i] / 2) * miter;
    out.push({ x: spine[i].x + mx * h, y: spine[i].y + my * h });
  }
  return out;
}

/**
 * Catmull-Rom through an open chain, emitted as cubics. Indices in `creases`
 * get one-sided tangents so the elbow survives as a visible corner instead of
 * being smoothed into an arc.
 */
function chainToCubics(
  pts: Vec[],
  out: number[][],
  creases: Set<number> = new Set(),
  tension = 0.85
): void {
  const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p0 = creases.has(i) ? p1 : at(i - 1);
    const p3 = creases.has(i + 1) ? p2 : at(i + 2);
    out.push([
      p1.x,
      p1.y,
      p1.x + ((p2.x - p0.x) / 6) * tension,
      p1.y + ((p2.y - p0.y) / 6) * tension,
      p2.x - ((p3.x - p1.x) / 6) * tension,
      p2.y - ((p3.y - p1.y) / 6) * tension,
      p2.x,
      p2.y,
    ]);
  }
}

/** One branch as a closed, pointed, tapered outline. */
function branchCubics(branch: Branch): number[][] {
  const n = branch.spine.length;
  const left = offsetSide(branch.spine, branch.widths, 1).slice(0, n - 1);
  const right = offsetSide(branch.spine, branch.widths, -1).slice(0, n - 1);
  const apex = branch.spine[n - 1];

  const creases = new Set(branch.corners);
  const mirrored = new Set<number>();
  // The right side is walked backwards, so crease indices have to be flipped.
  for (const c of branch.corners) mirrored.add(right.length - 1 - c + 1);

  const cubics: number[][] = [];
  chainToCubics([...left, apex], cubics, creases);
  chainToCubics([apex, ...right.reverse()], cubics, mirrored);
  return cubics;
}

// ---------------------------------------------------------------------------
// petals
// ---------------------------------------------------------------------------

/**
 * The blob primitive: two cubic segments running between two sharp tips. The
 * control-point ranges below were measured off the six blobs in the original
 * artwork, in a frame where the chord from tip to tip is the x axis, length 1.
 *
 * The overshooting control on the return side (t > 1) is what gives these
 * shapes their little hook near the far tip.
 */
function petalCubics(p: Petal, rng: Rng): number[][] {
  const L = p.length;
  const m = p.mirror;
  const f = p.fat;

  // The far tip is a cusp — both tangents leave it the same way — so the
  // overshoot has to stay under the bulge that pays for it, or the cusp
  // stretches into a needle instead of a hook.
  const hook = f * rand(rng, 0.8, 1.05);
  const overshoot = Math.min(rand(rng, 0.1, 0.35), hook * 0.55);

  const local: [number, number][][] = [
    [
      [rand(rng, 0.18, 0.4), m * rand(rng, -0.3, 0.1)],
      [rand(rng, 0.58, 0.75), m * -f * rand(rng, 0.85, 1.1)],
      [1, 0],
    ],
    [
      [1 + overshoot, m * hook],
      [rand(rng, 0.4, 0.6), m * f * rand(rng, 0.5, 1.05)],
      [0, 0],
    ],
  ];

  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  const to = (u: number, v: number): [number, number] => [
    p.at.x + (u * L * cos - v * L * sin),
    p.at.y + (u * L * sin + v * L * cos),
  ];

  const cubics: number[][] = [];
  let cursor: [number, number] = [p.at.x, p.at.y];
  for (const seg of local) {
    const c1 = to(seg[0][0], seg[0][1]);
    const c2 = to(seg[1][0], seg[1][1]);
    const end = to(seg[2][0], seg[2][1]);
    cubics.push([cursor[0], cursor[1], c1[0], c1[1], c2[0], c2[1], end[0], end[1]]);
    cursor = end;
  }
  return cubics;
}

// ---------------------------------------------------------------------------
// paths and bounds
// ---------------------------------------------------------------------------

function cubicsToPath(cubics: number[][]): string {
  if (!cubics.length) return "";
  let d = `M${round(cubics[0][0])},${round(cubics[0][1])}`;
  for (const c of cubics) {
    d += `C${round(c[2])},${round(c[3])} ${round(c[4])},${round(c[5])} ${round(c[6])},${round(c[7])}`;
  }
  return d + "Z";
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const emptyBounds = (): Bounds => ({
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
});

/** Samples the curves themselves, so far-flung control points don't inflate it. */
function boundsOf(cubics: number[][], into: Bounds = emptyBounds()): Bounds {
  const SAMPLES = 12;
  for (const c of cubics) {
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const mt = 1 - t;
      const a = mt * mt * mt;
      const b = 3 * mt * mt * t;
      const d = 3 * mt * t * t;
      const e = t * t * t;
      const x = a * c[0] + b * c[2] + d * c[4] + e * c[6];
      const y = a * c[1] + b * c[3] + d * c[5] + e * c[7];
      if (x < into.minX) into.minX = x;
      if (y < into.minY) into.minY = y;
      if (x > into.maxX) into.maxX = x;
      if (y > into.maxY) into.maxY = y;
    }
  }
  return into;
}

const mergeBounds = (into: Bounds, b: Bounds): Bounds => {
  into.minX = Math.min(into.minX, b.minX);
  into.minY = Math.min(into.minY, b.minY);
  into.maxX = Math.max(into.maxX, b.maxX);
  into.maxY = Math.max(into.maxY, b.maxY);
  return into;
};

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

export interface TreeShape {
  kind: "branch" | "petal";
  d: string;
  bounds: Bounds;
}

export interface GeneratedTree {
  svg: string;
  /** Path data in final viewport coordinates, for other renderers. */
  shapes: TreeShape[];
  seed: number;
  width: number;
  height: number;
}

export function generateTree(options: TreeOptions = {}): GeneratedTree {
  const seed =
    typeof options.seed === "string"
      ? hashSeed(options.seed)
      : options.seed ?? Math.floor(Math.random() * 4294967296);

  const cfg: Config = {
    rng: mulberry32(seed),
    width: options.width ?? 400,
    height: options.height ?? 800,
    colors: options.colors ?? ["rgb(255,176,0)", "rgb(102,198,169)"],
    gradient: options.gradient ?? "art",
    padding: options.padding ?? 20,
    joints: options.joints ?? [3, 4],
    branchChance: options.branchChance ?? 0.7,
    petalChance: options.petalChance ?? 0.45,
    maxDepth: options.maxDepth ?? 2,
    crown: options.crown ?? true,
  };
  const rng = cfg.rng;

  const world: World = { cfg, branches: [], petals: [], joints: [] };
  grow(world, { x: 0, y: 0 }, rand(rng, -0.1, 0.1), TRUNK_LENGTH, TRUNK_WIDTH, 0);

  // A tree that rolled badly can come out a bare stick. Give the spare elbows
  // a second chance — limbs first, then petals — before settling for it.
  if (world.branches.length <= MIN_LIMBS) {
    const spare = world.joints.filter((j) => j.depth === 0 && !j.hasBranch && !j.hasPetal);
    for (const joint of spare) {
      if (world.branches.length > MIN_LIMBS) break;
      trySprout(world, joint, TRUNK_LENGTH, 0);
    }
  }

  if (world.petals.length < MIN_PETALS) {
    const spare = world.joints
      .filter((j) => !j.hasPetal)
      .sort((a, b) => a.pos.y - b.pos.y);
    for (const joint of spare) {
      if (world.petals.length >= MIN_PETALS) break;
      tryPetal(world, joint, false);
    }
  }

  // --- flare the trunk base ----------------------------------------------
  // Done after growth so the flare never feeds into widths children inherit.
  const trunk = world.branches[0];
  let run = 0;
  for (let i = 0; i < trunk.spine.length; i++) {
    if (i > 0) run += Math.hypot(
      trunk.spine[i].x - trunk.spine[i - 1].x,
      trunk.spine[i].y - trunk.spine[i - 1].y
    );
    trunk.widths[i] *= 1 + ROOT_FLARE * Math.exp(-run / (TRUNK_LENGTH * FLARE_FALLOFF));
  }

  // --- collect shapes in model space --------------------------------------
  const model: { kind: "branch" | "petal"; cubics: number[][] }[] = [];
  for (const b of world.branches) model.push({ kind: "branch", cubics: branchCubics(b) });
  for (const p of world.petals) model.push({ kind: "petal", cubics: petalCubics(p, rng) });

  const all = emptyBounds();
  for (const s of model) boundsOf(s.cubics, all);

  // --- fit to viewport ----------------------------------------------------
  // The trunk base bleeds off the bottom edge, like the source art, so the
  // tree grows out of the frame instead of standing on a visible stump.
  const pad = cfg.padding;
  const modelW = all.maxX - all.minX || 1;
  const modelH = all.maxY - all.minY || 1;
  const k = Math.min((cfg.width - pad * 2) / modelW, (cfg.height - pad) / modelH);
  const tx = (cfg.width - modelW * k) / 2 - all.minX * k;
  const ty = pad - all.minY * k;

  const shapes: TreeShape[] = model.map((s) => {
    const placed = s.cubics.map((c) =>
      c.map((v, i) => (i % 2 === 0 ? v * k + tx : v * k + ty))
    );
    return { kind: s.kind, d: cubicsToPath(placed), bounds: boundsOf(placed) };
  });

  // --- gradients ----------------------------------------------------------
  const treeBounds = emptyBounds();
  const petalBounds = emptyBounds();
  for (const s of shapes) {
    mergeBounds(treeBounds, s.bounds);
    if (s.kind === "petal") mergeBounds(petalBounds, s.bounds);
  }

  const uid = seed.toString(36);
  const defs: string[] = [];
  const body: string[] = [];
  const ramps = new Map<string, string>();

  const rampFor = (y1: number, y2: number): string => {
    const key = `${round(y1)}:${round(y2)}`;
    let id = ramps.get(key);
    if (!id) {
      id = `t${uid}-${ramps.size}`;
      ramps.set(key, id);
      defs.push(
        `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${round(y1)}" x2="0" y2="${round(y2)}">` +
          `<stop offset="0%" stop-color="${cfg.colors[0]}"/>` +
          `<stop offset="100%" stop-color="${cfg.colors[1]}"/>` +
          `</linearGradient>`
      );
    }
    return id;
  };

  for (const shape of shapes) {
    let y1: number;
    let y2: number;
    if (cfg.gradient === "shape") {
      y1 = shape.bounds.minY;
      y2 = shape.bounds.maxY;
    } else if (cfg.gradient === "tree" || shape.kind === "branch") {
      y1 = treeBounds.minY;
      y2 = treeBounds.maxY;
    } else {
      y1 = petalBounds.minY;
      y2 = petalBounds.maxY;
    }
    body.push(`<path fill="url(#${rampFor(y1, y2)})" d="${shape.d}"/>`);
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cfg.width} ${cfg.height}" ` +
    `width="${cfg.width}" height="${cfg.height}" preserveAspectRatio="xMidYMid meet" role="img">` +
    `<defs>${defs.join("")}</defs>${body.join("")}</svg>`;

  return { svg, shapes, seed, width: cfg.width, height: cfg.height };
}

export default generateTree;
