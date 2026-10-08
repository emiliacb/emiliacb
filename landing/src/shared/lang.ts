export const LANGS = ["en", "es"] as const;

export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "en";

/** Cookie the language switcher sets so "/" remembers an explicit choice. */
export const LANG_COOKIE = "lang";

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

/**
 * Picks the best supported language from an Accept-Language header, honouring
 * q-values ("en;q=0.5, es" is Spanish). Falls back to DEFAULT_LANG.
 */
export function negotiateLang(header: string | null | undefined): Lang {
  if (!header) return DEFAULT_LANG;

  let best: { lang: Lang; q: number; index: number } | null = null;

  header.split(",").forEach((part, index) => {
    const [tag, ...params] = part.trim().split(";");
    const base = tag.trim().toLowerCase().split("-")[0];
    if (!isLang(base)) return;

    const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const q = qParam ? Number(qParam.slice(2)) : 1;
    if (!Number.isFinite(q) || q <= 0) return;

    if (!best || q > best.q || (q === best.q && index < best.index)) {
      best = { lang: base, q, index };
    }
  });

  return best ? (best as { lang: Lang }).lang : DEFAULT_LANG;
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
