// The site's colour mode, shared by every client bundle that has to know
// whether the page is dark: the canvases (the tree, the cotas, the gradient),
// the Cal.com embed, the shadow-DOM components.
//
// The mode is the system's unless the page overrides it: <html
// data-theme="light"> or <html data-theme="dark"> forces one, and no
// attribute follows the system. styles.css and tailwind.config.cjs read the
// same attribute, so what this module reports is what the CSS paints. The
// override exists only for agents (visitors have no switcher), so it follows
// their policy: it is kept in this tab's navigation storage (nav-storage.js,
// key `theme`) while the visitor navigates the site, and a reload clears it.
// The inline script in the layout's <head> puts it back on <html> before the
// first paint (it has to be there before any bundle loads, or the page would
// flash the system's mode first) and skips it on a reload; that script and
// setThemeMode() must stay in agreement about the key (`nav:theme`) and the
// attribute.
//
// This file is a module, not an entry (see ClientEntry in site/context.ts):
// each bundle that imports it gets its own copy, which is fine because there
// is no state in it, only the attribute, the storage and the `themechange`
// event on window.

import { navRemove, navSet } from "./nav-storage.js";

const KEY = "theme";
const EVENT = "themechange";
const SYSTEM_DARK = "(prefers-color-scheme: dark)";

/** @returns {"light" | "dark" | "system"} what the page was told to be. */
export function getThemeMode() {
  const forced = document.documentElement.dataset.theme;
  return forced === "light" || forced === "dark" ? forced : "system";
}

/** @returns {boolean} whether the page is dark now: the override, else the system's mode. */
export function isDark() {
  const mode = getThemeMode();
  if (mode !== "system") return mode === "dark";
  return matchMedia(SYSTEM_DARK).matches;
}

/**
 * Forces a mode, or hands the choice back to the system. Kept while the
 * visitor navigates the site in this tab, unless storage is unavailable
 * (private windows, blocked site data), where it lasts until the page is left.
 * @param {"light" | "dark" | "system"} mode
 */
export function setThemeMode(mode) {
  const root = document.documentElement;
  const forced = mode === "light" || mode === "dark";
  if (forced) root.dataset.theme = mode;
  else delete root.dataset.theme;
  try {
    if (forced) navSet(KEY, mode);
    else navRemove(KEY);
  } catch {
    // Storage can throw; the attribute is already set and that is what paints.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { mode: getThemeMode(), dark: isDark() } }));
}

/**
 * Calls `cb(isDark())` whenever the page's mode may have changed: when the
 * system's preference does (heard only while the mode is "system", since an
 * override ignores it) and on every `themechange`.
 * @param {(dark: boolean) => void} cb
 * @returns {() => void} stops listening.
 */
export function onThemeChange(cb) {
  const query = matchMedia(SYSTEM_DARK);
  const onSystem = () => {
    if (getThemeMode() === "system") cb(isDark());
  };
  const onEvent = () => cb(isDark());
  query.addEventListener("change", onSystem);
  window.addEventListener(EVENT, onEvent);
  return () => {
    query.removeEventListener("change", onSystem);
    window.removeEventListener(EVENT, onEvent);
  };
}

const TOKENS_EVENT = "tokenschange";

/**
 * Tells every painter that the design tokens (the custom properties on the
 * root) may have changed value at runtime, which the mode switch does not
 * cover: an agent restyling the page through WebMCP. Whoever writes tokens
 * calls this after the change is committed; the listeners below read the
 * computed values again.
 */
export function notifyTokensChange() {
  window.dispatchEvent(new CustomEvent(TOKENS_EVENT));
}

/**
 * Calls `cb(isDark())` whenever what the canvases read from the tokens may
 * have changed: on everything onThemeChange hears and on `tokenschange`. The
 * calls are coalesced to one per animation frame, so a burst (a mode switch
 * that also restyles) repaints once, and by then the browser has recomputed
 * the styles the callback is about to read.
 * @param {(dark: boolean) => void} cb
 * @returns {() => void} stops listening.
 */
export function onTokensChange(cb) {
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      cb(isDark());
    });
  };
  const stopTheme = onThemeChange(schedule);
  window.addEventListener(TOKENS_EVENT, schedule);
  return () => {
    stopTheme();
    window.removeEventListener(TOKENS_EVENT, schedule);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
}
