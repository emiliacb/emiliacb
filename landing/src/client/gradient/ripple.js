/**
 * The blast's shock through the page: everything on it, the text and the
 * navbar, moves as if printed on a cloth that has just been shaken.
 *
 * It draws the copy of the page the hole took (gradient/lens.js), over the
 * screen, while the page itself is hidden. A ring leaves the hole at a
 * cloth's wave speed; behind it the cloth rises and falls (a damped wave in
 * the distance behind the front), and each point of the page is carried
 * across by the cloth's slope, as print on a rippling sheet is. The folds
 * catch the light on one side and fall into shade on the other. It dies away
 * as it spreads, and then the page is given back as it was.
 */
import { isDark } from "../lib/theme.js";

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
uniform sampler2D uTex;
uniform vec2 uRes;      // the canvas, in CSS px
uniform vec2 uOff;      // where the canvas starts in the copy
uniform vec2 uTexSize;  // the copy, in CSS px
uniform vec2 uC;        // the blast, in the canvas
uniform float uT;       // s since it
uniform vec3 uShade;    // the ink of the folds' shade
uniform float uDark;    // 1 on the dark theme

const float SPEED = 1500.0;  // px/s
const float WAVE = 115.0;    // px from crest to crest
const float AMP = 16.0;      // px, at the start
const float TAU = 0.75;      // s for it to die down to a third
const float REACH = 520.0;   // px behind the front for the ringing to fade

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 q = vUv * uRes;
  vec2 rel = q - uC;
  float r = length(rel);
  vec2 dir = rel / max(r, 1.0);
  // A cloth is never shaken evenly: the front is a little ragged.
  float th = atan(rel.y, rel.x);
  float front = SPEED * uT * (1.0 + 0.06 * (noise(vec2(th * 3.0, uT)) - 0.5));
  float behind = front - r;
  float k = 6.2831853 / WAVE;
  float env = smoothstep(0.0, 30.0, behind) * exp(-max(behind, 0.0) / REACH) * exp(-uT / TAU);
  float h = AMP * env * sin(behind * k);
  float slope = AMP * env * cos(behind * k) * k;
  // Carried across by the cloth, and a little sideways where it creases.
  vec2 side = vec2(-dir.y, dir.x) * (noise(q * 0.01 + uT) - 0.5) * 0.5 * h;
  vec2 at = q - dir * h - side;
  vec2 uv = (at + uOff) / uTexSize;
  vec4 c = texture2D(uTex, clamp(uv, 0.0, 1.0));
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) c = vec4(0.0);
  // The folds: lit facing the blast, shaded away from it.
  float s = clamp(slope * 0.9, -1.0, 1.0);
  float lit = max(0.0, s), dim = max(0.0, -s);
  vec4 fold = vec4(vec3(1.0) * lit * (0.14 - 0.08 * uDark), lit * (0.14 - 0.08 * uDark))
            + vec4(uShade * dim * (0.12 + 0.1 * uDark), dim * (0.12 + 0.1 * uDark));
  gl_FragColor = c + fold * (1.0 - c.a);
}`;

export function makeRipple(host) {
  const canvas = document.createElement("canvas");
  canvas.className = "bh-ripple";
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
    console.warn("ripple:", err);
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
  for (const n of ["uTex", "uRes", "uOff", "uTexSize", "uC", "uT", "uShade", "uDark"]) U[n] = gl.getUniformLocation(prog, n);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.uniform1i(U.uTex, 0);

  const shell = document.getElementById("page-shell");
  let on = false;

  /** Starts the shock from (cx, cy) in the host, with the copy `shot`. */
  function start(shot, cx, cy) {
    if (!shot || !shell) return false;
    const hostBox = host.getBoundingClientRect();
    // Over the screen, in the host.
    const x0 = Math.round(-hostBox.left), y0 = Math.round(-hostBox.top);
    const w = Math.min(host.clientWidth, innerWidth), h = innerHeight;
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    canvas.style.left = `${x0}px`;
    canvas.style.top = `${y0}px`;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, shot.img);
    gl.uniform2f(U.uRes, w, h);
    gl.uniform2f(U.uOff, x0 - shot.x, y0 - shot.y);
    gl.uniform2f(U.uTexSize, shot.w, shot.h);
    gl.uniform2f(U.uC, cx - x0, cy - y0);
    const dark = isDark();
    gl.uniform3fv(U.uShade, dark ? [0, 0, 0] : [0.11, 0.1, 0.09]);
    gl.uniform1f(U.uDark, dark ? 1 : 0);
    draw(0);
    canvas.style.display = "";
    // The page itself steps out while its copy is shaken.
    shell.style.visibility = "hidden";
    on = true;
    return true;
  }

  function draw(t) {
    gl.uniform1f(U.uT, t);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function stop() {
    if (!on) return;
    on = false;
    shell.style.visibility = "";
    canvas.style.display = "none";
  }

  return { start, draw, stop, get on() { return on; } };
}
