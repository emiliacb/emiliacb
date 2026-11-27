// The site's colour mode, shared by every client bundle that has to know
// whether the page is dark: the canvases (the tree, the cotas, the gradient),
// the Cal.com embed, the shadow-DOM components.
//
// The mode is the system's unless the page overrides it: <html
// data-theme="light"> or <html data-theme="dark"> forces one, and no
// attribute follows the system. styles.css and tailwind.config.cjs read the
// same attribute, so what this module reports is what the CSS paints. The
// choice is kept in localStorage under `theme`, and the inline script in the
// layout's <head> puts it back on <html> before the first paint (it has to be
// there before any bundle loads, or the page would flash the system's mode
// first); that script and setThemeMode() must stay in agreement about the key
// and the attribute.
//
// This file is a module, not an entry (see ClientEntry in site/context.ts):
// each bundle that imports it gets its own copy, which is fine because there
// is no state in it, only the attribute, the storage and the `themechange`
// event on window.

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
 * Forces a mode, or hands the choice back to the system. Remembered across
 * visits, unless storage is unavailable (private windows, blocked site data),
 * where it simply lasts until the page is left.
 * @param {"light" | "dark" | "system"} mode
 */
export function setThemeMode(mode) {
  const root = document.documentElement;
  const forced = mode === "light" || mode === "dark";
  if (forced) root.dataset.theme = mode;
  else delete root.dataset.theme;
  try {
    if (forced) localStorage.setItem(KEY, mode);
    else localStorage.removeItem(KEY);
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
