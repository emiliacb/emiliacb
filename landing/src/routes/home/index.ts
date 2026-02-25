import path from "path";
import { Context } from "hono";
import { html, raw } from "hono/html";

import { getContent } from "../../services/content";
import layout from "../../components/layout";
import contact from "../../components/contacts";

// We don't want to add a /lang path in the home route for aesthetic reasons
const getLang = (c: Context) => {
  const paramLang = c.req.param("lang");
  if (paramLang) return paramLang;

  const acceptLang = c.req.header("accept-language")?.split(",")[0];
  const lang = acceptLang && acceptLang.includes("es") ? "es" : "en";

  return lang;
};

export default async function handler(c: Context) {
  const lang = getLang(c);

  const filePath = path.join(
    __dirname,
    `../../../content/pages/${lang}/home.md`
  );

  const htmlContent = await getContent(filePath, lang);

  const view = layout({
    siteData: {
      title: "ємιℓιαċв",
      description: "Senior Software Engineer with a product mindset",
      lang,
    },
    withIlustration: true,

    children: html`<div class="markdown-content">${raw(htmlContent)}</div>
      <footer class="mt-12 md:mt-24">${contact({ lang })}</footer> `,
  });

  return c.html(view, {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "public, max-age=3605",
    },
  });
}
