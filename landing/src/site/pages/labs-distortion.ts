import { html } from "hono/html";
import type { RenderCtx } from "../context";
import layout from "../components/layout";

/**
 * POC lab page: the whole page is rasterized into a WebGL texture and
 * re-rendered through a distortion shader driven by the mouse. The real DOM
 * stays invisible underneath so links and buttons keep working.
 * See src/client/distortion.js for the effect implementation.
 */
export default async function render(ctx: RenderCtx): Promise<string> {
  const { pages, labs } = ctx.t;
  const t = labs.distortion;

  return String(
    await layout({
      ctx,
      path: "/labs/distortion",
      siteData: { title: pages["labs-distortion"].title, description: pages["labs-distortion"].description },
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
            <a class="underline underline-offset-4" href="/${ctx.lang}/blog">${t.linkProof}</a>
          </div>
          <p class="text-sm opacity-70 max-w-[42rem]">${t.toggleHint}</p>

          <p class="text-sm opacity-70 max-w-[42rem]">${t.caveats}</p>
        </section>
        <script src="${ctx.assets.script("distortion")}" defer></script>
      `,
    })
  );
}
