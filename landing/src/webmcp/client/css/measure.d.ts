// Types for the plain-JS module next to it, so the tests can import it.
export type Box = { left: number; top: number; right: number; bottom: number };

export function parseFilter(text: string): { blur: number; opacity: number; brightness: number };
export function transformScale(transform: string, scale?: string): number;
export function overlap(a: Box, b: Box): { width: number; height: number };
export function mostCommon<T>(items: T[]): [T, number] | null;
