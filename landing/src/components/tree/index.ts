import { html } from "hono/html";

export default function tree() {
  return html`
    <script
      src="https://unpkg.com/@dotlottie/player-component@latest/dist/dotlottie-player.mjs"
      type="module"
    ></script>
    <dotlottie-player
      src="/public/tree.lottie"
      background="transparent"
      class="cover-tree"
      loop
      autoplay
    >
    </dotlottie-player>
  `;
}
