import { html } from "hono/html";
import type { RenderCtx } from "../context";
import layout from "../components/layout";

/**
 * Course data that is not text. The titles and descriptions live in the
 * dictionary (courses.items, same order as this list).
 */
const COURSES = [
  { thumbnail: "ai-intro-course.png" },
  { thumbnail: "claude-code-course.jpg" },
  { thumbnail: "hermes-logo.png" },
];

export default async function render(ctx: RenderCtx): Promise<string> {
  const { pages, courses } = ctx.t;

  if (courses.items.length !== COURSES.length) {
    throw new Error("courses.items and COURSES must list the same courses");
  }

  const cards = courses.items.map(
    (item, index) => html`<div class="flex flex-col bg-yellow-300 dark:bg-blue-900 overflow-hidden">
      <div class="aspect-video relative overflow-hidden">
        <div class="absolute inset-0 bg-cover bg-center" style="background-image: url('/public/${COURSES[index].thumbnail}')"></div>
        <span class="absolute top-2 left-2 text-[0.6rem] font-bold uppercase tracking-wide px-2 py-1 bg-black text-white dark:bg-white dark:text-black">${courses.comingSoon}</span>
      </div>
      <div class="flex flex-col p-3 gap-1.5">
        <h2 class="font-bold leading-tight">${item.title}</h2>
        <p class="text-xs text-stone-800 dark:text-stone-200">${item.description}</p>
      </div>
    </div>`
  );

  return String(
    await layout({
      ctx,
      path: "/courses",
      siteData: { title: pages.courses.title, description: pages.courses.description },
      withFooter: true,
      children: html`<div>
        <div class="markdown-content">
          <h1 class="text-2xl font-bold">${courses.heading}</h1>
          <p class="text-sm text-stone-800 dark:text-stone-300 !pb-6 !-mt-6">
            ${courses.intro}
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          ${cards}
        </div>
      </div>`,
    })
  );
}
