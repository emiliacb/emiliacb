/**
 * The gradient on the pages without the tree, as a stack of sheets, and the
 * black hole a click makes of it.
 *
 * The markup (src/site/components/layout.ts) draws the gradient as five
 * concentric sheets of colour centred on the right edge of the page, back to
 * front and largest to smallest. Each carries a share of the old gradient
 * (styles.css, .grad-layer), so at rest the five make it again. On a desktop
 * this hangs them at different depths in one perspective, so they part as
 * the pointer moves, and lets each sway like a leaf: a damped spring on its
 * place and on its tilt, pushed by a breeze that passes from the back sheet to
 * the front one and by the pointer brushing through it. The small front
 * sheets are the light leaves, quicker and easier to move, and like the
 * tree's leaves each rings its note when the hand brushes through its edge.
 *
 * A click on the gradient makes a black hole of it, out of its own matter
 * (gradient/lens.js, light traced past it the way Interstellar's was). The
 * sheets tremble while the page behind is copied; then their matter flows in
 * and winds round, the inner sheets folding in on themselves and the outer
 * ones torn into spiral arms, the halo coming apart into a cloud of points
 * drawn out into streaks, and what reaches the middle lights the disc in the
 * gradient's colours. The page behind bends round it. The drawn cursor
 * (ink-cursor.js), held to the arrow, is caught into an orbit that shrinks
 * as it goes, so it turns faster and faster (Kepler: ω ∝ ρ^−3/2, the orbit
 * decaying as a radiating pair's does, ρ⁴ falling linearly); inside the tidal
 * radius it comes apart, stretched along the orbit and sheared by it into a
 * thread, and is gone at the shadow. After a moment the hole evaporates in a
 * flash and gives back the sheets and the cursor. Only the drawing is taken:
 * the pointer itself stays where the hand is. All of it is heard
 * (gradient/sound.js).
 *
 * The pointer carries the tree's air, its contact ring, its wake and its
 * velocity on a rule, near the sheets and while it falls; page-cotas.js
 * leaves the pointer to this meanwhile (html[data-air-held]).
 *
 * Desktop only, (min-width: 768px) and a fine pointer that can hover, and not
 * with reduced motion; everywhere else the sheets stay as they are drawn.
 */
import { makeLens } from "./gradient/lens.js";
import { makeSound, note } from "./gradient/sound.js";

