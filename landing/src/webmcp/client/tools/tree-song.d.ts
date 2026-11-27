import type { ToolSpec } from "./index.js";
import type { ToolResult } from "./skills.js";

export const treeSongTools: readonly (ToolSpec & { execute(input: unknown): Promise<ToolResult> })[];
