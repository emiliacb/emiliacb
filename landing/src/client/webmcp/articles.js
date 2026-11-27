// The articles an agent creates with create_article: kept in this tab's
// sessionStorage, rendered with the same Markdown pipeline and the same
// .markdown-content classes as a published post, and shown in place of the
// page's own content until the visitor (or the agent) restores it. Nothing
// here talks to a server.
import { Marked } from "marked";

import { sanitizeHtmlWithReport } from "./sanitize.js";

const STORAGE_KEY = "webmcp:articles";
const BANNER_ATTRIBUTE = "data-agent-article-banner";
// sessionStorage holds about 5 MB per origin; one article larger than this is
// a mistake, and a few of them would lock out the site's other uses of it.
const MAX_ARTICLE_CHARS = 200000;
const MAX_ARTICLES = 20;

const BANNER = {
  en: { note: "Agent-generated article — not published", restore: "Restore original page" },
  es: { note: "Artículo generado por un agente — no publicado", restore: "Restaurar la página original" },
};

// The anchor icon of site/content/markdown.ts (lucide's link-2), inlined: the
// lucide package is a build-time dependency and must stay out of the bundle.
const LINK_ICON =
  '<svg class="lucide lucide-link-2" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ' +
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M9 17H7A5 5 0 0 1 7 7h2" /><path d="M15 7h2a5 5 0 1 1 0 10h-2" /><line x1="8" x2="16" y1="12" y2="12" /></svg>';

// The classes site/content/markdown.ts puts on the anchor of every h2 and below.
const ANCHOR_CLASS =
  "inline-flex justify-center w-5 !p-0 translate-y-[0.2rem] before:hidden text-lg font-bold text-center align-baseline " +
  "no-underline opacity-50 focus:opacity-100 hover:opacity-100 !bg-transparent !outline-none hover:!bg-black " +
  "dark:hover:!bg-white hover:!text-white dark:hover:!text-black !border-2 border-transparent focus-visible:!border-red-500";

/** The page's language, "en" or "es". */
export function pageLang() {
  return document.documentElement.lang === "es" ? "es" : "en";
}

/** Heading id rule of the site's own posts (site/content/markdown.ts headingSlug). */
function headingSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/ /g, "-");
}

function escapeAttribute(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The id an article is stored and shown by: its title as a heading slug, so the same title replaces it. */
export function articleId(title) {
  return headingSlug(title.trim()).replace(/-+/g, "-").slice(0, 80);
}

// --- Storage ---------------------------------------------------------------

let articles = null;

/** Every article of this tab, oldest first. Falls back to memory when sessionStorage is blocked. */
export function listArticles() {
  if (articles) return articles;
  articles = [];
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    if (Array.isArray(stored)) articles = stored.filter((a) => a && typeof a.id === "string" && typeof a.markdown === "string");
  } catch {
    // Blocked or corrupt storage: start empty, the tools still work for this page.
  }
  return articles;
}

export function findArticle(id) {
  return listArticles().find((article) => article.id === id);
}

/** Adds or replaces the article with the same id; the oldest go once there are too many. */
export function saveArticle(article) {
  const others = listArticles().filter((a) => a.id !== article.id);
  articles = [...others, article].slice(-MAX_ARTICLES);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
  } catch (error) {
    console.warn("[webmcp] Could not keep the article in sessionStorage:", error);
  }
  return article;
}

export { MAX_ARTICLE_CHARS };

// --- Markdown --------------------------------------------------------------

function formatDate(value, lang) {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" }).format(new Date(time));
}

/** The article as Markdown, in the shape of a post's .md version: title, description, date, body. */
export function articleMarkdown(article) {
  const byline = [article.date ? formatDate(article.date, article.lang) : "", ...(article.tags ?? [])].filter(Boolean);
  const meta = [article.subtitle, byline.length ? `_${byline.join(" · ")}_` : ""].filter(Boolean).join("\n\n");
  return `# ${article.title}\n\n${meta ? `${meta}\n\n` : ""}${article.markdown.trim()}\n`;
}

