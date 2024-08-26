import fs from "fs";
import path from "path";
import { marked } from "marked";
import matter from "gray-matter";

export async function getAllPosts() {
  try {
    const directoryPath = path.join(__dirname, "../../content/blog");
    const files = fs.readdirSync(directoryPath);

    const posts = await Promise.all(
      files
        .filter((file) => path.extname(file) === ".md")
        .map(async (file) => {
          const filePath = path.join(directoryPath, file);
          const fileContent = fs.readFileSync(filePath, "utf8");
          const { data } = matter(fileContent);
          data.slug = file.replace(".md", "");

          return data;
        })
    );

    return posts.filter((post) => !post.draft);
  } catch (error: any) {
    error.step = "getAllPosts";
    console.log(error);
    return null;
  }
}

export async function getPost(slug: string) {
  try {
    const filePath = path.join(__dirname, `../../content/blog/${slug}.md`);
    const file = fs.readFileSync(filePath, "utf8");
    const { data, content } = matter(file);
    const htmlContent = await marked(content);

    return { data, htmlContent };
  } catch (error: any) {
    error.step = "getPost";
    console.log(error);
    return null;
  }
}
