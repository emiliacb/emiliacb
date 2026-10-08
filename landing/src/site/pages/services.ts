import { html, raw } from "hono/html";
import type { RenderCtx } from "../context";
import layout from "../components/layout";

export default async function render(ctx: RenderCtx): Promise<string> {
  const { pages } = ctx.t;

  return String(
    await layout({
      ctx,
      path: "/services",
      siteData: { title: pages.services.title, description: pages.services.description },
      withFooter: true,
      children: html`<div class="markdown-content">${raw(ctx.content.pages[ctx.lang].services)}</div>`,
    })
  );
}
