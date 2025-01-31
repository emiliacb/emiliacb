import path from "path";
import { Context } from "hono";
import { html, raw } from "hono/html";

import { getContent } from "../../services/content";
import layout from "../../components/layout";
import contact from "../../components/contacts";

const getLang = (c: Context) => {
  let lang;

  const paramLang = c.req.param("lang");
  if (paramLang) {
    lang = paramLang;
  } else {
    const acceptLang = c.req.header("accept-language")?.split(",")[0];
    console.log(acceptLang);
    lang = acceptLang && acceptLang.includes("es") ? "es" : "en";
  }

  return lang;
};

export default async function handler(c: Context) {
  const lang = getLang(c);

  const filePath = path.join(
    __dirname,
    `../../../content/pages/${lang}/home.md`
  );

  const htmlContent = await getContent(filePath);

  const view = layout({
    siteData: {
      title: "ємιℓιαċв",
      description: "Product Engineer and former librarian",
      lang,
    },
    withFooter: false,
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
