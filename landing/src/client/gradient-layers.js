/**
 * The gradient on the pages without the tree, as a stack of sheets, and the
 * black hole a click makes of it.
 *
 * The markup (src/site/components/layout.ts) draws the gradient as five
 * concentric sheets of colour centred on the right edge of the page, back to
 * front and largest to smallest; styles.css gives them the old gradient's
 * rings. On a desktop this hangs them at different depths in one perspective,
 * so they part as the pointer moves, and lets each sway like a leaf: a damped
 * spring on its place and on its tilt, pushed by a breeze that passes from
 * the back sheet to the front one and by the pointer brushing through it. The
 * small front sheets are the light leaves, quicker and easier to move.
 *
 * A click on the gradient folds it into a black hole (gradient/lens.js, light
 * traced past it the way Interstellar's was): the sheets spiral in and light
 * its disc, and the page behind bends round it. The drawn cursor
 * (ink-cursor.js) is caught into an orbit, which shrinks as it goes, so it
 * turns faster and faster (Kepler: ω ∝ ρ^−3/2, the orbit decaying as a
 * radiating binary's does, ρ⁴ falling linearly); inside the tidal radius it
 * comes apart, stretched along the orbit and sheared by it into a thread,
 * and is gone at the shadow. After a moment the hole evaporates in a flash
 * and gives back the sheets and the cursor. Only the drawing is taken: the
 * pointer itself stays where the hand is.
 *
 * Over it all the ink, as on the tree: the pointer carries the tree's air
 * (its contact ring, its wake, its velocity on a rule, F = k v), which page-
 * cotas.js leaves to this while it is near; a sheet under the hand is
 * dimensioned, with the spring it sways on; the hole gets its shadow, its
 * mass, the cursor's distance and pull, and its temperature as it goes.
 * Lengths and values in the cotas' face, formulas in the tree's script.
 *
 * Desktop only, (min-width: 768px) and a fine pointer that can hover, and not
 * with reduced motion; everywhere else the sheets stay as they are drawn.
 */
import { makeLens } from "./gradient/lens.js";

