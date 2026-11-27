// WebMCP POC (/labs/webmcp): this outer document holds the site in a same-origin
// iframe and registers one tool, set_page_css, for the visitor's own browser agent
// (WebMCP: https://webmachinelearning.github.io/webmcp/). The agent runs on the
// visitor's side, so there is no endpoint and no API key here.
//
// The tool writes one <style> into the iframe's document. Nothing is saved: the
// stylesheet lives in this tab, is applied again when the iframe navigates to
// another page of the site, and is gone on reload.
(function () {
  "use strict";

  const STYLE_ID = "webmcp-agent-css";
  // A stylesheet, not a page: past this it is more likely a mistake than a design.
  const MAX_CSS_CHARS = 50000;

  const frame = document.getElementById("webmcp-frame");
  if (!frame) return;

  let css = "";

  /** Writes `css` into the iframe's document. False while it has no <head> to write to. */
  function apply() {
    const doc = frame.contentDocument;
    if (!doc || !doc.head) return false;
    let style = doc.getElementById(STYLE_ID);
    if (!style) {
      style = doc.createElement("style");
      style.id = STYLE_ID;
    }
    // Last in <head>, so it wins ties against the site's own stylesheets.
    doc.head.appendChild(style);
    style.textContent = css;
    return true;
  }

  // Every load is a fresh document (the visitor followed a link inside the
  // iframe): the agent's stylesheet goes with it.
  frame.addEventListener("load", apply);

  // The spec puts it on document; Chrome's first builds had it on navigator.
  const modelContext = document.modelContext || navigator.modelContext;
  if (!modelContext || typeof modelContext.registerTool !== "function") {
    console.warn("[webmcp] This browser exposes no WebMCP (document.modelContext): set_page_css is not registered.");
    return;
  }

  const tool = {
    name: "set_page_css",
    title: "Restyle the page",
    description:
      "Restyles emiliacabral.com, the personal site shown in this tab, with CSS. " +
      "The CSS replaces whatever this tool applied before, so always send the complete stylesheet; " +
      "an empty string restores the original look. It is added after the site's own styles, " +
      "but use !important where an inline style or a more specific rule may win. " +
      "The change is only visible in this tab and disappears on reload. " +
      "Dark mode follows @media (prefers-color-scheme: dark). " +
      "Useful selectors: body, nav[data-cota-row] (navbar), #content (main column), " +
      "#gradient-bg (background gradient), #tree-illustration (the tree on the home), footer, " +
      "h1, h2, p, a.",
    inputSchema: {
      type: "object",
      properties: {
        css: {
          type: "string",
          description: "The full stylesheet to apply, as plain CSS. Empty string to reset.",
        },
      },
      required: ["css"],
    },
    execute: function (input) {
      const next = input && typeof input.css === "string" ? input.css : null;
      if (next === null) return Promise.reject(new TypeError("css must be a string"));
      if (next.length > MAX_CSS_CHARS) {
        return Promise.reject(new RangeError("css is longer than " + MAX_CSS_CHARS + " characters"));
      }
      css = next;
      let text = "Applied " + css.length + " characters of CSS.";
      if (!css) text = "Removed the custom CSS; the page looks as it was.";
      if (!apply()) text = "Saved; the page is still loading and gets the stylesheet as soon as it does.";
      return Promise.resolve({ content: [{ type: "text", text: text }] });
    },
  };

  // The spec's registerTool returns a promise; Chrome's first builds returned
  // nothing or threw synchronously. Promise.resolve().then covers all three.
  Promise.resolve()
    .then(function () {
      return modelContext.registerTool(tool);
    })
    .catch(function (error) {
      console.warn("[webmcp] Could not register set_page_css:", error);
    });
})();
