import { describe, expect, it } from "vitest";

import { PAGES, type PageId, pagePath } from "../../src/shared/site";

describe("pagePath", () => {
  it("returns the path of every page in PAGES", () => {
    for (const page of PAGES) expect(pagePath(page.id)).toBe(page.path);
  });

  it("throws on an id missing from PAGES", () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- simulates a stale id
    expect(() => pagePath("missing" as PageId)).toThrow(/missing/);
  });
});
