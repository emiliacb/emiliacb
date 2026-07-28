import { html } from "hono/html";
import { config } from "dotenv";

config();

const CACHE_VERSION = process.env.CACHE_VERSION!;

/**
 * The background of the illustration: a ruled ground plane receding to a
 * horizon, with a procedurally grown forest standing on its intersections and
 * the hand-drawn tree in front of the whole thing.
 *
 * Only the empty containers are rendered here. The ruling is drawn and the
 * trees are grown in the browser by src/client/forest.js, which also drives the
 * parallax — so with no JS, or with the bundle blocked, this is inert markup
 * and the page looks exactly as it did before.
 *
 * The bands are grouped under one plane on purpose. The trees stand on the
 * ruling, so ground and forest have to move together; anything that drifted a
 * band on its own would slide its trees off their own crossings.
 */
export default function forest() {
  return html`
    <div id="forest" aria-hidden="true">
      <div id="forest-plane">
        <canvas id="forest-field"></canvas>
        <div id="forest-far" class="forest-band forest-band--far"></div>
        <div id="forest-mid" class="forest-band forest-band--mid"></div>
        <div id="forest-near" class="forest-band forest-band--near"></div>
      </div>
      <div class="forest-haze"></div>
    </div>
    <script src="/public/${CACHE_VERSION}/_forest-bundle.js" defer></script>
  `;
}
