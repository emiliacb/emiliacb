import { describe, expect, it } from "vitest";

import { clearOnReload, isReload, PREFIX } from "../../src/client/lib/nav-storage.js";

/** A `performance` stub whose navigation entry has the given type. */
function perfOf(type: string) {
  return { getEntriesByType: (name: string) => (name === "navigation" ? [{ type }] : []) };
}

/** The part of Storage the helper uses, backed by a Map. */
function memoryStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (key: string) => void map.delete(key),
  };
}

describe("isReload", () => {
  it("is true only for a navigation entry of type reload", () => {
    expect(isReload(perfOf("reload"))).toBe(true);
    expect(isReload(perfOf("navigate"))).toBe(false);
    expect(isReload(perfOf("back_forward"))).toBe(false);
    expect(isReload(perfOf("prerender"))).toBe(false);
  });

  it("falls back to performance.navigation when there is no entry", () => {
    expect(isReload({ getEntriesByType: () => [], navigation: { type: 1 } })).toBe(true);
    expect(isReload({ getEntriesByType: () => [], navigation: { type: 2 } })).toBe(false);
    expect(isReload({})).toBe(false);
  });

  it("trusts the entry over the legacy field", () => {
    expect(isReload({ ...perfOf("navigate"), navigation: { type: 1 } })).toBe(false);
  });

  it("is false when performance is missing or throws", () => {
    expect(
      isReload({
        getEntriesByType: () => {
          throw new Error("blocked");
        },
      }),
    ).toBe(false);
    expect(isReload({ getEntriesByType: undefined })).toBe(false);
  });
});

describe("clearOnReload", () => {
  const entries = { [`${PREFIX}webmcp:css`]: "{}", [`${PREFIX}theme`]: "dark", unrelated: "keep" };

  it("empties only the prefixed keys when the load was a reload", () => {
    const storage = memoryStorage(entries);
    clearOnReload({ storage, perf: perfOf("reload"), scope: {} });
    expect(Array.from(storage.map.keys())).toEqual(["unrelated"]);
  });

  it.each(["navigate", "back_forward"])("keeps everything on %s", (type) => {
    const storage = memoryStorage(entries);
    clearOnReload({ storage, perf: perfOf(type), scope: {} });
    expect(storage.map.size).toBe(3);
  });

  it("clears once per document, so what is written afterwards stays", () => {
    const storage = memoryStorage(entries);
    const scope = {};
    clearOnReload({ storage, perf: perfOf("reload"), scope });
    storage.map.set(`${PREFIX}theme`, "light");
    clearOnReload({ storage, perf: perfOf("reload"), scope });
    expect(storage.map.get(`${PREFIX}theme`)).toBe("light");
  });
});
