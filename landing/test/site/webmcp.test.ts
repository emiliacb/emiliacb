import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { type Lang } from "../../src/shared/lang";
import { dictionaries } from "../../src/shared/i18n";
import { loadContent } from "../../src/site/content";
import type { RenderCtx } from "../../src/site/context";
import { renderLlmsTxt } from "../../src/site/markdown";
import { blend, contrastRatio, parseRgb } from "../../src/client/webmcp/contrast.js";
import {
  mergeRule,
  parseDeclarations,
  rulesToCss,
  splitDeclarations,
} from "../../src/client/webmcp/declarations.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

describe("parseDeclarations", () => {
  it("reads a declaration string and an object the same way", () => {
    const fromString = parseDeclarations("color: red; Font-Size: 2rem;");
    expect(fromString).toEqual([
      ["color", "red"],
      ["font-size", "2rem"],
    ]);
    expect(parseDeclarations({ color: "red", "font-size": "2rem" })).toEqual(fromString);
  });

  it("keeps semicolons inside strings and parentheses", () => {
    expect(splitDeclarations('content: "a;b"; background: url(data:image/png;base64,xx)')).toHaveLength(2);
  });

  it("turns empty and null values into removals, keeps custom property case", () => {
    expect(parseDeclarations({ color: null, margin: "", "--Tok": 4 })).toEqual([
      ["color", null],
      ["margin", null],
      ["--Tok", "4"],
    ]);
    expect(parseDeclarations("color:")).toEqual([["color", null]]);
  });

  it("rejects braces, unbalanced input and non-declarations", () => {
    expect(() => parseDeclarations("color: red } body { display: none")).toThrow(/braces/);
    expect(() => parseDeclarations('content: "x')).toThrow(/quote/);
    expect(() => parseDeclarations("width: calc(1px")).toThrow(/unbalanced/);
    expect(() => parseDeclarations("just words")).toThrow(/property: value/);
    expect(() => parseDeclarations(["color"])).toThrow(/object or a CSS/);
  });
});

describe("mergeRule", () => {
  it("adds !important by default, merges, removes, and never mutates its input", () => {
    const empty = {};
    const a = mergeRule(empty, "h1", parseDeclarations("color: red; margin: 0 !important"), true);
    expect(empty).toEqual({});
    expect(a).toEqual({ h1: { color: "red !important", margin: "0 !important" } });

    const b = mergeRule(a, "h1", parseDeclarations({ color: "blue", margin: null }), false);
    expect(b).toEqual({ h1: { color: "blue" } });

    expect(mergeRule(b, "h1", parseDeclarations({ color: null }), true)).toEqual({});
    expect(mergeRule(a, "h1", [], true)).toEqual({});
  });

  it("prints the rules as a stylesheet", () => {
    expect(rulesToCss({ h1: { color: "red !important" } })).toBe("h1 {\n  color: red !important;\n}");
  });
});

describe("contrast", () => {
  it("parses rgb notations", () => {
    expect(parseRgb("rgb(1, 2, 3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseRgb("rgba(0 0 0 / 0.5)")).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(parseRgb("oklch(0.5 0.1 200)")).toBeNull();
  });

  it("measures black on white as 21 and identical colors as 1", () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 255, g: 255, b: 255, a: 1 };
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBe(1);
  });

  it("blends translucent text over its background", () => {
    const mixed = blend({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255, a: 1 });
    expect(mixed.r).toBeCloseTo(127.5, 5);
    expect(mixed.a).toBe(1);
  });
});

describe("llms.txt WebMCP section", () => {
  it("lists every tool the client registers", async () => {
    const content = await loadContent(root);
    const assets = { script: () => "/x.js", css: "/x.css", buildId: "test" };
    const ctxFor = (lang: Lang): RenderCtx => ({ lang, t: dictionaries[lang], assets, content });
    const txt = renderLlmsTxt(ctxFor);

    const dir = `${root}/src/client/webmcp`;
    const names: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith("-tools.js"))) {
      const source = readFileSync(`${dir}/${file}`, "utf8");
      for (const match of source.matchAll(/^\s+name: "([a-z_]+)",$/gm)) names.push(match[1]);
    }
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(txt, name).toContain(`\`${name}\``);
    expect(txt).toContain("document.modelContext.getTools()");
    expect(txt).not.toContain("](/");
  });
});
