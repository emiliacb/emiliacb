// Types for the plain-JS module next to it, so the tests can import it.
import type { Variables } from "./variables.js";

export type CssState = { css: string; rules: Record<string, Record<string, string>>; variables: Variables };

export function emptyState(): CssState;
export function isEmptyState(state: CssState): boolean;
export function renderCss(state: CssState): string;
