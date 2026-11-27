import { describe, expect, it } from "vitest";

import { LANGS, byLang, langFromCookie, negotiateLang } from "../../src/shared/lang";

describe("negotiateLang", () => {
  it.each([
    ["es-AR,es;q=0.9", "es"],
    ["en;q=0.5, es", "es"],
    ["fr, en;q=0.1", "en"],
    ["", "en"],
    ["es;q=0", "en"],
    [null, "en"],
    // Equal q: the first listed language wins.
    ["es;q=0.8, en;q=0.8", "es"],
    ["en, es", "en"],
    // A malformed q drops that entry, not the whole header.
    ["es;q=abc, en;q=0.2", "en"],
    ["ES-mx", "es"],
  ])("%j -> %s", (header, expected) => {
    expect(negotiateLang(header)).toBe(expected);
  });
});

describe("langFromCookie", () => {
  it("reads a valid lang cookie among others", () => {
    expect(langFromCookie("theme=dark; lang=es; x=1")).toBe("es");
  });

  it("ignores unsupported or missing values", () => {
    expect(langFromCookie("lang=fr")).toBeNull();
    expect(langFromCookie("theme=dark")).toBeNull();
    expect(langFromCookie(null)).toBeNull();
  });
});

describe("byLang", () => {
  it("builds one value per supported language", () => {
    const record = byLang((lang) => `/${lang}`);
    expect(Object.keys(record).toSorted()).toEqual([...LANGS].toSorted());
    for (const lang of LANGS) expect(record[lang]).toBe(`/${lang}`);
  });
});
