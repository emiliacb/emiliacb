import { html } from "hono/html";
import type { RenderCtx } from "../context";
import layout from "../components/layout";

/**
 * POC lab page: only the decorative background layer (gradient blob + tree
 * illustration behind #overlay-content) is captured into a WebGL texture and
 * distorted with the mouse. Navbar and content stay untouched on top.
 * See src/client/gradient-distortion.js for the effect implementation.
 */
export default async function render(ctx: RenderCtx): Promise<string> {
  const { pages, labs } = ctx.t;
  const t = labs.distortionBg;

  return String(
    await layout({
      ctx,
      path: "/labs/distortion-bg",
      siteData: { title: pages["labs-distortion-bg"].title, description: pages["labs-distortion-bg"].description },
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

          <a class="underline underline-offset-4 w-fit" href="/${ctx.lang}/blog">${t.linkProof}</a>
          <p class="text-sm opacity-70 max-w-[32rem]">${t.caveats}</p>
        </section>
        <script src="${ctx.assets.script("gradient-distortion")}" defer></script>
      `,
    })
  );
}
