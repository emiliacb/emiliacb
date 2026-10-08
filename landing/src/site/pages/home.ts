import { html, raw } from "hono/html";
import type { RenderCtx } from "../context";
import layout from "../components/layout";
import contact from "../components/contacts";

export default async function render(ctx: RenderCtx): Promise<string> {
  const { pages } = ctx.t;

  return String(
    await layout({
      ctx,
      path: "",
      siteData: { title: pages.home.title, description: pages.home.description },
      withIlustration: true,
      children: html`<div class="markdown-content">${raw(ctx.content.pages[ctx.lang].home)}</div>
        <footer class="mt-12 md:mt-24">${contact(ctx)}</footer>`,
    })
  );
}
