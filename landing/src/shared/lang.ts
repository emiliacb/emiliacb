export const LANGS = ["en", "es"] as const;

export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "en";

/** Cookie the language switcher sets so "/" remembers an explicit choice. */
export const LANG_COOKIE = "lang";

/**
 * One value per language, typed without a cast: adding a language to LANGS
 * makes every call site fail to compile until it is handled here.
 */
export function byLang<T>(make: (lang: Lang) => T): Record<Lang, T> {
  return { en: make("en"), es: make("es") };
}

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

/**
 * Picks the best supported language from an Accept-Language header, honouring
 * q-values ("en;q=0.5, es" is Spanish). Falls back to DEFAULT_LANG.
 */
export function negotiateLang(header: string | null | undefined): Lang {
  if (!header) return DEFAULT_LANG;

  // Ties keep the earlier entry, since only a strictly higher q replaces it.
  let best: LangRange | null = null;
  for (const part of header.split(",")) {
    const range = parseLangRange(part);
    if (range && (!best || range.q > best.q)) best = range;
  }
  return best?.lang ?? DEFAULT_LANG;
}

type LangRange = { lang: Lang; q: number };

/** One Accept-Language entry ("es-AR;q=0.8") → a supported language and its q, or null. */
function parseLangRange(part: string): LangRange | null {
  const [tag, ...params] = part.trim().split(";");
  const base = tag.trim().toLowerCase().split("-")[0];
  if (!isLang(base)) return null;

  const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
  const q = qParam ? Number(qParam.slice(2)) : 1;
  if (!Number.isFinite(q) || q <= 0) return null;
  return { lang: base, q };
}

/** Reads the language cookie out of a Cookie header, if it holds a valid value. */
export function langFromCookie(header: string | null | undefined): Lang | null {
  if (!header) return null;
  for (const pair of header.split(";")) {
    const [name, value] = pair.trim().split("=");
    if (name === LANG_COOKIE && isLang(value)) return value;
  }
  return null;
}
