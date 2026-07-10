/**
 * POC: "Liquid page" — the whole rendered page is captured into a WebGL
 * texture and re-drawn through a distortion shader that twists/ripples
 * around the mouse.
 *
 * How it works:
 *  1. html-to-image rasterizes document.body (SVG foreignObject under the
 *     hood, with fonts/styles inlined) into a 2D canvas.
 *  2. That canvas becomes a THREE.CanvasTexture on a fullscreen quad. All
 *     distortion happens as UV displacement in the fragment shader.
 *  3. The real DOM stays underneath with opacity 0 but fully interactive
 *     (links/buttons keep working); the WebGL canvas sits on top with
 *     pointer-events: none.
 *
 * Progressive enhancement: the DOM is visible by default and only hidden
 * after the capture AND the first WebGL frame succeed. Any failure (no
 * WebGL, tainted canvas, capture error) leaves the page untouched.
 */
import * as THREE from "three";
import { toCanvas, getFontEmbedCSS } from "html-to-image";

const CANVAS_ID = "fx-canvas";
const ACTIVE_CLASS = "fx-active";
const CAPTURE_PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, 1.5);

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;
  uniform vec2 uMouse;      // pointer position, viewport UV
  uniform vec2 uVelocity;   // smoothed pointer velocity, UV units
  uniform float uIntensity; // 0..1 global fade-in of the effect
  uniform float uTime;
  uniform float uAspect;    // viewport width / height
  uniform float uViewToTex; // viewport height / document height
  uniform float uScrollTex; // scrollY / document height

  varying vec2 vUv;

  vec2 rotateAround(vec2 p, vec2 center, float angle) {
    vec2 d = p - center;
    float s = sin(angle);
    float c = cos(angle);
    return center + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  }

  void main() {
    vec2 uv = vUv;
    float speed = length(uVelocity);

    // Work in aspect-corrected space so distances/rotations are circular.
    vec2 am = vec2(uAspect, 1.0);
    vec2 p = uv * am;
    vec2 m = uMouse * am;
    vec2 c = vec2(0.5) * am;

    // 1) Whole-page twist: the sheet subtly rotates around its center
    //    following the horizontal position of the pointer.
    float pageAngle = (uMouse.x - 0.5) * -0.05 * uIntensity;
    p = rotateAround(p, c, pageAngle);

    // 2) Whole-page bend: the middle of the sheet bows away from the pointer.
    p.x += sin(uv.y * 3.14159) * (uMouse.x - 0.5) * -0.02 * uIntensity;
    p.y += sin(uv.x * 3.14159) * (uMouse.y - 0.5) * -0.02 * uIntensity;

    // 3) Local swirl around the cursor, stronger while the pointer moves.
    float dist = distance(p, m);
    float falloff = exp(-dist * dist * 9.0);
    float swirl = -1.8 * falloff * uIntensity * (0.08 + min(speed * 14.0, 1.0));
    p = rotateAround(p, m, swirl);

    // 4) Liquid smear: pixels get dragged along the pointer velocity.
    p -= uVelocity * am * falloff * 2.5 * uIntensity;

    // 5) Ripple rings emitted while moving.
    float ripple = sin(dist * 34.0 - uTime * 5.0) * 0.006 * falloff *
      min(speed * 24.0, 1.0) * uIntensity;
    p += normalize(p - m + 1e-5) * ripple;

    uv = p / am;

    // Map viewport UV -> document texture UV (supports page scroll: the
    // texture holds the full document, the quad shows the viewport slice).
    vec2 tuv = vec2(uv.x, 1.0 - ((1.0 - uv.y) * uViewToTex + uScrollTex));
    tuv = clamp(tuv, vec2(0.002), vec2(0.998));

    // Subtle chromatic aberration near the cursor while moving.
    vec2 caOffset = uVelocity * falloff * 1.2 * uIntensity;
    float r = texture2D(uTexture, clamp(tuv + caOffset, vec2(0.002), vec2(0.998))).r;
    vec4 base = texture2D(uTexture, tuv);
    float b = texture2D(uTexture, clamp(tuv - caOffset, vec2(0.002), vec2(0.998))).b;

    gl_FragColor = vec4(r, base.g, b, base.a);
  }
