import fs from "fs";
import path from "path";
import { marked } from "marked";

export async function getContent(filePath: string) {
  try {
    const file = fs.readFileSync(filePath, "utf8");
    const htmlContent = await marked(file);

    return htmlContent;
  } catch (error: any) {
    error.step = "getContent";
    console.log(error);
    return null;
  }
}
