import { html } from "hono/html";
import { config } from 'dotenv';

config()

const CACHE_VERSION = process.env.CACHE_VERSION!;

export default function tree() {
  return html`
    <script type="module" src="/public/${CACHE_VERSION}/_dotlottie-bundle.js" crossorigin="anonymous"></script>

    <dotlottie-player
      src="/public/${CACHE_VERSION}/tree.lottie"
      background="transparent"
      class="cover-tree"
      speed="0.5"
      loop
      autoplay
    >
    </dotlottie-player>
  `;
}
