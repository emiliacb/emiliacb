import fs from "fs";

import { parseContent } from "../utils/parse-content";

const cache = new Map();

export async function getContent(filePath: string, lang: string) {
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
    const htmlContent = await parseContent(file, lang);
    cache.set(filePath, htmlContent);

    return htmlContent;
  } catch (error: any) {
    error.step = "getContent";
    console.log(error);
    return null;
  }
}
