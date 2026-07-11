/**
 * POC variant: distort only the decorative background layer (the radial
 * gradient blob + tree illustration inside #overlay-content), leaving the
 * navbar and page content crisp and undistorted on top.
 *
 * Two capture strategies, feature-detected at runtime:
 *
 *  - NATIVE (speculative): the WICG "HTML in Canvas" proposal
 *    (https://github.com/WICG/html-in-canvas), which lets WebGL read a live
 *    HTML element's rendered pixels directly via `gl.texElementImage2D()`.
 *    No browser ships this today (Chromium has it behind
 *    chrome://flags/#canvas-draw-element, still experimental/unshipped), so
 *    this path is untested and only runs if that API exists. Each
 *    decorative element gets its own texture/quad, updated every frame
 *    straight from the live DOM — no snapshot, no serialization, real
 *    animation preserved.
 *
 *  - FALLBACK (what every real browser uses today): `html-to-image`
 *    rasterizes the decorative layer once into a canvas texture, same
 *    technique as the whole-page POC (src/client/distortion.js).
 *
 * Either way, the original DOM elements are hidden (opacity: 0) only after
 * the replacement canvas has successfully rendered, so a failure never
 * leaves both the original and the effect visible at once, and never
 * leaves the page blank either.
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

    // Tight falloff radius + low ambient boost: only distort close to the
    // cursor, and keep it calm unless the pointer is actually over the box.
    float dist = distance(p, m);
    float falloff = exp(-dist * dist * 10.0);
    float hoverBoost = uHover ? 1.0 : 0.08;
    float swirl = -1.0 * falloff * uIntensity * hoverBoost *
      (0.1 + min(speed * 10.0, 1.0));
    p = rotateAround(p, m, swirl);

    p -= uVelocity * am * falloff * 1.0 * uIntensity * hoverBoost;

    float ripple = sin(dist * 26.0 - uTime * 4.0) * 0.004 * falloff *
      min(speed * 14.0, 1.0) * uIntensity * hoverBoost;
    p += normalize(p - m + 1e-5) * ripple;

    // Gentle constant drift so the background never looks fully static.
    p.x += sin(uTime * 0.15 + uv.y * 4.0) * 0.003 * uIntensity;
    p.y += cos(uTime * 0.12 + uv.x * 4.0) * 0.003 * uIntensity;

    uv = p / am;
    uv = clamp(uv, vec2(0.002), vec2(0.998));

    vec4 color = texture2D(uTexture, uv);
    if (uv.x <= 0.002 || uv.x >= 0.998 || uv.y <= 0.002 || uv.y >= 0.998) {
      color.a *= 0.0; // don't smear edge pixels into the surrounding box
    }
    gl_FragColor = color;
  }
`;

function makeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: null },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uVelocity: { value: new THREE.Vector2(0, 0) },
      uIntensity: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uHover: { value: false },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
  });
}

// A single element's local interaction state: mouse position/velocity in its
// own 0..1 box space, independent of the other decorative element.
function makeLocalPointer(targetEl, uniforms) {
  const target = new THREE.Vector2(0.5, 0.5);
  const scratch = new THREE.Vector2();
  let rect = targetEl.getBoundingClientRect();

  const updateRect = () => {
    rect = targetEl.getBoundingClientRect();
  };
  window.addEventListener("scroll", updateRect, { passive: true });
  window.addEventListener("resize", updateRect, { passive: true });

  window.addEventListener(
    "pointermove",
    (event) => {
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      uniforms.uHover.value = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      target.set(Math.min(Math.max(x, -0.2), 1.2), Math.min(Math.max(y, -0.2), 1.2));
    },
    { passive: true }
  );

  return {
    updateRect,
    tick() {
      scratch.copy(target).sub(uniforms.uMouse.value);
      uniforms.uVelocity.value.lerp(scratch, 0.1);
      if (uniforms.uVelocity.value.length() > 0.12) uniforms.uVelocity.value.setLength(0.12);
      uniforms.uMouse.value.add(scratch.multiplyScalar(0.09));
    },
  };
}

function createCanvasTexture(sourceCanvas) {
  const texture = new THREE.CanvasTexture(sourceCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function hideOriginal(el) {
  if (!el) return;
  // gradient-bg's CSS class runs a one-shot "gradientAppear ... forwards"
  // animation that holds opacity:1 indefinitely once finished — that beats
  // a plain inline opacity, so the animation has to be cancelled first.
  el.style.animation = "none";
  el.style.transition = "opacity 200ms ease";
  el.style.opacity = "0";
}

// Each decorative element only covers part of #overlay-content's box, so its
// quad must be sized/positioned to match that element's own rect within the
// shared canvas — not stretched to fill the whole thing.
function positionMesh(mesh, el, overlayRect) {
  const r = el.getBoundingClientRect();
  const leftF = (r.left - overlayRect.left) / overlayRect.width;
  const rightF = (r.right - overlayRect.left) / overlayRect.width;
  const topF = (r.top - overlayRect.top) / overlayRect.height;
  const bottomF = (r.bottom - overlayRect.top) / overlayRect.height;

  const ndcLeft = -1 + 2 * leftF;
  const ndcRight = -1 + 2 * rightF;
  const ndcTop = 1 - 2 * topF;
  const ndcBottom = 1 - 2 * bottomF;

  mesh.position.set((ndcLeft + ndcRight) / 2, (ndcTop + ndcBottom) / 2, 0);
  mesh.scale.set((ndcRight - ndcLeft) / 2, (ndcTop - ndcBottom) / 2, 1);
}

// ---------------------------------------------------------------------------
// NATIVE path: WICG "HTML in Canvas" (https://github.com/WICG/html-in-canvas)
// Speculative — no shipping browser implements this today. Feature-detected
// below; this code simply never runs until/unless a browser adds it.
// ---------------------------------------------------------------------------
function supportsHtmlInCanvas(gl) {
  return !!gl && typeof gl.texElementImage2D === "function";
}

function setupNativeLayer(renderer, gl, targetEl) {
  const material = makeMaterial();
  // Force Three.js to allocate a real WebGL texture object we can then feed
  // directly via texElementImage2D, bypassing Three's normal image upload.
  const placeholder = document.createElement("canvas");
  placeholder.width = placeholder.height = 1;
  const texture = createCanvasTexture(placeholder);
  material.uniforms.uTexture.value = texture;

  const rect = targetEl.getBoundingClientRect();
  material.uniforms.uAspect.value = rect.width / Math.max(rect.height, 1);

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  const pointer = makeLocalPointer(targetEl, material.uniforms);

  let glTexture = null;
  const ensureUploaded = () => {
    // First render call makes Three.js create+bind the underlying texture.
    if (glTexture) return;
    glTexture = renderer.properties.get(texture).__webglTexture || null;
  };

  return {
    mesh,
    pointer,
    targetEl,
    reposition(overlayRect) {
      positionMesh(mesh, targetEl, overlayRect);
      const r = targetEl.getBoundingClientRect();
      material.uniforms.uAspect.value = r.width / Math.max(r.height, 1);
    },
    uploadFrame() {
      ensureUploaded();
      if (!glTexture) return false;
      try {
        gl.bindTexture(gl.TEXTURE_2D, glTexture);
        // Speculative API shape per the WICG explainer. Signature/behavior
        // may change before (if) this ships.
        gl.texElementImage2D(gl.TEXTURE_2D, gl.RGBA, targetEl, {});
        return true;
      } catch (error) {
        console.warn("[fx-bg:native] texElementImage2D failed", error);
        return false;
      }
    },
    material,
  };
}

// ---------------------------------------------------------------------------
// FALLBACK path: html-to-image snapshot (what every real browser uses today)
//
// Captured from #overlay-content as a whole (excluding #page-shell), not
// per-element: the tree illustration renders through a Shadow DOM (the
// dotlottie-player web component), and html-to-image only manages to flatten
// that shadow content when the capture root is high enough in the tree —
// capturing #tree-illustration in isolation comes back essentially blank.
// One combined texture also sidesteps needing separate positioning math;
// it simply covers the same box #overlay-content already occupies.
// ---------------------------------------------------------------------------
function captureDecoration(overlayEl, maxTextureSize) {
  const rect = overlayEl.getBoundingClientRect();
  const width = Math.max(Math.round(rect.width), 1);
  const height = Math.max(Math.round(rect.height), 1);

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
        backgroundColor: "transparent",
        filter: (node) => node.id !== "page-shell" && node.tagName !== "SCRIPT",
        ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
      })
    )
    .then((canvas) => ({ canvas, width, height }));
}

async function setupFallbackLayer(renderer, overlayEl) {
  const material = makeMaterial();
  const captured = await captureDecoration(overlayEl, renderer.capabilities.maxTextureSize);
  const texture = createCanvasTexture(captured.canvas);
  material.uniforms.uTexture.value = texture;
  material.uniforms.uAspect.value = captured.width / captured.height;

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  const pointer = makeLocalPointer(overlayEl, material.uniforms);

  return {
    mesh,
    pointer,
    material,
    reposition() {
      mesh.position.set(0, 0, 0);
      mesh.scale.set(1, 1, 1); // always fills the canvas — same box as #overlay-content
    },
    async recapture() {
      const next = await captureDecoration(overlayEl, renderer.capabilities.maxTextureSize);
      material.uniforms.uTexture.value.dispose();
      const nextTexture = createCanvasTexture(next.canvas);
      material.uniforms.uTexture.value = nextTexture;
      material.uniforms.uAspect.value = next.width / next.height;
    },
  };
}

// gradient-bg runs a one-shot CSS entrance animation (gradientAppear:
// opacity/scale/blur settling in over ~1.2s). Capturing before it finishes
// freezes that in-between look into the texture — dimmer/blurrier than the
// original ever rests at — and hiding the original at a fixed delay races
// its own animation, causing a visible mismatched crossfade. Wait for any
// running entrance animations to actually finish before doing anything else.
async function waitForEntranceAnimations(el) {
  if (!el || !el.getAnimations) return;
  try {
    await Promise.all(
      el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))
    );
  } catch {
    // getAnimations unsupported or animation cancelled — proceed anyway.
  }
}

async function init() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const overlayEl = document.getElementById("overlay-content");
  const gradientEl = document.getElementById("gradient-bg");
  const treeEl = document.getElementById("tree-illustration");
  if (!overlayEl || !gradientEl) return;

  await Promise.all([
    document.fonts.ready,
    waitForEntranceAnimations(gradientEl),
    waitForEntranceAnimations(treeEl),
  ]);

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
    alpha: true, // let #overlay-content's own background show through
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const overlayRect = overlayEl.getBoundingClientRect();
  renderer.setSize(overlayRect.width, overlayRect.height, false);

  const gl = renderer.getContext();
  const native = supportsHtmlInCanvas(gl);

  const scene = new THREE.Scene();
  const layers = [];

  if (native) {
    console.info("[fx-bg] HTML-in-Canvas supported — using live element textures");
    layers.push(setupNativeLayer(renderer, gl, gradientEl));
    if (treeEl) layers.push(setupNativeLayer(renderer, gl, treeEl));
  } else {
    layers.push(await setupFallbackLayer(renderer, overlayEl));
  }
  layers.forEach((layer) => {
    layer.reposition(overlayRect);
    scene.add(layer.mesh);
  });

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // First frame(s) before touching the DOM — if this throws (tainted
  // canvas, no WebGL), the original gradient/illustration stay untouched.
  if (native) layers.forEach((layer) => layer.uploadFrame());
  renderer.render(scene, camera);

  overlayEl.insertBefore(canvasEl, overlayEl.firstChild);
  requestAnimationFrame(() => {
    canvasEl.style.opacity = "1";
    setTimeout(() => {
      hideOriginal(gradientEl);
      hideOriginal(treeEl);
    }, 250);
  });

  let recaptureTimer;
  window.addEventListener("resize", () => {
    clearTimeout(recaptureTimer);
    recaptureTimer = setTimeout(async () => {
      const r = overlayEl.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      if (native) {
        layers.forEach((layer) => layer.reposition(r));
      } else {
        try {
          await Promise.all(layers.map((layer) => layer.recapture()));
          layers.forEach((layer) => layer.reposition(r));
        } catch (error) {
          console.warn("[fx-bg] recapture failed, disabling effect", error);
          canvasEl.remove();
          if (gradientEl) gradientEl.style.opacity = "";
          if (treeEl) treeEl.style.opacity = "";
        }
      }
    }, 300);
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const time = clock.getElapsedTime();
    layers.forEach((layer) => {
      layer.material.uniforms.uTime.value = time;
      layer.material.uniforms.uIntensity.value +=
        (1 - layer.material.uniforms.uIntensity.value) * 0.04;
      layer.pointer.tick();
      if (native) layer.uploadFrame(); // re-read the live element every frame
    });
    renderer.render(scene, camera);
  });
}

function start() {
  init().catch((error) => {
    console.warn("[fx-bg] background distortion disabled:", error);
    document.getElementById(CANVAS_ID)?.remove();
    document.getElementById("gradient-bg")?.style.removeProperty("opacity");
    document.getElementById("tree-illustration")?.style.removeProperty("opacity");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
