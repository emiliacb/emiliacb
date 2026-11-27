// WebMCP tools for the site's content: the Markdown version of every page
// (what an agent should read instead of parsing HTML) and temporary articles
// the agent writes and sees styled as a post of this site. Reading goes to the
// site's own origin only; articles never leave the tab.
import {
  MAX_ARTICLE_CHARS,
  articleId,
  articleMarkdown,
  findArticle,
  listArticles,
  pageLang,
  restoreOriginal,
  saveArticle,
  showArticle,
} from "./articles.js";
import { fail, ok } from "./result.js";

// Built together with the .md files (scripts/build.ts, renderPagesManifest).
const MANIFEST_URL = "/webmcp/pages.json";
// What one read returns. The longest post is a little over this, so paging is
// the normal way to read it, not an edge case.
const PAGE_CHARS = 12000;
const MAX_TITLE_CHARS = 200;
const MAX_TAGS = 20;
const ARTICLE_PREFIX = "agent-article:";
const LANGUAGES = ["en", "es", "all"];

let manifestRequest = null;

/** The site's Markdown pages as the build wrote them. Fetched once per page load. */
function loadManifest(signal) {
  manifestRequest ??= fetch(MANIFEST_URL, { signal, credentials: "same-origin" })
    .then((response) => {
      if (!response.ok) throw new Error(`${MANIFEST_URL} answered ${response.status}`);
      return response.json();
    })
    .then((data) => (Array.isArray(data?.pages) ? data.pages : []))
    .catch((error) => {
      // Not cached: a failed load (offline, aborted) must not stay failed for the whole visit.
      manifestRequest = null;
      throw fail(
        `Could not load the list of pages (${error instanceof Error ? error.message : String(error)}). ` +
          "Try again, or read /llms.txt, which links every page's Markdown version.",
      );
    });
  return manifestRequest;
}

const absolute = (path) => new URL(path, location.origin).href;

// --- list_md_pages ---------------------------------------------------------

function articleEntry(article) {
  return { path: `${ARTICLE_PREFIX}${article.id}`, title: article.title, lang: article.lang, kind: "agent-article" };
}

const listMdPages = {
  name: "list_md_pages",
  title: "List the site's Markdown pages",
  description:
    "Lists the pages of this site that have a Markdown version, which is the best way to read them: " +
    "clean text, links already absolute. Each entry has the page's path (an absolute URL of its .md file, " +
    "ready for read_md_page), title, language (en or es) and kind: page, post (a journal article), " +
    "index (the journal's list of posts) or agent-article (an article you made with create_article in this tab; " +
    'its path is "agent-article:<id>", not a URL). Takes an optional "lang": en or es, or all for both ' +
    "(default: the language of the page you are on). Your own agent-articles are always listed.",
  inputSchema: {
    type: "object",
    properties: {
      lang: {
        type: "string",
        enum: LANGUAGES,
        description: "Language of the pages to list. Default: the current page's language.",
      },
    },
  },
  annotations: { readOnlyHint: true },
  async execute(input, { signal } = {}) {
    const lang = typeof input?.lang === "string" ? input.lang : pageLang();
    if (!LANGUAGES.includes(lang)) throw fail(`"lang" must be one of ${LANGUAGES.join(", ")}.`);
    const manifest = await loadManifest(signal);
    const pages = manifest
      .filter((entry) => lang === "all" || entry.lang === lang)
      .map(({ path, title, lang: entryLang, kind }) => ({ path: absolute(path), title, lang: entryLang, kind }));
    return ok({ language: lang, pages: [...pages, ...listArticles().map(articleEntry)] });
  },
};

// --- read_md_page ----------------------------------------------------------

/** The path of a URL's Markdown file: "/es/about" and "/es/about/" become "/es/about.md", "/" the home's "/.md". */
function markdownPathname(pathname) {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") : "";
  if (trimmed === "/llms.txt" || trimmed.endsWith(".md")) return trimmed;
  return `${trimmed}.md`;
}

function urlTarget(raw) {
  let url;
  try {
    url = new URL(raw, location.origin);
  } catch {
    throw fail(`"${raw}" is not a URL or a path. Pass a path like "/en/about", or call list_md_pages.`);
  }
  if (url.origin !== location.origin) {
    throw fail(
      `Only pages of this site can be read (${location.origin}). "${url.origin}" is another origin: ` +
        "this tool does not fetch it, and nothing is sent there.",
    );
  }
  return `${location.origin}${markdownPathname(url.pathname)}`;
}

