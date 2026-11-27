import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The dark values of the design tokens are written twice in styles.css (the
 * stylesheet cannot share a declaration list between a media query and an
 * attribute selector): under the system's dark mode unless light is forced,
 * and under <html data-theme="dark">. This keeps the two lists identical, and
 * keeps the media query from creeping back into the rest of the stylesheet,
 * where it would ignore the override.
 */
const css = readFileSync(fileURLToPath(new URL("../../src/styles.css", import.meta.url)), "utf8");

function declarationsOf(opening: string): string[] {
  const start = css.indexOf(opening);
  expect(start, `${opening} is in styles.css`).toBeGreaterThan(-1);
  const end = css.indexOf("}", start);
  return css
    .slice(start + opening.length, end)
    .split(";")
    .map((d) => d.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

describe("theme tokens", () => {
  it("defines the same dark values for the media query and for the attribute", () => {
    const media = declarationsOf('@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {');
    const attribute = declarationsOf(':root[data-theme="dark"] {');
    expect(media.length).toBeGreaterThan(10);
    expect(media).toEqual(attribute);
  });

  it("gives the tree and its window colours of their own in dark, instead of inverting the light ones", () => {
    const light = declarationsOf(":root {");
    const dark = declarationsOf(':root[data-theme="dark"] {');
    const valueOf = (list: string[], name: string) => list.find((d) => d.startsWith(`${name}:`));
    for (const name of ["--tree-grad-a", "--tree-grad-b"]) {
      expect(valueOf(dark, name), `${name} is set for dark`).toBeDefined();
      expect(valueOf(dark, name)).not.toEqual(valueOf(light, name));
    }
    // The flip it replaces: no filter and no token is left to turn the tree over.
    expect(css).not.toMatch(/--tree-invert|invert\(/);
  });

  it("derives the text on the accent, the ink and the strong ground, in one place for both modes", () => {
    const dark = declarationsOf(':root[data-theme="dark"] {');
    for (const name of ["--color-on-accent", "--color-on-ink", "--color-on-strong"]) {
      expect(css, `${name} is read from its ground`).toMatch(new RegExp(`${name}: oklch\\(from var\\(--color-(accent|ink|strong)\\)`));
      expect(
        dark.some((d) => d.startsWith(`${name}:`)),
        `${name} is not written again for dark`,
      ).toBe(false);
    }
  });

  it("has no other prefers-color-scheme rule: the override would not reach it", () => {
    const uses = css.match(/prefers-color-scheme/g) ?? [];
    // The dark token block's own media query, and the one in the comment on it.
    expect(uses.length).toBeLessThanOrEqual(2);
  });
});
