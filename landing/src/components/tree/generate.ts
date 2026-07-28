/**
 * Procedural generator for the site's tree illustration.
 *
 * It reproduces the *language* of the original hand-drawn tree (the one baked
 * into public/tree.lottie) rather than any single instance of it. The rules
 * that actually define the look:
 *
 *   - A branch is a chain of bowed bezier runs meeting at visible elbows. The
 *     runs curve; the elbows crease. Straight segments between kinks read
 *     mechanical, which is the tell that separates a generated tree from a
 *     drawn one.
 *   - Those elbows are the event points. Some sprout a child branch, some grow
 *     a petal, some do neither — never all of them, and that irregularity is
 *     most of the character.
 *   - Branches never overlap each other. Candidates that would cross or crowd
 *     an existing limb are rejected, which is also what keeps the tree sparse.
 *   - Branches are filled tapered ribbons, not strokes, each narrowing to a
 *     point at its tip.
 *   - Petals are fat asymmetric blobs: two cubic segments between two sharp
 *     tips, the sharp one planted on the elbow, the body swinging out to the
 *     convex side of the turn.
 *   - Two shared amber -> teal ramps. The tree ramp runs from the highest
 *     branch tip down to the ground line, so everything below ground stays at
 *     the far end of the ramp. The petal ramp runs across the petal cluster
 *     alone, starting at the first petal — which is why the low petals read
 *     green while only the crown goes amber.
 *
 * Roots are the one thing the source does not have; it just cuts off at the
 * bottom edge. They use the same machinery as branches, aimed downwards and
 * carrying no petals. The taproot is born the same width as the trunk's flared
 * base and starts a little way *up* the trunk, so its flat base cap is buried
 * inside the trunk instead of meeting the trunk's cap edge to edge.
 *
 * Growth is the same algorithm read at a time t rather than an effect layered
 * on top: `growTree` builds a model where every branch and petal knows when it
 * starts and how long it takes, and `renderTree(model, t)` draws the tree
 * partway through. A branch truncated mid-run is drawn as a smaller whole
 * branch, so a growing shoot keeps a pointed tip instead of a sawn-off one.
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
   * "art" reproduces the source: the tree ramp runs from the crown to the
   * ground line, the petal ramp across the petals alone. "tree" puts
   * everything on the first ramp; "shape" gives every path its own.
   */
  gradient?: "art" | "tree" | "shape";
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
  /** Root system below the trunk. Off makes the base bleed off-frame instead. */
  roots?: boolean;
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
  roots: boolean;
}

// Growth constants, tuned against the original artwork. Deliberately not part
// of the public options — they are what makes it *this* tree and not a fractal.
const TRUNK_LENGTH = 480;
const TRUNK_WIDTH = 0.062 * TRUNK_LENGTH;
const BASE_FLARE = 0.85; // extra width right where trunk and taproot meet
const FLARE_FALLOFF = 0.07; // as a fraction of trunk length
const SAMPLES_PER_RUN = 8; // resolution of the bezier run between two elbows
/** Total bend across one run between elbows. This is what makes limbs curve. */
const RUN_BOW = [0.35, 0.95] as const;
/** Odds a run bows back towards the branch's home angle rather than away. */
const BOW_HOMEWARD = 0.7;
/** The trunk carries far less bow than its limbs, or it reads as a snake. */
const TRUNK_BOW = 0.45;
const ELBOW = [0.22, 0.62] as const; // how hard the skeleton kinks at a joint
const UPRIGHT = 0.8; // odds an elbow turns back towards the home angle
const RECOVERY = 0.9; // how much of its lean a branch sheds at every elbow
const CLEARANCE = 5; // extra gap enforced between branches, in model units
const PLACEMENT_TRIES = 12;
/** Cone a branch may wander in around its home angle, by depth. */
const CONE = [0.34, 1.0, 1.25] as const;
/** How far past the cone a run may bow before it is reeled back in. */
const BOW_SLACK = 1.35;
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