/** Renders like the build does for posts (site/content/markdown.ts): same heading ids and anchors. */
function renderBody(markdown) {
  const marked = new Marked({
    renderer: {
      heading({ tokens, text, depth }) {
        const slug = headingSlug(text);
        const inner = this.parser.parseInline(tokens);
        if (depth === 1) return `<h1 id="${slug}">${inner}</h1>`;
        const anchor = `<a class="${ANCHOR_CLASS}" href="#${slug}" aria-label="${escapeAttribute(text)}">${LINK_ICON}</a>`;
        return `<h${depth} id="${slug}">${inner}${anchor}</h${depth}>`;
      },
    },
  });
  return marked.parse(markdown, { async: false });
}

/** The post-shaped HTML of an article: its H1, the description and date under it, then the body. */
function articleHtml(article) {
  const title = `<h1 id="${headingSlug(article.title)}">${escapeAttribute(article.title)}</h1>`;
  const byline = [article.date ? formatDate(article.date, article.lang) : "", ...(article.tags ?? [])].filter(Boolean);
  const subtitle = article.subtitle ? `<p class="lead">${escapeAttribute(article.subtitle)}</p>` : "";
  const meta = byline.length ? `<p><em>${escapeAttribute(byline.join(" · "))}</em></p>` : "";
  return `${title}${subtitle}${meta}${renderBody(article.markdown)}`;
}

// --- Showing ---------------------------------------------------------------

// The page's own content while an article is on show, with the title to put back.
let original = null;
let shownId = null;

function contentElement() {
  return document.getElementById("content") ?? document.querySelector("main");
}

function createBanner(lang) {
  const text = BANNER[lang];
  const banner = document.createElement("div");
  banner.setAttribute(BANNER_ATTRIBUTE, "");
  banner.setAttribute("role", "note");
  banner.className =
    "mb-4 flex max-w-[65ch] flex-wrap items-center justify-between gap-x-4 gap-y-1 border border-dashed border-stone-400 " +
    "px-3 py-1.5 text-xs text-stone-600 dark:border-stone-500 dark:text-stone-300";
  const note = document.createElement("span");
  note.textContent = text.note;
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500";
  button.textContent = text.restore;
  button.addEventListener("click", restoreOriginal);
  banner.append(note, button);
  return banner;
}

/** "Title | site" like a post's <title>: the site part is whatever follows the last " | " of the page's own. */
function pageTitleFor(title, pageTitle) {
  const site = pageTitle.includes(" | ") ? pageTitle.slice(pageTitle.lastIndexOf(" | ") + 3) : "";
  return site ? `${title} | ${site}` : title;
}

/** Puts the page's own content back. Returns false when no article was on show. */
export function restoreOriginal() {
  const content = contentElement();
  if (!original || !content) return false;
  content.replaceChildren(...original.nodes);
  document.title = original.title;
  original = null;
  shownId = null;
  return true;
}

/** The id of the article on show, or null. */
export function shownArticleId() {
  return shownId;
}

/**
 * Replaces the page's content with the article, inside the same #content
 * column and .markdown-content wrapper a published post uses, so the layout,
 * navbar and footer stay and the typography is the post's own. The page's
 * nodes are kept (not rebuilt) so restoring brings back their listeners and
 * canvases. Returns what the sanitizer dropped.
 */
export function showArticle(article) {
  const content = contentElement();
  if (!content) throw new Error("The page has no #content column to show the article in.");
  const { fragment, removed } = sanitizeHtmlWithReport(articleHtml(article));
  const wrapper = document.createElement("div");
  wrapper.className = "markdown-content";
  wrapper.append(fragment);

  if (!original) original = { nodes: Array.from(content.childNodes), title: document.title };
  content.replaceChildren(createBanner(pageLang()), wrapper);
  document.title = pageTitleFor(article.title, original.title);
  shownId = article.id;
  window.scrollTo(0, 0);
  return removed;
}
