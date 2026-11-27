import { describe, expect, it } from "vitest";

import { mostCommon, overlap, parseFilter, transformScale } from "../../src/webmcp/client/css/measure.js";
import { scanCss } from "../../src/webmcp/client/css/scan.js";

describe("parseFilter", () => {
  it("reads the blur, and multiplies opacity() and brightness()", () => {
    expect(parseFilter("blur(40px)")).toEqual({ blur: 40, opacity: 1, brightness: 1 });
    expect(parseFilter("opacity(50%) blur(2px) opacity(0.5) brightness(0)")).toEqual({ blur: 2, opacity: 0.25, brightness: 0 });
  });

  it("ignores filters that do not hide anything and the keyword none", () => {
    expect(parseFilter("none")).toEqual({ blur: 0, opacity: 1, brightness: 1 });
    expect(parseFilter("drop-shadow(rgb(0, 0, 0) 0px 0px 4px) grayscale(1)")).toEqual({ blur: 0, opacity: 1, brightness: 1 });
  });
});

describe("transformScale", () => {
  it("is 1 for none and for moves and rotations", () => {
    expect(transformScale("none")).toBe(1);
    expect(transformScale("matrix(1, 0, 0, 1, 40, 10)")).toBe(1);
    expect(transformScale("matrix(0, 1, -1, 0, 0, 0)")).toBe(1);
  });

  it("takes the smaller axis of a scale, in 2D and 3D matrices and in the scale property", () => {
    expect(transformScale("matrix(0.01, 0, 0, 0.01, 0, 0)")).toBeCloseTo(0.01);
    expect(transformScale("matrix(2, 0, 0, 0.5, 0, 0)")).toBeCloseTo(0.5);
    expect(transformScale("matrix3d(0.2,0,0,0,0,0.4,0,0,0,0,1,0,0,0,0,1)")).toBeCloseTo(0.2);
    expect(transformScale("none", "0.1 0.5")).toBeCloseTo(0.1);
    expect(transformScale("none", "0.3")).toBeCloseTo(0.3);
  });
});

describe("overlap and mostCommon", () => {
  it("measures what two boxes share", () => {
    const box = { left: 0, top: 0, right: 100, bottom: 50 };
    expect(overlap({ left: 80, top: 10, right: 200, bottom: 20 }, box)).toEqual({ width: 20, height: 10 });
    expect(overlap({ left: -500, top: 0, right: -400, bottom: 50 }, box)).toEqual({ width: 0, height: 50 });
  });

  it("finds the commonest entry", () => {
    expect(mostCommon(["a", "b", "b"])).toEqual(["b", 2]);
    expect(mostCommon([])).toBeNull();
  });
});

describe("scanCss", () => {
  it("lists the rules, at-rule blocks and statements", () => {
    const scan = scanCss("@layer a, b; h1 { color: red } @media (min-width: 1px) { p { color: blue } } /* x { */ p { margin: 0 }");
    expect(scan.rules.map((rule) => rule.prelude)).toEqual(["@layer a, b", "h1", "@media (min-width: 1px)", "p"]);
    expect(scan.unclosed).toEqual([]);
    expect(scan.extraClosers).toBe(0);
  });

  it("finds a block that is never closed", () => {
    expect(scanCss("h1{").unclosed).toEqual(["h1"]);
    expect(scanCss("p { color: red } h1 { color: blue; ").unclosed).toEqual(["h1"]);
  });

  it("finds @import, stray text and a } that closes nothing", () => {
    const scan = scanCss('@import url("a;b.css"); color: red; h1 { x: y } }');
    expect(scan.imports).toEqual(['@import url("a;b.css")']);
    expect(scan.stray).toEqual(["color: red"]);
    expect(scan.extraClosers).toBe(1);
  });

  it("is not fooled by braces and semicolons in strings", () => {
    const scan = scanCss('a::after { content: "}{;" } b { color: red }');
    expect(scan.rules).toHaveLength(2);
    expect(scan.unclosed).toEqual([]);
    expect(scan.stray).toEqual([]);
  });
});
