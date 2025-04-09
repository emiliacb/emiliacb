import fs from "fs";
import path from "path";

import matter from "gray-matter";

import { parseContent } from "../utils/parse-content";

type Post = {
  date: string;
  draft: boolean;
  slug: string;
  title: string;
};

export async function getAllPosts() {
  try {
    const directoryPath = path.join(__dirname, "../../content/blog");
    const files = fs.readdirSync(directoryPath);

    const postsData = await Promise.all(
      files
        .filter((file) => path.extname(file) === ".md")
        .map(async (file) => {
          const filePath = path.join(directoryPath, file);
          const fileContent = fs.readFileSync(filePath, "utf8");
          const { data } = matter(fileContent);
          data.slug = file.replace(".md", "");

          return data as Post;
        })
    );

    const posts = postsData.sort((a: Post, b: Post) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
    const htmlContent = await parseContent(content, "en");

    return { data, htmlContent };
  } catch (error: any) {
    error.step = "getPost";
    console.log(error);
    return null;
  }
}
