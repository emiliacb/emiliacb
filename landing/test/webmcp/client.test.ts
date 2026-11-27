import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { blend, contrastRatio, parseRgb } from "../../src/webmcp/client/css/contrast.js";
import { markSkillRead } from "../../src/webmcp/client/core/skill-gate.js";
import { enabledTools } from "../../src/webmcp/client/tools/index.js";
import { treeSongTools } from "../../src/webmcp/client/tools/tree-song.js";
import {
  mergeRule,
  parseDeclarations,
  rulesToCss,
  splitDeclarations,
} from "../../src/webmcp/client/css/declarations.js";

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

describe("enabledTools", () => {
  it("defines every tool completely, with a unique name", () => {
    const names = enabledTools.map((tool) => tool.name);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of enabledTools) {
      expect(tool.name, tool.name).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(tool.summary, tool.name).not.toBe("");
      expect(tool.title, tool.name).not.toBe("");
      expect(tool.description, tool.name).not.toBe("");
    }
  });
});

describe("play_tree_song without audio", () => {
  const play = treeSongTools[0];
  const song = { notes: "D4/4" };

  /** A tree whose sound stands at `status`, the window at `place`; play must not be reached unless it is "running". */
  function withTree(lang: string, status: string, place: { x: string; y: string } | null = { x: "right", y: "bottom" }) {
    const played: unknown[] = [];
    Object.assign(globalThis, {
      document: { documentElement: { lang } },
      window: {
        siteTreeSound: {
          unlock: () => Promise.resolve(status),
          place: () => place,
          state: () => ({ wanted: status !== "off" }),
          play: (input: unknown) => {
            played.push(input);
            return { steps: 1, bpm: 120, durationMs: 500, effects: [] };
          },
        },
      },
    });
    return played;
  }

  // The gate is tested in skill-gate.test.ts; here the skill has been read.
  beforeEach(() => {
    markSkillRead("composing-song");
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "document");
    Reflect.deleteProperty(globalThis, "window");
  });

  it("rejects in the page's language, naming the button and where the window is, and plays nothing", async () => {
    const played = withTree("es", "window");
    await expect(play.execute(song)).rejects.toThrow(/^Para escuchar al árbol, hacé clic en "Permitir" en la ventana del árbol \(abajo a la derecha\) y avisame\./);
    withTree("en", "window", { x: "center", y: "bottom" });
    await expect(play.execute(song)).rejects.toThrow(/^To hear the tree, click "Allow" in the tree's window \(at the bottom\) and let me know\./);
    expect(played).toEqual([]);
  });

  it("tells a sound the visitor turned off or ignored apart, and says only they can bring it back", async () => {
    withTree("es", "off");
    await expect(play.execute(song)).rejects.toThrow(/^Apagaste el sonido del árbol.*parlante.*Only the visitor/s);
    withTree("en", "ignored");
    await expect(play.execute(song)).rejects.toThrow(/^You chose "Ignore" in the tree's window.*speaker button/s);
  });

  it("never reports success when the sound stops between the check and the song", async () => {
    withTree("en", "running");
    Object.assign(window, {
      siteTreeSound: {
        unlock: () => Promise.resolve("running"),
        place: () => null,
        state: () => ({ wanted: true }),
        play: () => {
          throw new Error("The tree's sound is not running.");
        },
      },
    });
    await expect(play.execute(song)).rejects.toThrow(/^To hear the tree, click or tap anywhere/);
  });

  it("plays when the sound is running", async () => {
    const played = withTree("en", "running");
    await play.execute(song);
    expect(played).toEqual([song]);
  });
});
