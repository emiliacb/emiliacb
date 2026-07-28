import { html } from "hono/html";
import { config } from "dotenv";

config();

const CACHE_VERSION = process.env.CACHE_VERSION!;

/**
 * The two background planes of the illustration: bands of procedurally grown
 * trees that sit behind the page copy, with the hand-drawn tree in front.
 *
 * Only the empty containers are rendered here. Everything in them is grown in
 * the browser by src/client/forest.js, which also drives the parallax — so with
 * no JS, or with the bundle blocked, this is inert markup and the page looks
 * exactly as it did before.
 */
export default function forest() {
  return html`
    <div id="forest" aria-hidden="true">
      <div id="forest-far" class="forest-band forest-band--far"></div>
      <div id="forest-mid" class="forest-band forest-band--mid"></div>
      <div id="forest-near" class="forest-band forest-band--near"></div>
      <div class="forest-haze"></div>
    </div>
    <script src="/public/${CACHE_VERSION}/_forest-bundle.js" defer></script>
  `;
}
