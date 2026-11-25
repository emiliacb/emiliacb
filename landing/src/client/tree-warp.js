// The home's content answers the tree's sound, listened to as a visualiser
// listens (see "listening" below): its loudness, followed with a meter's
// ballistics, moves the page note by note and echo by echo, and how many notes
// have been struck lately, from the spectral flux, sets how far that loudness
// reaches along the scale. Silent, the page is at rest. A little sound turns
// the content, rigidly, about the foot of the trunk (C), by up to THETA:
// tilted, not bent, the bottom of the scale. More sound also bends it, by s,
// from 0 to 1; near the top the colours come apart, on the content and on the
// navbar, flashing on each hit: a glitch.
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
  const GLITCH = 0.7; // s, above which the colours start to come apart
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
      uniform float uS;      // the scale
      uniform float uGlitch;
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
        // The glitch: the colours drift apart along the bend, more where it
        // bends more, and a few thin bands, picked anew several times a
        // second, jump.
        float g = uGlitch * smoothstep(8.0, 60.0, length(d));
        float tick = floor(uTime * 14.0);
        float row = floor(p.y / 7.0);
        float jump = step(0.93, hash(vec2(row, tick))) * (hash(vec2(tick, row)) - 0.5) * 16.0 * g;
        vec2 at = p + d + vec2(jump, 0.0);
        // At most 4px apart, so the text stays readable through it.
        float len = length(d);
        vec2 split = (len > 0.0 ? d / len : vec2(1.0, 0.0)) * min(len * 0.08, 3.0) * g + vec2(1.5 * g, 0.0);
        vec4 cg = page(at);
        vec4 cr = page(at + split);
        vec4 cb = page(at - split);
        gl_FragColor = vec4(cr.r, cg.g, cb.b, max(cg.a, max(cr.a, cb.a)));
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
    for (const n of ["uTex", "uSize", "uFoot", "uR", "uS", "uGlitch", "uTime"]) U[n] = gl.getUniformLocation(prog, n);
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
  // in RELEASE (time constants, seconds). That is env, and the page moves with
  // it, note by note and echo by echo.
  //
  // Novelty. The spectral flux: how far each bin of the magnitude spectrum
  // stands above where it has lately been (a copy of it that follows it over
  // REF seconds), summed over the bins that rose (half-wave rectified), so a
  // new note shows even while others ring at the same loudness. Measured
  // against a reference with its own time constant rather than the frame
  // before, and integrated over time, it comes to the same at 10 frames a
  // second as at 60. Its integral charges `drive`, which leaks away over
  // DRIVE_LEAK: the more notes struck lately, and the harder, the more of the
  // scale the loudness reaches.
  //
  // Onsets. Where the flux stands above an adaptive threshold (FLUX_K times
  // its own recent mean, and never below FLUX_MIN) it is an onset, of strength
  // o from 0 to 1. An attack spans a few frames (the FFT window is 43 ms), so
  // the frames within ONSET_WINDOW of the first are one onset, as strong as
  // the strongest of them. Each sets `punch`, which falls in PUNCH_FALL: a
  // flash on every hit.
  //
  //   turn = THETA * smoothstep(min(1, env / TURN_AT))
  //   s    = smoothstep(clamp(env * (BASE + (1 - BASE) * drive) + PUNCH * punch))
  //   glitch = clamp((s - GLITCH) / (1 - GLITCH)) * (0.35 + 0.65 * punch)
  const FLOOR = -56, CEIL = -26;
  const ATTACK = 0.012, RELEASE = 0.22;
  const REF = 0.15;
  const FLUX_K = 1.6, FLUX_MIN = 0.005, FLUX_ROOM = 4; // o is 0 at the threshold and 1 at FLUX_ROOM thresholds past it
  const LO_HZ = 60, HI_HZ = 6000;
  const ONSET_WINDOW = 0.06;
  const FLUX_GAIN = 60, DRIVE_LEAK = 1.4, BASE = 0.15;
  const PUNCH = 0.12, PUNCH_FALL = 0.12;
  const TURN_AT = 0.5;
  const smooth = (x) => x * x * (3 - 2 * x);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  let wave, spec, ref, lo = 0, hi = 0;
  let env = 0, drive = 0, punch = 0, fluxMean = 0, onsetAt = -1e9, onsetPeak = 0;
  let raf = 0, tick = -1, last = 0;
  window.__warp = {}; // for a look from the console

  function hear(ear, dt, now, gone) {
    if (!wave) {
      wave = new Float32Array(ear.fftSize);
      spec = new Float32Array(ear.frequencyBinCount);
      ref = new Float32Array(ear.frequencyBinCount);
      const hz = ear.context.sampleRate / ear.fftSize;
      lo = Math.max(1, Math.floor(LO_HZ / hz));
      hi = Math.min(spec.length, Math.ceil(HI_HZ / hz));
    }
    ear.getFloatTimeDomainData(wave);
    let sum = 0;
    for (let i = 0; i < wave.length; i++) sum += wave[i] * wave[i];
    const db = 10 * Math.log10(sum / wave.length + 1e-12);
    const level = clamp01((db - FLOOR) / (CEIL - FLOOR));
    env += (level - env) * (1 - Math.exp(-dt / (level > env ? ATTACK : RELEASE)));

    ear.getFloatFrequencyData(spec);
    let flux = 0;
    const follow = 1 - Math.exp(-dt / REF);
    for (let i = lo; i < hi; i++) {
      const m = Math.pow(10, spec[i] / 20); // dB to magnitude
      if (m > ref[i]) flux += m - ref[i];
      ref[i] += (m - ref[i]) * follow;
    }
    const thresh = Math.max(FLUX_MIN, fluxMean * FLUX_K);
    const o = flux > thresh ? clamp01((flux - thresh) / (thresh * FLUX_ROOM)) : 0;
    fluxMean += (flux - fluxMean) * (1 - Math.exp(-dt / 0.5));
    if (o > 0 && now - onsetAt > ONSET_WINDOW * 1000) {
      onsetAt = now;
      onsetPeak = 0;
    }
    if (o > onsetPeak) {
      punch = Math.max(punch, o);
      onsetPeak = o;
    }
    drive = clamp01(drive + FLUX_GAIN * flux * dt);
    drive *= Math.exp(-gone / DRIVE_LEAK); // over all the time since, if it slept
    punch *= Math.exp(-dt / PUNCH_FALL);
    Object.assign(window.__warp, { db, env, flux, o, drive, punch });
    return db;
  }

  function frame(now) {
    raf = 0;
    const gone = last ? (now - last) / 1000 : 1 / 60;
    const dt = Math.min(0.1, gone);
    last = now;
    const ear = window.__treeEar;
    const db = ear ? hear(ear, dt, now, gone) : -120;
    const turn = smooth(Math.min(1, env / TURN_AT));
    const s = smooth(clamp01(env * (BASE + (1 - BASE) * drive) + PUNCH * punch));
    // Anticlockwise, the far side of the content dropping, as the bend
    // carries it.
    content.style.setProperty("--tree-turn", `${(-THETA * turn).toFixed(3)}deg`);
    const on = ready && s > 0.002;
    show(on);
    const glitch = clamp01((s - GLITCH) / (1 - GLITCH)) * (0.35 + 0.65 * punch);
    if (on) {
      gl.uniform1f(U.uS, s);
      gl.uniform1f(U.uGlitch, glitch);
      gl.uniform1f(U.uTime, now / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    glitchNav(glitch, now);
    window.__warp.s = s;
    // Listens until the tree has gone quiet and the page has come to rest.
    if (db > FLOOR - 6 || env > 1e-3 || punch > 1e-3) raf = requestAnimationFrame(frame);
    else {
      env = punch = 0;
      content.style.setProperty("--tree-turn", "0deg");
      show(false);
      glitchNav(0, now);
    }
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  // The navbar's glitch: its colours split (--glitch, in styles.css) and, a
  // few times a second, it jumps a little sideways.
  function glitchNav(glitch, now) {
    if (!nav) return;
    if (glitch <= 0) {
      if (nav.classList.contains("tree-glitching")) {
        nav.classList.remove("tree-glitching");
        nav.style.translate = "";
      }
      return;
    }
    nav.classList.add("tree-glitching");
    nav.style.setProperty("--glitch", glitch.toFixed(3));
    const t = Math.floor(now / 70);
    if (t !== tick) {
      tick = t;
      nav.style.translate = Math.random() < 0.35 ? `${((Math.random() - 0.5) * 10 * glitch).toFixed(1)}px 0` : "";
    }
  }

  // A note wakes it; from there it listens to the ear until all is quiet.
  addEventListener("tree-note", kick);

  measure();
  const start = () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { measure(); take(); });
  if (document.readyState === "complete") start();
  else addEventListener("load", start, { once: true });
  let resizing = 0;
  addEventListener("resize", () => {
    clearTimeout(resizing);
    ready = false;
    show(false);
    resizing = setTimeout(() => { measure(); take(); }, 200);
  }, { passive: true });
})();
