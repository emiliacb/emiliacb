import { Context, Next } from "hono";
import { html, raw } from "hono/html";

import layout from "../../components/layout";
import { getAllPosts, getPost } from "../../services/posts";

export default async function handler(c: Context, next: Next) {
  const lang = c.req.param("lang");
  const slug = c.req.path.split("/").pop();
  const isPost = slug && slug !== "blog";

  if (isPost) {
    const post = await getPost(slug);

    if (!post) return await next();

    const view = layout({
      siteData: {
        title: `${post.data.title} | ємιℓιαċв`,
        description: post.data.description,
        lang: lang,
      },
      withFooter: true,
      children: html`<div class="markdown-content">
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
      description: "blog | ємιℓιαċв",
      lang: lang,
    },
    withFooter: true,
    children: html`<div class="flex flex-col space-y-10 text-pretty">
      ${raw(
        posts
          .map(
            (post) => `
          <a class="group light-gradient-projection before:border-b-[5px] before:border-green-50 dark:before:border-blue-900/40 hover:bg-stone-600 hover:text-stone-100 dark:hover:bg-stone-100 dark:hover:text-stone-900" href="/${lang}/blog/${
              post.slug
            }">
          <article class="flex flex-col space-y-2 justify-center p-2 pl-4 transition duration-100 min-h-12">
          <h2 class="font-bold ">${post.title} </h2>
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