(() => {
  const stack = document.getElementById("gradient-bg");
  const host = document.getElementById("overlay-content");
  if (!stack || !host || !stack.classList.contains("grad-stack")) return;
  const desk = matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine)");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const sheets = Array.from(stack.querySelectorAll(".grad-layer"));
  if (!sheets.length) return;
  const root = document.documentElement;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const clamp01 = (v) => clamp(v, 0, 1);
  const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
  const TAU = Math.PI * 2;

  /* ==== the sheets ==== */

  // The perspective's distance, as in styles.css.
  const P = 1200;
  // Back to front, one per sheet in the markup:
  //   z      depth, in px (negative is further)
  //   f      how quickly it sways, in Hz
  //   zeta   how soon it settles
  //   give   how much of the hand's motion it takes up
  //   wind   how far the breeze moves it, in px
  //   tilt   how far the breeze tips it, in radians
  const KIND = [
    { z: -320, f: 0.42, zeta: 0.3, give: 0.18, wind: 9, tilt: 0.04 },
    { z: -210, f: 0.58, zeta: 0.22, give: 0.32, wind: 12, tilt: 0.07 },
    { z: -130, f: 0.74, zeta: 0.18, give: 0.46, wind: 15, tilt: 0.1 },
    { z: -60, f: 0.95, zeta: 0.16, give: 0.62, wind: 17, tilt: 0.13 },
    { z: 10, f: 1.25, zeta: 0.14, give: 0.8, wind: 19, tilt: 0.17 },
  ];
  const leaves = sheets.map((el, i) => {
    const kind = KIND[Math.min(i, KIND.length - 1)];
    const st = el.style;
    return {
      el, ...kind,
      k: parseFloat(st.getPropertyValue("--k")) || 0.2,
      b: st.getPropertyValue("--c").includes("g-b"), // which of the two colours
      a0: parseFloat(st.getPropertyValue("--a0")) || 0,
      a1: el.classList.contains("halo") ? -1 : parseFloat(st.getPropertyValue("--a1")) || 0,
      seed: 17 + i * 31,
      x: 0, y: 0, vx: 0, vy: 0, // its place, about the centre, in px
      rx: 0, ry: 0, vrx: 0, vry: 0, // its tilt about x and y, in radians
      bx: 0, by: 0, bvx: 0, bvy: 0, // how far it still is from coming back out of the hole
      grow: 1, vgrow: 0, // its size, as it comes back out
      // Where it shows, in the box: centre, radius, opacity.
      ax: 0, ay: 0, ar: 0, ao: 1,
      fx: 0, fy: 0, out: false,
    };
  });

  // Smooth noise in [-1, 1], as tree-sway.js has it.
  const hash1 = (i, seed) => {
    const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise1 = (x, seed) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return (hash1(i, seed) * (1 - u) + hash1(i + 1, seed) * u) * 2 - 1;
  };
  // The breeze, as a multiple of a sheet's own sway: a slow lean to one side,
  // two octaves of wander and the odd gust, which only ever adds. It reaches
  // the back sheet first.
  const breeze = (t, lag, seed) => {
    const tt = t - lag;
    return (
      0.25 +
      0.6 * noise1(tt * 0.17, 11 + seed) +
      0.35 * noise1(tt * 0.41, 23 + seed) +
      1.3 * Math.max(0, noise1(tt * 0.07, 37)) ** 2
    );
  };

  // The box's size, the circle's centre (its right edge, halfway down) and the
  // radius the sheets are fractions of, as the old gradient's farthest corner.
  let W = 0, H = 0, R = 0;
  const measure = () => {
    W = stack.offsetWidth;
    H = stack.offsetHeight;
    R = Math.hypot(W, H / 2);
  };

  /* ==== the pointer ==== */

  const hand = { x: -1e4, y: -1e4, lastX: -1e4, lastY: -1e4, vx: 0, vy: 0, seen: false, t: null, bare: false };
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    hand.x = e.clientX;
    hand.y = e.clientY;
    // Whether it is on the page's bare ground, not on text or a control.
    const t = e.target;
    if (t !== hand.t) {
      hand.t = t;
      hand.bare = t instanceof Element && getComputedStyle(t).getPropertyValue("--cur-role").trim() === "default";
    }
    if (!hand.seen) { hand.lastX = hand.x; hand.lastY = hand.y; hand.seen = true; }
    wake();
  }, { passive: true });
  root.addEventListener("mouseleave", () => { hand.seen = false; });
  // Where the eye is: the perspective's origin follows the hand a little.
  const eye = { x: 0, y: 0, set: false };

  /* ==== the hole ==== */

  let lens; // made on the first click (gradient/lens.js); null without WebGL
  // calm → fall (the sheets go in, the cursor is caught) → hold → boom → back.
  let phase = "calm", since = 0, clock = 0;
  // The hole: its centre in the box and in the host, r_s, and the square
  // the lens draws, half of its side.
  const at = { x: 0, y: 0, hx: 0, hy: 0, rs: 0, half: 0 };
  // r_s as it grows and shrinks, the disc's light, the flash, the copy.
  const now_ = { rs: 0, disc: 0, flash: 0, lens: 0 };
  const cursor = () => window.__inkCursor;
  const BIG_BANG = 1.2; // how long the hole stays once it has eaten, in s

  // The cursor's fall: where it was caught from, then its orbit.
  //   catch    s since the hole began to pull it
  //   rho, th  its orbit about the hole, in r_s and radians
  //   w        its angular speed
  //   tear     how far it has come apart, 0 to 1
  const orbit = {
    on: false, catch: 0, rho: 0, th: 0, w: 0, tear: 0, gone: false,
    x: 0, y: 0, // where it is drawn, on screen
    back: null, // its way back out of the hole
  };
  const RHO0 = 8; // the orbit it is caught into, in r_s
  const RHO_TIDE = 6.2; // where it starts to come apart
  const RHO_END = 2.6; // the shadow's edge: gone
  const INSPIRAL = 3.2; // s from RHO0 to RHO_END
  const PERIOD0 = 1.5; // s per turn at RHO0
  const CATCH = 0.8; // s to fall from the hand into the orbit

  // A press on the gradient's own ground: on nothing that is text, a link or
  // a control (their cursor role says so), with nothing selected, inside the
  // sheets that show.
  document.addEventListener("click", (e) => {
    if (phase !== "calm" || !desk.matches || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;
    const t = e.target;
    if (!(t instanceof Element) || !host.contains(t)) return;
    if (getComputedStyle(t).getPropertyValue("--cur-role").trim() !== "default") return;
    if (t.closest("a, button, input, textarea, select, label, summary, dropdown-trigger, [role], [contenteditable]")) return;
    const sel = getSelection();
    if (sel && !sel.isCollapsed) return;
    const box = stack.getBoundingClientRect();
    const cx = box.left + W, cy = box.top + H / 2;
    if (Math.hypot(e.clientX - cx, e.clientY - cy) > 0.25 * R) return;
    swallow(box);
  });

  function swallow(box) {
    if (lens === undefined) lens = makeLens(host);
    // The hole's size goes with the gradient's; the square it bends holds
    // its disc and the bending round it.
    const rs = clamp(0.017 * R, 10, 18);
    const half = Math.round(16 * rs);
    // Where the circle's centre is, brought into the view far enough for the
    // disc to show.
    const m = 10.5 * rs;
    const cx = box.left + W, cy = box.top + H / 2;
    const vw = root.clientWidth, vh = innerHeight;
    const hx = clamp(cx, Math.max(box.left, 0) + m, vw - m);
    const hy = clamp(cy, Math.min(m, vh / 2), Math.max(vh - m, vh / 2));
    const hostBox = host.getBoundingClientRect();
    at.x = hx - box.left;
    at.y = hy - box.top;
    at.hx = hx - hostBox.left;
    at.hy = hy - hostBox.top;
    at.rs = rs;
    at.half = half;
    if (lens) lens.open(at.hx, at.hy, half);
    for (const l of leaves) {
      // Each sheet falls in from wherever it was swaying.
      l.fx = W + l.x + l.bx;
      l.fy = H / 2 + l.y + l.by;
    }
    Object.assign(orbit, { on: false, catch: 0, rho: 0, th: 0, w: 0, tear: 0, gone: false, back: null });
    Object.assign(now_, { rs: 0, disc: 0, flash: 0, lens: 0 });
    phase = "fall";
    since = 0;
    root.setAttribute("data-air-held", "");
    wake();
  }

  /* ==== each frame ==== */

  let raf = 0, last = 0, t = 0, visible = true;
  function wake() {
    if (!raf && desk.matches && (visible || phase !== "calm")) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function sway(l, dt, i) {
    const w = TAU * l.f;
    const lag = (KIND.length - 1 - i) * -0.18; // the back sheet a moment ahead
    const ax = l.wind * breeze(t, lag, l.seed);
    const ay = l.wind * 0.6 * noise1((t - lag) * 0.23, l.seed + 5);
    const tx = l.tilt * noise1((t - lag) * 0.3, l.seed + 9);
    const ty = l.tilt * (0.4 * breeze(t, lag, l.seed + 3) - 0.3);
    l.vx += (w * w * (ax - l.x) - 2 * l.zeta * w * l.vx) * dt;
    l.vy += (w * w * (ay - l.y) - 2 * l.zeta * w * l.vy) * dt;
    l.vrx += (w * w * (tx - l.rx) - 2 * l.zeta * w * l.vrx) * dt;
    l.vry += (w * w * (ty - l.ry) - 2 * l.zeta * w * l.vry) * dt;
    l.x += l.vx * dt; l.y += l.vy * dt;
    l.rx += l.vrx * dt; l.ry += l.vry * dt;
    // Coming back out of the hole: its own spring, slower and bouncier.
    if (l.bx || l.by || l.bvx || l.bvy) {
      const wb = TAU * 0.9;
      l.bvx += (-wb * wb * l.bx - 2 * 0.32 * wb * l.bvx) * dt;
      l.bvy += (-wb * wb * l.by - 2 * 0.32 * wb * l.bvy) * dt;
      l.bx += l.bvx * dt; l.by += l.bvy * dt;
      if (Math.abs(l.bx) + Math.abs(l.by) < 0.05 && Math.abs(l.bvx) + Math.abs(l.bvy) < 0.5) l.bx = l.by = l.bvx = l.bvy = 0;
    }
    if (l.grow !== 1 || l.vgrow) {
      const wg = TAU * (1.1 + 0.15 * i);
      l.vgrow += (wg * wg * (1 - l.grow) - 2 * 0.3 * wg * l.vgrow) * dt;
      l.grow += l.vgrow * dt;
      if (Math.abs(1 - l.grow) < 1e-3 && Math.abs(l.vgrow) < 1e-2) { l.grow = 1; l.vgrow = 0; }
    }
  }

  // The hand brushing through a sheet takes it along a little, and tips it.
  function brush(l, hx, hy, vx, vy, dt) {
    const r = l.k * R;
    const cx = W + l.x + l.bx, cy = H / 2 + l.y + l.by;
    const d = Math.hypot(hx - cx, hy - cy);
    if (d >= r) return;
    // A hand at rest inside it holds nothing back.
    const reach = (1 - (d / r) ** 2) * clamp01(Math.hypot(vx, vy) / 300);
    const k = 1 - Math.exp(-dt * 7 * l.give * reach);
    l.vx += (vx * 0.5 - l.vx) * k;
    l.vy += (vy * 0.5 - l.vy) * k;
    l.vry += vx * 0.00012 * l.give * reach * dt * 60;
    l.vrx -= vy * 0.00012 * l.give * reach * dt * 60;
  }

  // Sets a sheet's transform, and notes where it shows: through the
  // perspective, a point at depth z sits (P / (P − z)) as far from the eye.
  function place(l, extra) {
    const z = extra ? extra.z : l.z;
    const s = ((P - l.z) / P) * (extra ? extra.s : l.grow);
    const x = extra ? extra.x : l.x + l.bx;
    const y = extra ? extra.y : l.y + l.by;
    const keep = extra ? 1 - extra.u : 1;
    const rx = Math.tanh(l.rx) * keep, ry = Math.tanh(l.ry) * keep;
    const o = extra ? extra.a : l.grow < 1 ? clamp01(l.grow * 2) : 1;
    l.el.style.transform =
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(1)}px) ` +
      `rotateX(${rx.toFixed(4)}rad) rotateY(${ry.toFixed(4)}rad) scale(${Math.max(0, s).toFixed(4)})`;
    l.el.style.opacity = o < 1 ? String(o) : "";
    const k = P / (P - z);
    l.ax = eye.x + (W + x - eye.x) * k;
    l.ay = eye.y + (H / 2 + y - eye.y) * k;
    l.ar = l.k * R * Math.max(0, s) * k;
    l.ao = o;
  }

  let box = null;
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    t += dt;
    if (!desk.matches) { rest(); return; }

    box = stack.getBoundingClientRect();
    const hx = hand.x - box.left, hy = hand.y - box.top;
    let vx = 0, vy = 0;
    if (hand.seen) {
      vx = (hand.x - hand.lastX) / dt;
      vy = (hand.y - hand.lastY) / dt;
      hand.lastX = hand.x; hand.lastY = hand.y;
    }
    hand.vx += (vx - hand.vx) * (1 - Math.exp(-dt / 0.03));
    hand.vy += (vy - hand.vy) * (1 - Math.exp(-dt / 0.03));

    // The eye leans toward the hand, so the sheets part by their depth.
    const cx = W, cy = H / 2;
    let ex = cx, ey = cy;
    if (hand.seen && phase === "calm") {
      const dx = hx - cx, dy = hy - cy, d = Math.hypot(dx, dy), cap = 0.6 * R;
      const f = d > 0 ? Math.min(d * 0.35, cap) / d : 0;
      ex = cx + dx * f; ey = cy + dy * f;
    } else if (phase !== "calm" && phase !== "back") {
      ex = at.x; ey = at.y;
    }
    if (!eye.set) { eye.x = ex; eye.y = ey; eye.set = true; }
    const ek = 1 - Math.exp(-dt / 0.25);
    eye.x += (ex - eye.x) * ek;
    eye.y += (ey - eye.y) * ek;
    stack.style.perspectiveOrigin = `${eye.x.toFixed(1)}px ${eye.y.toFixed(1)}px`;

    // Small steps, so the quick front sheet stays stable at any frame rate.
    const n = Math.ceil(dt / (1 / 120));
    for (let s = 0; s < n; s++) {
      leaves.forEach((l, i) => {
        sway(l, dt / n, i);
        if (phase === "calm" || phase === "back") brush(l, hx, hy, hand.vx, hand.vy, dt / n);
      });
    }
    if (phase === "calm" || phase === "back" || (phase === "boom" && leaves[0].out)) {
      for (const l of leaves) place(l);
    }
    if (phase !== "calm") hole(dt);
    follow(dt);
    ink(dt);

    const moving = hand.seen && Math.hypot(hand.vx, hand.vy) > 1;
    if (visible || phase !== "calm" || moving || inked) raf = requestAnimationFrame(frame);
  }

  function hole(dt) {
    since += dt;
    clock += dt;
    const hx = box.left + at.x, hy = box.top + at.y; // on screen

    if (phase === "fall") {
      // The sheets go in, the small inner ones first and quickest, winding
      // the way the cursor will.
      leaves.forEach((l, i) => {
        const n = leaves.length - 1 - i;
        const u = smooth((since - 0.05 * n) / (0.9 + 0.08 * i));
        const rx = l.fx - at.x, ry = l.fy - at.y;
        const turn = -(2.4 * Math.PI * u ** 1.6) / (0.7 + 0.12 * n);
        const k = (1 - u) ** 1.2;
        const cs = Math.cos(turn), sn = Math.sin(turn);
        place(l, {
          x: at.x + (rx * cs - ry * sn) * k - W,
          y: at.y + (rx * sn + ry * cs) * k - H / 2,
          z: l.z * (1 - u), s: 0.04 + 0.96 * (1 - u) ** 1.5, a: 1 - u ** 4, u,
        });
      });
      now_.rs = at.rs * smooth((since - 0.15) / 0.9);
      now_.disc = smooth((since - 0.4) / 0.9);
      if (since > 0.55) fall(dt, hx, hy);
      if (orbit.gone) { phase = "hold"; since = 0; }
    } else if (phase === "hold") {
      // A gulp as it eats.
      now_.rs = at.rs * (1 + 0.12 * Math.exp(-since / 0.2) * Math.sin(since * 26));
      now_.disc = 1 + 0.5 * Math.exp(-since / 0.3);
      if (since > BIG_BANG) { phase = "boom"; since = 0; }
    } else if (phase === "boom") {
      // It evaporates: it shrinks, its disc burns bright, and it is gone in
      // a flash, which gives back the sheets and the cursor.
      const u = clamp01(since / 0.7);
      now_.rs = at.rs * (1 - smooth(u) ** 1.4);
      now_.disc = (1 + 1.4 * Math.sin(Math.PI * u)) * (1 - smooth((since - 0.5) / 0.25));
      now_.flash = Math.sin(Math.PI * clamp01((since - 0.45) / 0.45));
      if (since >= 0.62 && !leaves[0].out) giveBack(hx, hy);
      if (since >= 0.95) { phase = "back"; since = 0; if (lens) lens.close(); }
    } else if (phase === "back") {
      comeBack(dt, hx, hy);
      if (since > 1.5) finish();
    }

    // The copy of the page fades in once it is taken.
    if (lens && phase !== "back") {
      now_.lens += ((lens.ready ? 1 : 0) - now_.lens) * (1 - Math.exp(-dt / 0.25));
      const ox = at.x - at.half, oy = at.y - at.half; // the square, in the box
      const ga = rgbOf("--g-a"), gb = rgbOf("--g-b");
      lens.draw({
        rs: now_.rs, lens: now_.lens, disc: now_.disc, flash: now_.flash, time: clock,
        sheets: leaves.map((l) => ({ x: l.ax - ox, y: l.ay - oy, r: l.ar, o: l.ao, c: l.b ? gb : ga, a0: l.a0, a1: l.a1 })),
      });
    }
  }

  // The gradient's two colours, from styles.css, as 0 to 1.
  const colours = {};
  function rgbOf(name) {
    if (!colours[name]) colours[name] = getComputedStyle(stack).getPropertyValue(name).trim().split(/\s+/).map((c) => Number(c) / 255);
    return colours[name];
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { for (const k in colours) delete colours[k]; });

  /* ---- the cursor's fall ---- */

  // Caught, then on an orbit that shrinks as ρ⁴ falls linearly, turning at
  // Kepler's rate; inside RHO_TIDE the tide takes it apart.
  function fall(dt, hx, hy) {
    const c = cursor();
    if (!c) { orbit.gone = true; return; }
    const rs = Math.max(1, now_.rs);
    const w0 = TAU / PERIOD0;
    if (!orbit.on) {
      orbit.on = true;
      orbit.catch = 0;
      orbit.th = Math.atan2(c.y - hy, c.x - hx);
      orbit.rho = Math.hypot(c.x - hx, c.y - hy) / rs;
    }
    orbit.catch += dt;
    const e = smooth(orbit.catch / CATCH);
    if (orbit.catch < CATCH) {
      // From the hand into the orbit: drawn in, and turning ever more.
      const from = Math.hypot(c.x - hx, c.y - hy) / rs;
      orbit.rho = from + (RHO0 - from) * e;
      orbit.w = w0 * e * Math.pow(RHO0 / Math.max(orbit.rho, RHO0), 1.5);
    } else {
      // The orbit decays: ρ⁴ falls linearly, so it goes slowly and then fast.
      const K = (RHO0 ** 4 - RHO_END ** 4) / INSPIRAL;
      orbit.rho = Math.pow(Math.max(RHO_END ** 4 * 0.98, orbit.rho ** 4 - K * dt), 0.25);
      orbit.w = w0 * Math.pow(RHO0 / orbit.rho, 1.5);
    }
    orbit.th -= orbit.w * dt;
    // Caught from close in, it is first thrown out onto the orbit: the tide
    // and the shadow wait until it is on it.
    const onOrbit = orbit.catch >= CATCH;
    orbit.tear = onOrbit ? smooth((RHO_TIDE - orbit.rho) / (RHO_TIDE - RHO_END)) : 0;
    const ox = hx + Math.cos(orbit.th) * orbit.rho * rs;
    const oy = hy + Math.sin(orbit.th) * orbit.rho * rs;
    orbit.x = ox; orbit.y = oy;
    c.offset(ox - c.x, oy - c.y);
    shred(c, ox, oy, hx, hy, rs);
    if (onOrbit && orbit.rho <= RHO_END * 1.01) {
      orbit.gone = true;
      c.fade(0);
      c.bend(null, 0);
      c.offset(0, 0);
    }
  }

  // The cursor's own shape in the tide: turned to keep one face to the hole
  // as it nears (tidally locked), then stretched along its orbit and
  // squeezed across it, sheared so its inner part runs ahead, bent round the
  // orbit, and broken. It dims as it reaches the shadow.
  function shred(c, ox, oy, hx, hy, rs) {
    const q = orbit.tear;
    const urx = (ox - hx), ury = (oy - hy), rr = Math.hypot(urx, ury) || 1;
    const nx = urx / rr, ny = ury / rr; // out from the hole
    const tx = ny, ty = -nx; // along the orbit, the way it goes
    const lock = smooth(orbit.catch / CATCH) * 0.85;
    const spin = (Math.atan2(ty, tx) + Math.PI / 2) * lock;
    const cs = Math.cos(spin), sn = Math.sin(spin);
    c.bend((x, y) => {
      // Locked: the arrow turns to face along its path.
      let px = x * cs - y * sn, py = x * sn + y * cs;
      if (q <= 0) return [px, py];
      let a = px * tx + py * ty; // along the orbit
      let r = px * nx + py * ny; // out from the hole
      a = a * (1 + 9 * q * q) - r * 5 * q; // stretched, and the inner part ahead
      r = r * (1 - 0.75 * q);
      // Laid along the orbit's curve.
      const phi = a / rr, rad = rr + r;
      const wx = hx + (Math.cos(orbit.th - phi) * rad), wy = hy + (Math.sin(orbit.th - phi) * rad);
      return [wx - ox, wy - oy];
    }, clamp01(q * 1.3));
    const toShadow = orbit.catch < CATCH ? 1 : (orbit.rho - RHO_END) / (RHO_TIDE - RHO_END);
    c.fade(0.15 + 0.85 * smooth(toShadow * 1.6));
  }

  // The sheets come back out of the hole, each from its centre, and grow.
  function giveBack(hx, hy) {
    leaves.forEach((l, i) => {
      l.out = true;
      l.bx = at.x - W - l.x;
      l.by = at.y - H / 2 - l.y;
      const a = Math.random() * TAU;
      l.bvx = Math.cos(a) * 120 * (1 + i * 0.2);
      l.bvy = Math.sin(a) * 120 * (1 + i * 0.2);
      l.grow = 0.03;
      l.vgrow = 0;
    });
    const c = cursor();
    if (c) {
      // Its way back to the hand, as a fraction of the way from the hand to
      // the hole: all of it to none, on a spring.
      orbit.back = { f: 1, v: 0, hx, hy };
      c.bend(null, 0);
      c.offset(hx - c.x, hy - c.y);
      c.stretch(0, 0.2, 0.2);
      c.fade(0);
    }
  }

  function comeBack(dt, hx, hy) {
    now_.flash = Math.max(0, 1 - since / 0.25) * 0.4;
    const c = cursor(), g = orbit.back;
    if (!c || !g) return;
    const w = TAU * 1.5, z = 0.55;
    g.v += (-w * w * g.f - 2 * z * w * g.v) * dt;
    g.f += g.v * dt;
    const sc = smooth(since / 0.35);
    orbit.x = c.x + (hx - c.x) * g.f;
    orbit.y = c.y + (hy - c.y) * g.f;
    c.offset(orbit.x - c.x, orbit.y - c.y);
    c.stretch(0, 0.2 + 0.8 * sc, 0.2 + 0.8 * sc);
    c.fade(sc);
  }

  function finish() {
    phase = "calm";
    since = 0;
    orbit.back = null;
    orbit.on = false;
    for (const l of leaves) l.out = false;
    const c = cursor();
    if (c) { c.offset(0, 0); c.stretch(0, 1, 1); c.bend(null, 0); c.fade(null); }
    if (lens) lens.close();
  }

  /* ==== the ink ==== */

  const plate = document.createElement("canvas");
  plate.className = "grad-cotas";
  plate.setAttribute("aria-hidden", "true");
  const floats = document.createElement("div");
  floats.className = "tree-floats grad-floats";
  floats.setAttribute("aria-hidden", "true");
  document.body.append(plate, floats);
  const g = plate.getContext("2d");
  let pw = 0, ph = 0, pdpr = 1, inked = false;
  function sizePlate() {
    pdpr = Math.min(2, devicePixelRatio || 1);
    pw = innerWidth; ph = innerHeight;
    plate.width = Math.round(pw * pdpr);
    plate.height = Math.round(ph * pdpr);
  }
  const FONT = `300 13px "Barlow Condensed", sans-serif`;
  const SUB = `300 9.5px "Barlow Condensed", sans-serif`;
  const LINE = 15;
  const TONE = {};
  let lift = 1;
  function readTheme() {
    const cs = getComputedStyle(root), ft = getComputedStyle(floats);
    TONE.length = cs.getPropertyValue("--cota-length").trim();
    TONE.measure = cs.getPropertyValue("--cota-measure").trim();
    TONE.force = cs.getPropertyValue("--cota-force").trim();
    TONE.circle = ft.getPropertyValue("--tree-ink-circle").trim();
    TONE.construct = ft.getPropertyValue("--tree-ink-construct").trim();
    TONE.push = ft.getPropertyValue("--tree-ink-force").trim();
    const th = root.dataset.theme;
    const dark = th === "dark" || (th !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    lift = dark ? 1 : 1.3;
  }
  // The light theme's opacity lift, as on the tree and the page's cotas.
  const A = (x) => (lift === 1 ? x : 1 - Math.pow(1 - clamp01(x), lift));
  const tone = (kind) => { g.strokeStyle = g.fillStyle = TONE[kind]; };
  const MM = 25.4 / 96;
  const mmOf = (px) => { const v = px * MM; return `${v < 100 ? v.toFixed(1) : Math.round(v)} mm`; };
  // A number as a·10ⁿ.
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const sci = (v, d = 1) => {
    if (!isFinite(v) || v <= 0) return "—";
    const e = Math.floor(Math.log10(v));
    const ex = String(e).replace("-", "⁻").replace(/\d/g, (ch) => SUP[+ch]);
    return `${(v / 10 ** e).toFixed(d)}·10${ex}`;
  };
  // Text with subscripts: "r_s" or "b_{c}" sets the part after _ small and low.
  const parts = (text) => text.split(/(_\{[^}]*\}|_\S)/).filter(Boolean).map((p) =>
    p[0] === "_" ? { t: p[1] === "{" ? p.slice(2, -1) : p.slice(1), sub: true } : { t: p, sub: false });
  const widthOf = (text) => parts(text).reduce((w, p) => { g.font = p.sub ? SUB : FONT; return w + g.measureText(p.t).width; }, 0);
  function write(text, x, y) {
    g.textAlign = "left";
    g.textBaseline = "middle";
    for (const p of parts(text)) {
      g.font = p.sub ? SUB : FONT;
      g.fillText(p.t, x, p.sub ? y + 3.5 : y);
      x += g.measureText(p.t).width;
    }
  }
  // Closed, filled arrowheads, three times as long as wide.
  const head = (x, y, ux, uy, len) => {
    const L = len * 1.5, w = L / 6, bx = x - ux * L, by = y - uy * L;
    g.moveTo(x, y); g.lineTo(bx - uy * w, by + ux * w); g.lineTo(bx + uy * w, by - ux * w); g.closePath();
  };
  function dimLine(x0, y0, x1, y1, a, h0, h1) {
    const d = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / d, uy = (y1 - y0) / d;
    g.globalAlpha = A(a * 0.85);
    g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.beginPath();
    if (h0) head(x0, y0, -ux, -uy, 6);
    if (h1) head(x1, y1, ux, uy, 6);
    g.fill();
  }
  // A value along a line, upright enough to read.
  function along(text, x0, y0, x1, y1, a) {
    let ang = Math.atan2(y1 - y0, x1 - x0);
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;
    g.save();
    g.translate((x0 + x1) / 2, (y0 + y1) / 2);
    g.rotate(ang);
    g.globalAlpha = A(a);
    write(text, -widthOf(text) / 2, -9);
    g.restore();
  }
  // Values on a 45° leader from (tx, ty) toward (sx, sy), read top to bottom
  // on a level shelf, turned back where the screen ends. Returns the shelf's
  // far end, for what goes with it.
  function leader(lines, tx, ty, sx, sy, a) {
    const tw = Math.max(...lines.map(widthOf));
    const LEAD = 22, n = lines.length;
    if (sx < 0 && tx - LEAD - tw - 12 < 6) sx = 1;
    if (sx > 0 && tx + LEAD + tw + 12 > pw - 6) sx = -1;
    if (sy < 0 && ty - LEAD - LINE * n < 4) sy = 1;
    if (sy > 0 && ty + LEAD + LINE * n > ph - 4) sy = -1;
    const ex = tx + sx * LEAD, ey = ty + sy * LEAD, fx = ex + sx * 8;
    g.globalAlpha = A(a * 0.85);
    g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(ex, ey); g.lineTo(fx, ey); g.stroke();
    g.beginPath(); head(tx, ty, -sx * Math.SQRT1_2, -sy * Math.SQRT1_2, 5); g.fill();
    g.globalAlpha = A(a);
    lines.forEach((l, i) => {
      const y = ey + (sy < 0 ? (i - (n - 1)) * LINE : i * LINE);
      write(l, sx > 0 ? fx + 4 : fx - 4 - widthOf(l), y);
    });
    return { x: sx > 0 ? fx + 4 : fx - 4 - tw, y: sy < 0 ? ey - (n - 1) * LINE - LINE : ey + n * LINE, sx, sy, w: tw };
  }
  const cross = (x, y, a) => {
    g.globalAlpha = A(a * 0.7); g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.moveTo(x, y - 5); g.lineTo(x, y + 5); g.stroke();
  };

  /* ---- the formulas, in the tree's script (styles.css, .tree-floats) ---- */
  const I = (s, cls) => `<i${cls ? ` class="${cls}"` : ""}>${s}</i>`;
  const frac = (a, b) => `<span class="frac"><span>${a}</span><span>${b}</span></span>`;
  const FX = {
    push: "F = k v",
    lerp: "k = (1 − t) k<sub>0</sub> + t k<sub>1</sub>",
    sway: `${I("x", "ddot")} + 2${I("ζω")}&#8239;${I("x", "dot")} + ${I("ω")}<sup>2</sup>(x − w) = 0`,
    rs: `r<sub>s</sub> = ${frac("2GM", "c<sup>2</sup>")}`,
    bend: `${I("α")} = ${frac("2r<sub>s</sub>", "b")}`,
    pull: `g = ${frac("GM", "d<sup>2</sup>")}`,
    kepler: `${I("ω")} = ${frac("√GM", "ρ<sup>3/2</sup>")}`,
    tide: `${I("Δ")}g = ${frac("2GM ℓ", "d<sup>3</sup>")}`,
    heat: `T<sub>H</sub> = ${frac("ħ c<sup>3</sup>", "8" + I("π") + "GM k<sub>B</sub>")}`,
    life: "t<sub>ev</sub> ∝ M<sup>3</sup>",
  };
  const fxEl = {};
  for (const [k, html] of Object.entries(FX)) {
    const el = document.createElement("div");
    el.className = "fx force";
    el.style.fontSize = k === "lerp" || k === "kepler" || k === "life" ? "15px" : "18px";
    el.innerHTML = html;
    floats.appendChild(el);
    fxEl[k] = { el, a: 0, want: 0, x: 0, y: 0, w: 0, h: 0 };
  }
  function sizeFloats() {
    for (const f of Object.values(fxEl)) { f.w = f.el.offsetWidth; f.h = f.el.offsetHeight; }
  }
  // Asked for this frame at (x, y), its top left, kept on the screen.
  function want(k, x, y, a = 1) {
    const f = fxEl[k];
    f.want = a;
    f.x = clamp(x, 6, pw - 6 - f.w);
    f.y = clamp(y, 6, ph - 6 - f.h);
  }
  function showFloats(dt) {
    let any = false;
    for (const f of Object.values(fxEl)) {
      f.a += (f.want - f.a) * (1 - Math.exp(-dt / (f.want > f.a ? 0.12 : 0.3)));
      if (Math.abs(f.want - f.a) < 0.004) f.a = f.want;
      if (f.a > 0) {
        any = true;
        f.el.style.visibility = "visible";
        f.el.style.opacity = String(A(f.a));
        f.el.style.transform = `translate(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px) rotate(-3deg)`;
      } else if (f.el.style.visibility !== "hidden") {
        f.el.style.visibility = "hidden";
      }
      f.want = 0;
    }
    return any;
  }

  /* ---- the tree's air, round the drawn cursor ---- */
  const CONTACT = 24, WAKE = 80, V1 = 2600, FULL = 110;
  const air = { a: 0, t: 0, cur: 0, hold: 0, x: 0, y: 0, lx: 0, ly: 0, vx: 0, vy: 0, set: false };
  function follow(dt) {
    const c = cursor();
    // Where the cursor is drawn: on its orbit, on its way back, or the hand.
    const caught = phase === "fall" && orbit.on;
    const x = caught || (phase === "back" && orbit.back) ? orbit.x : hand.x;
    const y = caught || (phase === "back" && orbit.back) ? orbit.y : hand.y;
    if (!air.set) { air.lx = x; air.ly = y; air.set = true; }
    const vx = (x - air.lx) / dt, vy = (y - air.ly) / dt;
    air.lx = x; air.ly = y;
    const k = 1 - Math.exp(-dt / 0.04);
    air.vx += (vx - air.vx) * k; air.vy += (vy - air.vy) * k;
    air.x = x; air.y = y;
    // Near the sheets, or caught by the hole, the air is this one's.
    let near = false;
    if (box && hand.seen && c && c.on) {
      const d = Math.hypot(hand.x - (box.left + W), hand.y - (box.top + H / 2));
      near = d < 0.3 * R + WAKE;
    }
    const visibleCursor = phase === "calm" ? near : phase === "fall" ? !orbit.gone : phase === "back";
    air.a += ((visibleCursor ? 1 : 0) - air.a) * (1 - Math.exp(-dt / 0.1));
    if (air.a < 0.004) air.a = 0;
    const speed = Math.hypot(air.vx, air.vy);
    air.t += (Math.min(1, speed / V1) - air.t) * (1 - Math.exp(-dt / 0.05));
    if (visibleCursor && speed > 40) air.hold = 0.16;
    else air.hold = Math.max(0, air.hold - dt);
    const w = air.hold > 0 ? 1 : 0;
    air.cur += (w - air.cur) * (1 - Math.exp(-dt / (w > air.cur ? 0.05 : 0.2)));
    if (air.cur < 0.004) air.cur = 0;
    const held = air.a > 0 || phase !== "calm";
    if (held !== root.hasAttribute("data-air-held")) root.toggleAttribute("data-air-held", held);
  }
  function drawAir() {
    if (air.a < 0.01) return;
    const { x, y } = air;
    tone("circle");
    g.lineWidth = 0.8 + 1.2 * air.t;
    g.globalAlpha = A(air.a * (0.4 + 0.5 * air.t));
    g.beginPath(); g.arc(x, y, CONTACT, 0, TAU); g.stroke();
    g.lineWidth = 0.7;
    g.globalAlpha = A(air.a * 0.3);
    g.beginPath(); g.arc(x, y, WAKE, 0, TAU); g.stroke();
    // Its velocity on a rule, the arrow reaching as far along it as t.
    const sp = Math.hypot(air.vx, air.vy);
    if (sp > 30 && air.cur > 0.01) {
      tone("push");
      const ux = air.vx / sp, uy = air.vy / sp;
      const x0 = x + ux * CONTACT, y0 = y + uy * CONTACT;
      g.globalAlpha = A(air.a * air.cur * 0.55);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x0, y0); g.lineTo(x0 + ux * FULL, y0 + uy * FULL);
      for (let k = 0; k <= 10; k++) {
        const len = k % 5 === 0 ? 6 : 3;
        const px = x0 + ux * FULL * (k / 10), py = y0 + uy * FULL * (k / 10);
        g.moveTo(px, py); g.lineTo(px - uy * len, py + ux * len);
      }
      g.stroke();
      const ax = x0 + ux * FULL * air.t, ay = y0 + uy * FULL * air.t;
      g.globalAlpha = A(air.a * air.cur);
      g.lineWidth = 1.7;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(ax, ay); g.stroke();
      g.beginPath(); head(ax, ay, ux, uy, 6); g.fill();
    }
  }

  // How much of each to show, eased.
  const shown = { sheet: 0, hole: 0, fall: 0, heat: 0 };
  let sheetAt = null; // the sheet last under the hand
  const G = 6.674e-11, C2 = 8.988e16, M_EARTH = 5.972e24;
  const massOf = (rsPx) => ((rsPx * MM) / 1000) * C2 / (2 * G);

  function ink(dt) {
    const ease = (k, w, tin, tout) => {
      shown[k] += (w - shown[k]) * (1 - Math.exp(-dt / (w > shown[k] ? tin : tout)));
      if (Math.abs(w - shown[k]) < 0.004) shown[k] = w;
    };
    // The sheet under the hand: the smallest that holds it, on bare ground.
    let under = null;
    if (phase === "calm" && hand.seen && hand.bare && box) {
      for (let i = leaves.length - 1; i >= 0; i--) {
        const l = leaves[i];
        if (Math.hypot(hand.x - box.left - l.ax, hand.y - box.top - l.ay) < l.ar) { under = l; break; }
      }
    }
    if (under) sheetAt = under;
    ease("sheet", under ? 1 : 0, 0.12, phase === "calm" ? 0.4 : 0.08);
    ease("hole", phase === "fall" || phase === "hold" ? 1 : 0, 0.3, 0.12);
    ease("fall", phase === "fall" && orbit.on && !orbit.gone ? 1 : 0, 0.15, 0.15);
    ease("heat", (phase === "boom" && since > 0.2) || (phase === "back" && since < 0.7) ? 1 : 0, 0.12, 0.35);

    g.setTransform(pdpr, 0, 0, pdpr, 0, 0);
    if (inked) g.clearRect(0, 0, pw, ph);
    inked = false;

    const cx = air.x, cy = air.y;
    // The tree's own formulas, by the cursor while it moves near the sheets;
    // once it is caught, the pull it is under.
    if (air.cur > 0.01 && air.a > 0.01) {
      let fx = cx + 30, fy = cy + 22;
      if (fx + 200 > pw) fx = cx - 30 - 200;
      if (phase === "calm" || phase === "back") {
        want("push", fx, fy, air.cur * air.a);
        want("lerp", fx + 4, fy + 30, air.cur * air.a * 0.9);
      }
    }

    if (shown.sheet > 0 && sheetAt && box) {
      // Its radius, from its centre out through the hand to its edge.
      const l = sheetAt, i = leaves.indexOf(l);
      const sx0 = box.left + l.ax, sy0 = box.top + l.ay, r = l.ar;
      let ux = hand.x - sx0, uy = hand.y - sy0;
      const d = Math.hypot(ux, uy) || 1; ux /= d; uy /= d;
      const ex = sx0 + ux * r, ey = sy0 + uy * r;
      tone("length");
      cross(sx0, sy0, shown.sheet);
      dimLine(sx0, sy0, ex, ey, shown.sheet * 0.8, false, true);
      along(`r_${i} = ${mmOf(r)}`, sx0, sy0, ex, ey, shown.sheet * 0.85);
      tone("measure");
      const end = leader([
        `z_${i} = ${l.z > 0 ? "+" : "−"}${mmOf(Math.abs(l.z))}`,
        `f = ${l.f.toFixed(2)} Hz   ζ = ${l.zeta.toFixed(2)}`,
      ], ex, ey, ux < 0 ? -1 : 1, uy < 0 ? -1 : 1, shown.sheet * 0.8);
      const f = fxEl.sway;
      want("sway", end.sx > 0 ? end.x : end.x + end.w - f.w, end.sy < 0 ? end.y - f.h + 4 : end.y + 2, shown.sheet);
    }

    if (phase !== "calm" && box) {
      const hx = box.left + at.x, hy = box.top + at.y;
      const rs = Math.max(0, now_.rs);
      const M = massOf(at.rs);
      if (shown.hole > 0 && rs > 1) {
        // The shadow, across, under the disc: light that comes nearer than
        // b_c = (3√3/2) r_s is lost.
        const bc = 2.598 * rs, y = hy + 11 * rs;
        tone("length");
        g.globalAlpha = A(shown.hole * 0.45); g.lineWidth = 0.7;
        g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(hx - bc, hy); g.lineTo(hx - bc, y + 4); g.moveTo(hx + bc, hy); g.lineTo(hx + bc, y + 4); g.stroke();
        g.setLineDash([]);
        dimLine(hx - bc, y, hx + bc, y, shown.hole, true, true);
        along(`2b_c = 3√3 r_s = ${mmOf(2 * bc)}`, hx - bc, y + 18, hx + bc, y + 18, shown.hole);
        // The Einstein ring: where the page behind is seen all round.
        const bE = Math.sqrt(2 * 10) * rs;
        tone("construct");
        g.globalAlpha = A(shown.hole * 0.5); g.lineWidth = 0.7;
        g.setLineDash([2, 4]);
        g.beginPath(); g.arc(hx, hy, bE, 0, TAU); g.stroke();
        g.setLineDash([]);
        // Its mass, from the size of its horizon.
        tone("measure");
        const lead = leader([
          `r_s = ${mmOf(at.rs)}`,
          `M = ${sci(M)} kg ≈ ${(M / M_EARTH).toFixed(1)} M⊕`,
          ...(phase === "hold" ? ["M → M + m_{cursor}"] : []),
        ], hx - bE * Math.SQRT1_2, hy - bE * Math.SQRT1_2, -1, -1, shown.hole);
        want("rs", lead.sx > 0 ? lead.x : lead.x + lead.w - fxEl.rs.w, lead.y - fxEl.rs.h, shown.hole);
        want("bend", hx + bE * 0.8 + 8, hy + bE * 0.5, shown.hole * 0.9);
      }
      if (shown.fall > 0 && orbit.on) {
        // The cursor's distance, and the pull, while it can be read.
        const d = Math.hypot(orbit.x - hx, orbit.y - hy);
        const sh = 2.598 * rs;
        const a = shown.fall * smooth((d - sh * 1.2) / (sh * 0.8));
        if (a > 0.004 && d > sh) {
          const ux = (orbit.x - hx) / d, uy = (orbit.y - hy) / d;
          tone("length");
          dimLine(hx + ux * sh, hy + uy * sh, orbit.x - ux * CONTACT, orbit.y - uy * CONTACT, a * 0.8, false, true);
          along(`ρ = ${(d / Math.max(rs, 1)).toFixed(1)} r_s`, hx + ux * sh, hy + uy * sh, orbit.x, orbit.y, a);
          tone("measure");
          const gv = (G * M) / ((d * MM) / 1000) ** 2;
          const period = TAU / Math.max(orbit.w, 1e-3);
          leader([
            `g = ${sci(gv)} m/s²`,
            `T = ${period.toFixed(2)} s`,
            ...(orbit.tear > 0.05 ? ["spaghettification"] : []),
          ], orbit.x + ux * CONTACT * 0.7, orbit.y + uy * CONTACT * 0.7, ux < 0 ? -1 : 1, uy < 0 ? -1 : 1, a);
        }
        // By the cursor, what it is under.
        let fx = orbit.x + 34, fy = orbit.y + 26;
        if (fx + 160 > pw) fx = orbit.x - 34 - 160;
        want("pull", fx, fy, shown.fall);
        want(orbit.tear > 0.05 ? "tide" : "kepler", fx + 4, fy + 40, shown.fall * 0.9);
      }
      if (shown.heat > 0) {
        tone("measure");
        const T = 1.227e23 / M; // ħc³ / (8πGk_B), in kg·K
        const lead = leader([`T_H = ${sci(T, 2)} K`, "t_{ev} ∝ M³"], hx - 3 * at.rs, hy - 3 * at.rs, -1, -1, shown.heat);
        want("heat", lead.sx > 0 ? lead.x : lead.x + lead.w - fxEl.heat.w, lead.y - fxEl.heat.h, shown.heat);
      }
    }

    drawAir();
    const any = shown.sheet + shown.hole + shown.fall + shown.heat + air.a > 0;
    inked = any;
    g.globalAlpha = 1;
    if (showFloats(dt)) inked = true;
  }

  /* ==== setting up, and putting away ==== */

  // Back to the drawing as it is, when the page stops being a desktop one.
  function rest() {
    if (phase !== "calm") finish();
    stack.classList.remove("live");
    stack.style.perspectiveOrigin = "";
    for (const l of leaves) { l.el.style.transform = ""; l.el.style.opacity = ""; }
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, plate.width, plate.height); inked = false;
    for (const f of Object.values(fxEl)) { f.a = 0; f.el.style.visibility = "hidden"; }
    root.removeAttribute("data-air-held");
  }

  function start() {
    if (!desk.matches) { rest(); return; }
    measure();
    sizePlate();
    readTheme();
    sizeFloats();
    stack.classList.add("live");
    wake();
  }

  addEventListener("resize", () => { measure(); sizePlate(); }, { passive: true });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readTheme);
  new MutationObserver(readTheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  desk.addEventListener("change", start);
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) wake();
  }).observe(stack);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
  // The faces the ink is set in: the canvas would not ask for them.
  if (document.fonts) {
    document.fonts.load(FONT).catch(() => {});
    Promise.all([
      document.fonts.load('18px "Petit Formal Script"'),
      document.fonts.load('italic 18px "EB Garamond"'),
    ]).then(sizeFloats, () => {});
  }
  start();
})();
