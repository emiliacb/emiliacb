import { LANGS, type Lang } from "../../shared/lang";
import { PAGES, type PageId } from "../../shared/site";
import type { RenderCtx } from "../context";
import renderHome from "./home";
import renderAbout from "./about";
import renderServices from "./services";
import renderCourses from "./courses";
import renderBlogIndex from "./blog-index";
import renderBlogPost from "./blog-post";
import renderLabsDistortion from "./labs-distortion";
import renderLabsDistortionBg from "./labs-distortion-bg";
import renderNotFound from "./not-found";

export type RenderedPage = { path: string; html: string };

const RENDERERS: Record<PageId, (ctx: RenderCtx) => Promise<string>> = {
  home: renderHome,
  about: renderAbout,
  services: renderServices,
  courses: renderCourses,
  blog: renderBlogIndex,
  "labs-distortion": renderLabsDistortion,
  "labs-distortion-bg": renderLabsDistortionBg,
};

/**
 * Renders the whole site: every PAGES entry, every published post, and the 404
 * page, for each language. `ctxFor` builds the render context for a language.
 */
export async function renderSite(
  ctxFor: (lang: Lang) => RenderCtx
): Promise<{ pages: RenderedPage[]; notFound: Record<Lang, string> }> {
  const pages: RenderedPage[] = [];
  const notFound = {} as Record<Lang, string>;

  for (const lang of LANGS) {
    const ctx = ctxFor(lang);

    for (const def of PAGES) {
      pages.push({ path: `/${lang}${def.path}`, html: await RENDERERS[def.id](ctx) });
    }

    for (const post of ctx.content.posts) {
      pages.push({ path: `/${lang}/blog/${post.slug}`, html: await renderBlogPost(ctx, post) });
    }

    notFound[lang] = await renderNotFound(ctx);
  }

  return { pages, notFound };
}
