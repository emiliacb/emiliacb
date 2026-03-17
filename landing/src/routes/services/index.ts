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

  const description =
    lang === "es"
      ? "Servicios de ingeniería de software: integración de IA, desarrollo full-stack y consultoría técnica."
      : "Software engineering services: AI integration, full-stack development, and technical consulting.";

  const view = layout({
    siteData: {
      title: "What I Offer | ємιℓιαċв",
      description,
      lang,
    },
    withFooter: true,
    children: html`<div class="markdown-content">${raw(htmlContent)}</div>`,
  });

  return c.html(view);
}
