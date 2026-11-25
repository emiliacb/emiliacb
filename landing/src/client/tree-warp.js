// The home's content answers the tree's sound, listened to as a visualiser
// listens (see "listening" below): its loudness, followed with a meter's
// ballistics, moves the page note by note and echo by echo, and how many notes
// have been struck lately, from the spectral flux, sets how far that loudness
// reaches along the scale. Silent, the page is at rest. A little sound turns
// the content, rigidly, about the foot of the trunk (C), by up to THETA:
// tilted, not bent, the bottom of the scale. Each register has its own effect:
// the low notes (the wood) bend the content most, the high ones (the small
// leaves and every note's upper partials) split its colours, and the middle
// ones (the big leaves) make thin bands of it jump, flashing on each hit; on
// the navbar too.
//
// The turn is CSS (--tree-turn in styles.css), on the live page, so its links
// and hovers keep working. The bend fuses two grids: the page's own, and the
// polar one about the foot, where each level line is bent all the way round
// onto the circle at its height. For a point P at u across and v above the
// foot, at distance r and angle phi = atan2(u, v) from straight up, the polar
// grid shows the page at
//
//   Q = (Cx + r * phi, Cy - r)
//
// and the two are fused by distance, w(r) = 1 / (1 + (r / R)^2), so what is
// shown at P is
//
//   page(P + s * w(r) * (Q - P))
//
// near the foot the lines curl round it, further out they only curve, less and
// less. The glitch splits red one way and blue the other along the bend and
// makes thin bands jump; on the navbar, which is not part of #content, the
// same in CSS (.tree-glitching). The tree is not part of #content, so it never
// bends.
//
// The bend is drawn by WebGL from a copy of #content (html-to-image), on a
// canvas inside #content, so it leans and turns with it and the view
// transition captures it as drawn. The copy stands in only while the page
// bends. It is taken once the fonts are in, and again on a resize.
//
// Only #content bends: it is the element the view transition animates, so it
// may leave the page turned or bent and arrive straight.
//
// With reduced motion, on touch screens and below md, this does nothing;
// without WebGL the content still turns but does not bend.
import { toCanvas, getFontEmbedCSS } from "html-to-image";