// Roots.
const TAPROOT_LENGTH = [0.38, 0.52] as const; // as a fraction of trunk length
const LATERAL_ROOTS = [3, 4] as const;
const LATERAL_LENGTH = [0.55, 0.9] as const; // as a fraction of the taproot
const LATERAL_SPLAY = [1.9, 2.5] as const; // home angle, radians from straight up
/** Chance a lateral root forks again, so the system reads finished, not stubbed. */
const ROOTLET_CHANCE = 0.55;
const MAX_ROOT_DEPTH = 2;
const DOWN = Math.PI;
/** How far up the trunk the taproot starts, so their base caps overlap. */
const BURY = 14;
/** How wide a child starts, as a fraction of its full width, and over what run. */
const COLLAR_WAIST = 0.45;
const COLLAR_RUN = 1.6; // in units of the child's own base width

/** How long a petal takes to unfurl, in the same arc-length units as growth. */
const PETAL_GROW = 70;

// ---------------------------------------------------------------------------
// geometry helpers
// ---------------------------------------------------------------------------

interface Vec {
  x: number;
  y: number;
}

/** Where a branch wants to point, and how far it may stray from that. */
interface Aim {
  home: number;
  cone: number;
  petals: boolean;
}

interface Branch {
  spine: Vec[];
  /** Cumulative arc length at each sample; last entry is the total. */
  arc: number[];
  /** Indices into `spine` that are elbows, and so must stay creased. */
  corners: number[];
  baseWidth: number;
  depth: number;
  isRoot: boolean;
  /**
   * Arc position of the ground swell, or -1 for none. Trunk and taproot both
   * peak at ground level and decay away from it, so the silhouette runs
   * continuously through the junction instead of stepping at it.
   */
  flarePeak: number;
  /** Arc distance over which a child necks up to full width from its parent. */
  collar: number;
  /** Growth clock, in arc-length units. */
  startAt: number;
  /**
   * How long this branch takes, which is usually just its length. The taproot
   * overrides it to match the trunk: it is shorter, so at equal speed it would
   * finish first and thicken out of step, stepping the shared junction.
   */
  duration: number;
}

interface Joint {
  pos: Vec;
  /** Direction of travel arriving at and leaving the elbow, radians from up. */
  dirIn: number;
  dirOut: number;
  width: number;
  depth: number;
  isRoot: boolean;
  /** When this elbow comes into being, on the growth clock. */
  bornAt: number;
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
  /** Normalised control points, baked once so rendering needs no randomness. */
  ctrl: number[][];
  bornAt: number;
}

const rand = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
const randInt = (rng: Rng, min: number, max: number) =>
  Math.floor(rand(rng, min, max + 1 - 1e-9));
const round = (n: number) => Math.round(n * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number) => clamp(v, 0, 1);

/** Width along a branch: stays solid for most of its run, then points sharply. */
function taper(base: number, t: number): number {
  return base * Math.pow(1 - Math.pow(clamp01(t), 1.8), 0.62);
}

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
  /** Every elbow the tree grew, kept for the second-chance passes. */
  joints: Joint[];
}

/**
 * Walks one branch: bowed runs meeting at elbows. Returns the branch plus the
 * elbows, which are the only places children and petals may appear.
 */
