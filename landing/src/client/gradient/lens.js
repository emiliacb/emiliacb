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
uniform float uRs;      // r_s, in CSS px
uniform float uL;       // half the square
uniform float uLens;    // 0: the page shows through; 1: the lensed copy
uniform sampler2D uTex;
uniform vec2 uTexOff;   // where the square starts in the copy, in CSS px
uniform vec2 uTexSize;  // the copy's size, in CSS px
uniform vec3 uBg;
uniform vec4 uSh[5];    // each sheet: centre (square px), radius, opacity
uniform vec3 uShC[5];
uniform vec2 uShA[5];   // its two alphas; a1 < 0 for the soft halo
uniform float uTime;
uniform float uDisc;    // the disc's light, 0 to 1, more as it evaporates
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

vec3 page(vec2 q) {
  vec3 c = uBg;
  for (int i = 0; i < 5; i++) {
    float d = length(q - uSh[i].xy) / max(uSh[i].z, 1.0);
    float a;
    if (uShA[i].y < 0.0) a = uShA[i].x * (1.0 - smoothstep(0.6, 1.0, d));
    else a = d < 0.95 ? mix(uShA[i].x, uShA[i].y, d / 0.95) : mix(uShA[i].y, 0.0, (d - 0.95) / 0.05);
    a *= step(d, 1.0) * uSh[i].w;
    c = mix(c, uShC[i], a);
  }
  vec2 uv = (q + uTexOff) / uTexSize;
  vec4 t = texture2D(uTex, clamp(uv, 0.0, 1.0));
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) t = vec4(0.0);
  return c * (1.0 - t.a) + t.rgb;
}

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

