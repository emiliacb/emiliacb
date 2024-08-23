import path from "path";
import { Context } from "hono";
import { html, raw } from "hono/html";

import layout from "../../components/layout";
import { getContent } from "src/services/content";

export default async function handler(c: Context) {
  const filePath = path.join(__dirname, `./content.md`);
  const htmlContent = await getContent(filePath)

  const view = layout({
    siteData: {
      title: "services | emiliacb",
    },
    children: html`<div class="prose prose-stone dark:prose-invert">
      ${raw(htmlContent)}
    </div>`,
  });

  return c.html(view);
}
