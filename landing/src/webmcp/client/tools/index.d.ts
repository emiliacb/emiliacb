// Types for the plain-JS module next to it, so the build (and its tests) can read the catalog.
export type ToolSpec = {
  name: string;
  /** One line for the tool list in llms.txt. */
  summary: string;
  title: string;
  description: string;
};

export const enabledTools: readonly ToolSpec[];
