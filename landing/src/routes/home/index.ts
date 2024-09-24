import path from "path";
import { Context } from "hono";
import { html, raw } from "hono/html";

import { getContent } from "../../services/content";
import layout from "../../components/layout";
import contact from "../../components/contacts";

export default async function handler(c: Context) {
  const filePath = path.join(__dirname, `../../../content/pages/home.md`);
  const htmlContent = await getContent(filePath);

  const view = layout({
    siteData: {
      title: "ємιℓιαċв",
    },
    children: html`<div class="markdown-content">
        ${raw(htmlContent)}
      </div>
      <div class="mt-24">${contact()}</div> `,
  });

  return c.html(view, {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "public, max-age=3605",
    },
  });
}
