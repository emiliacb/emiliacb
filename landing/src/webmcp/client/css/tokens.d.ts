// Types for the plain-JS module next to it, so the tests can import it.
export const BASE_TOKENS: { name: string; purpose: string; derives: string }[];
export function overridesOf(
  variables: { light: Record<string, string>; dark: Record<string, string> },
  name: string,
): { mode: "light" | "dark"; value: string }[];
