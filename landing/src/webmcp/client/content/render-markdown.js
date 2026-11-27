// Markdown to HTML for create_article. This is the only module that imports
// `marked` (about 50 KB), so it is bundled apart (src/client/webmcp-markdown.js)
// and fetched the first time an article is written, not on every page.
import { Marked } from "marked";

import { escapeAttribute, headingSlug } from "./text.js";

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

/** Renders like the build does for posts (site/content/markdown.ts): same heading ids and anchors. */
export function renderBody(markdown) {
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

