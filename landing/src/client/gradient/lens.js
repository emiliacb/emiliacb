/**
 * The black hole, drawn the way Interstellar's was: by following light back
 * from the eye past a Schwarzschild hole.
 *
 * Every pixel of a square around the hole is a ray. It leaves the eye
 * parallel to the others, and is bent on its way by the hole's pull, which for
 * light in the units where the horizon's radius r_s is 1 is the acceleration
 *
 *   a = −(3/2) h² r / |r|⁵,   h = |r × v|
 *
 * (the extra term general relativity adds to Newton; light feels only it).
 * Steps are short near the hole and long away from it. On the way a ray may
 * cross the accretion disc, a thin ring in a plane nearly edge-on to the eye,
 * from the innermost stable orbit (3 r_s) out to DISC; it takes the disc's
 * light there, as often as it crosses, so the far side of the disc shows
 * bent over the top of the hole and under it, and a thin ring of light hugs
 * the shadow. The disc turns faster inside (Kepler), is hotter inside, and is
 * brighter on the side that comes toward the eye (Doppler beaming) and
 * dimmer deep in the well (gravitational redshift). A ray that falls under
 * r_s is lost: the shadow. One that gets through lands on the page behind,
 * a plane at a distance D, and shows what is there.
 *
 * What is there is the page: a copy of #page-shell (html-to-image) over the
 * gradient's sheets, drawn here from where they are, on the paper's colour.
 * The sheets are the hole's food. Their matter flows in, so what shows at a
 * radius came from further out (r₀² = r² + flow), and it winds round as it
 * comes, faster further in (Δθ ∝ r₀^−3/2): the inner sheets fold in on
 * themselves and the outer ones are torn into ragged spiral arms. The halo
 * comes apart into a cloud of points, each drawn out into a streak by the
 * same shear. The disc is lit in the gradient's own colours.
 * Until the copy is in, the page itself shows through, unbent. Near the
 * square's edge the bending eases off to nothing, so the copy meets the page
 * it stands in for.
 */
import { toCanvas, getFontEmbedCSS } from "html-to-image";

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;      // the square, in CSS px
uniform vec2 uH;        // the hole in it, which may drift from its middle
uniform float uRs;      // r_s, in CSS px
uniform float uL;       // half the square
uniform float uLc;      // how far round the hole the page is bent, in px
uniform float uLens;    // 0: the page shows through; 1: the lensed copy
uniform sampler2D uTex;
uniform vec2 uTexOff;   // where the square starts in the copy, in CSS px
uniform vec2 uTexSize;  // the copy's size, in CSS px
uniform vec3 uBg;
uniform vec4 uSh[5];    // each sheet: centre (square px), radius, opacity
uniform vec3 uShC[5];
uniform vec4 uShS[5];   // its profile: four stops along its radius (0 to 1)
uniform vec4 uShP[5];   // and the alpha at each; then down to 0 at the edge
uniform float uFlow;    // the inflow so far, in px²
uniform float uWind;    // how far round it has wound, in radians at the scale uWindR
uniform float uWindR;
uniform float uTear;    // how ragged the arms are
uniform float uCloud;   // how far the halo has come apart into points
uniform float uTime;
uniform float uDisc;    // the disc's light, 0 to 1, more as it evaporates
uniform float uFed;     // how much has fallen in so far, 0 to 1, for the glow
uniform float uCirc;    // how far what fell in has spread round its orbit
uniform float uFlash;
uniform vec3 uHot, uMid, uOut, uCore;
uniform float uTilt, uRoll;

const float D = 10.0;    // the page behind, in r_s
const float Z0 = 14.0;   // where the rays start
const float DISC = 10.0; // the disc's outer edge, in r_s

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
                 mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                 mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

float profile(float d, vec4 st, vec4 al) {
  if (d >= 1.0) return 0.0;
  if (d < st.y) return mix(al.x, al.y, clamp((d - st.x) / max(st.y - st.x, 1e-4), 0.0, 1.0));
  if (d < st.z) return mix(al.y, al.z, (d - st.y) / max(st.z - st.y, 1e-4));
  if (d < st.w) return mix(al.z, al.w, (d - st.z) / max(st.w - st.z, 1e-4));
  return mix(al.w, 0.0, (d - st.w) / max(1.0 - st.w, 1e-4));
}

