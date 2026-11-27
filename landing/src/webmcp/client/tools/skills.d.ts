import type { ToolSpec } from "./index.js";

/** What a tool's execute resolves with: the spec's list of content parts. */
export type ToolResult = { content: { type: "text"; text: string }[] };

export const skillsTools: readonly (ToolSpec & { execute(input: unknown): Promise<ToolResult> })[];
