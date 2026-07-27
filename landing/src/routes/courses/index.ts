import { Context } from "hono";
import { html, raw } from "hono/html";

import layout from "../../components/layout";

type Course = {
  title: Record<string, string>;
  description: Record<string, string>;
  thumbnail: string;
};

const courses: Course[] = [
  {
    title: {
      en: "First Steps with AI",
      es: "Primeros pasos con IA",
    },
    description: {
      en: "The fundamentals of how generative AI works and how to use it day-to-day, no technical background required.",
      es: "Los fundamentos de cómo funciona la IA generativa y cómo usarla en tu día a día, sin necesitar experiencia técnica.",
    },
    thumbnail: "ai-intro-course.png",
  },
  {
    title: {
      en: "Build Your First App with Claude Code",
      es: "Construí tu primera app con Claude Code",
    },
    description: {
      en: "Use Claude Code to build and ship real projects without writing a line of code yourself.",
      es: "Usá Claude Code para crear y lanzar proyectos reales sin escribir una línea de código vos mismo.",
    },
    thumbnail: "claude-code-course.jpg",
  },
  {
    title: {
      en: "Internal Automation with Hermes",
      es: "Automatización interna con Hermes",
    },
    description: {
      en: "How to deploy a self-hosted Hermes agent for internal automation at your company: real use cases, the configurability that justifies it, and the risks and costs nobody puts on the landing page.",
      es: "Cómo desplegar un agente Hermes auto-hospedado para automatización interna en tu empresa: casos de uso reales, la configurabilidad que lo justifica, y los riesgos y costos que nadie pone en la portada.",
    },
    thumbnail: "hermes-warning.png",
  },
];

const wordings: Record<
  string,
  { title: string; description: string; metaDescription: string; comingSoon: string }
> = {
  en: {
    title: "Courses",
    description: "Practical generative AI courses, no fluff: for non-programmers and for teams that want to move faster.",
    metaDescription: "A look at the courses Emilia CB is currently building.",
    comingSoon: "Coming Soon",
  },
  es: {
    title: "Cursos",
    description: "Cursos prácticos de IA generativa, sin vueltas: para no programadores y para equipos que quieren moverse más rápido.",
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

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${raw(
          courses
            .map(
              (course) => `
          <div class="flex flex-col bg-yellow-300 dark:bg-blue-900 overflow-hidden">
          <div class="aspect-video relative overflow-hidden">
          <div class="absolute inset-0 bg-cover bg-center" style="background-image: url('/public/${course.thumbnail}')"></div>
          <span class="absolute top-2 left-2 text-[0.6rem] font-bold uppercase tracking-wide px-2 py-1 bg-black text-white dark:bg-white dark:text-black">${wordings[lang].comingSoon}</span>
          </div>
          <div class="flex flex-col p-3 gap-1.5">
          <h2 class="font-bold leading-tight">${course.title[lang]}</h2>
          <p class="text-xs text-stone-800 dark:text-stone-200">${course.description[lang]}</p>
          </div>
          </div>`
            )
            .join("")
        )}
      </div>
    </div>`,
  });

  return c.html(view);
}
