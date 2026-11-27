// Types for the plain-JS module next to it, so the build (and its tests) can read the catalog.
export type JsonSchema = {
  type?: string | string[];
  description?: string;
  enum?: readonly unknown[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  anyOf?: readonly JsonSchema[];
  minimum?: number;
  maximum?: number;
  additionalProperties?: boolean | JsonSchema;
};

export type ToolSpec = {
  name: string;
  /** One line for the tool list in llms.txt. */
  summary: string;
  title: string;
  description: string;
  /** The full explanation in Markdown, for tools whose description would be too long; get_tool_help returns it. */
  help?: string;
  inputSchema: JsonSchema;
};

export type ToolGroup = {
  /** The key of the group's title and blurb in src/webmcp/site/docs/copy.ts. */
  id: string;
  tools: readonly ToolSpec[];
};

export const toolGroups: readonly ToolGroup[];
export const enabledTools: readonly ToolSpec[];
