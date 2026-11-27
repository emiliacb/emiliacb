// Storage for what an agent changes on the page (its CSS, the fonts it loaded,
// the articles it wrote, the colour mode it forced). The policy: it is kept
// while the visitor navigates the site in this tab (clicking links, back and
// forward), and a reload restores the original page. So it lives in
// sessionStorage, which already stays out of other tabs and later visits, and
// the first use in a document that was loaded by a reload empties it.
//
// Why "first use" and not "on import": every bundle that imports this module
// has its own copy of it, and an agent may already have changed something by
// the time a second bundle is evaluated. A flag on `window` makes the clearing
// happen once per document load, before anything reads or writes, and never
// again after the agent has started writing.
//
// Every key is stored under PREFIX, so the clearing needs no list of keys that
// could fall out of date. The inline script in the layout's <head> repeats the
// reload check for the theme key only, because it runs before any bundle.
// A page restored from the back/forward cache is the same document with its DOM
// as it was, so nothing here has to run for it.

export const PREFIX = "nav:";
const DONE_FLAG = "__navStorageCleared";

/**
 * Whether this document was loaded by a reload. `perf` is a parameter so a
 * test can stub `performance`.
 * @param {object} [perf]
 */
export function isReload(perf = globalThis.performance) {
  try {
    const entry = perf?.getEntriesByType?.("navigation")?.[0];
    if (entry) return entry.type === "reload";
    // Engines without Navigation Timing level 2: 1 is TYPE_RELOAD.
    return perf?.navigation?.type === 1;
  } catch {
    return false;
  }
}

function clearAll(storage) {
  const keys = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

/**
 * Empties the stored keys once per document load, when the load was a reload.
 * Called by every accessor, so callers never have to remember it.
 * @param {{ storage?: Storage, perf?: object, scope?: object }} [env] overrides, for tests.
 */
export function clearOnReload(env = {}) {
  const scope = env.scope ?? globalThis;
  if (scope[DONE_FLAG]) return;
  scope[DONE_FLAG] = true;
  try {
    if (isReload(env.perf)) clearAll(env.storage ?? sessionStorage);
  } catch {
    // Storage blocked: nothing was kept, so there is nothing to clear.
  }
}

/** @returns {string | null} the stored value, or null when absent, cleared by a reload, or storage is blocked. */
export function navGet(key) {
  clearOnReload();
  return sessionStorage.getItem(PREFIX + key);
}

/** Stores a value for the rest of this tab's navigation. Throws when storage is blocked or full, like setItem. */
export function navSet(key, value) {
  clearOnReload();
  sessionStorage.setItem(PREFIX + key, value);
}

export function navRemove(key) {
  clearOnReload();
  sessionStorage.removeItem(PREFIX + key);
}