(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine)").matches) return;
  const tree = document.querySelector("#tree-illustration .cover-tree");
  const content = document.getElementById("content");
  if (!tree || !content) return;

  const THETA = 2; // degrees of turn, at its most: tilted, not bent
  const R = 350; // px from the foot where the polar grid's weight is half
  const BEND = 0.65; // the bend at the top of the scale, as a share of the full polar grid
  const nav = document.querySelector("#page-shell > nav");

  /* ---- the bend: WebGL over a copy of #content ---- */
  const canvas = document.createElement("canvas");
  canvas.className = "tree-warp";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false });
  const U = {};
  let tex = null;
  if (gl && setUp()) content.appendChild(canvas);

  function setUp() {
    const vert = `
      attribute vec2 aPos;
      varying vec2 vUv;
      void main() {
        vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); // top-left origin
        gl_Position = vec4(aPos, 0.0, 1.0);
      }`;
    const frag = `
      precision highp float;
      uniform sampler2D uTex;
      uniform vec2 uSize;    // #content, CSS px
      uniform vec2 uFoot;    // C, in #content's px
      uniform float uR;
      uniform float uS;      // the bend
      uniform float uRGB;    // how far the colours split, 0 to 1
      uniform float uJump;   // how much the bands jump, 0 to 1
      uniform vec3 uBg;      // the page's colour behind #content
      uniform float uTime;
      varying vec2 vUv;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      vec4 page(vec2 p) {
        vec2 t = p / uSize;
        if (t.x < 0.0 || t.y < 0.0 || t.x > 1.0 || t.y > 1.0) return vec4(0.0);
        return texture2D(uTex, t);
      }

      void main() {
        vec2 p = vUv * uSize;
        // Below the foot the angle from straight up flips between -pi and
        // pi, and the bend with it; what little reaches down there is bent as
        // if level with the foot.
        float u = p.x - uFoot.x;
        float v = max(0.0, uFoot.y - p.y);
        float r = length(vec2(u, v));
        vec2 d = vec2(0.0);
        if (r > 0.5) {
          vec2 q = vec2(uFoot.x + r * atan(u, v), uFoot.y - r);
          d = uS / (1.0 + (r * r) / (uR * uR)) * (q - vec2(p.x, uFoot.y - v));
        }
        // The jumps: a few thin bands, picked anew several times a second,
        // more of them and further the more there is.
        float tick = floor(uTime * 14.0);
        float row = floor(p.y / 7.0);
        float jump = step(0.93 - 0.06 * uJump, hash(vec2(row, tick))) * (hash(vec2(tick, row)) - 0.5) * 20.0 * uJump;
        vec2 at = p + d + vec2(jump, 0.0);
        // The split: red one way and blue the other, along the bend where
        // there is one, at most 4px apart so the text stays readable.
        float len = length(d);
        vec2 split = ((len > 0.0 ? d / len : vec2(1.0, 0.0)) * min(len * 0.05, 1.5) + vec2(2.5, 0.0)) * uRGB;
        vec4 cg = page(at);
        vec4 cr = page(at + split);
        vec4 cb = page(at - split);
        // Each sample is laid over the page's colour before its channel is
        // taken, so dark text on a light page splits into colour too (taken
        // from transparent, black only ever splits into black), and the result
        // is lifted back off it: shown over that colour, it is exactly the split.
        float A = max(cg.a, max(cr.a, cb.a));
        vec3 over = vec3(cr.r + (1.0 - cr.a) * uBg.r, cg.g + (1.0 - cg.a) * uBg.g, cb.b + (1.0 - cb.a) * uBg.b);
        gl_FragColor = vec4(over - (1.0 - A) * uBg, A);
      }`;
    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = shader(gl.VERTEX_SHADER, vert), fs = shader(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    for (const n of ["uTex", "uSize", "uFoot", "uR", "uS", "uRGB", "uJump", "uBg", "uTime"]) U[n] = gl.getUniformLocation(prog, n);
    gl.uniform1i(U.uTex, 0);
    gl.uniform1f(U.uR, R);
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    return true;
  }

  /* ---- measuring: the foot ---- */
  // The foot of the trunk as drawn, where the sound hint sits, a tenth of the
  // drawing above its bottom edge, in #content's own coordinates (before its
  // lean and turn): the turn's pivot and the bend's centre.
  let local = { x: 0, y: 0 };
  function measure() {
    const r = tree.getBoundingClientRect();
    // #content turns about its top-left; a point in its own coordinates is
    // the point's offset from there, turned back.
    const inv = new DOMMatrix(getComputedStyle(content).transform).inverse();
    const was = content.style.transform;
    content.style.transform = "none";
    const c = content.getBoundingClientRect();
    content.style.transform = was;
    local = inv.transformPoint(new DOMPoint(r.left + r.width * 0.49 - c.left, r.top + r.height * 0.9 - c.top));
    content.style.setProperty("--tree-x", `${local.x.toFixed(1)}px`);
    content.style.setProperty("--tree-y", `${local.y.toFixed(1)}px`);
  }

  /* ---- the copy ---- */
  let fontCSS;
  let ready = false, taking = 0;
  // The page's colour behind #content, for the split (uBg), read with the copy.
  let bg = [0, 0, 0];
  function readBg() {
    const m = getComputedStyle(document.getElementById("overlay-content") || document.body).backgroundColor.match(/[\d.]+/g);
    if (m && m.length >= 3) bg = m.slice(0, 3).map((c) => Number(c) / 255);
  }

  async function take() {
    if (!tex) return;
    const ticket = ++taking;
    ready = false;
    show(false);
    const w = content.offsetWidth, h = content.offsetHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (fontCSS === undefined) fontCSS = await getFontEmbedCSS(content, { preferredFontFormat: "woff2" }).catch(() => null);
    let copy;
    try {
      copy = await toCanvas(content, {
        width: w,
        height: h,
        pixelRatio: dpr,
        style: { transform: "none", margin: "0" },
        filter: (node) => node !== canvas,
        ...(fontCSS ? { fontEmbedCSS: fontCSS } : { skipFonts: true }),
      });
    } catch {
      return;
    }
    if (ticket !== taking) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, copy);
    gl.uniform2f(U.uSize, w, h);
    gl.uniform2f(U.uFoot, local.x, local.y);
    readBg();
    ready = true;
    kick();
  }

  let shown = false;
  function show(on) {
    if (on === shown) return;
    shown = on;
    content.classList.toggle("tree-warping", on);
  }

  /* ---- listening ---- */
  // tree-sway.js puts an AnalyserNode on what the tree sends out, echo and
  // all (window.__treeEar). Each frame this reads it the way a sound
  // visualiser does:
  //
  // Loudness. The RMS of the waveform, in dBFS, mapped from FLOOR (0) to CEIL
  // (1), and followed with a meter's ballistics: it rises in ATTACK and falls
  // in RELEASE (time constants, seconds). That is env, and it turns the page.
  //
  // Bands. The spectrum's power in three registers, BANDS: low (the wood's
  // notes, 73 to 220 Hz), middle (the big leaves, 294 to 440 Hz) and high
  // (the small leaves, and everyone's upper partials), each in dB from
  // BAND_FLOOR to BAND_CEIL and followed with the same ballistics. A note
  // lands some 30 dB above what leaks of it into the other registers.
  //
  // Novelty. The spectral flux: how far each bin of the magnitude spectrum
  // stands above where it has lately been (a copy of it that follows it over
  // REF seconds), summed over the bins that rose (half-wave rectified), so a
  // new note shows even while others ring at the same loudness. Measured
  // against a reference with its own time constant rather than the frame
  // before, and integrated over time, it comes to the same at 10 frames a
  // second as at 60. Its integral charges `drive`, which leaks away over
  // DRIVE_LEAK: the more notes struck lately, and the harder, the more of the
  // scale each register's loudness reaches.
  //
  // Onsets. Where a register's flux stands above an adaptive threshold
  // (FLUX_K times its own recent mean, and never below FLUX_MIN) it is an
  // onset, of strength o from 0 to 1. An attack spans a few frames (the FFT
  // window is 43 ms), so the frames within ONSET_WINDOW of the first are one
  // onset, as strong as the strongest of them. Each sets that register's
  // `punch`, which falls in PUNCH_FALL: a flash on every hit.
  //
  // With x_b = env_b * (BASE + (1 - BASE) * drive) for each register, and
  // y_b = env_b * (GLINT + (1 - GLINT) * drive) for the lighter effects,
  //
  //   turn = THETA * smoothstep(min(1, env / TURN_AT))
  //   bend = BEND * smoothstep(clamp(x_low + 0.35 x_mid + 0.15 x_high + PUNCH punch_low))
  //   rgb  = smoothstep(clamp((y_high + 0.25 y_mid) / 0.5)) * (0.5 + 0.5 punch_high)
  //   jump = smoothstep(clamp(y_mid / 0.5)) * (0.4 + 0.6 punch_mid)
  const FLOOR = -56, CEIL = -26;
  const BAND_FLOOR = -50, BAND_CEIL = -30;
  const BANDS = [[60, 250], [250, 450], [450, 6000]]; // Hz: low, middle, high
  const ATTACK = 0.012, RELEASE = 0.22;
  const REF = 0.15;
  const FLUX_K = 1.6, FLUX_MIN = 0.002, FLUX_ROOM = 4; // o is 0 at the threshold and 1 at FLUX_ROOM thresholds past it
  const ONSET_WINDOW = 0.06;
  const FLUX_GAIN = 60, DRIVE_LEAK = 1.4, BASE = 0.15, GLINT = 0.4;
  const PUNCH = 0.12, PUNCH_FALL = 0.12;
  const TURN_AT = 0.5;
  const smooth = (x) => x * x * (3 - 2 * x);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  let wave, spec, ref, bins;
  let env = 0, drive = 0;
  const band = BANDS.map(() => ({ env: 0, punch: 0, mean: 0, at: -1e9, peak: 0 }));
  let raf = 0, tick = -1, last = 0;
  window.__warp = {}; // for a look from the console

  function hear(ear, dt, now, gone) {
    if (!wave) {
      wave = new Float32Array(ear.fftSize);
      spec = new Float32Array(ear.frequencyBinCount);
      ref = new Float32Array(ear.frequencyBinCount);
      const hz = ear.context.sampleRate / ear.fftSize;
      bins = BANDS.map(([a, b]) => [Math.max(1, Math.floor(a / hz)), Math.min(spec.length, Math.ceil(b / hz))]);
    }
    const ease = (from, to) => from + (to - from) * (1 - Math.exp(-dt / (to > from ? ATTACK : RELEASE)));
    ear.getFloatTimeDomainData(wave);
    let sum = 0;
    for (let i = 0; i < wave.length; i++) sum += wave[i] * wave[i];
    const db = 10 * Math.log10(sum / wave.length + 1e-12);
    env = ease(env, clamp01((db - FLOOR) / (CEIL - FLOOR)));

    ear.getFloatFrequencyData(spec);
    const follow = 1 - Math.exp(-dt / REF);
    let flux = 0;
    bins.forEach(([lo, hi], k) => {
      const b = band[k];
      let power = 0, rise = 0;
      for (let i = lo; i < hi; i++) {
        power += Math.pow(10, spec[i] / 10);
        const m = Math.pow(10, spec[i] / 20); // dB to magnitude
        if (m > ref[i]) rise += m - ref[i];
        ref[i] += (m - ref[i]) * follow;
      }
      b.env = ease(b.env, clamp01((10 * Math.log10(power + 1e-20) - BAND_FLOOR) / (BAND_CEIL - BAND_FLOOR)));
      const thresh = Math.max(FLUX_MIN, b.mean * FLUX_K);
      const o = rise > thresh ? clamp01((rise - thresh) / (thresh * FLUX_ROOM)) : 0;
      b.mean += (rise - b.mean) * (1 - Math.exp(-dt / 0.5));
      if (o > 0 && now - b.at > ONSET_WINDOW * 1000) {
        b.at = now;
        b.peak = 0;
      }
      if (o > b.peak) {
        b.punch = Math.max(b.punch, o);
        b.peak = o;
      }
      b.punch *= Math.exp(-dt / PUNCH_FALL);
      flux += rise;
    });
    drive = clamp01(drive + FLUX_GAIN * flux * dt);
    drive *= Math.exp(-gone / DRIVE_LEAK); // over all the time since, if it slept
    Object.assign(window.__warp, { db, env, drive, low: band[0].env, mid: band[1].env, high: band[2].env });
    return db;
  }

  function frame(now) {
    raf = 0;
    const gone = last ? (now - last) / 1000 : 1 / 60;
    const dt = Math.min(0.1, gone);
    last = now;
    const ear = window.__treeEar;
    const db = ear ? hear(ear, dt, now, gone) : -120;
    const reach = BASE + (1 - BASE) * drive;
    const [lo, mid, hi] = band;
    const xLo = lo.env * reach, xMid = mid.env * reach, xHi = hi.env * reach;
    const light = GLINT + (1 - GLINT) * drive;
    const yMid = mid.env * light, yHi = hi.env * light;
    const turn = smooth(Math.min(1, env / TURN_AT));
    const bend = BEND * smooth(clamp01(xLo + 0.35 * xMid + 0.15 * xHi + PUNCH * lo.punch));
    const rgb = smooth(clamp01((yHi + 0.25 * yMid) / 0.5)) * (0.5 + 0.5 * hi.punch);
    const jump = smooth(clamp01(yMid / 0.5)) * (0.4 + 0.6 * mid.punch);
    // Anticlockwise, the far side of the content dropping, as the bend
    // carries it.
    content.style.setProperty("--tree-turn", `${(-THETA * turn).toFixed(3)}deg`);
    const on = ready && (bend > 0.002 || rgb > 0.01 || jump > 0.01);
    show(on);
    if (on) {
      gl.uniform1f(U.uS, bend);
      gl.uniform1f(U.uRGB, rgb);
      gl.uniform1f(U.uJump, jump);
      gl.uniform3f(U.uBg, bg[0], bg[1], bg[2]);
      gl.uniform1f(U.uTime, now / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    glitchNav(rgb, jump, now);
    Object.assign(window.__warp, { bend, rgb, jump });
    // Listens until the tree has gone quiet and the page has come to rest.
    const busy = band.some((b) => b.env > 1e-3 || b.punch > 1e-3);
    if (db > FLOOR - 6 || env > 1e-3 || busy) raf = requestAnimationFrame(frame);
    else {
      env = 0;
      for (const b of band) b.env = b.punch = 0;
      content.style.setProperty("--tree-turn", "0deg");
      show(false);
      glitchNav(0, 0, now);
    }
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  // The navbar's glitch: its colours split as the content's do (--glitch,
  // in styles.css), and, a few times a second, by the middle register, it
  // jumps a little sideways.
  function glitchNav(rgb, jump, now) {
    if (!nav) return;
    if (rgb <= 0.01 && jump <= 0.01) {
      if (nav.classList.contains("tree-glitching")) {
        nav.classList.remove("tree-glitching");
        nav.style.translate = "";
      }
      return;
    }
    nav.classList.add("tree-glitching");
    nav.style.setProperty("--glitch", rgb.toFixed(3));
    const t = Math.floor(now / 70);
    if (t !== tick) {
      tick = t;
      nav.style.translate = Math.random() < 0.4 * jump ? `${((Math.random() - 0.5) * 10 * jump).toFixed(1)}px 0` : "";
    }
  }

  // A note wakes it; from there it listens to the ear until all is quiet.
  addEventListener("tree-note", kick);

  measure();
  const start = () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { measure(); take(); });
  if (document.readyState === "complete") start();
  else addEventListener("load", start, { once: true });
  // A resize or a change of theme makes the copy stale: until a new one is
  // taken the live page stands, unbent. A theme's colours may ease in, so
  // the copy waits for them.
  let resizing = 0;
  function retake(wait) {
    clearTimeout(resizing);
    ready = false;
    show(false);
    resizing = setTimeout(() => { measure(); take(); }, wait);
  }
  addEventListener("resize", () => retake(200), { passive: true });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => retake(500));
  new MutationObserver(() => retake(500)).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
