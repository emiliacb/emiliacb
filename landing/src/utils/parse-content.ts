import { Link2 } from "lucide-static";
import { marked, Tokens } from "marked";

type HeadingRecord = {
  text: string;
  slug: string;
  depth: number;
};

const wordings: Record<string, any> = {
  en: {
    tableOfContents: "Table of Contents:",
  },
  es: {
    tableOfContents: "Tabla de Contenidos:",
  },
} as const;

export async function parseContent(file: string, lang: string) {
  const renderer = new marked.Renderer();
  const headingsList: Array<HeadingRecord> = [];

  // Customize the renderer to add id attributes to heading elements
  // This enables direct linking to specific sections via anchor tags
  renderer.heading = ({ text, depth }: Tokens.Heading) => {
    const slug = text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/ /g, "-");

    if (depth === 1) {
      return `<h${depth} id="${slug}">${text}</h${depth}>`;
    }

    headingsList.push({ text, slug, depth });

    return `<h${depth} id="${slug}">${text}<a class="inline-flex justify-center w-5 !p-0 translate-y-[0.2rem] before:hidden text-lg font-bold text-center align-baseline no-underline opacity-50 focus:opacity-100 hover:opacity-100 !bg-transparent !outline-none hover:!bg-black dark:hover:!bg-white hover:!text-white dark:hover:!text-black !border-2 border-transparent focus-visible:!border-red-500" href="#${slug}" aria-label="${text}">${Link2}</a></h${depth}>`;
  };

  marked.setOptions({ renderer });

  const contentHtml = await marked(file);

  const headingsListHtml = headingsList
    .filter(({ depth }) => depth === 2)
    .map(({ text, slug }) => `<li><a href="#${slug}">${text}</a></li>`)
    .join("");

  const tocHtml = `
    <p>${wordings[lang].tableOfContents}</p>
    <ul>
        ${headingsListHtml}
    </ul>
  `;

  const parsedContent = contentHtml.replace(/%table-of-contents%/, tocHtml);

  return parsedContent;
}
