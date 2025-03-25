import { html } from "hono/html";

export default function tree() {
  return html`
    <dotlottie-player
      src="/public/tree.lottie"
      background="transparent"
      class="cover-tree"
      speed="0.5"
      loop
      autoplay
    >
    </dotlottie-player>
  `;
}
