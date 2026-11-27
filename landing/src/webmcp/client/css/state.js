// The agent's CSS: what is applied now, where it lives in the DOM and how it
// survives navigation inside the tab.
//
// Three parts, all kept: design-token overrides (set_variables), a free-form
// stylesheet (set_css) and per-selector rules (set_css_by_selector). All are
// printed into the one <style>, in that order, so a per-selector rule wins a
// tie against the stylesheet, which wins one against a token override. In
// front of them all, while there is anything to print, the two effect
// switches are turned off (see FX_OFF below).
//
// Whatever is committed here is announced with `tokenschange`, because the
// canvases (the tree, the cotas, the gradient) paint with the tokens' values
// and only know they changed when told. Every way of changing the CSS passes
// through here (the tools, the shield's restore, the restore of a saved
// state), so this is the one place that tells them.
//
// The lifetime is src/client/lib/nav-storage.js's: kept while the visitor
// navigates the site in this tab (links, back and forward), gone on a reload,
// in another tab and on the next visit, so the original page is always one
// reload away.
import { navGet, navRemove, navSet } from "../../../client/lib/nav-storage.js";
import { notifyTokensChange } from "../../../client/lib/theme.js";
import { rulesToCss } from "./declarations.js";
import { emptyVariables, hasVariables, isVariables, variablesToCss } from "./variables.js";

export const STYLE_ID = "webmcp-agent-css";
const STORAGE_KEY = "webmcp:css";

let current = emptyState();

export function emptyState() {
  return { css: "", rules: {}, variables: emptyVariables() };
}

/** What is applied right now. The rules object is replaced, never edited, so a shallow copy is safe. */
export function getState() {
  return {
    css: current.css,
    rules: { ...current.rules },
    variables: { light: { ...current.variables.light }, dark: { ...current.variables.dark } },
  };
}

/** Whether the agent has changed nothing: no overrides, no stylesheet, no rules. */
export function isEmptyState(state) {
  return state.css === "" && Object.keys(state.rules).length === 0 && !hasVariables(state.variables);
}

// The page's effect switches (--fx-ui-warp, --fx-shockwave, see styles.css),
// written off in front of everything else while the agent has changed
// anything: the tree's warp and the black hole's shockwave bend and shake the
// page, which gets in the way of an agent judging its own styling. They come
// FIRST so that the agent's own override (set_variables on either name) comes
// later and wins, and the agent can turn them back on. An empty state renders
// nothing at all, so a reset (and a reload) restores the site's default, on.
const FX_OFF = ":root{--fx-ui-warp:off;--fx-shockwave:off}";

/** The whole agent stylesheet as the browser sees it. */
export function renderCss(state) {
  if (isEmptyState(state)) return "";
  return [FX_OFF, variablesToCss(state.variables), state.css, rulesToCss(state.rules)].filter((part) => part !== "").join("\n");
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
    if (isEmptyState(state)) navRemove(STORAGE_KEY);
    else navSet(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked or full: the change still applies, it just will not follow the next navigation.
  }
}

/** Makes `state` the current one: applied now and kept for the next page of this tab. */
export function commitState(state) {
  current = state;
  paint(state);
  save(state);
  notifyTokensChange();
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
    const saved = JSON.parse(navGet(STORAGE_KEY) ?? "null");
    // `variables` is absent from what an earlier version saved.
    const variables = saved?.variables ?? emptyVariables();
    if (saved && typeof saved.css === "string" && isRules(saved.rules) && isVariables(variables)) return { ...saved, variables };
  } catch {
    // No storage, or something else wrote there: start clean.
  }
  return null;
}

/** Applies what an earlier page of this tab left behind. Runs before any tool does. */
export function restoreSavedCss() {
  const saved = readSaved();
  if (!saved) return;
  current = { css: saved.css, rules: saved.rules, variables: saved.variables };
  paint(current);
  notifyTokensChange();
  // Scripts that run later may append their own styles: take the last place back once the page is loaded.
  window.addEventListener("load", () => paint(current), { once: true });
}