const slugOf = (path) => path.split("/").pop().replace(/\.md$/, "");

/** The one manifest entry a title or slug names, preferring the page's language; a ToolError when none or several. */
function namedPage(name, manifest) {
  const wanted = name.toLowerCase();
  const matches = manifest.filter((entry) => entry.title.toLowerCase() === wanted || slugOf(entry.path).toLowerCase() === wanted);
  const inLang = matches.filter((entry) => entry.lang === pageLang());
  const candidates = inLang.length ? inLang : matches;
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) {
    throw fail(
      `No page is called "${name}". Call list_md_pages (lang "all" for both languages) and pass a path from it, ` +
        'or a path like "/en/about".',
    );
  }
  throw fail(`"${name}" matches ${candidates.length} pages: ${candidates.map((c) => c.path).join(", ")}. Pass one of those paths.`);
}

/** The article a path, id or title names, if any. */
function namedArticle(name) {
  const id = name.startsWith(ARTICLE_PREFIX) ? name.slice(ARTICLE_PREFIX.length) : name;
  return findArticle(id) ?? listArticles().find((article) => article.title.toLowerCase() === name.toLowerCase());
}

async function fetchMarkdown(url, signal) {
  let response;
  try {
    response = await fetch(url, { signal, credentials: "same-origin" });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw fail(`Could not fetch ${url}: ${error instanceof Error ? error.message : String(error)}. Try again.`);
  }
  const isMarkdown = !(response.headers.get("content-type") ?? "").includes("text/html");
  if (!response.ok || !isMarkdown || new URL(response.url).origin !== location.origin) {
    throw fail(
      `${url} has no Markdown version (it answered ${response.status}). ` +
        "Call list_md_pages for the pages that do, or pass a path like /en/about.",
    );
  }
  return response.text();
}

function pageOfText(text, offset) {
  if (offset > text.length) throw fail(`"offset" ${offset} is past the end of the page, which has ${text.length} characters.`);
  const end = Math.min(offset + PAGE_CHARS, text.length);
  const body = text.slice(offset, end);
  if (end === text.length) return body;
  return (
    `${body}\n\n[Truncated: characters ${offset}-${end} of ${text.length}. ` +
    `Call read_md_page again with the same path and offset ${end} to continue.]`
  );
}

function readOffset(input) {
  const offset = input?.offset === undefined ? 0 : Number(input.offset);
  if (!Number.isInteger(offset) || offset < 0) throw fail('"offset" must be a whole number of characters, 0 or more.');
  return offset;
}

async function markdownOf(raw, signal) {
  if (raw.startsWith(ARTICLE_PREFIX)) {
    const article = namedArticle(raw);
    if (!article) throw fail(`No article "${raw}" in this tab. Call list_md_pages to see them.`);
    return articleMarkdown(article);
  }
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("/")) return fetchMarkdown(urlTarget(raw), signal);
  const manifest = await loadManifest(signal);
  const article = namedArticle(raw);
  if (article && !manifest.some((entry) => entry.title.toLowerCase() === raw.toLowerCase())) return articleMarkdown(article);
  return fetchMarkdown(absolute(namedPage(raw, manifest).path), signal);
}

const readMdPage = {
  name: "read_md_page",
  title: "Read a page as Markdown",
  description:
    "Returns the Markdown text of one page of this site. Pass the page as an absolute URL of this site, a path " +
    '("/es/about", "/es/about.md", "/blog/<slug>"; a path without a language is served in the visitor\'s language), ' +
    'its title or slug as list_md_pages shows it ("About", a post\'s slug), or an agent-article path. ' +
    "Only this site's own pages are read: another origin is refused. " +
    `A long page comes back ${PAGE_CHARS} characters at a time; when it is cut, the text ends with a line saying so ` +
    'and which "offset" to pass to continue.',
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "URL, path, title or slug of the page." },
      offset: { type: "integer", minimum: 0, description: "Character to start from, to read a long page in parts. Default 0." },
    },
    required: ["path"],
  },
  annotations: { readOnlyHint: true },
  async execute(input, { signal } = {}) {
    const raw = typeof input?.path === "string" ? input.path.trim() : "";
    if (raw === "") throw fail('"path" is required: a URL, a path like "/en/about", or a title from list_md_pages.');
    const offset = readOffset(input);
    return ok(pageOfText(await markdownOf(raw, signal), offset));
  },
};

// --- create_article --------------------------------------------------------

