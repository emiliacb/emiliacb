// The page's WebMCP ModelContext, and the one way tools get registered.
import { ToolError, cleanError } from "./result.js";

/**
 * The part of the spec's ModelContext an agent calling from JavaScript needs:
 * registerTool, getTools, and executeTool (by name, or by an entry of getTools),
 * which like the spec's resolves to the result serialized as JSON.
 */
function createModelContext() {
  const tools = new Map();
  return {
    polyfill: true,
    registerTool(definition) {
      tools.set(definition.name, definition);
      return Promise.resolve();
    },
    getTools() {
      return Promise.resolve(
        Array.from(tools.values(), (t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: t.annotations,
        })),
      );
    },
    executeTool(nameOrTool, input) {
      const name = typeof nameOrTool === "string" ? nameOrTool : nameOrTool?.name;
      const found = tools.get(name);
      if (!found) return Promise.reject(new Error(`No tool named ${name}. See getTools().`));
      return Promise.resolve(found.execute(input ?? {}, {})).then((result) => JSON.stringify(result));
    },
  };
}

/**
 * The spec puts it on document; Chrome's first builds had it on navigator.
 * Without either (every browser without the WebMCP flag, today) the page brings
 * its own, so an agent that can run JavaScript in the tab (Claude in Chrome,
 * for one) still finds the tools and calls them. llms.txt tells it how.
 */
export function getModelContext() {
  const native = document.modelContext || navigator.modelContext;
  if (native && typeof native.registerTool === "function") return native;
  const polyfill = createModelContext();
  Object.defineProperty(document, "modelContext", { value: polyfill, configurable: true });
  Object.defineProperty(navigator, "modelContext", { value: polyfill, configurable: true });
  return polyfill;
}

/**
 * Wraps execute so nothing a tool does can break the page or reach the agent
 * as an unhandled exception: sync throws and rejections both end as one clean
 * rejection. A ToolError is the tool reporting a failure it expected (bad input, a
 * change rolled back): the agent gets it and nothing is logged, or every rejected
 * change would be a console warning on the visitor's page. Anything else is a bug,
 * and its real error goes to the console for whoever is debugging.
 */
function guard(tool) {
  return {
    ...tool,
    execute(input, client) {
      return new Promise((resolve) => resolve(tool.execute(input ?? {}, client))).catch((error) => {
        if (!(error instanceof ToolError)) console.warn(`[webmcp] ${tool.name} failed:`, error);
        throw cleanError(tool.name, error);
      });
    },
  };
}

/** Registers every tool, each on its own: one the browser refuses does not stop the rest. */
export function registerTools(tools) {
  const modelContext = getModelContext();
  for (const tool of tools) {
    // The spec's registerTool returns a promise; Chrome's first builds returned
    // nothing or threw synchronously. Promise.resolve().then covers all three.
    Promise.resolve()
      .then(() => modelContext.registerTool(guard(tool)))
      .catch((error) => console.warn(`[webmcp] Could not register ${tool.name}:`, error));
  }
}
