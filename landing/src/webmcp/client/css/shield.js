// The shield: a small notice, shown only when an agent forced a style change
// the page checks flagged, with a button to go back to the original style. It must stay on screen whatever the agent's CSS
// says, so it is a host element on <html> with every property that could hide
// it set inline with !important (an inline !important declaration beats any
// stylesheet's, however specific), and its content lives in a closed shadow
// root, which no page selector reaches.

const HOST_ID = "webmcp-shield";

const COPY = {
  es: {
    title: "Un agente cambió la página de una forma que puede dificultar su uso.",
    restore: "Restaurar la página original",
    close: "Cerrar",
  },
  en: {
    title: "An agent changed the page in a way that may make it hard to use.",
    restore: "Restore the original page",
    close: "Close",
  },
};

const PANEL_CSS = `
  :host { all: initial; }
  .panel { box-sizing: border-box; width: min(380px, calc(100vw - 32px)); padding: 16px; border-radius: 12px;
    background: #fff; color: #1a1a1a; border: 1px solid #c9c9c9; box-shadow: 0 8px 32px rgb(0 0 0 / 0.25);
    font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; text-align: left; }
  h2 { margin: 0 28px 12px 0; font-size: 14px; font-weight: 600; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  button { font: inherit; cursor: pointer; padding: 7px 12px; border-radius: 8px; border: 1px solid #1a1a1a;
    background: #fff; color: #1a1a1a; }
  button.primary { background: #1a1a1a; color: #fff; }
  button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .close { position: absolute; top: 8px; right: 8px; border: 0; padding: 4px 8px; font-size: 18px; line-height: 1; }
  .panel { position: relative; }
`;

/** Inline !important on the host: the page's own CSS cannot hide or move it. */
const HOST_STYLE = [
  ["all", "initial"],
  ["position", "fixed"],
  ["right", "16px"],
  ["bottom", "16px"],
  ["z-index", "2147483647"],
  ["display", "block"],
  ["visibility", "visible"],
  ["opacity", "1"],
  ["pointer-events", "auto"],
  ["transform", "none"],
  ["filter", "none"],
  ["clip-path", "none"],
  ["mix-blend-mode", "normal"],
  ["isolation", "isolate"],
  ["width", "auto"],
  ["height", "auto"],
];

function language() {
  return document.documentElement.lang.toLowerCase().startsWith("es") ? "es" : "en";
}

function button(label, className, onClick) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  if (className) el.className = className;
  el.addEventListener("click", onClick);
  return el;
}

function buildPanel(copy, actions, close) {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.setAttribute("role", "alertdialog");
  // Focus lands on the notice, so Tab goes straight to its buttons instead of through the whole page first.
  panel.tabIndex = -1;
  panel.setAttribute("aria-label", copy.title);
  const title = document.createElement("h2");
  title.textContent = copy.title;
  const row = document.createElement("div");
  row.className = "row";
  row.append(
    button(copy.restore, "primary", () => {
      close();
      actions.onRestore();
    }),
    button(copy.close, "", close),
  );
  const x = button("×", "close", close);
  x.setAttribute("aria-label", copy.close);
  panel.append(x, title, row);
  return panel;
}

/** Removes the shield, if one is showing. */
export function hideShield() {
  document.getElementById(HOST_ID)?.remove();
}

export function isShieldOpen() {
  return document.getElementById(HOST_ID) !== null;
}

/**
 * Shows the shield for a change the agent forced. `actions.onRestore` undoes
 * what was forced (the agent's CSS, the elements it inserted). The problems are
 * not listed here: they went to the agent, and the visitor only needs the way back.
 */
export function showShield(actions) {
  hideShield();
  const host = document.createElement("div");
  host.id = HOST_ID;
  for (const [property, value] of HOST_STYLE) host.style.setProperty(property, value, "important");
  const root = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = PANEL_CSS;
  root.append(style, buildPanel(COPY[language()], actions, hideShield));
  document.documentElement.appendChild(host);
  root.querySelector(".panel")?.focus({ preventScroll: true });
}