`;

// Computed once: re-fetching/re-parsing every stylesheet on each recapture
// (resize) would be wasteful, and the fonts don't change at runtime.
let fontEmbedCSSPromise;
function getFontEmbedCSSOnce() {
  if (!fontEmbedCSSPromise) {
    fontEmbedCSSPromise = getFontEmbedCSS(document.body, {
      preferredFontFormat: "woff2",
    }).catch(() => undefined);
  }
  return fontEmbedCSSPromise;
}

async function capturePage(maxTextureSize) {
  const width = document.documentElement.clientWidth;
  const height = Math.max(document.body.scrollHeight, window.innerHeight);

  // Keep the rasterized document under the GPU texture size limit.
  let pixelRatio = CAPTURE_PIXEL_RATIO;
  const largestSide = Math.max(width, height);
  if (largestSide * pixelRatio > maxTextureSize) {
    pixelRatio = maxTextureSize / largestSide;
  }

  const overlay = document.getElementById("overlay-content");
  const backgroundColor = overlay
    ? getComputedStyle(overlay).backgroundColor
    : undefined;

  const fontEmbedCSS = await getFontEmbedCSSOnce();

  const canvas = await toCanvas(document.body, {
    width,
    height,
    pixelRatio,
    backgroundColor,
    filter: (node) => node.id !== CANVAS_ID && node.tagName !== "SCRIPT",
    ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
  });

  return { canvas, width, height };
}

function createTexture(sourceCanvas) {
  const texture = new THREE.CanvasTexture(sourceCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

async function init() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Wait for webfonts so the snapshot matches the live page.
  await document.fonts.ready;

  const canvasEl = document.createElement("canvas");
  canvasEl.id = CANVAS_ID;
  canvasEl.setAttribute("aria-hidden", "true");
  Object.assign(canvasEl.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    zIndex: "60",
    pointerEvents: "none",
    opacity: "0",
    transition: "opacity 400ms ease",
  });

  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const captured = await capturePage(renderer.capabilities.maxTextureSize);
  let texture = createTexture(captured.canvas);

  const uniforms = {
    uTexture: { value: texture },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uVelocity: { value: new THREE.Vector2(0, 0) },
    uIntensity: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: window.innerWidth / window.innerHeight },
    uViewToTex: { value: window.innerHeight / captured.height },
    uScrollTex: { value: window.scrollY / captured.height },
  };

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  // First frame before revealing anything — if the texture is tainted or the
  // context is broken, this throws and the DOM stays visible.
  renderer.render(scene, camera);

  document.body.appendChild(canvasEl);

  let enabled = true;
  let documentHeight = captured.height;

  const setEnabled = (on) => {
    enabled = on;
    canvasEl.style.opacity = on ? "1" : "0";
    document.body.classList.toggle(ACTIVE_CLASS, on);
  };

  // Fade the canvas in over identical pixels, then hide the real DOM.
  requestAnimationFrame(() => {
    canvasEl.style.opacity = "1";
    setTimeout(() => {
      if (enabled) document.body.classList.add(ACTIVE_CLASS);
    }, 450);
  });

  // --- Interaction ---------------------------------------------------------
  const targetMouse = new THREE.Vector2(0.5, 0.5);
  const mouse = uniforms.uMouse.value;
  const velocity = uniforms.uVelocity.value;
  const scratch = new THREE.Vector2();

  window.addEventListener(
    "pointermove",
    (event) => {
      targetMouse.set(
        event.clientX / window.innerWidth,
        1 - event.clientY / window.innerHeight
      );
    },
    { passive: true }
  );

  window.addEventListener(
    "scroll",
    () => {
      uniforms.uScrollTex.value = window.scrollY / documentHeight;
    },
    { passive: true }
  );

  const toggleButton = document.getElementById("fx-toggle");
  if (toggleButton) {
    toggleButton.addEventListener("click", () => setEnabled(!enabled));
  }
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setEnabled(false);
  });

  let recaptureTimer;
  window.addEventListener("resize", () => {
    clearTimeout(recaptureTimer);
    recaptureTimer = setTimeout(async () => {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      uniforms.uAspect.value = window.innerWidth / window.innerHeight;
      try {
        const next = await capturePage(renderer.capabilities.maxTextureSize);
        texture.dispose();
        texture = createTexture(next.canvas);
        documentHeight = next.height;
        uniforms.uTexture.value = texture;
        uniforms.uViewToTex.value = window.innerHeight / next.height;
        uniforms.uScrollTex.value = window.scrollY / next.height;
      } catch (error) {
        console.warn("[fx] recapture failed, disabling effect", error);
        setEnabled(false);
      }
    }, 300);
  });

  // --- Render loop ----------------------------------------------------------
  const clock = new THREE.Clock();

  renderer.setAnimationLoop(() => {
    if (!enabled) return;

    uniforms.uTime.value = clock.getElapsedTime();
    uniforms.uIntensity.value += (1 - uniforms.uIntensity.value) * 0.04;

    // Ease the shader mouse toward the pointer; the lag vector doubles as
    // the velocity that drives smear/swirl/ripple strength.
    scratch.copy(targetMouse).sub(mouse);
    velocity.lerp(scratch, 0.1);
    if (velocity.length() > 0.09) velocity.setLength(0.09);
    mouse.add(scratch.multiplyScalar(0.09));

    renderer.render(scene, camera);
  });
}

function start() {
  init().catch((error) => {
    console.warn("[fx] liquid page effect disabled:", error);
    document.body.classList.remove(ACTIVE_CLASS);
    document.getElementById(CANVAS_ID)?.remove();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
