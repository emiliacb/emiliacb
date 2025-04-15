import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

import { getAllPosts } from "../src/services/posts";

/**
 * This is a test script for static site generation to evaluate CDN deployment feasibility.
 * The goal is to fetch and save static HTML versions of the site's pages that could be 
 * served directly from a CDN. This is an initial proof-of-concept implementation.
 */
dotenv.config();

// Config
const supportedLanguages = ["en", "es"];
const defaultLanguage = "en";
const outputDir = "export";
const publicDir = "public";
const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const scriptDir = __dirname;
const projectRoot = path.resolve(scriptDir, "..");
const outputDirPath = path.join(projectRoot, outputDir);
const publicDirPath = path.join(projectRoot, publicDir);

// Routes
const baseRoutes = ["/", "/about", "/services"];

class ServerNotRunningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerNotRunningError";
  }
}

/**
 * Fetches HTML content from the specified route path
 * @param routePath - The URL path to fetch (e.g. "/about" or "/en/blog")
 * @returns {Promise<string>} A promise that resolves to the HTML content
 * @throws {Error} If there is an error fetching the route or if the content type is not text/html
 */
async function fetchRoute(routePath: string): Promise<string> {
  const url = `${baseUrl}${routePath}`;

  try {
    const response = await fetch(url);

    if (response.status === 404) {
      throw new Error("404");
    }

    if (response.status < 200 || response.status >= 400) {
      throw new Error("Invalid status");
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("text/html")) {
      const html = await response.text();
      return html;
    }

    throw new Error("Invalid content type");
  } catch (error: any) {
    console.error("Error fetching route:", error);
    error.step = "fetchRoute";
    throw new Error(error);
  }
}

/**
 * Saves HTML content to a file at the specified route path
 * @param routePath - The URL path where the content should be saved (e.g. "/about" or "/en/blog")
 * @param html - The HTML content to save
 * @throws {Error} If there is an error creating directories or writing the file
 */
async function saveHtml(routePath: string, html: string) {
  try {
    let filePathLang = routePath;
    let filePath = path.join(outputDirPath, filePathLang, "index.html");

    switch (routePath) {
      case "/":
        filePath = path.join(outputDirPath, "index.html");
        break;
      case `/${defaultLanguage}`:
        filePath = path.join(outputDirPath, defaultLanguage, "index.html");
        break;
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, html);
  } catch (error: any) {
    error.step = "saveHtml";
    throw new Error(error);
  }
}

/**
 * Saves HTML content to a file at the specified route path
 * @param routePath - The URL path where the content should be saved (e.g. "/about" or "/en/blog")
 * @param html - The HTML content to save
 * @throws {Error} If there is an error creating directories or writing the file
 */

async function copyRecursive(src: string, dest: string) {
  try {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (let entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await copyRecursive(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  } catch (error: any) {
    error.step = "copyRecursive";
    throw new Error(error);
  }
}

async function checkServer() {
  const errorMessage = `\nServer at ${baseUrl} is not running or /health endpoint failed. Have you run 'npm run start' in the root directory?`;
 
  try {
    const healthCheck = await fetch(`${baseUrl}/health`);
    if (healthCheck.status !== 200) {
      throw new ServerNotRunningError(errorMessage);
    }
  } catch (error: any) {
    error.step = "checkServer";
    throw new ServerNotRunningError(errorMessage);
  }
}

async function main() {
  await fs.mkdir(outputDirPath, { recursive: true });

  try {
    await checkServer();

    let blogPosts: { slug: string }[] = [];

    const postsResult = await getAllPosts();

    if (!postsResult) {
      throw new Error("No posts found");
    }

    blogPosts = postsResult
      .filter((p) => p != null && typeof p.slug === "string")
      .map((p) => ({ slug: p.slug }));

    let allRoutes: string[] = [];

    // Fetch all pages without language
    for (const route of baseRoutes) {
      allRoutes.push(route);
    }

    // Fetch all blog posts without language
    for (const post of blogPosts) {
      allRoutes.push(`/blog/${post.slug}`);
    }

    // Fetch all with language
    for (const lang of supportedLanguages) {
      baseRoutes.forEach((route) => {
        if (route === "/") {
          allRoutes.push(`/${lang}`);
        } else {
          allRoutes.push(`/${lang}${route}`);
        }
      });

      blogPosts.forEach((post: { slug: string }) => {
        if (post && post.slug) {
          allRoutes.push(`/${lang}/blog/${post.slug}`);
        } else {
          console.warn("Skipping blog post with missing slug:", post);
        }
      });
    }
    
    for (const route of allRoutes) {
      const html = await fetchRoute(route);
      await saveHtml(route, html);
    }

    await copyRecursive(publicDirPath, path.join(outputDirPath, "public"));

    console.log(`Static site generation complete. Output in ./${outputDir}/`);
  } catch (error) {
    console.error("\nError during static site generation:", error);
    process.exitCode = 1;
  }
}

main();
