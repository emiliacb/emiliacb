import { Lexer, type Tokens } from "marked";

import { LANGS, type Lang } from "../../shared/lang";
import { CONTACT, PAGES, SITE_NAME, SITE_URL, markdownPath, type PageId } from "../../shared/site";
import { headingSlug } from "../content";
import type { Post } from "../content/types";
import type { RenderCtx } from "../context";

/**
 * Markdown versions of every page, for LLMs and agents: /en/about.md next to
 * /en/about, /en.md next to /en, and so on. Plus /llms.txt, the index that
 * points at them (https://llmstxt.org).
 *
 * Pages written in Markdown (content/) are served from their source; the rest
 * (courses, blog index, labs) are written here from the same dictionary the
 * HTML uses. Links are made absolute and point at the .md version of a page
 * when there is one, so an agent can follow them without parsing HTML.
 */

export type MarkdownFile = { path: string; markdown: string };

/** Every HTML page path that has a .md version, e.g. "/en/about", "/es/blog/<slug>". */
function knownPagePaths(posts: Post[]): Set<string> {
  const paths = new Set<string>();
  for (const lang of LANGS) {
    for (const page of PAGES) paths.add(`/${lang}${page.path}`);
    for (const post of posts) paths.add(`/${lang}/blog/${post.slug}`);
  }
  return paths;
}

/** Root-relative URL → absolute URL, to the .md version when the page has one. */
function absoluteUrl(href: string, known: Set<string>): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const match = /^([^?#]*)(.*)$/.exec(href)!;
  const pathname = match[1].replace(/\/$/, "");
  const rest = match[2];
  if (known.has(pathname)) return `${SITE_URL}${pathname}.md${rest}`;
  return `${SITE_URL}${href}`;
}

function tableOfContents(source: string, ctx: RenderCtx): string {
  const items = new Lexer()
    .lex(source)
    .filter((token): token is Tokens.Heading => token.type === "heading" && token.depth === 2)
    .map(({ text }) => `- [${text}](#${headingSlug(text)})`);

  return `**${ctx.t.markdown.tableOfContents.replace(/:$/, "")}**\n\n${items.join("\n")}`;
}

/**
 * Turns a content/ Markdown source into its served form: the
 * %table-of-contents% token becomes a real list, the few inline HTML bits
 * become Markdown, and root-relative links become absolute.
 */
export function toServedMarkdown(source: string, ctx: RenderCtx, known: Set<string>): string {
  const withToc = source.replace(/%table-of-contents%/, () => tableOfContents(source, ctx));

  const withoutHtml = withToc
    .replace(/^[ \t]*<br\s*\/?>[ \t]*\n?/gim, "")
    .replace(/<a\s[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, text: string) => `[${text.trim()}](${href})`);

  // Markdown links and images whose target is root-relative: ](/path)
  const withLinks = withoutHtml.replace(/\]\((\/[^)\s]*)/g, (_m, href: string) => `](${absoluteUrl(href, known)}`);

  return `${withLinks.trim()}\n`;
}

const list = (items: string[]) => items.join("\n");

function contactSection(ctx: RenderCtx): string {
  const { contact } = ctx.t;
  return [
    `## ${ctx.t.footer.contact}`,
    "",
    list([
      `- ${contact.email}: [${CONTACT.email}](mailto:${CONTACT.email})`,
      `- ${contact.linkedin}: [${CONTACT.linkedin}](${CONTACT.linkedin})`,
      `- ${contact.github}: [${CONTACT.github}](${CONTACT.github})`,
      `- ${contact.scheduleFull}: [${CONTACT.calendar}](${CONTACT.calendar})`,
    ]),
  ].join("\n");
}

function formatDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));
}

function renderCourses(ctx: RenderCtx): string {
  const { courses } = ctx.t;
  return [
    `# ${courses.heading}`,
    "",
    courses.intro,
    "",
    ...courses.items.flatMap((item) => [`## ${item.title}`, "", `_${courses.comingSoon}._`, "", item.description, ""]),
  ].join("\n");
}

function renderBlogIndex(ctx: RenderCtx): string {
  const { blog } = ctx.t;
  const posts = ctx.content.posts;
  const items = posts.map(
    (post) =>
      `- [${post.title}](${SITE_URL}${markdownPath(ctx.lang, `/blog/${post.slug}`)}) (${formatDate(post.date, ctx.lang)})` +
      (post.description ? `: ${post.description}` : ""),
  );
  return [`# ${blog.heading}`, "", blog.intro, "", posts.length ? list(items) : blog.empty, ""].join("\n");
}

