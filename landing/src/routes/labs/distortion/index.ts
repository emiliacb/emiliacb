import { Context } from "hono";
import { html } from "hono/html";

import layout from "../../../components/layout";
import { CACHE_VERSION } from "../../../middlewares/cache";

/**
 * POC lab page: the whole page is rasterized into a WebGL texture and
 * re-rendered through a distortion shader driven by the mouse. The real DOM
 * stays invisible underneath so links and buttons keep working.
 * See src/client/distortion.js for the effect implementation.
 */
export default async function handler(c: Context) {
  const lang = c.req.param("lang") || "en";

  const wordings: Record<string, Record<string, string>> = {
    en: {
      title: "Liquid page",
      subtitle:
        "This whole page — navbar included — is a WebGL texture. Move the mouse to twist it.",
      how: "How it works",
      step1:
        "The rendered DOM is captured into an image (SVG foreignObject via html-to-image).",
      step2:
        "The capture becomes a texture on a fullscreen Three.js quad, distorted per-pixel in a fragment shader (twist, swirl, smear and ripple around the cursor).",
      step3:
        "The real DOM stays underneath with opacity 0 but interactive: what you click is the invisible page, what you see is the shader.",
      toggle: "Toggle effect",
      toggleHint: "…or press Escape. This button is part of the proof: you are clicking the invisible DOM.",
      caveats:
        "POC caveats: the capture is a static snapshot (hover states don't repaint), and it respects prefers-reduced-motion by staying off.",
      linkProof: "Links keep working →",
    },
    es: {
      title: "Página líquida",
      subtitle:
        "Toda esta página — navbar incluida — es una textura WebGL. Mové el mouse para torcerla.",
      how: "Cómo funciona",
      step1:
        "El DOM renderizado se captura como imagen (SVG foreignObject vía html-to-image).",
      step2:
        "La captura pasa a ser una textura sobre un quad fullscreen de Three.js, distorsionada por píxel en un fragment shader (twist, remolino, arrastre y ondas alrededor del cursor).",
      step3:
        "El DOM real queda debajo con opacity 0 pero interactivo: lo que clickeás es la página invisible, lo que ves es el shader.",
      toggle: "Activar / desactivar",
      toggleHint: "…o apretá Escape. Este botón es parte de la prueba: estás clickeando el DOM invisible.",
      caveats:
        "Limitaciones del POC: la captura es una foto estática (los hover no se repintan) y respeta prefers-reduced-motion quedándose apagado.",
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
    children: html`
      <style>
        /* While the effect is active the real DOM is invisible but keeps
           receiving pointer events; the WebGL canvas on top is what you see. */
        body.fx-active #overlay-content {
          opacity: 0;
        }
      </style>
      <section class="flex flex-col gap-6 pt-2 md:pt-6">
        <header>
          <h1 class="text-3xl font-[600]">${t.title}</h1>
          <p class="mt-2 max-w-[42rem] text-lg">${t.subtitle}</p>
        </header>

        <div
          class="h-10 w-full max-w-[42rem] border border-stone-400 [background:repeating-linear-gradient(-45deg,transparent,transparent_10px,#86efac_10px,#86efac_12px)] dark:[background:repeating-linear-gradient(-45deg,transparent,transparent_10px,#1d4ed8_10px,#1d4ed8_12px)]"
          aria-hidden="true"
        ></div>

        <div class="max-w-[42rem]">
          <h2 class="text-xl font-[600] mb-2">${t.how}</h2>
          <ol class="list-decimal pl-5 space-y-1">
            <li>${t.step1}</li>
            <li>${t.step2}</li>
            <li>${t.step3}</li>
          </ol>
        </div>

        <div class="flex flex-wrap items-center gap-4">
          <button
            id="fx-toggle"
            class="interactive border border-stone-800 dark:border-stone-100 px-4 py-2 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
          >
            ${t.toggle}
          </button>
          <a class="underline underline-offset-4" href="/${lang}/blog"
            >${t.linkProof}</a
          >
        </div>
        <p class="text-sm opacity-70 max-w-[42rem]">${t.toggleHint}</p>

        <p class="text-sm opacity-70 max-w-[42rem]">${t.caveats}</p>
      </section>
      <script
        src="/public/${CACHE_VERSION}/_distortion-bundle.js"
        defer
      ></script>
    `,
  });

  return c.html(view);
}
