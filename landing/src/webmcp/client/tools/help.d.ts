import type { ToolSpec } from "./index.js";
import type { ToolResult } from "./skills.js";

export const helpTools: readonly (ToolSpec & { execute(input: unknown): Promise<ToolResult> })[];
