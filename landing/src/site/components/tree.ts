import { html } from "hono/html";
import type { RenderCtx } from "../context";

/**
 * The hand-drawn tree in the illustration column, as plain SVG in its resting
 * pose. src/client/tree-sway.js bends it in the air the pointer moves; with no
 * JS, or with reduced motion, this is the whole of it and it stands still.
 *
 * The trunk is cut off flat by the bottom of the frame, so the drawing is
 * pinned to the bottom of its box (xMidYMax): if the box ever comes out
 * narrower than the drawing, the tree shrinks onto the ground instead of
 * floating above it.
 *
 * The art is one outline for the wood plus six loose leaves, in paint order:
 * the elbow leaf sits behind the wood, every other leaf in front of it. Each
 * leaf names the limb it hangs from and the point it hangs by, which is all the
 * script needs to swing it; the limbs themselves are traced in the script.
 */
export default function tree(ctx: RenderCtx) {
  return html`
    <div class="tree-container">
      <svg
        class="cover-tree"
        viewBox="0 0 400 800"
        preserveAspectRatio="xMidYMax meet"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="tree-wood" gradientUnits="userSpaceOnUse" x1="32.6" y1="134.19" x2="32.6" y2="800">
            <stop offset="0" stop-color="rgb(255,176,0)" />
            <stop offset="1" stop-color="rgb(102,198,169)" />
          </linearGradient>
          <linearGradient id="tree-leaves" gradientUnits="userSpaceOnUse" x1="131.16" y1="9.81" x2="131.16" y2="335.33">
            <stop offset="0" stop-color="rgb(255,176,0)" />
            <stop offset="1" stop-color="rgb(102,198,169)" />
          </linearGradient>
          <linearGradient id="tree-leaf-right" gradientUnits="userSpaceOnUse" x1="284.43" y1="170.05" x2="315.36" y2="311.02">
            <stop offset="0" stop-color="rgb(255,176,0)" />
            <stop offset="1" stop-color="rgb(102,198,169)" />
          </linearGradient>
          <linearGradient id="tree-leaf-twig" gradientUnits="userSpaceOnUse" x1="270.39" y1="78.05" x2="300.8" y2="176.29">
            <stop offset="0" stop-color="rgb(255,176,0)" />
            <stop offset="1" stop-color="rgb(102,198,169)" />
          </linearGradient>
        </defs>
        <g data-leaf="elbow" data-limb="left" data-pivot="137 415">
          <path
            fill="rgb(102,198,169)"
            d="M137.08,414.86C164.36,395.37 200.99,424.25 216.6,377.44C227.51,344.69 149.55,357.17 137.08,414.86Z"
          />
        </g>
        <path
          data-wood
          fill="url(#tree-wood)"
          d="M201.79,563.77C177.46,686.64 227,772.45 254.8,800C254.8,800 138.64,800 138.64,800C148.77,800 179.33,795.89 162.02,758.68C146.43,725.15 150.59,628.48 155.79,585.6C189.47,482.06 141.75,456.96 127.72,439.03C127.72,333.62 106.93,286.74 92.64,267.51C115.25,291.68 131.62,334.56 139.42,428.89C147.72,447 173.06,452.7 188.11,501.83C203.95,448.43 213.26,388.74 196.33,357.94C205.12,324.73 207.69,252.13 213.43,183.31C239.21,156.02 254.02,177.07 273.51,134.19C261.04,178.63 229.07,163.81 220.85,189.54C218.09,255.48 215.72,328.06 210.36,357.94C218.36,380.97 223.24,384.54 224.38,402.38C231.41,381.33 236.73,366.84 256.36,354.05C268.06,311.17 286.25,292.97 289.11,294.01C277.26,297.76 264.42,338.19 259.48,357.94C238.58,372.51 228.06,418.45 224.38,432.01C222.57,457.17 215.52,494.41 201.79,563.77Z"
        />
        <g data-leaf="crown" data-limb="stem" data-pivot="217 186">
          <path
            fill="url(#tree-leaves)"
            d="M216.6,185.64C161.51,182.01 69.4,148.69 141.75,44.53C214.1,-59.63 221.8,95.21 216.6,185.64Z"
          />
        </g>
        <g data-leaf="left" data-limb="left" data-pivot="122 335">
          <path
            fill="url(#tree-leaves)"
            d="M122.26,335.33C84.58,329.1 -12.13,235.37 89.52,263.61C131.62,275.3 140.19,261.01 122.26,335.33Z"
          />
        </g>
        <g data-leaf="stem" data-limb="stem" data-pivot="208 265">
          <path
            fill="url(#tree-leaves)"
            d="M208.02,265.17C172.94,256.59 140.96,275.34 156.57,228.52C167.48,195.78 207.24,205.14 208.02,265.17Z"
          />
        </g>
        <g data-leaf="right" data-limb="right" data-pivot="275 311">
          <path
            fill="url(#tree-leaf-right)"
            d="M275.07,311.02C302.36,291.53 338.99,320.41 354.6,273.6C365.51,240.85 287.55,253.33 275.07,311.02Z"
          />
        </g>
        <g data-leaf="twig" data-limb="twig" data-pivot="264 153">
          <path
            fill="url(#tree-leaf-twig)"
            d="M261.82,153.68C286.54,172.18 332.98,190.15 336.52,123.34C340.06,56.53 272.73,120.93 261.82,153.68Z"
          />
        </g>
      </svg>
    </div>
    <script src="${ctx.assets.script("tree-sway")}" defer></script>
  `;
}
