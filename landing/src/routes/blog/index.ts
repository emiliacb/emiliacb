import { Context, Next } from "hono";
import { html, raw } from "hono/html";

import layout from "../../components/layout";
import { getAllPosts, getPost } from "../../services/posts";

export default async function handler(c: Context, next: Next) {
  const slug = c.req.path.replace(/^\/blog\/?/, "");

  if (slug) {
    const post = await getPost(slug);

    if (!post) return await next();

    const view = layout({
      siteData: {
        title: `${post.data.title} | ємιℓιαċв`,
      },
      children: html`<div class="prose prose-stone dark:prose-invert">
        ${raw(post.htmlContent)}
      </div>`,
    });

    return c.html(view);
  }

  const posts = await getAllPosts();

  if (!posts) return await next();

  const view = layout({
    siteData: {
      title: "blog | ємιℓιαċв",
    },
    children: html`<div class="flex flex-col space-y-10">
      ${raw(
        posts
          .map(
            (post) => `
          <a class="group" href="/blog/${post.slug}">
          <article class="flex flex-col space-y-2 justify-center border-l-2 border-transparent p-2 pl-4 group-hover:border-stone-400 transition duration-100 min-h-12">
          <h2 class="font-bold">${post.title} </h2>
          ${post.description && `<span>${post.description}</span>`}
          <span class="text-xs font-light">${post.date.toLocaleDateString()}</span>  
          </article>
          </a>`
          )
          .join("")
      )}
    </div>`,
  });

  return c.html(view);
}
