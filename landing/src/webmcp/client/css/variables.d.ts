// Types for the plain-JS module next to it, so the tests can import it.
export type VariableEntry = [name: string, value: string | null];
export type Variables = { light: Record<string, string>; dark: Record<string, string> };
export type Supports = (property: string, value: string) => boolean;

export const MODES: string[];
export function emptyVariables(): Variables;
export function hasVariables(variables: Variables): boolean;
export function isVariables(value: unknown): boolean;
export function parseVariables(input: unknown): VariableEntry[];
export function literalProblem(value: string): string | null;
export function kindOf(current: string, supports: Supports): "colour" | "channels" | "number" | "length" | "any";
export function kindProblem(kind: string, value: string, supports: Supports): string | null;
export function mergeVariables(variables: Variables, entries: VariableEntry[], mode: string): Variables;
export function variablesToCss(variables: Variables): string;
