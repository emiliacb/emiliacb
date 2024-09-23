import path from "path";
import { Context } from "hono";
import { html, raw } from "hono/html";

import layout from "../../components/layout";
import { getContent } from "../../services/content";

export default async function handler(c: Context) {
  const filePath = path.join(__dirname, `../../../content/pages/home.md`);
  const htmlContent = await getContent(filePath);

  return c.html(html`
     <div style="width: 100%; height: 100%; max-width: 40rem; display: grid; place-content: center; margin: auto;">
      <p>Hello there! 👷‍♂️</p>
      <p>Thank you for visiting our page. Unfortunately, we're experiencing some technical difficulties and our site is temporarily unavailable.</p>
    </div>
  `)

  const view = layout({
    siteData: {
      title: "ємιℓιαċв",
    },
    children: html`
    <div class="prose prose-stone dark:prose-invert text-pretty">
      <div aria-hidden="true" class="font-mono text-[14px] origin-top-left scale-75 -mb-4 md:scale-90 md:mb-4  whitespace-pre leading-[6px]">
        <div>           __________                              </div>
        <div>         .'----------\`.                           </div>
        <div>         | .--------. |                           </div>
        <div>         | |<span class="text-white animate-pulse">########</span>| |         ________           </div>
        <div>         | |<span class="text-white animate-pulse">########</span>| |       /_________\\          </div>
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

  return c.html(view, {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "public, max-age=3605",
    }
  });
}
