import { Link2 } from "lucide-static";
import { Marked, type Tokens } from "marked";

import emailLink from "../components/email-link";
import { dictionaries } from "../../shared/i18n";
import type { Lang } from "../../shared/lang";

type HeadingRecord = {
  text: string;
  slug: string;
  depth: number;
};

/** Escapes a value for use inside a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Renders Markdown to HTML synchronously. A fresh Marked instance is created
 * per call, so nothing leaks into the global marked defaults.
 */
export function renderMarkdown(source: string, lang: Lang): string {
  const headingsList: Array<HeadingRecord> = [];
  const marked = new Marked();

  marked.use({
    renderer: {
      // Heading ids are link targets. Same rule as before (hyphens are stripped,
      // spaces become "-") except accented letters are kept: "Qué es" → "qué-es".
      heading({ text, depth }: Tokens.Heading) {
        const slug = text
          .toLowerCase()
          .replace(/[^\p{L}\p{N} ]/gu, "")
          .replace(/ /g, "-");

        if (depth === 1) {
          return `<h${depth} id="${slug}">${text}</h${depth}>`;
        }

        headingsList.push({ text, slug, depth });

        return `<h${depth} id="${slug}">${text}<a class="inline-flex justify-center w-5 !p-0 translate-y-[0.2rem] before:hidden text-lg font-bold text-center align-baseline no-underline opacity-50 focus:opacity-100 hover:opacity-100 !bg-transparent !outline-none hover:!bg-black dark:hover:!bg-white hover:!text-white dark:hover:!text-black !border-2 border-transparent focus-visible:!border-red-500" href="#${slug}" aria-label="${escapeAttr(text)}">${Link2}</a></h${depth}>`;
      },

      // Render mailto: links as the email-link dropdown (copy / Gmail / Superhuman)
      // instead of a plain anchor, styled to match the surrounding prose link.
      link({ href, title, text }: Tokens.Link) {
        if (href.startsWith("mailto:")) {
          const email = href.slice("mailto:".length);
          return String(emailLink({ email, lang, label: text, variant: "prose" }));
        }

        const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
        return `<a href="${escapeAttr(href)}"${titleAttr}>${text}</a>`;
      },
    },
  });

  const contentHtml = marked.parse(source, { async: false }) as string;

  const headingsListHtml = headingsList
    .filter(({ depth }) => depth === 2)
    .map(({ text, slug }) => `<li><a href="#${slug}">${text}</a></li>`)
    .join("");

  const tocHtml = `
    <p>${dictionaries[lang].markdown.tableOfContents}</p>
    <ul>
        ${headingsListHtml}
    </ul>
  `;

  // marked wraps the standalone %table-of-contents% token in a <p>. Replacing
  // only the token would nest the block-level <ul> inside that <p>, which is
  // invalid HTML: browsers auto-close the paragraph and inject stray empty
  // paragraphs, producing blank bullets and dropped/merged items (worse on
  // some mobile browsers). Swap the whole wrapping paragraph instead, falling
  // back to the bare token if marked didn't wrap it.
  // A replacer function (not a string) so "$" in heading text is not special.
  return contentHtml.replace(
    /(?:<p>\s*)?%table-of-contents%(?:\s*<\/p>)?/,
    () => tocHtml
  );
}
