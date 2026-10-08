/**
 * The photo beside the services page, rendered with WebGPU through vgpu.
 *
 * Wide screens: it sits in the empty column to the right of the text, sharp,
 * and the subject slides over the background as the mouse moves (parallax
 * from a baked depth map).
 *
 * Compact screens have no free column. Once, for the top of the page, the
 * largest empty area next to the heading is found (see
 * ./side-photo/free-space.ts) and the photo is pinned there, turned on the Y
 * axis, semi transparent, with depth of field on the side that recedes. It
 * then scrolls with the page, a little faster than the text (parallax), so
 * it leaves upward instead of sliding over what comes next. Scrolling also
 * drives the depth parallax, since there is no mouse. When the top of the
 * page has no gap big enough, the photo stays hidden.
 *
 * Without WebGPU the <img> fallback stays, placed the same way. Nothing here
 * is required for the page to work.
 */
import { clock, effect, frame, frameLoop, init, sampler, surface, texture } from "vgpu";
import type { Frame, FrameLoopHandle, Gpu } from "vgpu";
import { SIDE_PHOTO_WGSL } from "./side-photo/shader";
import { findFreeSquare, MAX_SIZE } from "./side-photo/free-space";

const root = document.getElementById("side-photo");
const canvas = root?.querySelector("canvas");

const compactQuery = window.matchMedia("(max-width: 1099px)");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Opacity on compact screens. Wide screens are opaque. */
const COMPACT_OPACITY = 0.4;
/** Extra upward speed while scrolling, as a fraction of the scroll. */
const SCROLL_PARALLAX = 0.3;

/* ==========================================================================
   Placement on compact screens
   ========================================================================== */

// Where the photo sits in the page (document coordinates), or null if the top
// of the page has no gap for it.
let spot: { left: number; top: number; size: number } | null = null;

function findSpot() {
  if (!root) return;
  // Measured as if scrolled to the top, whatever the current scroll is.
  spot = findFreeSquare(root, { x: window.innerWidth * 0.7, y: window.innerHeight * 0.3 }, window.scrollY);
}

function applyPlacement() {
  if (!root) return;
  if (!spot) {
    root.style.opacity = "0";
    return;
  }
  // The element keeps a fixed MAX_SIZE box, so the canvas never reallocates,
  // and is scaled about its right edge, which stays nearest after the turn.
  const k = spot.size / MAX_SIZE;
  const lift = reduced ? 0 : window.scrollY * SCROLL_PARALLAX;
  const tx = spot.left - (MAX_SIZE - spot.size);
  const ty = spot.top - (MAX_SIZE - spot.size) / 2 - lift;
  root.style.transform = `translate3d(${tx}px, ${ty}px, 0) perspective(320px) rotateY(-30deg) scale(${k})`;
  root.style.opacity = String(COMPACT_OPACITY);
}

let scrollQueued = false;
function onScroll() {
  if (!compactQuery.matches || scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    applyPlacement();
  });
}

function setupLayout() {
  if (!root) return;
  if (compactQuery.matches) {
    findSpot();
    applyPlacement();
  } else {
    root.style.removeProperty("transform");
    root.style.removeProperty("opacity");
  }
  requestRender();
}

/* ==========================================================================
   Pointer on wide screens
   ========================================================================== */

const pointer = { tx: 0, ty: 0, th: 0, x: 0, y: 0, h: 0 };

window.addEventListener(
  "pointermove",
  (event) => {
    if (compactQuery.matches || reduced || !root) return;
    const rect = root.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    pointer.tx = Math.max(-1.2, Math.min(1.2, nx));
    pointer.ty = Math.max(-1.2, Math.min(1.2, ny));
    // Full strength over the photo, fading out over 1.5 photo-widths.
    pointer.th = Math.max(0, 1 - Math.max(0, Math.hypot(nx, ny) - 1) / 1.5);
  },
  { passive: true },
);

/* ==========================================================================
   WebGPU
   ========================================================================== */