function renderLab(ctx: RenderCtx, id: PageId, t: RenderCtx["t"]["labs"]["distortion" | "distortionBg"]): string {
  const htmlUrl = `${SITE_URL}/${ctx.lang}${PAGES.find((p) => p.id === id)!.path}`;
  return [
    `# ${t.title}`,
    "",
    t.subtitle,
    "",
    `## ${t.how}`,
    "",
    list([`1. ${t.step1}`, `2. ${t.step2}`, `3. ${t.step3}`]),
    "",
    t.caveats,
    "",
    // The effect itself only exists in a browser: point at the HTML page.
    `<${htmlUrl}>`,
    "",
  ].join("\n");
}

function renderPost(ctx: RenderCtx, post: Post, known: Set<string>): string {
  const body = toServedMarkdown(post.markdown, ctx, known);
  const meta = [post.description, `_${formatDate(post.date, ctx.lang)}_`].filter(Boolean).join("\n\n");

  // Keep the post's own H1 first, then the description and date under it.
  const h1 = /^# .*\n/.exec(body);
  if (h1) return `${h1[0]}\n${meta}\n${body.slice(h1[0].length)}`;
  return `# ${post.title}\n\n${meta}\n\n${body}`;
}

function renderPage(ctx: RenderCtx, id: PageId, known: Set<string>): string {
  const sources = ctx.content.pageSources[ctx.lang];
  switch (id) {
    case "home":
      return `${toServedMarkdown(sources.home, ctx, known)}\n${contactSection(ctx)}\n`;
    case "about":
      return toServedMarkdown(sources.about, ctx, known);
    case "services":
      return toServedMarkdown(sources.services, ctx, known);
    case "courses":
      return renderCourses(ctx);
    case "blog":
      return renderBlogIndex(ctx);
    case "labs-distortion":
      return renderLab(ctx, id, ctx.t.labs.distortion);
    case "labs-distortion-bg":
      return renderLab(ctx, id, ctx.t.labs.distortionBg);
  }
}

/** The .md version of every PAGES entry and every published post, in each language. */
export function renderSiteMarkdown(ctxFor: (lang: Lang) => RenderCtx): MarkdownFile[] {
  const files: MarkdownFile[] = [];
  for (const lang of LANGS) {
    const ctx = ctxFor(lang);
    const known = knownPagePaths(ctx.content.posts);

    for (const page of PAGES) {
      files.push({ path: markdownPath(lang, page.path), markdown: renderPage(ctx, page.id, known) });
    }
    for (const post of ctx.content.posts) {
      files.push({ path: markdownPath(lang, `/blog/${post.slug}`), markdown: renderPost(ctx, post, known) });
    }
  }
  return files;
}

/** Labs pages are WebGL experiments: listed under "Optional" in llms.txt. */
const OPTIONAL_PAGES: readonly PageId[] = ["labs-distortion", "labs-distortion-bg"];

/** /llms.txt: what the site is and where the Markdown versions live. */
export function renderLlmsTxt(ctxFor: (lang: Lang) => RenderCtx): string {
  const en = ctxFor("en");
  const es = ctxFor("es");

  const pageLink = (ctx: RenderCtx, id: PageId) => {
    const def = PAGES.find((p) => p.id === id)!;
    const t = ctx.t.pages[id];
    return `- [${t.mapTitle}](${SITE_URL}${markdownPath(ctx.lang, def.path)}): ${t.blurb}`;
  };
  const mainPages = (ctx: RenderCtx) =>
    PAGES.filter((p) => !OPTIONAL_PAGES.includes(p.id)).map((p) => pageLink(ctx, p.id));

  const posts = en.content.posts.map(
    (post) =>
      `- [${post.title}](${SITE_URL}${markdownPath("en", `/blog/${post.slug}`)})` +
      (post.description ? `: ${post.description}` : ""),
  );

  return [
    `# ${SITE_NAME}`,
    "",
    `> ${en.t.pages.home.description}`,
    "",
    `Personal site of ${SITE_NAME} (Emilia CB): AI engineer, mentor and consultant. ` +
      `It is published in English (${SITE_URL}/en) and Spanish (${SITE_URL}/es). ` +
      `Every page has a Markdown version at the same URL plus ".md", for example ` +
      `${SITE_URL}/en/about.md; ${SITE_URL}/.md serves the home in the visitor's language. ` +
      `Journal posts are written in English.`,
    "",
    "## Pages",
    "",
    list(mainPages(en)),
    "",
    "## Journal",
    "",
    posts.length ? list(posts) : en.t.blog.empty,
    "",
    "## Español",
    "",
    list(mainPages(es)),
    "",
    "## Contact",
    "",
    list([
      `- [Email](mailto:${CONTACT.email}): ${CONTACT.email}`,
      `- [LinkedIn](${CONTACT.linkedin})`,
      `- [GitHub](${CONTACT.github})`,
      `- [Schedule a meeting](${CONTACT.calendar})`,
      `- [Resume (PDF)](${SITE_URL}/public/cv.pdf)`,
    ]),
    "",
    "## Optional",
    "",
    list(OPTIONAL_PAGES.map((id) => pageLink(en, id))),
    "",
  ].join("\n");
}
