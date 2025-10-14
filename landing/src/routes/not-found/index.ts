import { Context } from "hono";
import { html } from "hono/html";

import layout from "../../components/layout";

function detectLang(c: Context): "en" | "es" {
  const segments = c.req.path.split("/").filter(Boolean);
  const first = segments[0];
  if (first === "en" || first === "es") return first;

  const acceptLang = c.req.header("accept-language")?.split(",")[0] || "";
  return acceptLang.includes("es") ? "es" : "en";
}

export default async function handler(c: Context) {
  const lang = detectLang(c);

  const copy = {
    en: {
      description: "Page not found",
      message: "The page you’re looking for doesn’t exist.",
      cta: "Back to home",
    },
    es: {
      description: "Página no encontrada",
      message: "La página que buscas no existe.",
      cta: "Volver al inicio",
    },
  } as const;

  const siteData = {
    title: "404 | ємιℓιαċв",
    description: copy[lang].description,
    lang,
  };

  const content = html`
    <section
      class="py-16 md:py-24 flex flex-col items-center text-center gap-4 md:gap-6"
    >
      <h1 class="text-6xl md:text-8xl font-extrabold tracking-tight">404</h1>
      <p class="text-base md:text-lg opacity-80">${copy[lang].message}</p>
      <a
        href="/${lang}"
        class="mt-2 inline-block px-4 py-2 border border-stone-800 text-stone-800 hover:bg-black hover:text-white dark:border-stone-100 dark:text-stone-100 dark:hover:bg-white dark:hover:text-black transition-colors"
      >
        ${copy[lang].cta}
      </a>
    </section>
  `;

  const view = layout({ siteData, withFooter: true, children: content });

  return c.html(view, { status: 404 });
}
