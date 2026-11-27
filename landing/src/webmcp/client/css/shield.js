// The shield: a notice that an agent's style change broke the page and was
// undone, with the way out. It must stay on screen whatever the agent's CSS
// says, so it is a host element on <html> with every property that could hide
// it set inline with !important (an inline !important declaration beats any
// stylesheet's, however specific), and its content lives in a closed shadow
// root, which no page selector reaches.

const HOST_ID = "webmcp-shield";

const COPY = {
  es: {
    title: "Un cambio de estilo de un agente rompió la página",
    body: "Lo deshice automáticamente: la página volvió a verse como antes. Podés aplicarlo igual o volver al diseño original.",
    apply: "Aplicar igual",
    restore: "Restaurar original",
    close: "Cerrar",
    details: "Qué se rompió",
  },
  en: {
    title: "An agent's style change broke the page",
    body: "It was undone automatically, and the page looks as it did before. You can apply it anyway or go back to the original design.",
    apply: "Apply anyway",
    restore: "Restore original",
    close: "Close",
    details: "What broke",
  },
};

const PANEL_CSS = `
  :host { all: initial; }
  .panel { box-sizing: border-box; width: min(380px, calc(100vw - 32px)); padding: 16px; border-radius: 12px;
    background: #fff; color: #1a1a1a; border: 1px solid #c9c9c9; box-shadow: 0 8px 32px rgb(0 0 0 / 0.25);
    font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; text-align: left; }
  h2 { margin: 0 28px 6px 0; font-size: 15px; font-weight: 650; }
  p { margin: 0 0 10px; }
  details { margin: 0 0 12px; font-size: 12px; color: #444; }
  ul { margin: 6px 0 0; padding-left: 18px; }
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

function detailsList(copy, problems) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = copy.details;
  const list = document.createElement("ul");
  for (const found of problems) {
    const item = document.createElement("li");
    item.textContent = found.message;
    list.appendChild(item);
  }
  details.append(summary, list);
  return details;
}

function buildPanel(copy, problems, actions, close) {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.setAttribute("role", "alertdialog");
  // Focus lands on the notice, so Tab goes straight to its buttons instead of through the whole page first.
  panel.tabIndex = -1;
  panel.setAttribute("aria-label", copy.title);
  const title = document.createElement("h2");
  title.textContent = copy.title;
  const body = document.createElement("p");
  body.textContent = copy.body;
  const row = document.createElement("div");
  row.className = "row";
  row.append(
    button(copy.apply, "primary", () => {
      close();
      actions.onApply();
    }),
    button(copy.restore, "", () => {
      close();
      actions.onRestore();
    }),
  );
  const x = button("×", "close", close);
  x.setAttribute("aria-label", copy.close);
  panel.append(x, title, body, detailsList(copy, problems), row);
  return panel;
}

/** Removes the shield, if one is showing. */
export function hideShield() {
  document.getElementById(HOST_ID)?.remove();
}

/**
 * Shows the shield for a change that was rolled back. `problems` are the
 * {message} entries from health.js; `actions.onApply` applies the change
 * anyway, `actions.onRestore` clears all agent CSS.
 */
export function showShield(problems, actions) {
  hideShield();
  const host = document.createElement("div");
  host.id = HOST_ID;
  for (const [property, value] of HOST_STYLE) host.style.setProperty(property, value, "important");
  const root = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = PANEL_CSS;
  root.append(style, buildPanel(COPY[language()], problems, actions, hideShield));
  document.documentElement.appendChild(host);
  root.querySelector(".panel")?.focus({ preventScroll: true });
}
