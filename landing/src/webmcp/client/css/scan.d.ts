// Types for the plain-JS module next to it, so the tests can import it.
export type ScannedRule = { prelude: string; block: boolean };
export type Scan = {
  rules: ScannedRule[];
  imports: string[];
  stray: string[];
  unclosed: string[];
  extraClosers: number;
};

export function scanCss(css: string): Scan;
