/**
 * POC variant: distort only the decorative background layer (the radial
 * gradient blob + tree illustration inside #overlay-content), leaving the
 * navbar and page content crisp and undistorted on top.
 *
 * Unlike the whole-page POC (src/client/distortion.js), this element has no
 * links or text to keep clickable, so there's no need for the "invisible
 * interactive DOM + pointer-events:none canvas on top" trick: the canvas
 * simply replaces the decorative layer in place, behind the real content.
 */
import * as THREE from "three";
import { toCanvas, getFontEmbedCSS } from "html-to-image";

const CANVAS_ID = "fx-bg-canvas";
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
  uniform vec2 uMouse;      // pointer position local to the box, 0..1
  uniform vec2 uVelocity;
  uniform float uIntensity;
  uniform float uTime;
  uniform float uAspect;
  uniform bool uHover;

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

    vec2 am = vec2(uAspect, 1.0);
    vec2 p = uv * am;
    vec2 m = uMouse * am;

    // No legibility constraint here (pure decoration), so the swirl can be
    // stronger and wider than on the whole-page variant.
    float dist = distance(p, m);
    float falloff = exp(-dist * dist * 5.0);
    float hoverBoost = uHover ? 1.0 : 0.35;
    float swirl = -2.6 * falloff * uIntensity * hoverBoost *
      (0.15 + min(speed * 16.0, 1.0));
    p = rotateAround(p, m, swirl);

    p -= uVelocity * am * falloff * 3.0 * uIntensity;

    float ripple = sin(dist * 26.0 - uTime * 4.0) * 0.01 * falloff *
      min(speed * 20.0, 1.0) * uIntensity;
    p += normalize(p - m + 1e-5) * ripple;

    // Gentle constant drift so the background never looks fully static.
    p.x += sin(uTime * 0.15 + uv.y * 4.0) * 0.006 * uIntensity;
    p.y += cos(uTime * 0.12 + uv.x * 4.0) * 0.006 * uIntensity;

    uv = p / am;
    uv = clamp(uv, vec2(0.002), vec2(0.998));

    gl_FragColor = texture2D(uTexture, uv);
  }
`;

function captureBackground(overlayEl, maxTextureSize) {
  const rect = overlayEl.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  let pixelRatio = CAPTURE_PIXEL_RATIO;
  const largestSide = Math.max(width, height);
  if (largestSide * pixelRatio > maxTextureSize) {
    pixelRatio = maxTextureSize / largestSide;
  }

  return getFontEmbedCSS(overlayEl, { preferredFontFormat: "woff2" })
    .catch(() => undefined)
    .then((fontEmbedCSS) =>
      toCanvas(overlayEl, {
        width,
        height,
        pixelRatio,
        // Keep only the decorative layer: drop navbar + main content
        // (#page-shell) from the clone, so the capture is just the gradient
        // and illustration sitting behind it.
        filter: (node) =>
          node.id !== "page-shell" &&
          node.id !== CANVAS_ID &&
          node.tagName !== "SCRIPT",
        ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
      })
    )
    .then((canvas) => ({ canvas, width, height }));
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

  const overlayEl = document.getElementById("overlay-content");
  if (!overlayEl) return;

  await document.fonts.ready;

  const canvasEl = document.createElement("canvas");
  canvasEl.id = CANVAS_ID;
  canvasEl.setAttribute("aria-hidden", "true");
  Object.assign(canvasEl.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    zIndex: "-10",
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

  const captured = await captureBackground(
    overlayEl,
    renderer.capabilities.maxTextureSize
  );
  let texture = createTexture(captured.canvas);
  renderer.setSize(captured.width, captured.height, false);

  const uniforms = {
    uTexture: { value: texture },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uVelocity: { value: new THREE.Vector2(0, 0) },
    uIntensity: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: captured.width / captured.height },
    uHover: { value: false },
  };

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  // First frame before touching the DOM — if this throws (tainted canvas,
  // no WebGL), the original gradient/illustration stay exactly as they were.
  renderer.render(scene, camera);

  overlayEl.insertBefore(canvasEl, overlayEl.firstChild);
  requestAnimationFrame(() => {
    canvasEl.style.opacity = "1";
  });

  // --- Interaction: mouse position local to the overlay box --------------
  const targetMouse = new THREE.Vector2(0.5, 0.5);
  const mouse = uniforms.uMouse.value;
  const velocity = uniforms.uVelocity.value;
  const scratch = new THREE.Vector2();
  let rect = overlayEl.getBoundingClientRect();

  const updateRect = () => {
    rect = overlayEl.getBoundingClientRect();
  };
  window.addEventListener("scroll", updateRect, { passive: true });

  window.addEventListener(
    "pointermove",
    (event) => {
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      uniforms.uHover.value = inside;
      targetMouse.set(
        Math.min(Math.max(x, -0.2), 1.2),
        Math.min(Math.max(y, -0.2), 1.2)
      );
    },
    { passive: true }
  );

  let recaptureTimer;
  window.addEventListener("resize", () => {
    clearTimeout(recaptureTimer);
    recaptureTimer = setTimeout(async () => {
      updateRect();
      try {
        const next = await captureBackground(
          overlayEl,
          renderer.capabilities.maxTextureSize
        );
        texture.dispose();
        texture = createTexture(next.canvas);
        uniforms.uTexture.value = texture;
        uniforms.uAspect.value = next.width / next.height;
        renderer.setSize(next.width, next.height, false);
      } catch (error) {
        console.warn("[fx-bg] recapture failed, disabling effect", error);
        canvasEl.remove();
      }
    }, 300);
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    uniforms.uTime.value = clock.getElapsedTime();
    uniforms.uIntensity.value += (1 - uniforms.uIntensity.value) * 0.04;

    scratch.copy(targetMouse).sub(mouse);
    velocity.lerp(scratch, 0.1);
    if (velocity.length() > 0.12) velocity.setLength(0.12);
    mouse.add(scratch.multiplyScalar(0.09));

    renderer.render(scene, camera);
  });
}

function start() {
  init().catch((error) => {
    console.warn("[fx-bg] background distortion disabled:", error);
    document.getElementById(CANVAS_ID)?.remove();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
