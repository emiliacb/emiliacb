import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BASE_TOKENS, overridesOf } from "../../src/webmcp/client/css/tokens.js";
import {
  emptyVariables,
  isVariables,
  kindOf,
  kindProblem,
  literalProblem,
  mergeVariables,
  parseVariables,
  variablesToCss,
} from "../../src/webmcp/client/css/variables.js";

// Node has no CSS.supports: a stand-in that knows hex colours, rgb() and a few
// names, and lengths in rem or px, which is all these tests ask of it.
const supports = (property: string, value: string) => {
  if (property === "color") return /^(#[0-9a-f]{3,8}|rgb\(.*\)|hsl\(.*\)|oklch\(.*\)|red|blue|transparent)$/i.test(value);
  if (property === "width") return /^-?[\d.]+(px|rem|%)$/.test(value);
  return false;
};

describe("parseVariables", () => {
  it("keeps custom properties and turns null or empty into removals", () => {
    expect(parseVariables({ "--color-paper": " #fff ", "--tree-hue": 200, "--color-ink": null, "--x": "" })).toEqual([
      ["--color-paper", "#fff"],
      ["--tree-hue", "200"],
      ["--color-ink", null],
      ["--x", null],
    ]);
  });

  it("rejects ordinary properties, bad shapes and empty input", () => {
    expect(() => parseVariables({ color: "red" })).toThrow(/custom property/);
    expect(() => parseVariables({ "--a b": "red" })).toThrow(/custom property/);
    expect(() => parseVariables(["--a"])).toThrow(/object/);
    expect(() => parseVariables(null)).toThrow(/object/);
    expect(() => parseVariables({})).toThrow(/empty/);
    expect(() => parseVariables({ "--a": {} })).toThrow(/string, a number or null/);
  });
});

describe("value checks", () => {
  it("refuses what could escape the declaration", () => {
    expect(literalProblem("red; background: blue")).toMatch(/one value/);
    expect(literalProblem("red } body { display: none")).toMatch(/braces/);
    expect(literalProblem("red /* x */")).toMatch(/comments/);
    expect(literalProblem("red !important")).toMatch(/important/);
    expect(literalProblem('"unterminated')).toMatch(/quote/);
    expect(literalProblem("#fff")).toBeNull();
    expect(literalProblem("rgb(0 0 0 / 50%)")).toBeNull();
  });

  it("tells a token's kind from its computed value", () => {
    expect(kindOf("#f5f5f4", supports)).toBe("colour");
    expect(kindOf("252 190 80", supports)).toBe("channels");
    expect(kindOf("143", supports)).toBe("number");
    expect(kindOf("2rem", supports)).toBe("length");
    expect(kindOf("block", supports)).toBe("any");
    expect(kindOf('Montserrat, system-ui', supports)).toBe("any");
    expect(kindOf("", supports)).toBe("any");
  });

  it("checks a value against the kind and lets references through", () => {
    expect(kindProblem("colour", "#fff", supports)).toBeNull();
    expect(kindProblem("colour", "banana", supports)).toMatch(/colour/);
    expect(kindProblem("colour", "var(--color-ink)", supports)).toBeNull();
    expect(kindProblem("channels", "10 20 30", supports)).toBeNull();
    expect(kindProblem("channels", "#fff", supports)).toMatch(/channels/);
    expect(kindProblem("channels", "10 20 300", supports)).toMatch(/channels/);
    expect(kindProblem("number", "200", supports)).toBeNull();
    expect(kindProblem("number", "green", supports)).toMatch(/number/);
    expect(kindProblem("length", "3rem", supports)).toBeNull();
    expect(kindProblem("length", "wide", supports)).toMatch(/length/);
    expect(kindProblem("any", "whatever", supports)).toBeNull();
  });
});

describe("merging and rendering", () => {
  it("writes both modes, only one, and removals", () => {
    const entries: [string, string | null][] = [["--color-paper", "#fff"]];
    const both = mergeVariables(emptyVariables(), entries, "both");
    expect(both).toEqual({ light: { "--color-paper": "#fff" }, dark: { "--color-paper": "#fff" } });
    const light = mergeVariables(emptyVariables(), entries, "light");
    expect(light.dark).toEqual({});
    const dark = mergeVariables(both, [["--color-paper", "#000"]], "dark");
    expect(dark.light["--color-paper"]).toBe("#fff");
    expect(dark.dark["--color-paper"]).toBe("#000");
    expect(mergeVariables(both, [["--color-paper", null]], "both")).toEqual(emptyVariables());
    expect(both.light).toEqual({ "--color-paper": "#fff" }); // the old one is not touched
  });

  it("prints light on :root and dark under the attribute and the media query", () => {
    const css = variablesToCss({ light: { "--a": "1" }, dark: { "--a": "2", "--b": "3" } });
    expect(css).toBe(
      [
        ":root {\n  --a: 1;\n}",
        ':root[data-theme="dark"] {\n  --a: 2;\n  --b: 3;\n}',
        '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n    --a: 2;\n    --b: 3;\n  }\n}',
      ].join("\n"),
    );
    expect(variablesToCss(emptyVariables())).toBe("");
    expect(variablesToCss({ light: { "--a": "1" }, dark: {} })).toBe(":root {\n  --a: 1;\n}");
  });

  it("recognises saved state", () => {
    expect(isVariables(emptyVariables())).toBe(true);
    expect(isVariables({ light: { "--a": 1 }, dark: {} })).toBe(false);
    expect(isVariables({ light: { a: "1" }, dark: {} })).toBe(false);
    expect(isVariables(null)).toBe(false);
  });
});

describe("base tokens", () => {
  const styles = readFileSync(fileURLToPath(new URL("../../src/styles.css", import.meta.url)), "utf8");

  it("are all declared on :root in styles.css and documented once", () => {
    const names = BASE_TOKENS.map((token) => token.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(styles, name).toMatch(new RegExp(`^\\s*${name}:`, "m"));
    for (const token of BASE_TOKENS) {
      expect(token.purpose.length, token.name).toBeGreaterThan(10);
      expect(token.derives.length, token.name).toBeGreaterThan(3);
    }
  });

  it("lists an override per mode", () => {
    expect(overridesOf({ light: { "--a": "1" }, dark: { "--a": "2" } }, "--a")).toEqual([
      { mode: "light", value: "1" },
      { mode: "dark", value: "2" },
    ]);
    expect(overridesOf(emptyVariables(), "--a")).toEqual([]);
  });
});
