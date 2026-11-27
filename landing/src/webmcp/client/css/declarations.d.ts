// Types for the plain-JS module next to it, so the tests can import it.
export type DeclarationEntry = [property: string, value: string | null];
export type Rules = Record<string, Record<string, string>>;

export function splitDeclarations(text: string): string[];
export function parseDeclarations(input: unknown): DeclarationEntry[];
export function splitImportant(value: string): { value: string; important: boolean };
export function mergeRule(rules: Rules, selector: string, entries: DeclarationEntry[], important: boolean): Rules;
export function rulesToCss(rules: Rules): string;