// Where the sheets' matter now at q came from: further out, and wound back.
vec2 source(vec2 q) {
  vec2 rel = q - uH;
  float r = length(rel);
  float r0 = sqrt(r * r + uFlow);
  float th = atan(rel.y, rel.x);
  float wind = uWind * pow(uWindR / max(r0, uWindR * 0.35), 1.5);
  float rag = uTear * (noise(vec3(r0 * 0.018, cos(th) * 1.7, sin(th) * 1.7 + uTime * 0.2)) - 0.5);
  th -= wind + rag * 2.2;
  r0 *= 1.0 + rag * 0.25;
  return uH + r0 * vec2(cos(th), sin(th));
}

// The sheets, back to front, premultiplied.
vec4 material(vec2 q) {
  vec2 q0 = source(q);
  vec4 o = vec4(0.0);
  for (int i = 0; i < 5; i++) {
    float d = length(q0 - uSh[i].xy) / max(uSh[i].z, 1.0);
    float a = profile(d, uShS[i], uShP[i]) * uSh[i].w;
    if (i == 0 && uCloud > 0.0) {
      // The halo as points: one in each cell, some cells empty.
      vec2 cell = floor(q0 / 6.0);
      vec2 at = (cell + 0.2 + 0.6 * vec2(hash(vec3(cell, 1.0)), hash(vec3(cell, 2.0)))) * 6.0;
      float dot = smoothstep(1.5, 0.4, length(q0 - at)) * step(0.45, hash(vec3(cell, 3.0)));
      a = mix(a, min(1.0, a * 9.0) * dot, uCloud);
    }
    o = o * (1.0 - a) + vec4(uShC[i] * a, a);
  }
  return o;
}

// The sheets as they lie on the page: their matter within the disc's reach
// has gone into the disc, so the hole sweeps its neighbourhood clean.
vec4 sheets(vec2 q) {
  float reach = DISC * max(uRs, 1e-3);
  return material(q) * smoothstep(0.8, 1.15, length(q - uH) / reach);
}

vec3 page(vec2 q) {
  vec4 s = sheets(q);
  vec3 c = uBg * (1.0 - s.a) + s.rgb;
  vec2 uv = (q + uTexOff) / uTexSize;
  vec4 t = texture2D(uTex, clamp(uv, 0.0, 1.0));
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) t = vec4(0.0);
  return c * (1.0 - t.a) + t.rgb;
}

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

