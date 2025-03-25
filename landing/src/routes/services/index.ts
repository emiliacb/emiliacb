import path from "path";
import { Context } from "hono";
import { html, raw } from "hono/html";

import layout from "../../components/layout";
import { getContent } from "../../services/content";

export default async function handler(c: Context) {
  const lang = c.req.param("lang") || "en";
  const filePath = path.join(
    __dirname,
    `../../../content/pages/${lang}/services.md`
  );
  const htmlContent = await getContent(filePath, lang);

  const view = layout({
    siteData: {
      title: "What I Offer | ємιℓιαċв",
      description: "Senior Software Engineer with a product mindset",
      lang,
    },
    withFooter: true,
    children: html`<div class="markdown-content">${raw(htmlContent)}</div>`,
  });

  return c.html(view);
}
