// Brings in the Markdown renderer the first time an article is written. `marked`
// weighs about 50 KB and only create_article needs it, so it is its own bundle
// (src/client/webmcp-markdown.js) that no page loads up front. The bundle's
// hashed URL is rendered into <meta name="asset:webmcp-markdown"> (the way
// sidebars.js finds ui-drawer), and it leaves its render function on the
// global below.
import { fail } from "../core/result.js";

const META_NAME = "asset:webmcp-markdown";

let loading = null;

function rendererOnPage() {
  const found = window.webmcpMarkdown;
  return found && typeof found.render === "function" ? found.render : null;
}

function inject(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.addEventListener("load", () => {
      const render = rendererOnPage();
      if (render) resolve(render);
      else reject(new Error("the Markdown bundle loaded but did not register"));
    });
    script.addEventListener("error", () => reject(new Error("the Markdown bundle did not load")));
    document.head.append(script);
  });
}

/** Resolves to `render(markdown) => html`, loading its bundle once and only when first asked. */
export function loadMarkdownRenderer() {
  const ready = rendererOnPage();
  if (ready) return Promise.resolve(ready);
  if (loading) return loading;
  const src = document.querySelector(`meta[name="${META_NAME}"]`)?.getAttribute("content");
  if (!src) return Promise.reject(fail("The Markdown renderer is not available on this page. Try reloading it."));
  loading = inject(src).catch((error) => {
    // Lets a later call try again.
    loading = null;
    console.warn("[webmcp] Could not load the Markdown renderer:", error);
    throw fail("The Markdown renderer could not be loaded. Check the connection and try again.");
  });
  return loading;
}
