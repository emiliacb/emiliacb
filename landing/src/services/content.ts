import fs from "fs";
import { marked } from "marked";

const cache = new Map();

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
    const htmlContent = await marked(file);
    cache.set(filePath, htmlContent);

    return htmlContent;
  } catch (error: any) {
    error.step = "getContent";
    console.log(error);
    return null;
  }
}
