import { getAllPosts } from "./posts";

type StaticPage = { path: string; title: string; blurb: string };

const STATIC_PAGES: Record<string, StaticPage[]> = {
  en: [
    { path: "/", title: "Home", blurb: "Landing page: intro to Emilia CB, a senior software engineer building AI products, full-stack apps, with a user-first mindset." },
    { path: "/about", title: "About", blurb: "Background, skills, and approach to software engineering and product development." },
    { path: "/services", title: "Services", blurb: "AI integration, full-stack development, and technical consulting services." },
    { path: "/blog", title: "Journal", blurb: "Articles on software engineering, AI, and building products." },
    { path: "/courses", title: "Courses", blurb: "Practical generative AI courses for non-programmers and teams." },
    { path: "/labs/distortion", title: "Labs: Liquid page", blurb: "Experimental WebGL page-distortion effect, a proof of concept." },
    { path: "/labs/distortion-bg", title: "Labs: Liquid background", blurb: "Experimental WebGL background-distortion effect, a proof of concept." },
  ],
  es: [
    { path: "/", title: "Inicio", blurb: "Página de inicio: presentación de Emilia CB, ingeniera de software senior que construye productos con IA y apps full-stack, con foco en el usuario." },
    { path: "/about", title: "Sobre mí", blurb: "Trayectoria, habilidades y enfoque en ingeniería de software y desarrollo de producto." },
    { path: "/services", title: "Servicios", blurb: "Servicios de integración de IA, desarrollo full-stack y consultoría técnica." },
    { path: "/blog", title: "Diario", blurb: "Artículos sobre ingeniería de software, IA y desarrollo de productos." },
    { path: "/courses", title: "Cursos", blurb: "Cursos prácticos de IA generativa para no programadores y equipos." },
    { path: "/labs/distortion", title: "Labs: Página líquida", blurb: "Experimento de distorsión WebGL de página completa, prueba de concepto." },
    { path: "/labs/distortion-bg", title: "Labs: Fondo líquido", blurb: "Experimento de distorsión WebGL de fondo, prueba de concepto." },
  ],
};

// Gives the LLM a compact map of what the rest of the site actually
// contains, so it can make sense of a LOGS entry that points at a page
// other than the one BLOG CONTENT was extracted from (e.g. "came from" a
// different blog post, or clicked a nav link to Services).
export async function getSiteMap(lang: string) {
  const pages = STATIC_PAGES[lang] || STATIC_PAGES.en;
  const posts = (await getAllPosts()) || [];

  const pageLines = pages.map((p) => `- ${p.title} (${p.path}): ${p.blurb}`);
  const postLines = posts.map(
    (post) => `- Blog post: "${post.title}" (/blog/${post.slug}): ${post.description}`
  );

  return [...pageLines, ...postLines].join("\n");
}