function traceBranch(
  cfg: Config,
  start: Vec,
  angle: number,
  length: number,
  baseWidth: number,
  depth: number,
  aim: Aim,
  startAt: number,
  isRoot: boolean,
  flarePeak = -1,
  collar = 0,
  duration = length
): { branch: Branch; joints: Joint[] } {
  const rng = cfg.rng;
  const jointCount = Math.max(1, randInt(rng, cfg.joints[0], cfg.joints[1]) - depth);

  // Runs get shorter towards the tip, so elbows crowd near the top the way
  // they do in the original.
  const weights: number[] = [];
  for (let i = 0; i < jointCount + 1; i++) {
    weights.push(rand(rng, 0.6, 1.4) * (1 - i * 0.12));
  }
  const total = weights.reduce((a, b) => a + b, 0);

  const spine: Vec[] = [{ ...start }];
  const arc: number[] = [0];
  const corners: number[] = [];
  const joints: Joint[] = [];

  let p = { ...start };
  let a = angle;
  let travelled = 0;

  for (let s = 0; s < weights.length; s++) {
    const runLength = (weights[s] / total) * length;

    // The run is an arc, not a straight line: a steady turn spread over the
    // whole run. Bowing back towards the home angle most of the time is what
    // produces the long S-curves the drawn tree has.
    const homeward = a > aim.home ? -1 : 1;
    const bowSign = rng() < BOW_HOMEWARD ? homeward : -homeward;
    const bow = bowSign * rand(rng, RUN_BOW[0], RUN_BOW[1]) * (depth === 0 ? TRUNK_BOW : 1);

    for (let i = 1; i <= SAMPLES_PER_RUN; i++) {
      a = clamp(
        a + bow / SAMPLES_PER_RUN,
        aim.home - aim.cone * BOW_SLACK,
        aim.home + aim.cone * BOW_SLACK
      );
      const ds = runLength / SAMPLES_PER_RUN;
      p = { x: p.x + Math.sin(a) * ds, y: p.y - Math.cos(a) * ds };
      travelled += ds;
      spine.push(p);
      arc.push(travelled);
    }

    if (s === weights.length - 1) break;

    // The elbow: a decisive kink, biased back towards the branch's home angle
    // and clamped to a cone, so it zigzags on course instead of wandering off.
    const dirBefore = a;
    const mag = rand(rng, ELBOW[0], ELBOW[1]);
    const towardsHome = a > aim.home ? -1 : 1;
    const sign = rng() < UPRIGHT ? towardsHome : -towardsHome;
    a = clamp(
      aim.home + (a - aim.home) * RECOVERY + mag * sign,
      aim.home - aim.cone,
      aim.home + aim.cone
    );

    const idx = spine.length - 1;
    corners.push(idx);
    joints.push({
      pos: spine[idx],
      dirIn: dirBefore,
      dirOut: a,
      width: taper(baseWidth, travelled / length),
      depth,
      isRoot,
      bornAt: startAt + (travelled / length) * duration,
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
    isRoot,
    bornAt: startAt + (travelled / length) * duration,
    budget: 0,
    hasBranch: false,
    hasPetal: false,
  });

  return {
    branch: { spine, arc, corners, baseWidth, depth, isRoot, flarePeak, collar, startAt, duration },
    joints,
  };
}

/**
 * True if a candidate branch crowds any branch already in the world.
 *
 * Samples inside `exempt` of the joint the candidate grows from are ignored:
 * right at the fork a child is *supposed* to be touching its parent, and
 * testing there would reject every branch the tree ever tries to make.
 */
function collides(world: World, branch: Branch, origin: Vec, exempt: number): boolean {
  const exemptSq = exempt * exempt;
  const total = branch.arc[branch.arc.length - 1] || 1;

  for (let i = 0; i < branch.spine.length; i++) {
    const p = branch.spine[i];
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    if (dx * dx + dy * dy < exemptSq) continue;

    const r = taper(branch.baseWidth, branch.arc[i] / total) / 2 + CLEARANCE;
    for (const other of world.branches) {
      const otherTotal = other.arc[other.arc.length - 1] || 1;
      for (let j = 0; j < other.spine.length - 1; j++) {
        const clear = r + taper(other.baseWidth, other.arc[j] / otherTotal) / 2;
        if (distSqToSegment(p, other.spine[j], other.spine[j + 1]) < clear * clear) {
          return true;
        }
      }
    }
  }
  return false;
}

/** Direction pointing out of the convex side of an elbow. */
function outwardAngle(joint: Joint): number {
  const bend = joint.dirOut - joint.dirIn;
  // Bisector between the reversed incoming leg and the outgoing leg. For a
  // straight-through joint (a tip) that degenerates, so fall back to the
  // direction of travel.
  if (Math.abs(bend) < 1e-3) return joint.dirOut;
  return joint.dirIn + bend / 2 + (bend > 0 ? -Math.PI / 2 : Math.PI / 2);
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

/** Grows a branch and rolls the events at each of its elbows. */
function grow(
  world: World,
  start: Vec,
  angle: number,
  length: number,
  baseWidth: number,
  depth: number,
  aim: Aim,
  startAt: number,
  isRoot: boolean,
  flarePeak = -1,
  collar = 0,
  duration = length
): Joint[] {
  const traced = traceBranch(
    world.cfg,
    start,
    angle,
    length,
    baseWidth,
    depth,
    aim,
    startAt,
    isRoot,
    flarePeak,
    collar,
    duration
  );
  world.branches.push(traced.branch);
  populate(world, traced.joints, length, depth, aim, isRoot);
  return traced.joints;
}

/** Rolls the events at each elbow of a branch that is already planted. */
function populate(
  world: World,
  joints: Joint[],
  length: number,
  depth: number,
  aim: Aim,
  isRoot: boolean
): void {
  const cfg = world.cfg;
  const rng = cfg.rng;
  world.joints.push(...joints);

  for (let i = 0; i < joints.length; i++) {
    const joint = joints[i];
    const isTip = i === joints.length - 1;

    // Sub-branches are rarer than trunk branches, which is what keeps the
    // silhouette a sapling instead of a shrub.
    const wants = rng() < cfg.branchChance * (depth === 0 ? 1 : 0.45);
    joint.hasBranch = !isTip && !isRoot && wants && trySprout(world, joint, length, depth);

    if (!aim.petals) continue;

    // Tips are terminal — nothing sprouts from them — so they always get a
    // petal. Interior elbows are the ones that roll for it.
    const crown = isTip && depth === 0 && cfg.crown;
    const chance = isTip ? 1 : cfg.petalChance * (joint.hasBranch ? 0.3 : 1);
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
    const aim: Aim = {
      home: 0,
      cone: CONE[Math.min(depth + 1, CONE.length - 1)],
      petals: true,
    };
    const probe = traceBranch(
      cfg,
      joint.pos,
      dir,
      len,
      childWidth,
      depth + 1,
      aim,
      joint.bornAt,
      false,
      -1,
      childWidth * COLLAR_RUN
    );

    if (!collides(world, probe.branch, joint.pos, exempt)) {
      world.branches.push(probe.branch);
      populate(world, probe.joints, len, depth + 1, aim, false);
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

  const fat = rand(rng, 0.5, 0.82);
  const mirror = rng() < 0.5 ? -1 : 1;

  // The far tip is a cusp — both tangents leave it the same way — so the
  // overshoot has to stay under the bulge that pays for it, or the cusp
  // stretches into a needle instead of a hook.
  const hook = fat * rand(rng, 0.8, 1.05);
  const overshoot = Math.min(rand(rng, 0.1, 0.35), hook * 0.55);

  const petal: Petal = {
    at: { ...joint.pos },
    // Angles here are measured from up; SVG angles from +x, hence the turn.
    angle: outwardAngle(joint) - Math.PI / 2 + rand(rng, -0.35, 0.35),
    length: TRUNK_LENGTH * (crown ? rand(rng, 0.18, 0.24) : rand(rng, 0.09, 0.16)),
    ctrl: [
      [rand(rng, 0.18, 0.4), mirror * rand(rng, -0.3, 0.1)],
      [rand(rng, 0.58, 0.75), mirror * -fat * rand(rng, 0.85, 1.1)],
      [1, 0],
      [1 + overshoot, mirror * hook],
      [rand(rng, 0.4, 0.6), mirror * fat * rand(rng, 0.5, 1.05)],
      [0, 0],
    ],
    bornAt: joint.bornAt,
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
  return true;
}

/**
 * Grows the root system: a taproot straight down carrying the trunk's own base
 * width, plus a couple of laterals splaying off it. Roots never carry petals.
 */
function growRoots(world: World, trunk: Branch): void {
  const cfg = world.cfg;
  const rng = cfg.rng;

  const buried = trunk.arc.findIndex((a) => a >= BURY);
  const at = buried > 0 ? buried : 0;

  // The taproot carries the trunk's own base width and puts its ground swell
  // at the point where the two meet, so the pair reads as one continuous shape.
  const tapLength = TRUNK_LENGTH * rand(rng, TAPROOT_LENGTH[0], TAPROOT_LENGTH[1]);
  const tapAim: Aim = { home: DOWN, cone: 0.4, petals: false };
  const tapJoints = grow(
    world,
    trunk.spine[at],
    DOWN + rand(rng, -0.2, 0.2),
    tapLength,
    trunk.baseWidth,
    0,
    tapAim,
    0,
    true,
    trunk.arc[at],
    0,
    TRUNK_LENGTH // creep down over the same span the trunk climbs
  );

  const wanted = randInt(rng, LATERAL_ROOTS[0], LATERAL_ROOTS[1]);
  const anchors = tapJoints.slice(0, -1);
  let side = rng() < 0.5 ? -1 : 1;

  for (let i = 0; i < wanted; i++) {
    const joint = anchors[i % Math.max(1, anchors.length)];
    if (!joint) break;
    const len = tapLength * rand(rng, LATERAL_LENGTH[0], LATERAL_LENGTH[1]);
    sproutRoot(world, joint, side * rand(rng, LATERAL_SPLAY[0], LATERAL_SPLAY[1]), len, 1);
    side *= -1;
  }
}

/**
 * Sends one root out from an elbow and lets it fork again. Roots use the same
 * placement rejection as branches, so the system spreads without tangling.
 */
function sproutRoot(
  world: World,
  joint: Joint,
  home: number,
  length: number,
  depth: number
): boolean {
  const cfg = world.cfg;
  const rng = cfg.rng;

  const width = Math.max(joint.width * rand(rng, 0.55, 0.8), length * MIN_ASPECT);
  const exempt = joint.width * 2.2 + CLEARANCE * 2;
  const aim: Aim = { home, cone: 0.55, petals: false };
  const side = home > 0 ? 1 : -1;

  for (let attempt = 0; attempt < PLACEMENT_TRIES; attempt++) {
    const dir = home + rand(rng, -0.3, 0.3) - side * attempt * 0.08;
    const probe = traceBranch(
      cfg,
      joint.pos,
      dir,
      length * (1 - attempt * 0.05),
      width,
      depth,
      aim,
      joint.bornAt,
      true,
      -1,
      width * COLLAR_RUN
    );
    if (collides(world, probe.branch, joint.pos, exempt)) continue;

    world.branches.push(probe.branch);
    world.joints.push(...probe.joints);

    // Rootlets, so the system ends in fine ends rather than blunt stubs.
    if (depth < MAX_ROOT_DEPTH) {
      for (const child of probe.joints.slice(0, -1)) {
        if (rng() > ROOTLET_CHANCE) continue;
        const splay = home + (rng() < 0.5 ? -1 : 1) * rand(rng, 0.4, 0.9);
        sproutRoot(world, child, splay, length * rand(rng, 0.4, 0.65), depth + 1);
      }
    }
    return true;
  }
  return false;
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
  creases: Set<number>,
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

/**
 * One branch as a closed, pointed, tapered outline, grown to `progress`.
 *
 * A partly grown branch is drawn as a smaller whole branch rather than a
 * branch chopped off: the taper is stretched over the length reached so far,
 * so the working tip is always a point, and the base thickens as it extends.
 */
function branchCubics(branch: Branch, progress: number): number[][] {
  const total = branch.arc[branch.arc.length - 1];
  const reach = total * clamp01(progress);
  if (reach <= 1e-6 || branch.spine.length < 2) return [];

  // Take every sample inside the reach, then land exactly on it.
  const spine: Vec[] = [];
  const arc: number[] = [];
  for (let i = 0; i < branch.spine.length; i++) {
    if (branch.arc[i] > reach) break;
    spine.push(branch.spine[i]);
    arc.push(branch.arc[i]);
  }
  if (spine.length < 2) {
    spine.push(branch.spine[1]);
    arc.push(branch.arc[1]);
  }
  const last = arc[arc.length - 1];
  if (reach - last > 1e-6 && spine.length < branch.spine.length) {
    const i = spine.length;
    const span = branch.arc[i] - last || 1;
    const f = (reach - last) / span;
    spine.push({
      x: branch.spine[i - 1].x + (branch.spine[i].x - branch.spine[i - 1].x) * f,
      y: branch.spine[i - 1].y + (branch.spine[i].y - branch.spine[i - 1].y) * f,
    });
    arc.push(reach);
  }

  // A shoot starts thin and fills out as it extends.
  const base = branch.baseWidth * Math.pow(clamp01(progress), 0.4);
  const span = arc[arc.length - 1] || 1;
  const widths = arc.map((a) => {
    let w = taper(base, a / span);
    if (branch.flarePeak >= 0) {
      // The buttress fills in as the tree grows; a seedling has none, and a
      // full-size swell on a two-day-old shoot reads as a step in the stem.
      const d = Math.abs(a - branch.flarePeak);
      w *= 1 + BASE_FLARE * clamp01(progress) * Math.exp(-d / (TRUNK_LENGTH * FLARE_FALLOFF));
    }
    // A child necks up out of its parent, keeping its base cap small and buried.
    if (branch.collar > 0) w *= Math.min(1, COLLAR_WAIST + (1 - COLLAR_WAIST) * (a / branch.collar));
    return w;
  });

  const n = spine.length;
  const left = offsetSide(spine, widths, 1).slice(0, n - 1);
  const right = offsetSide(spine, widths, -1).slice(0, n - 1);
  const apex = spine[n - 1];

  const creases = new Set(branch.corners.filter((c) => c < n - 1));
  // The right side is walked backwards, so crease indices have to be mirrored.
  const mirrored = new Set<number>();
  for (const c of creases) mirrored.add(n - 1 - c);

  const cubics: number[][] = [];
  chainToCubics([...left, apex], cubics, creases);
  chainToCubics([apex, ...right.reverse()], cubics, mirrored);
  return cubics;
}

/**
 * The blob primitive: two cubic segments running between two sharp tips. The
 * control-point ranges were measured off the six blobs in the original artwork,
 * in a frame where the chord from tip to tip is the x axis, length 1.
 *
 * Unfurling just scales the chord, so the sharp tip stays planted on its elbow
 * and the body swings outward.
 */
function petalCubics(p: Petal, progress: number): number[][] {
  const t = clamp01(progress);
  if (t <= 1e-6) return [];

  const L = p.length * t;
  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  const to = (u: number, v: number): [number, number] => [
    p.at.x + (u * L * cos - v * L * sin),
    p.at.y + (u * L * sin + v * L * cos),
  ];

  const cubics: number[][] = [];
  let cursor: [number, number] = [p.at.x, p.at.y];
  for (let s = 0; s < 2; s++) {
    const c1 = to(p.ctrl[s * 3][0], p.ctrl[s * 3][1]);
    const c2 = to(p.ctrl[s * 3 + 1][0], p.ctrl[s * 3 + 1][1]);
    const end = to(p.ctrl[s * 3 + 2][0], p.ctrl[s * 3 + 2][1]);
    cubics.push([cursor[0], cursor[1], c1[0], c1[1], c2[0], c2[1], end[0], end[1]]);
    cursor = end;
  }
  return cubics;
}

// ---------------------------------------------------------------------------
// paths and bounds
// ---------------------------------------------------------------------------

interface Place {
  k: number;
  tx: number;
  ty: number;
}

function cubicsToPath(cubics: number[][], place: Place): string {
  if (!cubics.length) return "";
  const X = (v: number) => round(v * place.k + place.tx);
  const Y = (v: number) => round(v * place.k + place.ty);
  let d = `M${X(cubics[0][0])},${Y(cubics[0][1])}`;
  for (const c of cubics) {
    d += `C${X(c[2])},${Y(c[3])} ${X(c[4])},${Y(c[5])} ${X(c[6])},${Y(c[7])}`;
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

// ---------------------------------------------------------------------------
// model
// ---------------------------------------------------------------------------

export interface TreeModel {
  branches: Branch[];
  petals: Petal[];
  /** Model-to-viewport fit, solved once on the full-grown tree. */
  place: Place;
  /** Gradient id per shape, in the order `pathsAt` returns them. */
  fills: string[];
  defs: string;
  /** Length of the whole growth sequence, in arc-length units. */
  span: number;
  seed: number;
  width: number;
  height: number;
}

/** Smooth start, smooth finish — growth eases in and settles rather than stopping. */
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Petals get a touch of overshoot so they pop rather than inflate. */
function easeOutBack(t: number): number {
  if (t <= 0) return 0;
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

/** Builds the tree, fully solved but not yet drawn. */
export function growTree(options: TreeOptions = {}): TreeModel {
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
    roots: options.roots ?? true,
  };
  const rng = cfg.rng;

  const world: World = { cfg, branches: [], petals: [], joints: [] };
  const trunkAim: Aim = { home: 0, cone: CONE[0], petals: true };
  grow(
    world,
    { x: 0, y: 0 },
    rand(rng, -0.1, 0.1),
    TRUNK_LENGTH,
    TRUNK_WIDTH,
    0,
    trunkAim,
    0,
    false,
    cfg.roots ? 0 : -1 // only swell the base when there are roots to swell into
  );

  // A tree that rolled badly can come out a bare stick. Give the spare elbows
  // a second chance — limbs first, then petals — before settling for it.
  if (world.branches.length <= MIN_LIMBS) {
    const spare = world.joints.filter((j) => j.depth === 0 && !j.hasBranch && !j.hasPetal);
    for (const joint of spare) {
      if (world.branches.length > MIN_LIMBS) break;
      joint.hasBranch = trySprout(world, joint, TRUNK_LENGTH, 0);
    }
  }

  if (world.petals.length < MIN_PETALS) {
    const spare = world.joints
      .filter((j) => !j.hasPetal && !j.isRoot)
      .sort((a, b) => a.pos.y - b.pos.y);
    for (const joint of spare) {
      if (world.petals.length >= MIN_PETALS) break;
      joint.hasPetal = tryPetal(world, joint, false);
    }
  }

  // Roots go in last, sharing the trunk's base width so the caps cancel.
  if (cfg.roots) growRoots(world, world.branches[0]);

  // --- growth clock -------------------------------------------------------
  let span = 0;
  for (const b of world.branches) span = Math.max(span, b.startAt + b.duration);
  for (const p of world.petals) span = Math.max(span, p.bornAt + PETAL_GROW);
  span = span || 1;

  // --- fit, solved on the full-grown tree so nothing drifts while growing --
  const grown = {
    branches: world.branches.map((b) => branchCubics(b, 1)),
    petals: world.petals.map((p) => petalCubics(p, 1)),
  };

  const all = emptyBounds();
  for (const c of grown.branches) boundsOf(c, all);
  for (const c of grown.petals) boundsOf(c, all);

  const pad = cfg.padding;
  const modelW = all.maxX - all.minX || 1;
  const modelH = all.maxY - all.minY || 1;
  // A rootless tree bleeds off the bottom edge the way the source art does.
  const bottom = cfg.roots ? pad : 0;
  const k = Math.min((cfg.width - pad * 2) / modelW, (cfg.height - pad - bottom) / modelH);
  const place: Place = {
    k,
    tx: (cfg.width - modelW * k) / 2 - all.minX * k,
    ty: pad - all.minY * k,
  };
  const place2 = (c: number[]) =>
    c.map((v, i) => (i % 2 === 0 ? v * place.k + place.tx : v * place.k + place.ty));

  // --- gradient anchors ---------------------------------------------------
  // The tree ramp runs from the highest branch tip down to the ground line, so
  // the roots sit past its end and stay at the far colour. The petal ramp runs
  // across the petal cluster alone, starting at the first petal.
  const branchTop = world.branches
    .filter((b) => !b.isRoot)
    .reduce((min, b, i) => Math.min(min, boundsOf(grown.branches[i].map(place2)).minY), Infinity);
  const groundY = place.ty; // model y = 0 is where trunk and taproot meet

  const petalBoxes = grown.petals.map((c) => boundsOf(c.map(place2)));
  const petalTop = petalBoxes.reduce((m, b) => Math.min(m, b.minY), Infinity);
  const petalBottom = petalBoxes.reduce((m, b) => Math.max(m, b.maxY), -Infinity);

  const uid = seed.toString(36);
  const defs: string[] = [];
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

  const fills: string[] = [];
  const assign = (box: Bounds, isPetal: boolean) => {
    if (cfg.gradient === "shape") return fills.push(rampFor(box.minY, box.maxY));
    if (cfg.gradient === "tree" || !isPetal) return fills.push(rampFor(branchTop, groundY));
    return fills.push(rampFor(petalTop, petalBottom));
  };

  grown.branches.forEach((c) => assign(boundsOf(c.map(place2)), false));
  petalBoxes.forEach((box) => assign(box, true));

  return {
    branches: world.branches,
    petals: world.petals,
    place,
    fills,
    defs: defs.join(""),
    span,
    seed,
    width: cfg.width,
    height: cfg.height,
  };
}

/**
 * Path data for every shape at growth `t` in [0, 1]. Shapes that have not
 * started yet come back as empty strings, so the array is stable across frames
 * and a renderer can keep its elements and just swap `d`.
 */
export function pathsAt(model: TreeModel, t = 1): string[] {
  const clock = smoothstep(clamp01(t)) * model.span;
  const out: string[] = [];

  for (const b of model.branches) {
    out.push(cubicsToPath(branchCubics(b, (clock - b.startAt) / b.duration), model.place));
  }
  for (const p of model.petals) {
    const raw = clamp01((clock - p.bornAt) / PETAL_GROW);
    out.push(cubicsToPath(petalCubics(p, easeOutBack(raw)), model.place));
  }
  return out;
}

/** The whole tree as a standalone SVG string, grown to `t`. */
export function renderTree(model: TreeModel, t = 1): string {
  const body = pathsAt(model, t)
    .map((d, i) => `<path fill="url(#${model.fills[i]})" d="${d}"/>`)
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${model.width} ${model.height}" ` +
    `width="${model.width}" height="${model.height}" preserveAspectRatio="xMidYMid meet" role="img">` +
    `<defs>${model.defs}</defs>${body}</svg>`
  );
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

export interface GeneratedTree {
  svg: string;
  model: TreeModel;
  seed: number;
  width: number;
  height: number;
}

/** A fully grown tree, ready to drop into markup. */
export function generateTree(options: TreeOptions = {}): GeneratedTree {
  const model = growTree(options);
  return {
    svg: renderTree(model, 1),
    model,
    seed: model.seed,
    width: model.width,
    height: model.height,
  };
}

export interface AnimateOptions extends TreeOptions {
  /** Milliseconds from bare seed to full tree. */
  duration?: number;
  /** Wait before starting, in milliseconds. */
  delay?: number;
  /** Draw the finished tree instantly instead of growing it. */
  reducedMotion?: boolean;
}

export interface TreeAnimation {
  model: TreeModel;
  /** Jump to a point in the growth, 0 to 1, and stop animating. */
  seek(t: number): void;
  replay(): void;
  stop(): void;
}

/**
 * Mounts a tree into `target` and grows it. This lives here because the
 * animation is not an effect on top of the drawing — it is the same model read
 * at successive times — but it is the only function in this file that touches
 * the DOM, and nothing runs until it is called.
 */
export function animateTree(target: Element, options: AnimateOptions = {}): TreeAnimation {
  const model = growTree(options);
  const duration = options.duration ?? 2600;
  const delay = options.delay ?? 0;

  target.innerHTML = renderTree(model, 0);
  const paths = Array.from(target.querySelectorAll("path"));

  const draw = (t: number) => {
    const d = pathsAt(model, t);
    for (let i = 0; i < paths.length; i++) paths[i].setAttribute("d", d[i]);
  };

  const reduced =
    options.reducedMotion ??
    (typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches);

  let frame = 0;
  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  const run = () => {
    stop();
    if (reduced) {
      draw(1);
      return;
    }
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start - delay;
      if (elapsed < 0) {
        frame = requestAnimationFrame(step);
        return;
      }
      const t = clamp01(elapsed / duration);
      draw(t);
      frame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    frame = requestAnimationFrame(step);
  };

  run();

  return {
    model,
    seek(t: number) {
      stop();
      draw(clamp01(t));
    },
    replay: run,
    stop,
  };
}

export default generateTree;
