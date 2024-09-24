import fs from "fs";
import { marked, Tokens } from "marked";

const cache = new Map();

function parseContent(file: string) {
  const renderer = new marked.Renderer();

  // Add id to headings
  renderer.heading = ({ text, depth }: Tokens.Heading) => {
    const slug = encodeURIComponent(text.toLowerCase());

    if (depth === 1) {
      return `<h${depth} id="${slug}">${text}</h${depth}>`;
    }

    return `<h${depth} id="${slug}">${text}<a class="!ml-2 px-1 font-bold mb-2 h-fit text-center align-middle no-underline opacity-70 focus:opacity-100 hover:opacity-100 !bg-transparent !outline-none hover:!bg-black" href="#${slug}" aria-label="${text}">#</a></h${depth}>`;
  };

  marked.setOptions({ renderer });

  return marked(file);
}

export async function getContent(filePath: string) {
  try {
    if (cache.has(filePath)) {
      return cache.get(filePath);
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
