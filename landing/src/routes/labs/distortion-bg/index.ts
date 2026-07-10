import { Context } from "hono";
import { html } from "hono/html";

import layout from "../../../components/layout";
import { CACHE_VERSION } from "../../../middlewares/cache";

/**
 * POC lab page: only the decorative background layer (gradient blob + tree
 * illustration behind #overlay-content) is captured into a WebGL texture and
 * distorted with the mouse. Navbar and content stay untouched on top.
 * See src/client/gradient-distortion.js for the effect implementation.
 */
export default async function handler(c: Context) {
  const lang = c.req.param("lang") || "en";

  const wordings: Record<string, Record<string, string>> = {
    en: {
      title: "Liquid background",
      subtitle:
        "Only the gradient and the illustration behind this card are a WebGL texture. The navbar and this text stay put — move the mouse over the page.",
      how: "How it's different from the full-page POC",
      step1:
        "Only #overlay-content's decorative layer is captured (gradient blob + tree illustration), excluding the navbar and content.",
      step2:
        "The capture becomes a texture on a Three.js quad placed exactly behind the content, at the same z-index as the original gradient.",
      step3:
        "Nothing needs to stay invisible-but-clickable here: the layer has no links, so the canvas simply replaces it in place.",
      caveats:
        "POC caveat: it's a static snapshot — the illustration's own animation freezes at capture time.",
      linkProof: "Links keep working →",
    },
    es: {
      title: "Fondo líquido",
      subtitle:
        "Solo el gradiente y la ilustración detrás de esta tarjeta son una textura WebGL. El navbar y este texto quedan quietos — mové el mouse sobre la página.",
      how: "En qué se diferencia del POC de página completa",
      step1:
        "Se captura solo la capa decorativa de #overlay-content (el gradiente + la ilustración del árbol), excluyendo navbar y contenido.",
      step2:
        "La captura pasa a ser una textura sobre un quad de Three.js ubicado exactamente detrás del contenido, en el mismo z-index que el gradiente original.",
      step3:
        "Acá no hace falta nada invisible-pero-clickeable: esta capa no tiene links, así que el canvas simplemente la reemplaza en el mismo lugar.",
      caveats:
        "Limitación del POC: es una foto estática — la animación propia de la ilustración se congela al momento de la captura.",
      linkProof: "Los links siguen funcionando →",
    },
  };

  const t = wordings[lang] || wordings.en;

  const view = layout({
    siteData: {
      title: `Labs: ${t.title} | ємιℓιαċв`,
      description: t.subtitle,
      lang,
    },
    withFooter: false,
    withIlustration: true,
    children: html`
      <section class="flex flex-col gap-6 pt-2 md:pt-6">
        <header>
          <h1 class="text-3xl font-[600]">${t.title}</h1>
          <p class="mt-2 max-w-[32rem] text-lg">${t.subtitle}</p>
        </header>

        <div class="max-w-[32rem]">
          <h2 class="text-xl font-[600] mb-2">${t.how}</h2>
          <ol class="list-decimal pl-5 space-y-1">
            <li>${t.step1}</li>
            <li>${t.step2}</li>
            <li>${t.step3}</li>
          </ol>
        </div>

        <a class="underline underline-offset-4 w-fit" href="/${lang}/blog"
          >${t.linkProof}</a
        >
        <p class="text-sm opacity-70 max-w-[32rem]">${t.caveats}</p>
      </section>
      <script
        src="/public/${CACHE_VERSION}/_gradient-distortion-bundle.js"
        defer
      ></script>
    `,
  });

  return c.html(view);
}
