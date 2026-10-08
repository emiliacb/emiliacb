import { html } from "hono/html";
import type { RenderCtx } from "../context";
import type { Post } from "../content/types";
import layout from "../components/layout";

function postCard(ctx: RenderCtx, post: Post) {
  const date = new Intl.DateTimeFormat(ctx.lang, { dateStyle: "medium" }).format(new Date(post.date));

  return html`<a class="group bg-yellow-300 dark:bg-blue-900 hover:bg-black hover:text-stone-100 dark:hover:bg-stone-100 dark:hover:text-stone-900" href="/${ctx.lang}/blog/${post.slug}">
    <article class="grid grid-cols-[auto_1fr] h-28">
      <div class="aspect-square relative overflow-hidden">
        <div class="absolute inset-0 blog-card-thumb"></div>
        ${post.preview
          ? html`<div class="absolute inset-0 bg-cover bg-center img-outline hue-rotate-30 dark:[filter:hue-rotate(180deg)_brightness(0.8)] group-hover:[filter:none]" style="background-image: url('/public/${post.preview}')"></div>`
          : null}
      </div>
      <div class="flex flex-col justify-center p-2 pl-4 overflow-hidden gap-1">
        <h2 class="font-bold truncate">${post.title} </h2>
        ${post.description
          ? html`<span class="text-sm text-stone-800 dark:text-stone-300 group-hover:text-stone-100 dark:group-hover:text-stone-900 line-clamp-2">${post.description}</span>`
          : null}
        <span class="text-xs font-light">${date}</span>
      </div>
    </article>
  </a>`;
}

export default async function render(ctx: RenderCtx): Promise<string> {
  const { pages, blog } = ctx.t;
  const posts = ctx.content.posts;

  return String(
    await layout({
      ctx,
      path: "/blog",
      siteData: { title: pages.blog.title, description: pages.blog.description },
      withFooter: true,
      children: html`<div>
        <div class="markdown-content">
          <h1 class="text-2xl font-bold">${blog.heading}</h1>
          <p class="text-sm text-stone-800 dark:text-stone-300 !pb-6 !-mt-6">
            ${blog.intro}
          </p>
        </div>

        <div class="flex flex-col space-y-3 text-pretty">
          ${posts.length
            ? null
            : html`<div class="text-left text-stone-800 dark:text-stone-300">
                <h2 class="text-lg font-light">${blog.empty}</h2>
              </div>`}
          ${posts.map((post) => postCard(ctx, post))}
        </div>
      </div>`,
    })
  );
}
