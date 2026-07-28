/**
 * Renders a grid of generated trees to an HTML file so the generator can be
 * eyeballed against the original artwork.
 *
 *   npx tsx scripts/preview-tree.ts            # 12 random trees
 *   npx tsx scripts/preview-tree.ts oak elm    # specific seeds
 *
 * Writes .preview-tree.html next to the project and prints the path.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { generateTree } from "../src/components/tree/generate";

const args = process.argv.slice(2);
const seeds = args.length
  ? args
  : Array.from({ length: 12 }, () => Math.floor(Math.random() * 1e9).toString(36));

const cells = seeds
  .map((seed) => {
    const tree = generateTree({ seed, width: 300, height: 600 });
    return `<figure>${tree.svg}<figcaption>${seed}</figcaption></figure>`;
  })
  .join("");

const out = resolve(process.cwd(), ".preview-tree.html");

writeFileSync(
  out,
  `<!doctype html><meta charset="utf-8"><title>tree generator</title><style>
    body { margin: 0; padding: 16px; background: #0e0f11; color: #7a7f87;
           font: 12px/1.4 ui-monospace, monospace; }
    .grid { display: grid; gap: 16px;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
    figure { margin: 0; background: #141518; border: 1px solid #212327;
             border-radius: 6px; overflow: hidden; }
    svg { display: block; width: 100%; height: auto; }
    figcaption { padding: 6px 8px; border-top: 1px solid #212327; }
  </style><div class="grid">${cells}</div>`
);

console.log(out);
