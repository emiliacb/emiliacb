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
      title: "emiliacb",
    },
    children: html`
    <div class="prose prose-stone dark:prose-invert">
      <div class="font-mono whitespace-pre leading-[8px]">
            <div>           __________                              </div>
            <div>         .'----------\`.                           </div>
            <div>         | .--------.  |                           </div>
            <div>         | |########|  |      __________           </div>
            <div>         | |########|  |     /__________\          </div>
            <div>.--------| \`--------' |-----|    --=-- |--------. </div>
            <div>|        \`----,-.-----'     |o ======  |        | </div>
            <div>|       ______|_|_______     |__________|        | </div>
            <div>|      /  %%%%%%%%%%%%  \                        | </div>
            <div>|     /  %%%%%%%%%%%%%%  \                       | </div>
            <div>|     ^^^^^^^^^^^^^^^^^^^^                       | </div>
            <div>+-----------------------------------------------+  </div>
            <div>^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^</div>
        </div>
      ${raw(htmlContent)}
    </div>`,
  });

  return c.html(view);
}
