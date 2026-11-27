// Types for the plain-JS module next to it, so the tests can import it.
export type Rgba = { r: number; g: number; b: number; a: number };

export function parseRgb(text: string): Rgba | null;
export function blend(top: Rgba, bottom: Rgba): Rgba;
export function luminance(color: Rgba): number;
export function contrastRatio(a: Rgba, b: Rgba): number;
