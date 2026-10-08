import { html } from "hono/html";
import type { RenderCtx } from "../context";
import layout from "../components/layout";

/** The 404 page. The server sends it with status 404; this only renders the HTML. */
export default async function render(ctx: RenderCtx): Promise<string> {
  const { notFound } = ctx.t;

  return String(
    await layout({
      ctx,
      // A 404 has no page of its own to point a canonical at, so it reuses the
      // language home; the 404 status keeps search engines from indexing it.
      path: "",
      siteData: { title: notFound.title, description: notFound.description },
      withFooter: true,
      children: html`
        <section
          class="py-16 md:py-24 flex flex-col items-center text-center gap-4 md:gap-6"
        >
          <h1 class="text-6xl md:text-8xl font-extrabold tracking-tight">404</h1>
          <p class="text-base md:text-lg opacity-80">${notFound.message}</p>
          <a
            href="/${ctx.lang}"
            class="mt-2 inline-block px-4 py-2 border border-stone-800 text-stone-800 hover:bg-black hover:text-white dark:border-stone-100 dark:text-stone-100 dark:hover:bg-white dark:hover:text-black transition-colors"
          >
            ${notFound.cta}
          </a>
        </section>
      `,
    })
  );
}