void main() {
  vec2 frag = vUv * uRes;                // y down
  vec2 rel = frag - uRes * 0.5;
  float rp = length(rel);
  // Near the square's edge the bending eases off, so the copy meets the page.
  float edge = smoothstep(0.6 * uL, 0.96 * uL, rp);
  if (uRs < 0.25) {
    gl_FragColor = uLens > 0.0 ? vec4(page(frag) * uLens, uLens) : vec4(0.0);
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
        float a = ph - uTime * 0.9 * pow(3.0 / rr, 1.5);
        vec3 ring = vec3(cos(a), sin(a), 0.0);
        float n = 0.6 * noise(vec3(ring.xy * 2.5, rr * 1.4)) + 0.4 * noise(vec3(ring.xy * 7.0, rr * 4.0 + 3.0));
        float prof = pow(3.0 / rr, 2.0) * smoothstep(2.9, 3.4, rr) * (1.0 - smoothstep(DISC * 0.5, DISC, rr));
        vec3 tang = normalize(cross(N, x));
        float beta = sqrt(0.5 / (rr - 1.0));
        vec3 k = -normalize(v);
        float g = sqrt(1.0 - beta * beta) / (1.0 - beta * dot(tang, k));
        float I = prof * (0.45 + 1.0 * n) * mix(1.0, g * g * g, 0.5) * sqrt(1.0 - 1.0 / rr) * uDisc;
        vec3 col = rr < 4.6 ? mix(uHot, uMid, (rr - 2.9) / 1.7) : mix(uMid, uOut, clamp((rr - 4.6) / (DISC - 4.6), 0.0, 1.0));
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
    if (p.z < -D && v.z < 0.0) hit = p.xy - v.xy * ((p.z + D) / v.z);
    else hit = p.xy + normalize(v).xy * 60.0;
    vec2 q = rot(-uRoll) * hit * uRs;
    q = vec2(q.x, -q.y) + uRes * 0.5;
    q = mix(q, frag, edge);
    // A glow of the disc's light, scattered close round the hole.
    float glow = uDisc * 0.35 * exp(-max(0.0, near - 2.6) / 2.2) * (1.0 - edge);
    if (uLens > 0.0) bg = vec4(mix(page(q), uMid, glow * 0.6) * uLens, uLens);
    bg = bg + vec4(uMid * glow * 0.35, glow * 0.35) * (1.0 - bg.a);
  } else {
    bg = vec4(uCore, 1.0);
  }
  vec4 o = acc + (1.0 - acc.a) * bg;
  // The flash it goes out in.
  float f = uFlash * exp(-pow(rp / (uL * 0.45), 2.0));
  o = mix(o, vec4(1.0), clamp(f, 0.0, 1.0));
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
  for (const n of ["uRes", "uRs", "uL", "uLens", "uTex", "uTexOff", "uTexSize", "uBg", "uSh", "uShC", "uShA",
    "uTime", "uDisc", "uFlash", "uHot", "uMid", "uOut", "uCore", "uTilt", "uRoll"]) U[n] = gl.getUniformLocation(prog, n);
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
    gl.uniform3fv(U.uHot, dark ? [1, 0.9, 0.95] : [1, 0.97, 0.86]);
    gl.uniform3fv(U.uMid, dark ? [0.93, 0.4, 0.56] : [0.99, 0.72, 0.28]);
    gl.uniform3fv(U.uOut, dark ? [0.32, 0.55, 1] : [0.36, 0.74, 0.62]);
    gl.uniform3fv(U.uCore, dark ? [0, 0, 0] : [0.047, 0.04, 0.035]);
    gl.uniform3fv(U.uBg, rgb(getComputedStyle(host).backgroundColor));
  }

  /** A square of half-side `l` round (x, y) in the host's box, for a hole of
   * radius `rs`; the copy of the page behind it is taken now. */
  function open(x, y, l) {
    half = l;
    size = 2 * l;
    dpr = Math.min(1.5, devicePixelRatio || 1);
    canvas.style.left = `${x - l}px`;
    canvas.style.top = `${y - l}px`;
    canvas.style.width = canvas.style.height = `${size}px`;
    canvas.width = canvas.height = Math.round(size * dpr);
    canvas.style.display = "";
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, size, size);
    gl.uniform1f(U.uL, l);
    palette();
    ready = false;
    copy(x - l, y - l);
  }

  async function copy(x0, y0) {
    if (!shell) return;
    const mine = ++ticket;
    const hostBox = host.getBoundingClientRect(), shellBox = shell.getBoundingClientRect();
    const sx = x0 - (shellBox.left - hostBox.left), sy = y0 - (shellBox.top - hostBox.top);
    const w = shell.offsetWidth;
    // All of each face's formats: asked for woff2 alone, Chrome draws the
    // copy in a fallback face.
    if (fontCSS === undefined) fontCSS = await getFontEmbedCSS(shell).catch(() => null);
    let img;
    try {
      // Only the rows of the square are drawn: the shell moved up out of a
      // frame that tall. Its width stays its own, so nothing reflows.
      img = await toCanvas(shell, {
        width: w,
        height: size,
        pixelRatio: dpr,
        // The frame is the square's height; the shell keeps its own, so its
        // layout is as on the page.
        style: { transform: `translateY(${-sy}px)`, margin: "0", height: `${shell.offsetHeight}px` },
        filter: (node) => !(node instanceof HTMLCanvasElement),
        ...(fontCSS ? { fontEmbedCSS: fontCSS } : { skipFonts: true }),
      });
    } catch {
      return;
    }
    if (mine !== ticket) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.uniform2f(U.uTexOff, sx, 0);
    gl.uniform2f(U.uTexSize, w, size);
    ready = true;
  }

  /** One frame: r_s in px, how much of the copy shows, the disc's light, the
   * flash, the sheets (centre in the square, radius, opacity, colour, alphas). */
  function draw({ rs, lens, disc, flash, time, sheets }) {
    gl.uniform1f(U.uRs, rs);
    gl.uniform1f(U.uLens, ready ? lens : 0);
    gl.uniform1f(U.uDisc, disc);
    gl.uniform1f(U.uFlash, flash);
    gl.uniform1f(U.uTime, time);
    const s = new Float32Array(20), c = new Float32Array(15), a = new Float32Array(10);
    sheets.forEach((q, i) => {
      if (i > 4) return;
      s.set([q.x, q.y, q.r, q.o], i * 4);
      c.set(q.c, i * 3);
      a.set([q.a0, q.a1], i * 2);
    });
    gl.uniform4fv(U.uSh, s);
    gl.uniform3fv(U.uShC, c);
    gl.uniform2fv(U.uShA, a);
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
    get half() { return half; },
  };
}
