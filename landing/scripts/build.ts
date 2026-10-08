import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import * as esbuild from "esbuild";

import { LANGS, type Lang } from "../src/shared/lang";
import { PAGES } from "../src/shared/site";
import { dictionaries } from "../src/shared/i18n";
import type { Assets, ClientEntry, RenderCtx } from "../src/site/context";
import { loadContent } from "../src/site/content";
import { renderSite } from "../src/site/pages";

// The only file in the project allowed to read process.env.
// Note: import.meta.dirname is scripts/, so the project root is one level up.
const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const publicDir = path.join(root, "public");
const clientDir = path.join(root, "src", "client");

const sha256 = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex").slice(0, 10);

// Leftovers of the old pipeline (bundle-client.ts wrote _*-bundle*.js and
// the tailwind CLI wrote _output.css into public/).
const isSkippedPublicFile = (name: string) =>
  name === ".gitignore" || name === "_output.css" || /^_.*-bundle/.test(name);

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? await dirSize(p) : (await fs.stat(p)).size;
  }
  return total;
}

async function exists(file: string) {
  return fs
    .stat(file)
    .then((s) => s.isFile())
    .catch(() => false);
}

// 1. Clean output.
await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(path.join(dist, "assets"), { recursive: true });

// 2. Static files. sw.js and robots.txt are also served from the root.
await fs.cp(publicDir, path.join(dist, "public"), {
  recursive: true,
  filter: (src) => !isSkippedPublicFile(path.basename(src)),
});
for (const name of ["sw.js", "robots.txt"]) {
  await fs.copyFile(path.join(publicDir, name), path.join(dist, name));
}

// 3. Client bundles. Only top-level files are entries; subfolders are modules.
const clientEntries = (await fs.readdir(clientDir, { withFileTypes: true }))
  .filter((e) => e.isFile() && /\.(js|ts)$/.test(e.name) && !e.name.endsWith(".d.ts"))
  .map((e) => path.join(clientDir, e.name));

const { metafile } = await esbuild.build({
  absWorkingDir: root,
  entryPoints: clientEntries,
  bundle: true,
  minify: true,
  sourcemap: true,
  platform: "browser",
  target: "es2020",
  outdir: path.join(dist, "assets"),
  entryNames: "[name]-[hash]",
  metafile: true,
  logLevel: "warning",
});
if (!metafile) throw new Error("esbuild returned no metafile");

// Entry name ("forest") → public URL ("/assets/forest-ABC123.js").
const scriptUrls = new Map<string, string>();
for (const [outFile, output] of Object.entries(metafile.outputs)) {
  if (!output.entryPoint || !outFile.endsWith(".js")) continue;
  const name = path.basename(output.entryPoint, path.extname(output.entryPoint));
  scriptUrls.set(name, `/assets/${path.basename(outFile)}`);
}
if (scriptUrls.size !== clientEntries.length) {
  throw new Error(
    `Expected ${clientEntries.length} client bundles, esbuild produced ${scriptUrls.size}. ` +
      "Two files in src/client/ may share a name (forest.js and forest.ts).",
  );
}

// 4. Tailwind. Written into dist first so the temp file is cleaned with it.
const cssTmp = path.join(dist, "assets", ".styles.tmp.css");
execFileSync(
  path.join(root, "node_modules", ".bin", "tailwindcss"),
  ["-c", "tailwind.config.cjs", "-i", "src/styles.css", "-o", cssTmp, "--minify"],
  { cwd: root, stdio: "inherit" },
);
const cssBytes = await fs.readFile(cssTmp);
await fs.rm(cssTmp);
const cssUrl = `/assets/styles-${sha256(cssBytes)}.css`;
await fs.writeFile(path.join(dist, cssUrl), cssBytes);

// 5. buildId: changes whenever any bundle or the stylesheet changes.
const buildId = sha256([...scriptUrls.values(), cssUrl].sort().join("\n"));

// 6. Render.
function script(name: ClientEntry): string {
  const url = scriptUrls.get(name);
  if (!url) {
    throw new Error(
      `Unknown client bundle "${name}". Known: ${[...scriptUrls.keys()].join(", ")}. ` +
        "Check the name against ClientEntry in src/site/context.ts.",
    );
  }
  return url;
}

const assets: Assets = { script, css: cssUrl, buildId };
const content = await loadContent(root);
const ctxFor = (lang: Lang): RenderCtx => ({ lang, t: dictionaries[lang], assets, content });
const { pages, notFound } = await renderSite(ctxFor);

const writtenPaths = new Set<string>();
for (const page of pages) {
  if (!page.path.startsWith("/") || page.path.split("/").includes("..")) {
    throw new Error(`Invalid page path from renderSite: "${page.path}"`);
  }
  if (writtenPaths.has(page.path)) throw new Error(`Duplicate page path: "${page.path}"`);
  writtenPaths.add(page.path);

  const file = path.join(dist, page.path, "index.html");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, page.html);
}

const notFoundFiles: [string, string][] = [
  ["404.html", notFound.en],
  ["en/404.html", notFound.en],
  ["es/404.html", notFound.es],
];
for (const [rel, html] of notFoundFiles) {
  await fs.mkdir(path.dirname(path.join(dist, rel)), { recursive: true });
  await fs.writeFile(path.join(dist, rel), html);
}

// 7. Headers and redirects (read by Cloudflare Static Assets).
await fs.writeFile(
  path.join(dist, "_headers"),
  [
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "/sw.js",
    "  Cache-Control: no-cache",
    "/public/cv.pdf",
    '  Content-Disposition: attachment; filename="Emilia_C_B_Resume.pdf"',
    "",
  ].join("\n"),
);
await fs.writeFile(
  path.join(dist, "_redirects"),
  [
    "/cv /public/cv.pdf 302",
    "# HTML from before the static build referenced versioned asset paths",
    "/public/:version/* /public/:splat 301",
    "",
  ].join("\n"),
);

// 8. Sanity checks. Failing here is cheaper than shipping a broken page.
const expectedPaths = [
  ...PAGES.flatMap((p) => LANGS.map((lang) => `/${lang}${p.path}`)),
  ...content.posts.flatMap((post) => LANGS.map((lang) => `/${lang}/blog/${post.slug}`)),
];
const missing: string[] = [];
for (const urlPath of expectedPaths) {
  if (!(await exists(path.join(dist, urlPath, "index.html")))) missing.push(urlPath);
}
if (missing.length) throw new Error(`Missing index.html for: ${missing.join(", ")}`);

const BAD_MARKERS = ["undefined</", "[object Promise]", "[object Object]"];
const renderedHtml: [string, string][] = [
  ...pages.map((p): [string, string] => [p.path, p.html]),
  ...notFoundFiles.map(([rel, html]): [string, string] => [rel, html]),
];
for (const [where, html] of renderedHtml) {
  for (const marker of BAD_MARKERS) {
    if (html.includes(marker)) throw new Error(`Rendered HTML at ${where} contains "${marker}"`);
  }
}

// 9. Summary.
const assetFiles = await fs.readdir(path.join(dist, "assets"));
const totalBytes = await dirSize(dist);
console.log(
  `build ${buildId}: ${pages.length + notFoundFiles.length} HTML files ` +
    `(${pages.length} pages, ${notFoundFiles.length} 404s), ` +
    `${assetFiles.filter((f) => !f.endsWith(".map")).length} assets, ` +
    `dist ${(totalBytes / 1024).toFixed(1)} KB`,
);
