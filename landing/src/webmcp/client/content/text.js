// Text rules shared by the article store and the lazily loaded Markdown renderer.

/** Heading id rule of the site's own posts (site/content/markdown.ts headingSlug). */
export function headingSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/ /g, "-");
}

export function escapeAttribute(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
