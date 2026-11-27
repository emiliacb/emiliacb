// What every WebMCP tool returns, and how it fails. A tool resolves with
// ok(...) or rejects with fail(...): the message of a rejection is the only
// thing the agent sees, so it must say what happened and what to try next.

/** A failure the tool meant to report: its message goes to the agent as written. */
export class ToolError extends Error {
  constructor(message) {
    super(message);
    this.name = "ToolError";
  }
}

/**
 * The spec's tool result: a list of content parts. Text goes as is; anything
 * else becomes indented JSON, which agents read better than one long line.
 */
export function ok(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text }] };
}

/** An error for the agent. Throw it (or reject with it) from a tool's execute. */
export function fail(message) {
  return new ToolError(message);
}

/**
 * Turns anything a tool threw into the Error the agent receives. Our own
 * ToolErrors pass through; a bug in a tool must not leak a stack trace or
 * break the page, so it becomes a plain message with a next step.
 */
export function cleanError(toolName, error) {
  if (error instanceof ToolError) return error;
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(
    `The tool "${toolName}" failed unexpectedly (${detail}). The page keeps working. ` +
      "Check the input against the tool's inputSchema and try again.",
  );
}
