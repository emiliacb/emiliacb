import { Context } from "hono";
import { html, raw } from "hono/html";

import layout from "../../components/layout";

type Course = {
  title: Record<string, string>;
  thumbnail?: string;
};

const courses: Course[] = [
  {
    title: {
      en: "Claude Code for Non-Programmers",
      es: "Claude Code para no programadores",
    },
    thumbnail: "claude-code-course.jpg",
  },
  {
    title: {
      en: "Hermes for Companies",
      es: "Hermes para Empresas",
    },
  },
  {
    title: {
      en: "Introduction to AI for Non-Programmers",
      es: "Introducción a la IA para no programadores",
    },
  },
];

const wordings: Record<
  string,
  { title: string; description: string; metaDescription: string; comingSoon: string }
> = {
  en: {
    title: "Courses",
    description: "Courses I'm building. Enrollment opens soon.",
    metaDescription: "A look at the courses Emilia CB is currently building.",
    comingSoon: "Coming Soon",
  },
  es: {
    title: "Cursos",
    description: "Cursos que estoy construyendo. Muy pronto vas a poder anotarte.",
    metaDescription: "Un vistazo a los cursos que Emilia CB está construyendo.",
    comingSoon: "Próximamente",
  },
};

export default async function handler(c: Context) {
  const lang = c.req.param("lang") || "en";

  const view = layout({
    siteData: {
      title: `${wordings[lang].title} | ємιℓιαċв`,
      description: wordings[lang].metaDescription,
      lang,
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
        ${raw(
          courses
            .map(
              (course) => `
          <div class="bg-yellow-300 dark:bg-blue-900">
          <article class="grid grid-cols-[auto_1fr] h-28">
          <div class="aspect-square relative overflow-hidden">
          <div class="absolute inset-0 blog-card-thumb"></div>
          ${course.thumbnail ? `<div class="absolute inset-0 bg-cover bg-center img-outline" style="background-image: url('/public/${course.thumbnail}')"></div>` : ''}
          </div>
          <div class="flex flex-col justify-center p-2 pl-4 overflow-hidden gap-2">
          <h2 class="font-bold truncate">${course.title[lang]}</h2>
          <span class="w-fit text-[0.65rem] font-bold uppercase tracking-wide px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black">${wordings[lang].comingSoon}</span>
          </div>
          </article>
          </div>`
            )
            .join("")
        )}
      </div>
    </div>`,
  });

  return c.html(view);
}
