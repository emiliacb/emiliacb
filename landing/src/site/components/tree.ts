import { html } from "hono/html";
import type { RenderCtx } from "../context";

/** The hand-drawn tree: a Lottie player in the illustration column, played by the dotlottie bundle. */
export default function tree(ctx: RenderCtx) {
  return html`
    <script type="module" src="${ctx.assets.script("dotlottie")}" crossorigin="anonymous"></script>

    <style>
      @media (prefers-reduced-motion: reduce) {
        .tree-container dotlottie-player { display: none; }
      }
    </style>

    <div class="tree-container">
      <dotlottie-player
        src="/public/tree.lottie"
        background="transparent"
        class="cover-tree"
        speed="0.5"
        loop
        autoplay
      >
      </dotlottie-player>
    </div>
  `;
}
