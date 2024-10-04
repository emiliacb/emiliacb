import path from "path";
import { Context } from "hono";
import { html, raw } from "hono/html";

import layout from "../../components/layout";
import { getContent } from "../../services/content";

export default async function handler(c: Context) {
  const lang = c.req.param("lang") || "en";
  const filePath = path.join(
    __dirname,
    `../../../content/pages/${lang}/about.md`
  );

  console.log(filePath);

  const htmlContent = await getContent(filePath);

  const view = layout({
    siteData: {
      title: "Who I Am | ємιℓιαċв",
      description: "Who I Am | ємιℓιαċв",
      lang,
    },
    withFooter: true,
    children: html`<div class="markdown-content">${raw(htmlContent)}</div>`,
  });

  return c.html(view);
}
