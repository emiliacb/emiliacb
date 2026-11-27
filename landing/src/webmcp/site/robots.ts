import { LANGS } from "../../shared/lang";
import { WEBMCP_ENABLED } from "../enabled";
import { DOCS_PATH, SKILLS_URL_PATH } from "./routes";

/**
 * robots.txt with WebMCP's lines in it: the docs for agents (HTML and Markdown,
 * language-less and per language) and the skills they can read. The static
 * public/robots.txt has everything else; the lines go in just before its
 * "Disallow: /", where they were when they were written by hand. They are
 * generated here, from the same paths the build and the Worker use, so that
 * turning the feature off takes them out too: the base file is then returned
 * as it is.
 */
export function renderRobots(base: string): string {
  if (!WEBMCP_ENABLED) return base;
  const allows = [
    "# WebMCP: the docs for agents (HTML and Markdown) and the skills they can read.",
    ...[DOCS_PATH, ...LANGS.map((lang) => `/${lang}${DOCS_PATH}`)].flatMap((path) => [`Allow: ${path}`, `Allow: ${path}.md`]),
    `Allow: ${SKILLS_URL_PATH}/`,
  ];
  const marker = "Disallow: /\n";
  const at = base.indexOf(marker);
  if (at === -1) throw new Error('public/robots.txt has no "Disallow: /" line to put the WebMCP lines before.');
  return `${base.slice(0, at)}${allows.join("\n")}\n${base.slice(at)}`;
}