function showExisting(show) {
  if (show === "original") {
    if (!restoreOriginal()) return ok("The page's own content was already on show.");
    return ok("Restored the page's original content.");
  }
  const article = findArticle(show) ?? namedArticle(show);
  if (!article) {
    const known = listArticles().map((a) => a.id);
    throw fail(`No article "${show}" in this tab. ${known.length ? `Known ids: ${known.join(", ")}.` : "None has been created yet."}`);
  }
  const removed = showArticle(article);
  return ok({ id: article.id, shown: true, sanitized: removed });
}

function requireText(input, key, max) {
  const value = typeof input?.[key] === "string" ? input[key].trim() : "";
  if (value === "") throw fail(`"${key}" is required (or pass "show" to bring back an article or the original page).`);
  if (value.length > max) throw fail(`"${key}" is too long: ${value.length} characters, at most ${max}.`);
  return value;
}

function optionalText(input, key, max) {
  const value = input?.[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > max) throw fail(`"${key}" must be a string of at most ${max} characters.`);
  return value.trim();
}

function readTags(input) {
  const tags = input?.tags;
  if (tags === undefined) return [];
  const valid = Array.isArray(tags) && tags.length <= MAX_TAGS && tags.every((tag) => typeof tag === "string" && tag.length <= 40);
  if (!valid) throw fail(`"tags" must be a list of at most ${MAX_TAGS} short strings.`);
  return tags.map((tag) => tag.trim()).filter(Boolean);
}

/** The body without a first line "# <title>": the article's own title is already drawn above it. */
function withoutTitleHeading(markdown, title) {
  const match = /^#[ \t]+(.+?)[ \t]*(?:\r?\n|$)/.exec(markdown);
  if (!match || match[1].toLowerCase() !== title.toLowerCase()) return markdown;
  return markdown.slice(match[0].length).trim();
}

function buildArticle(input) {
  const title = requireText(input, "title", MAX_TITLE_CHARS);
  const markdown = withoutTitleHeading(requireText(input, "markdown", MAX_ARTICLE_CHARS), title);
  const id = articleId(title);
  if (id === "") throw fail('"title" needs at least one letter or number.');
  return {
    id,
    title,
    subtitle: optionalText(input, "subtitle", 300),
    date: optionalText(input, "date", 40),
    tags: readTags(input),
    markdown,
    lang: pageLang(),
  };
}

const createArticle = {
  name: "create_article",
  title: "Show a temporary article in this tab",
  description:
    "Writes an article and shows it in this tab in place of the page's content, laid out and typeset exactly like " +
    "one of this site's journal posts (same column, headings, lists, code, links), under the navbar and above the footer. " +
    'A small banner says it is agent-generated and not published, with a button to restore the page. ' +
    "Nothing is published or sent anywhere: the article lives in this tab's sessionStorage (it survives navigation " +
    "and is gone when the tab closes). Pass \"title\" and \"markdown\" (the body: do not repeat the title as a first " +
    "heading); optional \"subtitle\" (one line under the title), \"date\" (e.g. 2026-11-27) and \"tags\". " +
    "Markdown is converted in the browser and the result is sanitized: scripts, event handlers and unsafe URLs are " +
    "removed, and the result lists what was dropped. Creating an article with the title of an existing one replaces it. " +
    "Articles appear in list_md_pages as kind agent-article and read_md_page returns their Markdown. " +
    'To show one again (for example after navigating to another page) pass only "show" with its id; ' +
    '"show": "original" restores the page\'s own content.',
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "The article's title (its H1)." },
      markdown: { type: "string", description: "The body in Markdown, without the title." },
      subtitle: { type: "string", description: "One line under the title." },
      date: { type: "string", description: "A date to show under the title, such as 2026-11-27." },
      tags: { type: "array", items: { type: "string" }, description: "Short tags, shown next to the date." },
      show: {
        type: "string",
        description: 'Instead of creating: the id of an article of this tab to show again, or "original" to restore the page.',
      },
    },
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  execute(input) {
    if (typeof input?.show === "string" && input.show.trim() !== "") return showExisting(input.show.trim());
    const article = saveArticle(buildArticle(input));
    const removed = showArticle(article);
    return ok({
      id: article.id,
      path: `${ARTICLE_PREFIX}${article.id}`,
      shown: true,
      sanitized: removed,
      note: 'Shown in this tab only. To bring the page back: create_article with {"show": "original"}.',
    });
  },
};

export const contentTools = [listMdPages, readMdPage, createArticle];
