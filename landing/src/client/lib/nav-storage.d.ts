// Types for the plain-JS module next to it, so its tests can import it.
export type PerfLike = {
  getEntriesByType?: (type: string) => ReadonlyArray<{ type?: string }>;
  navigation?: { type: number };
};
export type StorageLike = Pick<Storage, "length" | "key" | "removeItem">;

export const PREFIX: string;
export function isReload(perf?: PerfLike): boolean;
export function clearOnReload(env?: { storage?: StorageLike; perf?: PerfLike; scope?: Record<string, unknown> }): void;
export function navGet(key: string): string | null;
export function navSet(key: string, value: string): void;
export function navRemove(key: string): void;
