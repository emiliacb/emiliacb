// The home's content answers the pointer on a scale set by the page itself:
// 0 with the pointer at the letter nearest the tree, 1 with it at the foot of
// the trunk (C). With d the pointer's distance from the foot and d0 the
// letter's,
//
//   s = smoothstep(clamp(1 - d / d0, 0, 1))
//
// Up to 0, while the pointer comes over the text towards the tree, the content
// only turns, rigidly, about the foot, up to THETA when the pointer reaches
// that last letter: tilted, not bent. That turn is CSS (--tree-turn in
// styles.css), on the live page, so its links and hovers keep working.
//
// From 0 to 1, from the last letter to the foot, the content also bends, by s.
// Two grids are fused: the page's own, and the polar one about the foot, where
// each level line is bent all the way round onto the circle at its height. For
// a point P at u across and v above the foot, at distance r and angle
// phi = atan2(u, v) from straight up, the polar grid shows the page at
//
//   Q = (Cx + r * phi, Cy - r)
//
// and the two are fused by distance, w(r) = 1 / (1 + (r / R)^2), so what is
// shown at P is
//
//   page(P + s * w(r) * (Q - P))
//
// near the foot the lines curl round it, further out they only curve, less and
// less. High on the scale the colours come apart along the bend, red one way
// and blue the other, and thin bands jump sideways now and then: a glitch. The
// tree is not part of #content, so it never bends.
//
// The bend is drawn by WebGL from a copy of #content (html-to-image), on a
// canvas inside #content, so it leans and turns with it and the view
// transition captures it as drawn. The copy stands in only past the last
// letter, where the pointer is over no text. It is taken once the fonts are
// in, and again on a resize.
//
// Only #content moves: it is the element the view transition animates, so it
// may leave the page turned or bent and arrive straight, where the navbar,
// which is not animated, has to look the same on every page.
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

  const THETA = 2; // degrees of turn at 0 on the scale: tilted, not bent
  const APPROACH = 500; // px beyond the last letter where the turn starts
  const R = 350; // px from the foot where the polar grid's weight is half
  const GLITCH = 0.7; // s, above which the colours start to come apart
  const EASE = 0.08; // of the way to the target each frame

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

  /* ---- measuring: the foot, and the letter nearest it ---- */
  // The foot of the trunk as drawn, where the sound hint sits, a tenth of the
  // drawing above its bottom edge. In viewport coordinates for the pointer,
  // read again on scroll; in #content's own (before its lean and turn) for the
  // turn's pivot and the bend.
  let fx = 0, fy = 0, d0 = 0;
  function footOnScreen() {
    const r = tree.getBoundingClientRect();
    return { x: r.left + r.width * 0.49, y: r.top + r.height * 0.9 };
  }
  function measureFoot() {
    const f = footOnScreen();
    fx = f.x;
    fy = f.y;
  }
  /** From the foot to the nearest letter, every line of text in #content
   * measured in its own coordinates. */
  function nearestLetter(toLocal, foot) {
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let best = Infinity;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) {
        if (q.width < 1 || q.height < 1) continue;
        const pts = [[q.left, q.top], [q.right, q.top], [q.left, q.bottom], [q.right, q.bottom]].map(([x, y]) => toLocal(x, y));
        const l = Math.min(...pts.map((p) => p.x)), r = Math.max(...pts.map((p) => p.x));
        const t = Math.min(...pts.map((p) => p.y)), b = Math.max(...pts.map((p) => p.y));
        best = Math.min(best, Math.hypot(Math.max(l - foot.x, 0, foot.x - r), Math.max(t - foot.y, 0, foot.y - b)));
      }
    }
    return Math.max(40, best);
  }
  let local = { x: 0, y: 0 };
  function measure() {
    measureFoot();
    // #content turns about its top-left; a point in its own coordinates is
    // the point's offset from there, turned back.
    const inv = new DOMMatrix(getComputedStyle(content).transform).inverse();
    const was = content.style.transform;
    content.style.transform = "none";
    const c = content.getBoundingClientRect();
    content.style.transform = was;
    const toLocal = (x, y) => inv.transformPoint(new DOMPoint(x - c.left, y - c.top));
    local = toLocal(fx, fy);
    d0 = nearestLetter(toLocal, local);
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

  /* ---- the pointer ---- */
  const smooth = (x) => x * x * (3 - 2 * x);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  let px = null, py = null, turn = 0, s = 0, raf = 0;
  function frame(now) {
    raf = 0;
    let tTurn = 0, tS = 0;
    if (px !== null) {
      const d = Math.hypot(px - fx, py - fy);
      tTurn = smooth(clamp01((d0 + APPROACH - d) / APPROACH));
      tS = smooth(clamp01(1 - d / d0));
    }
    turn += (tTurn - turn) * EASE;
    s += (tS - s) * EASE;
    if (Math.abs(tTurn - turn) < 1e-3) turn = tTurn;
    if (Math.abs(tS - s) < 1e-3) s = tS;
    // Anticlockwise, the far side of the content dropping, as the bend
    // carries it.
    content.style.setProperty("--tree-turn", `${(-THETA * turn).toFixed(3)}deg`);
    const on = ready && s > 0.002;
    show(on);
    const glitch = clamp01((s - GLITCH) / (1 - GLITCH));
    if (on) {
      gl.uniform1f(U.uS, s);
      gl.uniform1f(U.uGlitch, glitch);
      gl.uniform1f(U.uTime, now / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    if (turn !== tTurn || s !== tS || (on && glitch > 0)) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

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
  addEventListener("scroll", () => { measureFoot(); kick(); }, { passive: true });
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    px = e.clientX;
    py = e.clientY;
    kick();
  }, { passive: true });
  const leave = () => { px = null; kick(); };
  document.documentElement.addEventListener("pointerleave", leave);
  addEventListener("blur", leave);
})();
