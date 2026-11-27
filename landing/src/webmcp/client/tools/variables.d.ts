import type { ToolSpec } from "./index.js";
import type { ToolResult } from "./skills.js";

export const variableTools: readonly (ToolSpec & { execute(input: unknown): Promise<ToolResult> })[];
