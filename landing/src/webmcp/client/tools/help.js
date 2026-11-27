// The one tool that explains the others. A tool's description is cut by the
// agent's client at about 900 characters, so the long ones keep to the basics
// and put the rest in their `help` (Markdown); this returns it on demand, with
// the input schema, for any tool (its description when it has no `help`).
import { fail, ok } from "../core/result.js";

/** Every enabled tool, handed over by tools/index.js (which imports this file, so it cannot be imported back). */
let catalog = [];

export function provideTools(tools) {
  catalog = tools;
}

const getToolHelp = {
  name: "get_tool_help",
  summary: "the full explanation and input schema of one tool",
  title: "Get a tool's full help",
  description:
    "Returns the full explanation of one tool, in Markdown, with its input schema. Tool descriptions are cut " +
    "short, so call this when one says \"Full details: get_tool_help\" or you need a parameter's exact format. " +
    "Input: `name`, one of the tool names. Reading it changes nothing.",
  inputSchema: {
    type: "object",
    properties: { name: { type: "string", description: 'The tool\'s name, e.g. "play_tree_song".' } },
    required: ["name"],
  },
  annotations: { readOnlyHint: true },
  execute(input) {
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    const tool = catalog.find((candidate) => candidate.name === name);
    if (!tool) {
      const known = catalog.map((candidate) => candidate.name).join(", ");
      throw fail(`There is no tool named "${name}". The tools are: ${known}.`);
    }
    const text = tool.help ?? `# ${tool.name}\n\n${tool.description}`;
    return Promise.resolve(ok(`${text}\n\n## Input schema\n\n\`\`\`json\n${JSON.stringify(tool.inputSchema, null, 2)}\n\`\`\``));
  },
};

export const helpTools = [getToolHelp];
