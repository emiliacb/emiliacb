import { describe, expect, it } from "vitest";

import { langFromCookie, negotiateLang } from "../../src/shared/lang";

describe("negotiateLang", () => {
  it.each([
    ["es-AR,es;q=0.9", "es"],
    ["en;q=0.5, es", "es"],
    ["fr, en;q=0.1", "en"],
    ["", "en"],
    ["es;q=0", "en"],
    [null, "en"],
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
