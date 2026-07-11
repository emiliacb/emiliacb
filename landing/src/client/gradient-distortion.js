/**
 * POC variant: distort only the decorative background layer (the radial
 * gradient blob + tree illustration inside #overlay-content), leaving the
 * navbar and page content crisp and undistorted on top.
 *
 * Two capture strategies, feature-detected at runtime:
 *
 *  - NATIVE: the WICG "HTML in Canvas" proposal
 *    (https://github.com/WICG/html-in-canvas). Origin-trialing on Chrome
 *    DESKTOP milestones 148–151 (extended to 154) as of mid-2026; testable
 *    without a trial token via Chrome Canary desktop with
 *    chrome://flags/#canvas-draw-element. Not available on Android Chrome in
 *    this rollout, and not on any other browser. Per the spec, participating
 *    elements must be direct children of the <canvas> (with
 *    `canvas.layoutsubtree = true` opting them into layout), so this path
 *    reparents gradient-bg/tree-illustration into the WebGL canvas — their
 *    absolute positioning still resolves correctly since the canvas already
 *    occupies the exact same box #overlay-content does. Each element then
 *    gets its live pixels read every frame via `gl.texElementImage2D()`, no
 *    snapshot, real animation preserved.
 *
 *  - FALLBACK (what every real browser/device uses today, including this
 *    site's actual visitors): `html-to-image` rasterizes the decorative
 *    layer once into a canvas texture, same technique as the whole-page POC
 *    (src/client/distortion.js).
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
// Origin-trialing on Chrome desktop (M148–151/154) as of mid-2026; testable
// without a trial token via Chrome Canary desktop +
// chrome://flags/#canvas-draw-element. Feature-detected below — this code
// only runs when that API actually exists.
// ---------------------------------------------------------------------------
function supportsHtmlInCanvas(gl) {
  return !!gl && typeof gl.texElementImage2D === "function";
}

// Per the spec, elements only participate in canvas.texElementImage2D() /
// drawElementImage() while they're direct children of a canvas that has
// opted into `layoutsubtree` — and per the explainer, such children render
// invisibly on the page by default until explicitly drawn into the canvas's
// bitmap, so there's no separate "hide the original" step needed here (unlike
// the fallback path). Their absolute positioning still resolves correctly
// after the move since canvasEl occupies the exact same box #overlay-content
// does (see init()). Returns a function that undoes the move.
function adoptIntoCanvas(canvasEl, el) {
  if (!el) return null;
  const placeholder = document.createComment(`fx-bg-native-slot:${el.id}`);
  el.parentNode.insertBefore(placeholder, el);
  canvasEl.appendChild(el);
  return () => {
    placeholder.parentNode?.insertBefore(el, placeholder);
    placeholder.remove();
  };
}

// On-screen feature-detection readout for testing the WICG HTML-in-Canvas
// flag on devices without accessible devtools (e.g. mobile). Visit this page
// with ?debug in the URL to see it; long-press to copy the text.
function renderDebugPanel(gl) {
  if (!location.search.includes("debug")) return;

  const probeCanvas = document.createElement("canvas");
  const info = {
    webglVersion: probeCanvas.getContext("webgl2")
      ? "webgl2"
      : gl
      ? "webgl1"
      : "none",
    "gl.texElementImage2D": gl ? typeof gl.texElementImage2D : "n/a",
    "canvas.layoutsubtree": "layoutsubtree" in probeCanvas,
    "canvas.onpaint": "onpaint" in probeCanvas,
    "ctx2d.drawElementImage": typeof probeCanvas.getContext("2d")?.drawElementImage,
    "canvas.captureElementImage": typeof probeCanvas.captureElementImage,
    userAgent: navigator.userAgent,
  };

  const panel = document.createElement("pre");
  Object.assign(panel.style, {
    position: "fixed",
    bottom: "0",
    left: "0",
    right: "0",
    zIndex: "999999",
    margin: "0",
    padding: "8px",
    fontSize: "11px",
    lineHeight: "1.4",
    background: "rgba(0,0,0,0.85)",
    color: "#0f0",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    userSelect: "text",
    WebkitUserSelect: "text",
  });
  panel.textContent = Object.entries(info)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  document.body.appendChild(panel);
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
  renderDebugPanel(gl);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const layers = [];

  if (native) {
    console.info("[fx-bg] HTML-in-Canvas supported — using live element textures");

    // Attach the (still invisible, opacity:0) canvas now and reparent the
    // decorative elements into it — the real API only works on elements
    // that are direct children of a layoutsubtree canvas.
    overlayEl.insertBefore(canvasEl, overlayEl.firstChild);
    canvasEl.layoutsubtree = true;
    const restoreGradient = adoptIntoCanvas(canvasEl, gradientEl);
    const restoreTree = adoptIntoCanvas(canvasEl, treeEl);

    try {
      layers.push(setupNativeLayer(renderer, gl, gradientEl));
      if (treeEl) layers.push(setupNativeLayer(renderer, gl, treeEl));
      layers.forEach((layer) => {
        layer.reposition(overlayRect);
        scene.add(layer.mesh);
      });
      layers.forEach((layer) => layer.uploadFrame());
      renderer.render(scene, camera); // may throw — caught below
    } catch (error) {
      restoreGradient?.();
      restoreTree?.();
      canvasEl.layoutsubtree = false;
      canvasEl.remove();
      throw error; // let start()'s catch do its normal cleanup
    }
  } else {
    layers.push(await setupFallbackLayer(renderer, overlayEl));
    layers.forEach((layer) => {
      layer.reposition(overlayRect);
      scene.add(layer.mesh);
    });

    // First frame before touching the DOM — if this throws (tainted
    // canvas, no WebGL), the original gradient/illustration stay untouched.
    renderer.render(scene, camera);
    overlayEl.insertBefore(canvasEl, overlayEl.firstChild);
  }

  requestAnimationFrame(() => {
    canvasEl.style.opacity = "1";
    // Native-mode children are already invisible-until-drawn per spec —
    // hiding them ourselves would also hide them from texElementImage2D.
    if (!native) {
      setTimeout(() => {
        hideOriginal(gradientEl);
        hideOriginal(treeEl);
      }, 250);
    }
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
