import { html, raw } from "hono/html";
import { SITE_TITLE, SITE_URL } from "../../shared/site";
import type { RenderCtx } from "../context";
import type { Post } from "../content/types";
import layout from "../components/layout";

export default async function render(ctx: RenderCtx, post: Post): Promise<string> {
  return String(
    await layout({
      ctx,
      path: `/blog/${post.slug}`,
      siteData: {
        title: `${post.title} | ${SITE_TITLE}`,
        description: post.description,
        image: post.preview ? `${SITE_URL}/public/${post.preview}` : undefined,
      },
      withFooter: true,
      children: html`<div class="markdown-content">${raw(post.html[ctx.lang])}</div>`,
    })
  );
}