let requestRender: () => void = () => {};

async function loadTexture(gpu: Gpu, url: string) {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob());
  const tex = texture(gpu, {
    kind: "2d",
    size: [bitmap.width, bitmap.height],
    format: "rgba8unorm",
    usage: ["texture_binding", "copy_dst", "render_attachment"],
    label: url,
  });
  gpu.gpu.queue.copyExternalImageToTexture({ source: bitmap }, { texture: tex.gpu }, [bitmap.width, bitmap.height]);
  bitmap.close();
  return tex;
}

async function startWebGpu(el: HTMLElement, cv: HTMLCanvasElement) {
  if (!("gpu" in navigator)) return;
  const gpu = await init();
  const [photo, depth] = await Promise.all([
    loadTexture(gpu, el.dataset.photo ?? ""),
    loadTexture(gpu, el.dataset.depth ?? ""),
  ]);
  const output = surface(gpu, cv, { dpr: [1, 2], clearColor: [0, 0, 0, 0] });
  const fx = effect(gpu, SIDE_PHOTO_WGSL, {
    label: "side-photo",
    set: {
      params: { resolution: output.size, pointer: [0, 0], hover: 0, time: 0, farBlur: 0 },
      photo,
      depth,
      linear: sampler(gpu, { minFilter: "linear", magFilter: "linear" }),
    },
  });
  await fx.compile({ colors: [output.format] });
  output.onResize(() => fx.set({ params: { resolution: output.size } }));

  const time = clock(gpu);

  const draw = (current: Frame) => {
    const compact = compactQuery.matches;
    let px = 0;
    let py = 0;
    let hover = 0;
    if (!reduced) {
      if (compact) {
        // Scrolling tilts the view down into the photo as it rises, over a
        // slow idle sway.
        const t = time.time;
        const scrolled = Math.min(1, window.scrollY / window.innerHeight);
        px = Math.max(-1, Math.min(1, Math.sin(t * 0.5) * 0.3));
        py = Math.max(-1, Math.min(1, scrolled * 1.2 - 0.3 + Math.cos(t * 0.37) * 0.15));
        hover = 1;
      } else {
        const k = 1 - Math.exp(-8 * Math.min(time.deltaTime, 0.1));
        pointer.x += (pointer.tx - pointer.x) * k;
        pointer.y += (pointer.ty - pointer.y) * k;
        pointer.h += (pointer.th - pointer.h) * k;
        px = pointer.x;
        py = pointer.y;
        hover = pointer.h;
      }
    }
    fx.set({
      params: {
        pointer: [px, py],
        hover,
        time: reduced ? 0 : time.time,
        farBlur: compact ? 1 : 0,
      },
    });
    current.pass(output, fx);
  };

  // Render only while the photo can be seen.
  let onScreen = true;
  let loop: FrameLoopHandle | null = null;
  const sync = () => {
    const shown = onScreen && (!compactQuery.matches || spot !== null);
    if (shown && !loop && !reduced) loop = frameLoop(gpu, draw, { fps: compactQuery.matches ? 30 : 60 });
    if ((!shown || reduced) && loop) {
      loop.stop();
      loop = null;
    }
  };
  new IntersectionObserver(([entry]) => {
    onScreen = !!entry?.isIntersecting;
    sync();
  }).observe(el);
  requestRender = () => {
    sync();
    if (reduced) frame(gpu, draw);
  };
  compactQuery.addEventListener("change", () => {
    loop?.stop();
    loop = null;
    sync();
  });

  requestRender();
  el.classList.add("side-photo--gpu");
}

if (root && canvas) {
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", setupLayout);
  compactQuery.addEventListener("change", setupLayout);
  setupLayout();
  // Line widths, and so the gaps, change once the web font arrives.
  document.fonts?.ready.then(setupLayout);
  startWebGpu(root, canvas).catch(() => {
    // No usable adapter or a failed load: the <img> fallback stays.
  });
}
