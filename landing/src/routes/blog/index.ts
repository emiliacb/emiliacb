import { Context, Next } from "hono";
import { html, raw } from "hono/html";

import layout from "../../components/layout";
import { getAllPosts, getPost } from "../../services/posts";

const wordings: Record<string, { title: string; description: string }> = {
  en: {
    title: "Journal",
    description:
      "This journal aims to be a collection of my thoughts and projects.",
  },
  es: {
    title: "Diario",
    description:
      "Este diario intenta ser una colección de pensamientos y proyectos.",
  },
} as const;

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
      title: `${wordings[lang].title} | ємιℓιαċв`,
      description: `${wordings[lang].description} | ємιℓιαċв`,
      lang: lang,
    },
    withFooter: true,
    children: html`<div>
      <div class="markdown-content">
        <h1 class="text-2xl font-bold">${wordings[lang].title}</h1>
        <p class="text-sm text-stone-800 dark:text-stone-300 !pb-6 !-mt-6">
          ${wordings[lang].description}
        </p>
      </div>

      <div class="flex flex-col space-y-3 text-pretty">
        ${!posts.length &&
        html`<div class="text-left text-stone-800 dark:text-stone-300">
          <h2 class="text-lg font-light">Posts coming soon...</h2>
        </div>`}
        ${raw(
          posts
            .map(
              (post) => `
          <a class="group bg-yellow-300 dark:bg-blue-900 hover:bg-black hover:text-stone-100 dark:hover:bg-stone-100 dark:hover:text-stone-900" href="/${lang}/blog/${
                post.slug
              }">
          <article class="grid grid-cols-[auto_1fr] min-h-12">
          <div class="aspect-square bg-cover bg-center ${post.preview ? '' : 'bg-gradient-to-br from-[rgb(252,190,80)] to-[rgb(135,207,183)] dark:from-[rgb(118,51,75)] dark:to-[rgb(0,68,165)]'}" ${post.preview ? `style="background-image: url('/public/${post.preview}')"` : ''}>
          </div>
          <div class="flex flex-col space-y-2 justify-center p-2 pl-4">
          <h2 class="font-bold">${post.title} </h2>
          ${
            post.description &&
            `<span class="text-sm text-stone-800 dark:text-stone-300 group-hover:text-stone-100 dark:group-hover:text-stone-900 line-clamp-3">${post.description}</span>`
          }
          <span class="text-xs font-light">${new Date(post.date).toLocaleDateString()}</span>
          </div>
          </article>
          </a>`
            )
            .join("")
        )}
      </div>
    </div>`,
  });

  return c.html(view);
}
