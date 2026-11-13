import { html, raw } from "hono/html";
import type { RenderCtx } from "../context";
import layout from "../components/layout";

export default async function render(ctx: RenderCtx): Promise<string> {
  const { pages } = ctx.t;

  return String(
    await layout({
      ctx,
      path: "/about",
      siteData: { title: pages.about.title, description: pages.about.description },
      withFooter: true,
      children: html`<div class="markdown-content">${raw(ctx.content.pages[ctx.lang].about)}</div>`,
    })
  );
}
