import fs from "fs";
import { marked, Tokens } from "marked";

const cache = new Map();

function parseContent(file: string) {
  const renderer = new marked.Renderer();

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

    return `<h${depth} id="${slug}">${text}<a class="!px-1 text-lg font-bold text-center align-baseline no-underline opacity-50 focus:opacity-100 hover:opacity-100 !bg-transparent !outline-none hover:!bg-black dark:hover:!bg-white hover:!text-white dark:hover:!text-black" href="#${slug}" aria-label="${text}">#</a></h${depth}>`;
  };

  marked.setOptions({ renderer });

  return marked(file);
}

export async function getContent(filePath: string) {
  try {
    if (cache.has(filePath)) {
      //return cache.get(filePath);
    }
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    if (!filePath.endsWith(".md")) {
      throw new Error(`File must be a Markdown file: ${filePath}`);
    }
    const file = fs.readFileSync(filePath, "utf8");
    const htmlContent = await parseContent(file);
    cache.set(filePath, htmlContent);

    return htmlContent;
  } catch (error: any) {
    error.step = "getContent";
    console.log(error);
    return null;
  }
}