void main() {
  vec2 frag = vUv * uRes;                // y down
  vec2 rel = frag - uH;
  // The square's own edge, where it fades out.
  vec2 sq = frag - uRes * 0.5;
  float fade = 1.0 - smoothstep(0.86 * uL, 0.99 * uL, max(abs(sq.x), abs(sq.y)));
  float rp = length(rel);
  // Away from the hole the bending eases off, and the copy of the page with
  // it: a copy is never quite the page (its text sits a pixel or so off), so
  // it is used only where the bending is strong enough not to show it.
  // Further out the sheets alone are drawn, over the page itself.
  float edge = smoothstep(0.5 * uLc, 0.95 * uLc, rp);
  float copyA = uLens * (1.0 - smoothstep(0.62 * uLc, uLc, rp));
  if (uRs < 0.25) {
    gl_FragColor = (vec4(page(frag), 1.0) * copyA + sheets(frag) * (1.0 - copyA))
      * fade;
    return;
  }
  vec2 b = rot(uRoll) * vec2(rel.x, -rel.y) / uRs;
  vec3 N = vec3(0.0, cos(uTilt), sin(uTilt));
  vec3 e1 = vec3(1.0, 0.0, 0.0);
  vec3 e2 = cross(N, e1);

  vec3 p = vec3(b, Z0);
  vec3 v = vec3(0.0, 0.0, -1.0);
  float h2 = dot(b, b);
  vec4 acc = vec4(0.0);
  float lost = 0.0;
  float near = 1e3;
  for (int i = 0; i < 320; i++) {
    float r = length(p);
    near = min(near, r);
    if (r < 1.0) { lost = 1.0; break; }
    float dt = clamp(0.04 * r * r, 0.035, 1.2);
    float r2 = r * r;
    v += -1.5 * h2 * p / (r2 * r2 * r) * dt;
    vec3 pn = p + v * dt;
    float s0 = dot(p, N), s1 = dot(pn, N);
    if (s0 * s1 < 0.0 && acc.a < 0.99) {
      vec3 x = mix(p, pn, s0 / (s0 - s1));
      float rr = length(x);
      if (rr > 2.9 && rr < DISC) {
        float ph = atan(dot(x, e2), dot(x, e1));
        // The disc is the sheets' matter, come in. What orbits at rr now
        // came from r0, where r0² = r² + flow, carried round by the same
        // winding (material() follows it back), and it has the density and
        // colour of the sheet it came from. It shines with what it gave up
        // falling, the energy GM m (1/r − 1/r0): nothing yet where nothing
        // has fallen, most deep in, and the more matter, the more light.
        vec2 p2 = uH + rr * uRs * vec2(cos(ph), sin(ph));
        vec4 m = material(p2);
        // Once in, it spreads round the orbit (it circularises): the more
        // turns there have been, the more the disc is the matter averaged
        // round each orbit rather than the stream that brought it.
        if (uCirc > 0.0) {
          vec4 avg = vec4(0.0);
          for (int j = 0; j < 8; j++) {
            float aj = 0.785398 * float(j) + 0.3;
            avg += material(uH + rr * uRs * vec2(cos(aj), sin(aj)));
          }
          m = mix(m, avg / 8.0, uCirc);
        }
        float r0 = sqrt(rr * rr * uRs * uRs + uFlow) / uRs;
        float fell = max(0.0, 1.0 / rr - 1.0 / r0);
        float a = ph - uTime * 0.9 * pow(3.0 / rr, 1.5);
        vec3 ring = vec3(cos(a), sin(a), 0.0);
        float n = 0.6 * noise(vec3(ring.xy * 2.5, rr * 1.4)) + 0.4 * noise(vec3(ring.xy * 7.0, rr * 4.0 + 3.0));
        float E = m.a * fell * 26.0 * (0.55 + 0.9 * n) * smoothstep(2.9, 3.4, rr);
        vec3 tang = normalize(cross(N, x));
        float beta = sqrt(0.5 / (rr - 1.0));
        vec3 k = -normalize(v);
        float g = sqrt(1.0 - beta * beta) / (1.0 - beta * dot(tang, k));
        float I = E * mix(1.0, g * g * g, 0.5) * sqrt(1.0 - 1.0 / rr) * uDisc;
        // Its own colour, lightened, heated toward white the more it gave up.
        vec3 own = m.rgb / max(m.a, 1e-3);
        vec3 col = mix(mix(own, vec3(1.0), 0.3), uHot, smoothstep(0.2, 1.4, E));
        float al = clamp(I * 1.5, 0.0, 0.96);
        acc.rgb += (1.0 - acc.a) * al * min(col * max(1.0, I * 0.8), vec3(1.0));
        acc.a += (1.0 - acc.a) * al;
      }
    }
    p = pn;
    if (p.z < -D || (r > 30.0 && dot(p, v) > 0.0)) break;
  }

  vec4 bg = vec4(0.0);
  if (lost < 0.5) {
    vec2 hit;
    // Carried on in a straight line to the page, wherever it left off; one
    // turned back toward the eye sees nothing of it, and takes it from far.
    if (v.z < 0.0) hit = p.xy - v.xy * ((p.z + D) / v.z);
    else hit = p.xy + normalize(v).xy * 60.0;
    vec2 q = rot(-uRoll) * hit * uRs;
    q = vec2(q.x, -q.y) + uH;
    q = mix(q, frag, edge);
    // A glow of the disc's light, scattered close round the hole.
    float glow = uFed * uDisc * 0.35 * exp(-max(0.0, near - 2.6) / 2.2) * (1.0 - edge);
    // Before the copy is in, only the sheets are drawn, and the page shows
    // through round them, unbent.
    bg = vec4(mix(page(q), uMid, glow * 0.6), 1.0) * copyA + sheets(q) * (1.0 - copyA);
    bg = bg + vec4(uMid * glow * 0.35, glow * 0.35) * (1.0 - bg.a);
  } else {
    bg = vec4(uCore, 1.0);
  }
  vec4 o = acc + (1.0 - acc.a) * bg;
  // The flash it goes out in.
  float f = uFlash * exp(-pow(rp / (uL * 0.45), 2.0));
  o = mix(o, vec4(1.0), clamp(f, 0.0, 1.0));
  // And the square fades out over its last stretch, where the sheets reach
  // nearly nothing anyway.
  o *= fade;
  gl_FragColor = o;
}`;

export function makeLens(host) {
  const canvas = document.createElement("canvas");
  canvas.className = "bh-lens";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.display = "none";
  host.appendChild(canvas);
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false });
  if (!gl) return null;

  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
    return s;
  };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
  } catch (err) {
    console.warn("black hole:", err);
    canvas.remove();
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ["uRes", "uH", "uRs", "uL", "uLc", "uLens", "uTex", "uTexOff", "uTexSize", "uBg", "uSh", "uShC", "uShS", "uShP",
    "uFed", "uCirc", "uFlow", "uWind", "uWindR", "uTear", "uCloud", "uTime", "uDisc", "uFlash", "uHot", "uMid", "uOut", "uCore", "uTilt", "uRoll"]) U[n] = gl.getUniformLocation(prog, n);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  gl.uniform1i(U.uTex, 0);
  gl.uniform1f(U.uTilt, 0.11);
  gl.uniform1f(U.uRoll, -0.24);

  let fontCSS;
  let ticket = 0;
  let ready = false;
  let half = 0, size = 0, dpr = 1;
  const shell = document.getElementById("page-shell");

  const rgb = (s) => (s.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map((c) => Number(c) / 255);
  function palette() {
    const dark = matchMedia("(prefers-color-scheme: dark)").matches;
    gl.uniform3fv(U.uCore, dark ? [0, 0, 0] : [0.047, 0.04, 0.035]);
    gl.uniform3fv(U.uBg, rgb(getComputedStyle(host).backgroundColor));
  }

  /** A square of half-side `l` round (x, y) in the host's box, for a hole of
   * radius `rs`; the copy of the page behind it is taken now. */
  function open(x, y, l, lc) {
    half = l;
    size = 2 * l;
    // Fewer pixels for a big square: every one is a traced ray.
    dpr = Math.max(0.6, Math.min(1.5, devicePixelRatio || 1, 760 / l));
    // On whole pixels, so the copy lies exactly on the page it stands in for.
    const x0 = Math.round(x - l), y0 = Math.round(y - l);
    canvas.style.left = `${x0}px`;
    canvas.style.top = `${y0}px`;
    canvas.style.width = canvas.style.height = `${size}px`;
    canvas.width = canvas.height = Math.round(size * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, size, size);
    gl.uniform1f(U.uL, l);
    gl.uniform1f(U.uLc, lc);
    palette();
    ready = false;
    copy(x0, y0);
  }

  // The last copy, for whoever else bends the page (gradient/ripple.js): the
  // image, and where it sits in the host (its top left) and how big it is.
  let shot = null;

  async function copy(x0, y0) {
    if (!shell) return;
    const mine = ++ticket;
    const hostBox = host.getBoundingClientRect(), shellBox = shell.getBoundingClientRect();
    const shellX = shellBox.left - hostBox.left, shellY = shellBox.top - hostBox.top;
    const sx = x0 - shellX, sy = y0 - shellY;
    const w = shell.offsetWidth;
    // The rows of the square and of the screen, in the shell's own.
    const view = -shellBox.top;
    const top = Math.max(0, Math.floor(Math.min(sy, view)));
    const bottom = Math.min(shell.offsetHeight, Math.ceil(Math.max(sy + size, view + innerHeight)));
    // All of each face's formats: asked for woff2 alone, Chrome draws the
    // copy in a fallback face.
    if (fontCSS === undefined) fontCSS = await getFontEmbedCSS(shell).catch(() => null);
    // html-to-image copies each element's style and its ::before and
    // ::after, but not a list item's ::marker, whose bullet would come out in
    // the text's colour. Each item is marked for the copy with its bullet's
    // own colour, which goes in with the copy's stylesheet.
    const items = shell.querySelectorAll("li");
    const tones = [];
    items.forEach((li) => {
      const c = getComputedStyle(li, "::marker").color;
      let k = tones.indexOf(c);
      if (k < 0) { k = tones.length; tones.push(c); }
      li.dataset.bhMarker = String(k);
    });
    // A bullet takes only a few properties of its own, and -webkit-text-fill-
    // color, which the copy sets on every element in the text's colour, is
    // not one: it paints over the bullet's colour unless the fill is left to
    // follow each element's own colour (as it does on the page).
    const markers = "li,li *{-webkit-text-fill-color:currentcolor!important}" +
      tones.map((c, k) => `[data-bh-marker="${k}"]::marker{color:${c}}`).join("");
    // Not every browser reports a box's automatic margins as what they come
    // to (a centred column can come out at the left, and wider). Where the
    // style says other than where the box is on the screen, the copy is told
    // where it is: its margins and its width, as measured.
    const boxes = [];
    const fixes = [];
    shell.querySelectorAll("*").forEach((el) => {
      const cs = getComputedStyle(el);
      if (!/^(block|flex|grid|list-item|flow-root)$/.test(cs.display) || cs.position === "absolute" || cs.position === "fixed") return;
      const par = el.parentElement;
      if (!par) return;
      const pc = getComputedStyle(par);
      // Only where margins place a box across its parent: in a block, or a
      // column of flex items.
      if (/grid/.test(pc.display) || (/flex/.test(pc.display) && !/column/.test(pc.flexDirection))) return;
      const r = el.getBoundingClientRect(), pr = par.getBoundingClientRect();
      if (r.width < 1) return;
      const inL = pr.left + par.clientLeft + parseFloat(pc.paddingLeft);
      const inR = pr.left + par.clientLeft + par.clientWidth - parseFloat(pc.paddingRight);
      const ml = r.left - inL, mr = inR - r.right;
      const said = (v, want) => Math.abs(parseFloat(v) - want) < 0.5; // NaN for "auto": not as said
      if (said(cs.marginLeft, ml) && said(cs.marginRight, mr) && said(cs.width, cs.boxSizing === "border-box" ? r.width : el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))) return;
      const k = boxes.length;
      boxes.push(el);
      el.dataset.bhBox = String(k);
      fixes.push(`[data-bh-box="${k}"]{margin-left:${ml.toFixed(2)}px!important;margin-right:${mr.toFixed(2)}px!important;width:${r.width.toFixed(2)}px!important;max-width:none!important}`);
    });
    let img;
    try {
      // Only those rows are drawn: the shell moved up out of a frame that
      // tall. It keeps its own width and height, so nothing reflows.
      img = await toCanvas(shell, {
        width: w,
        height: bottom - top,
        pixelRatio: dpr,
        style: { transform: `translateY(${-top}px)`, margin: "0", height: `${shell.offsetHeight}px` },
        filter: (node) => !(node instanceof HTMLCanvasElement),
        fontEmbedCSS: (fontCSS || "") + markers + fixes.join(""),
      });
    } catch {
      return;
    } finally {
      items.forEach((li) => { delete li.dataset.bhMarker; });
      boxes.forEach((el) => { delete el.dataset.bhBox; });
    }
    if (mine !== ticket) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.uniform2f(U.uTexOff, sx, sy - top);
    gl.uniform2f(U.uTexSize, w, bottom - top);
    shot = { img, x: shellX, y: shellY + top, w, h: bottom - top };
    ready = true;
  }

  /** One frame: r_s in px, how much of the copy shows, the disc's light and
   * its colours (hot, mid, out), the flash, the sheets (centre in the square,
   * radius, opacity, colour, profile) and how far they have been eaten. */
  function draw({ hx = half, hy = half, rs, fed = 0, circ = 0, lens, disc, flash, time, sheets, hot, mid, out, flow, wind, windR, tear, cloud }) {
    if (canvas.style.display) canvas.style.display = "";
    gl.uniform2f(U.uH, hx, hy);
    gl.uniform1f(U.uRs, rs);
    gl.uniform1f(U.uLens, ready ? lens : 0);
    gl.uniform1f(U.uDisc, disc);
    gl.uniform1f(U.uFed, fed);
    gl.uniform1f(U.uCirc, circ);
    gl.uniform1f(U.uFlash, flash);
    gl.uniform1f(U.uTime, time);
    gl.uniform3fv(U.uHot, hot);
    gl.uniform3fv(U.uMid, mid);
    gl.uniform3fv(U.uOut, out);
    gl.uniform1f(U.uFlow, flow);
    gl.uniform1f(U.uWind, wind);
    gl.uniform1f(U.uWindR, windR);
    gl.uniform1f(U.uTear, tear);
    gl.uniform1f(U.uCloud, cloud);
    const s = new Float32Array(20), c = new Float32Array(15), st = new Float32Array(20), al = new Float32Array(20);
    sheets.forEach((q, i) => {
      if (i > 4) return;
      s.set([q.x, q.y, q.r, q.o], i * 4);
      c.set(q.c, i * 3);
      st.set(q.stops, i * 4);
      al.set(q.alphas, i * 4);
    });
    gl.uniform4fv(U.uSh, s);
    gl.uniform3fv(U.uShC, c);
    gl.uniform4fv(U.uShS, st);
    gl.uniform4fv(U.uShP, al);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function close() {
    ticket++;
    ready = false;
    canvas.style.display = "none";
  }

  return {
    open, draw, close,
    get ready() { return ready; },
    get shot() { return shot; },
    get half() { return half; },
  };
}
