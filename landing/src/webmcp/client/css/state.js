// The agent's CSS: what is applied now, where it lives in the DOM and how it
// survives navigation inside the tab.
//
// Two parts, both kept: a free-form stylesheet (set_css) and per-selector rules
// (set_css_by_selector). Both are printed into the one <style>, stylesheet
// first, so a per-selector rule wins a tie against the stylesheet.
//
// sessionStorage is the right lifetime: it follows the tab through page loads
// and is gone when the tab closes, so the visitor's next visit starts clean.
import { rulesToCss } from "./declarations.js";

export const STYLE_ID = "webmcp-agent-css";
const STORAGE_KEY = "webmcp:css";

let current = { css: "", rules: {} };

export function emptyState() {
  return { css: "", rules: {} };
}

/** What is applied right now. The rules object is replaced, never edited, so a shallow copy is safe. */
export function getState() {
  return { css: current.css, rules: { ...current.rules } };
}

/** The whole agent stylesheet as the browser sees it. */
export function renderCss(state) {
  return [state.css, rulesToCss(state.rules)].filter((part) => part !== "").join("\n");
}

/** Writes `state` into the page, without remembering it. Used to try a change and to roll it back. */
export function paint(state) {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
  }
  // Last in <head>, so it wins ties against the site's own stylesheets.
  if (style.parentNode !== document.head || style.nextElementSibling) document.head.appendChild(style);
  style.textContent = renderCss(state);
}

function save(state) {
  try {
    if (state.css === "" && Object.keys(state.rules).length === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked or full: the change still applies, it just will not follow the next navigation.
  }
}

/** Makes `state` the current one: applied now and kept for the next page of this tab. */
export function commitState(state) {
  current = state;
  paint(state);
  save(state);
}

function isRules(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((declared) => typeof declared === "object" && declared !== null)
  );
}

function readSaved() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved.css === "string" && isRules(saved.rules)) return saved;
  } catch {
    // No storage, or something else wrote there: start clean.
  }
  return null;
}

/** Applies what an earlier page of this tab left behind. Runs before any tool does. */
export function restoreSavedCss() {
  const saved = readSaved();
  if (!saved) return;
  current = { css: saved.css, rules: saved.rules };
  paint(current);
  // Scripts that run later may append their own styles: take the last place back once the page is loaded.
  window.addEventListener("load", () => paint(current), { once: true });
}
