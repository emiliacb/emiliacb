import path from "path";
import { Context } from "hono";
import { html, raw } from "hono/html";

import layout from "../../components/layout";
import { getContent } from "../../services/content";

export default async function handler(c: Context) {
  const filePath = path.join(__dirname, `../../../content/pages/home.md`);
  const htmlContent = await getContent(filePath);

  const view = layout({
    siteData: {
      title: "ємιℓιαċв",
    },
    children: html`
    <div class="prose prose-stone dark:prose-invert text-pretty">
      <div aria-hidden="true" class="font-mono text-[14px] origin-top-left whitespace-pre leading-[6px]">
        <div>           __________                              </div>
        <div>         .'----------\`.                           </div>
        <div>         | .--------. |                           </div>
        <div>         | |########| |         ________           </div>
        <div>         | |########| |       /_________\\          </div>
        <div>.--------| \`--------' |------|    --=-- |--------. </div>
        <div>|        \`----,-.-----'      |o ======  |        | </div>
        <div>|       ______|_|_______     |__________|        | </div>
        <div>|      /  %%%%%%%%%%%%  \\                        | </div>
        <div>|     /  %%%%%%%%%%%%%%  \\                       | </div>
        <div>|     ^^^^^^^^^^^^^^^^^^^^                       | </div>
        <div>+-----------------------------------------------+  </div>
        <div>^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^</div>
        <div aria-hidden="true" class="opacity-0">from https://www.asciiart.eu/</div>
      </div>
      ${raw(htmlContent)}
    </div>`,
  });

  return c.html(view);
}
