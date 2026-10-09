import { html } from "hono/html";
import type { RenderCtx } from "../context";

const PHOTO = "/public/emilia-photo.webp";
const DEPTH = "/public/emilia-depth.png";

/**
 * Emilia's photo beside the services page. The <img> is the no-WebGPU
 * fallback; src/client/side-photo.ts renders the canvas over it (depth
 * parallax, blob outline) and places it on compact screens.
 *
 * It is rendered at the body level, outside #overlay-content: that element
 * has a transform, which would turn the photo's positioning context into the
 * overlay instead of the page.
 */
export default function sidePhoto(ctx: RenderCtx) {
  return html`
    <div id="side-photo" data-photo="${PHOTO}" data-depth="${DEPTH}">
      <img src="${PHOTO}" alt="Emilia Cabral" width="640" height="640" decoding="async" />
      <canvas aria-hidden="true"></canvas>
    </div>
    <script src="${ctx.assets.script("side-photo")}" defer></script>
  `;
}
