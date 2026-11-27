// Fixture for test/site/oxlint.test.ts: each block below is a shortcut the
// lint config must reject. Ignored by `npm run lint`; linted only by that test.

export function explicitAny(value: any): unknown {
  return value;
}

export function nonNull(map: Map<string, string>): string {
  return map.get("key")!;
}

export function narrowingCast(value: unknown): string {
  return value as string;
}

// @ts-ignore
export const ignored: number = 1;

export function floating(): void {
  Promise.resolve(1);
}

export function looseEquality(a: unknown): boolean {
  return a == 1;
}

export function nestedTernary(n: number): string {
  return n > 1 ? "many" : n === 1 ? "one" : "none";
}

export function tooManyParams(a: number, b: number, c: number, d: number, e: number): number {
  return a + b + c + d + e;
}

export function tooDeep(a: boolean, b: boolean, c: boolean, d: boolean): number {
  if (a) {
    if (b) {
      if (c) {
        if (d) return 1;
      }
    }
  }
  return 0;
}

export function tooComplex(n: number): number {
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  if (n === 4) return 4;
  if (n === 5) return 5;
  if (n === 6) return 6;
  if (n === 7) return 7;
  if (n === 8) return 8;
  if (n === 9) return 9;
  if (n === 10) return 10;
  return 0;
}

export function swallowed(): void {
  try {
    JSON.parse("{");
  } catch {}
}