(() => {
  const stack = document.getElementById("gradient-bg");
  const host = document.getElementById("overlay-content");
  if (!stack || !host || !stack.classList.contains("grad-stack")) return;
  const desk = matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine)");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const sheets = Array.from(stack.querySelectorAll(".grad-layer"));
  if (!sheets.length) return;
  const root = document.documentElement;
  const sound = makeSound();

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
  //   tone   its note: the biggest lowest, in the tree's scale
  const KIND = [
    { z: -320, f: 0.42, zeta: 0.3, give: 0.18, wind: 9, tilt: 0.04, tone: note(0) },
    { z: -210, f: 0.58, zeta: 0.22, give: 0.32, wind: 12, tilt: 0.07, tone: note(3) },
    { z: -130, f: 0.74, zeta: 0.18, give: 0.46, wind: 15, tilt: 0.1, tone: note(4) },
    { z: -60, f: 0.95, zeta: 0.16, give: 0.62, wind: 17, tilt: 0.13, tone: note(6) },
    { z: 10, f: 1.25, zeta: 0.14, give: 0.8, wind: 19, tilt: 0.17, tone: note(8) },
  ];
  // Each sheet's share of the old gradient, as styles.css has it: four stops
  // along its radius and the alpha at each, then down to nothing at its edge.
  const PROFILE = [
    { stops: [0, 0.5, 0.66, 0.7], alphas: [0, 0, 0.1, 0.1] },
    { stops: [0, 0.52, 0.95, 0.965], alphas: [0, 0, 0.222, 0.222] },
    { stops: [0, 0.55, 0.55, 0.55], alphas: [0.1, 0.1, 0.1, 0.1] },
    { stops: [0, 0.9, 0.9, 0.9], alphas: [0.118, 0.118, 0.118, 0.118] },
    { stops: [0, 0.92, 0.92, 0.92], alphas: [0.118, 0.118, 0.118, 0.118] },
  ];
  const leaves = sheets.map((el, i) => {
    const kind = KIND[Math.min(i, KIND.length - 1)];
    const st = el.style;
    return {
      el, ...kind, ...PROFILE[Math.min(i, PROFILE.length - 1)],
      k: parseFloat(st.getPropertyValue("--k")) || 0.2,
      b: st.getPropertyValue("--c").includes("g-b"), // which of the two colours
      seed: 17 + i * 31,
      x: 0, y: 0, vx: 0, vy: 0, // its place, about the centre, in px
      rx: 0, ry: 0, vrx: 0, vry: 0, // its tilt about x and y, in radians
      bx: 0, by: 0, bvx: 0, bvy: 0, // how far it still is from coming back out of the hole
      grow: 1, vgrow: 0, // its size, as it comes back out
      ax: 0, ay: 0, ar: 0, ao: 1, // where it shows, in the box: centre, radius, opacity
      inside: false, rang: -1, // the hand inside it, and when it last rang
      out: false,
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

  const hand = { x: -1e4, y: -1e4, lastX: -1e4, lastY: -1e4, vx: 0, vy: 0, seen: false };
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    hand.x = e.clientX;
    hand.y = e.clientY;
    if (!hand.seen) { hand.lastX = hand.x; hand.lastY = hand.y; hand.seen = true; }
    wake();
  }, { passive: true });
  root.addEventListener("mouseleave", () => { hand.seen = false; });
  // Where the eye is: the perspective's origin follows the hand a little.
  const eye = { x: 0, y: 0, set: false };

  /* ==== the hole ==== */

  let lens; // made on the first click (gradient/lens.js); null without WebGL
  // calm → gather (the sheets tremble while the page is copied) → fall (they
  // are eaten, the cursor is caught) → hold → boom → back.
  let phase = "calm", since = 0, clock = 0, eaten = 0;
  // The hole: its centre in the box and in the host, r_s, and the square
  // the lens draws, half of its side.
  const at = { x: 0, y: 0, hx: 0, hy: 0, rs: 0, half: 0 };
  const now_ = { rs: 0, disc: 0, flash: 0, lens: 0 };
  const cursor = () => window.__inkCursor;
  const GATHER = 1.2; // the most the copy is waited for, in s
  const BIG_BANG = 1.2; // how long the hole stays once it has eaten, in s
  let drone = null, chirp = null;

  // The cursor's fall: where it was caught from, then its orbit.
  //   catch    s since the hole began to pull it
  //   rho, th  its orbit about the hole, in r_s and radians
  //   w        its angular speed
  //   tear     how far it has come apart, 0 to 1
  const orbit = {
    on: false, catch: 0, rho: 0, th: 0, w: 0, tear: 0, gone: false, shattered: false,
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
    // The hole's size goes with the gradient's.
    const rs = clamp(0.017 * R, 10, 18);
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
    // The square holds all the sheets, which it draws while they are eaten,
    // and the bending round the hole.
    at.half = Math.round(Math.max(16 * rs, Math.hypot(hx - cx, hy - cy) + 0.31 * R));
    if (lens) lens.open(at.hx, at.hy, at.half, 12 * rs);
    Object.assign(orbit, { on: false, catch: 0, rho: 0, th: 0, w: 0, tear: 0, gone: false, shattered: false, back: null });
    Object.assign(now_, { rs: 0, disc: 0, flash: 0, lens: 0 });
    eaten = 0;
    phase = "gather";
    since = 0;
    root.setAttribute("data-air-held", "");
    // What falls in, and comes back out, is the arrow.
    cursor()?.hold("default");
    sound.start();
    drone = sound.drone();
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
    // Gathering, the sheets tremble, the light ones most.
    if (phase === "gather") {
      const k = smooth(since / GATHER) * 900 * (0.4 + l.give);
      l.vx += (Math.random() - 0.5) * k * dt * 4;
      l.vy += (Math.random() - 0.5) * k * dt * 4;
    }
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

  // The hand brushing through a sheet takes it along a little, and tips it;
  // crossing its edge with some speed, it rings.
  function brush(l, hx, hy, vx, vy, dt) {
    const r = l.k * R * l.grow;
    const cx = W + l.x + l.bx, cy = H / 2 + l.y + l.by;
    const d = Math.hypot(hx - cx, hy - cy);
    const inside = hand.seen && d < r;
    const speed = Math.hypot(vx, vy);
    if (inside !== l.inside) {
      l.inside = inside;
      if (speed > 180 && t - l.rang > 0.14) {
        l.rang = t;
        sound.bell(l.tone, Math.min(1, speed / 2200), clamp((hand.x / innerWidth) * 2 - 1, -1, 1) * 0.7);
      }
    }
    if (!inside) return;
    // A hand at rest inside it holds nothing back.
    const reach = (1 - (d / r) ** 2) * clamp01(speed / 300);
    const k = 1 - Math.exp(-dt * 7 * l.give * reach);
    l.vx += (vx * 0.5 - l.vx) * k;
    l.vy += (vy * 0.5 - l.vy) * k;
    l.vry += vx * 0.00012 * l.give * reach * dt * 60;
    l.vrx -= vy * 0.00012 * l.give * reach * dt * 60;
  }

  // Sets a sheet's transform, and notes where it shows: through the
  // perspective, a point at depth z sits (P / (P − z)) as far from the eye.
  function place(l) {
    const s = ((P - l.z) / P) * l.grow;
    const x = l.x + l.bx, y = l.y + l.by;
    const o = l.grow < 1 ? clamp01(l.grow * 2) : 1;
    l.el.style.transform =
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${l.z.toFixed(1)}px) ` +
      `rotateX(${Math.tanh(l.rx).toFixed(4)}rad) rotateY(${Math.tanh(l.ry).toFixed(4)}rad) scale(${Math.max(0, s).toFixed(4)})`;
    l.el.style.opacity = o < 1 ? String(o) : "";
    const k = P / (P - l.z);
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
    }
    if (!eye.set) { eye.x = ex; eye.y = ey; eye.set = true; }
    const ek = 1 - Math.exp(-dt / 0.25);
    eye.x += (ex - eye.x) * ek;
    eye.y += (ey - eye.y) * ek;
    stack.style.perspectiveOrigin = `${eye.x.toFixed(1)}px ${eye.y.toFixed(1)}px`;

    // Small steps, so the quick front sheet stays stable at any frame rate.
    const n = Math.ceil(dt / (1 / 120));
    const touch = phase === "calm" || phase === "back";
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < leaves.length; i++) {
        sway(leaves[i], dt / n, i);
        if (touch) brush(leaves[i], hx, hy, hand.vx, hand.vy, dt / n);
      }
    }
    // While the hole eats them, the lens draws the sheets, from where they
    // were when it began.
    const eatenNow = phase === "fall" || phase === "hold" || (phase === "boom" && !leaves[0].out);
    if (!eatenNow) for (const l of leaves) place(l);
    if (phase !== "calm") hole(dt);
    follow(dt);
    drawAir();

    const moving = hand.seen && Math.hypot(hand.vx, hand.vy) > 1;
    if (visible || phase !== "calm" || moving || inked) raf = requestAnimationFrame(frame);
  }

  function hole(dt) {
    since += dt;
    clock += dt;
    const hx = box.left + at.x, hy = box.top + at.y; // on screen
    let level = 1, sink = 0;

    if (phase === "gather") {
      level = 0.5 * smooth(since / 0.5);
      // Once the page is copied (or it is not coming), the sheets are eaten.
      if (!lens || lens.ready || since > GATHER) {
        phase = "fall";
        since = 0;
        if (lens) stack.classList.add("eaten");
      }
    } else if (phase === "fall") {
      eaten = since;
      now_.rs = at.rs * smooth((since - 0.1) / 1.2);
      now_.disc = smooth((since - 0.35) / 1.4);
      sink = smooth(since / 4);
      if (since > 0.6) fall(dt, hx, hy);
      if (orbit.gone) { phase = "hold"; since = 0; }
    } else if (phase === "hold") {
      // A gulp as it eats.
      eaten += dt;
      now_.rs = at.rs * (1 + 0.12 * Math.exp(-since / 0.2) * Math.sin(since * 26));
      now_.disc = 1 + 0.5 * Math.exp(-since / 0.3);
      sink = 1;
      if (since > BIG_BANG) {
        phase = "boom"; since = 0;
        if (drone) { drone.stop(0.5); drone = null; }
        sound.evaporate();
      }
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
    if (drone) drone.set(level, sink);

    if (lens && (phase === "fall" || phase === "hold" || phase === "boom")) {
      now_.lens += ((lens.ready ? 1 : 0) - now_.lens) * (1 - Math.exp(-dt / 0.2));
      const ox = at.x - at.half, oy = at.y - at.half; // the square, in the box
      const ga = rgbOf("--g-a"), gb = rgbOf("--g-b");
      const dark = matchMedia("(prefers-color-scheme: dark)").matches;
      // The disc is lit in the gradient's own colours, brighter: the inner
      // sheets' at its hot middle, the outer ones' at its edge.
      const lit = (c, k) => c.map((v) => v + (1 - v) * k);
      const e = Math.max(0, eaten);
      lens.draw({
        rs: now_.rs, lens: now_.lens, disc: now_.disc, flash: now_.flash, time: clock,
        hot: lit(ga, dark ? 0.75 : 0.7), mid: lit(ga, dark ? 0.35 : 0.05), out: lit(gb, dark ? 0.35 : 0),
        // Its matter flows in faster and faster, and winds round as it comes.
        flow: (0.05 * R) ** 2 * e * e * e,
        wind: 2.4 * e, windR: 6 * at.rs,
        tear: smooth(e / 1.4), cloud: smooth((e - 0.2) / 1.2),
        sheets: leaves.map((l) => ({
          x: l.ax - ox, y: l.ay - oy, r: l.ar, o: l.ao, c: l.b ? gb : ga, stops: l.stops, alphas: l.alphas,
        })),
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
      chirp = sound.chirp();
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
    shred(c, ox, oy, hx, hy);
    // Its tone rises with its turning, as a pair of stars' does.
    if (chirp) chirp.set(110 * (orbit.w / w0) * (0.5 + 0.5 * e), e * (0.5 + 0.5 * orbit.tear), orbit.th);
    if (orbit.tear > 0.3 && !orbit.shattered) { orbit.shattered = true; sound.shatter(); }
    if (onOrbit && orbit.rho <= RHO_END * 1.01) {
      orbit.gone = true;
      c.fade(0);
      c.bend(null, 0);
      c.offset(0, 0);
      if (chirp) { chirp.stop(); chirp = null; }
      sound.wood(note(0, -1), 1, clamp((hx / innerWidth) * 2 - 1, -1, 1) * 0.6);
    }
  }

  // The cursor's own shape in the tide: turned to keep one face to the hole
  // as it nears (tidally locked), then stretched along its orbit and
  // squeezed across it, sheared so its inner part runs ahead, bent round the
  // orbit, and broken. It dims as it reaches the shadow.
  function shred(c, ox, oy, hx, hy) {
    const q = orbit.tear;
    const urx = ox - hx, ury = oy - hy, rr = Math.hypot(urx, ury) || 1;
    const nx = urx / rr, ny = ury / rr; // out from the hole
    const tx = ny, ty = -nx; // along the orbit, the way it goes
    const lock = smooth(orbit.catch / CATCH) * 0.85;
    const spin = (Math.atan2(ty, tx) + Math.PI / 2) * lock;
    const cs = Math.cos(spin), sn = Math.sin(spin);
    c.bend((x, y) => {
      // Locked: the arrow turns to face along its path.
      const px = x * cs - y * sn, py = x * sn + y * cs;
      if (q <= 0) return [px, py];
      let a = px * tx + py * ty; // along the orbit
      let r = px * nx + py * ny; // out from the hole
      a = a * (1 + 9 * q * q) - r * 5 * q; // stretched, and the inner part ahead
      r = r * (1 - 0.75 * q);
      // Laid along the orbit's curve.
      const phi = a / rr, rad = rr + r;
      return [hx + Math.cos(orbit.th - phi) * rad - ox, hy + Math.sin(orbit.th - phi) * rad - oy];
    }, clamp01(q * 1.3));
    const toShadow = orbit.catch < CATCH ? 1 : (orbit.rho - RHO_END) / (RHO_TIDE - RHO_END);
    c.fade(0.15 + 0.85 * smooth(toShadow * 1.6));
  }

  // The sheets come back out of the hole, each from its centre, and grow.
  function giveBack(hx, hy) {
    stack.classList.remove("eaten");
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
      orbit.back = { f: 1, v: 0 };
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
    stack.classList.remove("eaten");
    for (const l of leaves) l.out = false;
    const c = cursor();
    if (c) { c.offset(0, 0); c.stretch(0, 1, 1); c.bend(null, 0); c.fade(null); c.hold(null); }
    if (chirp) { chirp.stop(); chirp = null; }
    if (drone) { drone.stop(); drone = null; }
    if (lens) lens.close();
  }

  /* ==== the tree's air, round the drawn cursor ==== */

  const plate = document.createElement("canvas");
  plate.className = "grad-air";
  plate.setAttribute("aria-hidden", "true");
  document.body.append(plate);
  const g = plate.getContext("2d");
  let pw = 0, ph = 0, pdpr = 1, inked = false;
  function sizePlate() {
    pdpr = Math.min(2, devicePixelRatio || 1);
    pw = innerWidth; ph = innerHeight;
    plate.width = Math.round(pw * pdpr);
    plate.height = Math.round(ph * pdpr);
  }
  const TONE = {};
  let lift = 1;
  function readTheme() {
    const cs = getComputedStyle(root);
    TONE.ring = cs.getPropertyValue("--cota-length").trim();
    TONE.push = cs.getPropertyValue("--cota-force").trim();
    const th = root.dataset.theme;
    const dark = th === "dark" || (th !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    lift = dark ? 1 : 1.3;
  }
  // The light theme's opacity lift, as on the tree and the page's cotas.
  const A = (x) => (lift === 1 ? x : 1 - Math.pow(1 - clamp01(x), lift));

  const CONTACT = 24, WAKE = 80, V1 = 2600, FULL = 110;
  const air = { a: 0, t: 0, cur: 0, hold: 0, x: 0, y: 0, lx: 0, ly: 0, vx: 0, vy: 0, set: false };
  function follow(dt) {
    const c = cursor();
    // Where the cursor is drawn: on its orbit, on its way back, or the hand.
    const drawn = (phase === "fall" && orbit.on) || (phase === "back" && orbit.back);
    const x = drawn ? orbit.x : hand.x;
    const y = drawn ? orbit.y : hand.y;
    if (!air.set) { air.lx = x; air.ly = y; air.set = true; }
    const vx = (x - air.lx) / dt, vy = (y - air.ly) / dt;
    air.lx = x; air.ly = y;
    const k = 1 - Math.exp(-dt / 0.04);
    air.vx += (vx - air.vx) * k; air.vy += (vy - air.vy) * k;
    air.x = x; air.y = y;
    // Near the sheets, or caught by the hole, the air is this one's.
    let near = false;
    if (box && hand.seen && c && c.on) near = Math.hypot(hand.x - (box.left + W), hand.y - (box.top + H / 2)) < 0.3 * R + WAKE;
    const shown = phase === "calm" ? near : phase === "fall" ? orbit.on && !orbit.gone : phase === "back";
    air.a += ((shown ? 1 : 0) - air.a) * (1 - Math.exp(-dt / 0.1));
    if (air.a < 0.004) air.a = 0;
    const speed = Math.hypot(air.vx, air.vy);
    air.t += (Math.min(1, speed / V1) - air.t) * (1 - Math.exp(-dt / 0.05));
    if (shown && speed > 40) air.hold = 0.16;
    else air.hold = Math.max(0, air.hold - dt);
    const w = air.hold > 0 ? 1 : 0;
    air.cur += (w - air.cur) * (1 - Math.exp(-dt / (w > air.cur ? 0.05 : 0.2)));
    if (air.cur < 0.004) air.cur = 0;
    const held = air.a > 0 || phase !== "calm";
    if (held !== root.hasAttribute("data-air-held")) root.toggleAttribute("data-air-held", held);
  }
  function drawAir() {
    g.setTransform(pdpr, 0, 0, pdpr, 0, 0);
    if (inked) g.clearRect(0, 0, pw, ph);
    inked = air.a >= 0.01;
    if (!inked) return;
    const { x, y } = air;
    g.strokeStyle = g.fillStyle = TONE.ring;
    g.lineWidth = 0.8 + 1.2 * air.t;
    g.globalAlpha = A(air.a * (0.4 + 0.5 * air.t));
    g.beginPath(); g.arc(x, y, CONTACT, 0, TAU); g.stroke();
    g.lineWidth = 0.7;
    g.globalAlpha = A(air.a * 0.3);
    g.beginPath(); g.arc(x, y, WAKE, 0, TAU); g.stroke();
    // Its velocity on a rule, the arrow reaching as far along it as t.
    const sp = Math.hypot(air.vx, air.vy);
    if (sp > 30 && air.cur > 0.01) {
      g.strokeStyle = g.fillStyle = TONE.push;
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
      // Its head: closed and filled, three times as long as wide.
      const L = 9, hw = L / 6, bx = ax - ux * L, by = ay - uy * L;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx - uy * hw, by + ux * hw); g.lineTo(bx + uy * hw, by - ux * hw); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
  }

  /* ==== setting up, and putting away ==== */

  // Back to the drawing as it is, when the page stops being a desktop one.
  function rest() {
    if (phase !== "calm") finish();
    stack.classList.remove("live");
    stack.style.perspectiveOrigin = "";
    for (const l of leaves) { l.el.style.transform = ""; l.el.style.opacity = ""; }
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, plate.width, plate.height); inked = false;
    root.removeAttribute("data-air-held");
  }

  function start() {
    if (!desk.matches) { rest(); return; }
    measure();
    sizePlate();
    readTheme();
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
  start();
})();
