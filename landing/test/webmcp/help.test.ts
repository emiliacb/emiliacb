import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { SKILLS } from "../../src/webmcp/client/skills/index.js";
import { helpTools } from "../../src/webmcp/client/tools/help.js";
import { enabledTools } from "../../src/webmcp/client/tools/index.js";
import { SONG_NOTES } from "../../src/client/lib/tree-voice.js";
import type { JsonSchema } from "../../src/webmcp/client/tools/index.js";

/** Claude cuts a tool's description at about 900 characters: past this, the end is lost. */
const MAX_DESCRIPTION = 700;
const MAX_PLAY_DESCRIPTION = 500;
const MAX_PROPERTY_DESCRIPTION = 200;

function propertyDescriptions(schema: JsonSchema | undefined, path: string): [string, string][] {
  if (!schema) return [];
  const own: [string, string][] = schema.description ? [[path, schema.description]] : [];
  const children = [
    ...Object.entries(schema.properties ?? {}).map(([key, child]) => [`${path}.${key}`, child] as const),
    ...(schema.anyOf ?? []).map((child, i) => [`${path}|${i}`, child] as const),
    ...(schema.items ? ([[`${path}[]`, schema.items]] as const) : []),
  ];
  return [...own, ...children.flatMap(([childPath, child]) => propertyDescriptions(child, childPath))];
}

describe("tool descriptions", () => {
  it(`are at most ${MAX_DESCRIPTION} characters, composed strings (scope, checks, hints) included`, () => {
    for (const tool of enabledTools) expect(tool.description.length, tool.name).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it(`keep the play tools to ${MAX_PLAY_DESCRIPTION} and point at the skill`, () => {
    for (const name of ["play_tree_song", "play_song"]) {
      const tool = enabledTools.find((candidate) => candidate.name === name);
      expect(tool?.description.length, name).toBeLessThanOrEqual(MAX_PLAY_DESCRIPTION);
      expect(tool?.description, name).toContain("`composing-song`");
    }
  });

  it(`keep every input property to ${MAX_PROPERTY_DESCRIPTION} characters`, () => {
    for (const tool of enabledTools) {
      for (const [path, text] of propertyDescriptions(tool.inputSchema, tool.name)) {
        expect(text.length, path).toBeLessThanOrEqual(MAX_PROPERTY_DESCRIPTION);
      }
    }
  });

  it("name get_tool_help wherever a tool has a longer help", () => {
    const withHelp = enabledTools.filter((tool) => tool.help !== undefined);
    expect(withHelp.length).toBeGreaterThan(5);
    for (const tool of withHelp) expect(tool.description, tool.name).toContain("get_tool_help");
  });
});

describe("get_tool_help", () => {
  const [help] = helpTools;

  it("returns a tool's help and input schema, or its description when it has no help", async () => {
    const play = (await help.execute({ name: "play_tree_song" })).content[0].text;
    expect(play).toContain("Hijaz");
    expect(play).toContain("## Input schema");
    expect(play).toContain('"notes"');
    const plain = (await help.execute({ name: "reset_css" })).content[0].text;
    expect(plain).toContain("Removes everything applied");
    expect(plain).toContain("## Input schema");
  });

  it("names the tools when the name is wrong", async () => {
    await expect(Promise.resolve().then(() => help.execute({ name: "nope" }))).rejects.toThrow(/play_tree_song/);
  });
});

describe("the composing-song skill", () => {
  const skill = SKILLS.find((candidate) => candidate.name === "composing-song");

  it("names every note a song may write, so it cannot drift from the tree", () => {
    expect(skill).toBeDefined();
    for (const note of SONG_NOTES) expect(skill?.markdown, note.name).toContain(note.name);
  });

  it("is read from disk at the path the build publishes", () => {
    const file = fileURLToPath(new URL("../../src/webmcp/skills/composing-song/SKILL.md", import.meta.url));
    expect(readFileSync(file, "utf8")).toBe(skill?.markdown);
  });
});

describe("the skill gate", () => {
  /** Fresh modules, so no skill counts as read. */
  async function fresh() {
    vi.resetModules();
    const gate = await import("../../src/webmcp/client/core/skill-gate.js");
    const skills = await import("../../src/webmcp/client/tools/skills.js");
    const css = await import("../../src/webmcp/client/tools/css.js");
    const song = await import("../../src/webmcp/client/tools/tree-song.js");
    const store = await import("../../src/webmcp/client/skills/store.js");
    store.setSkills(SKILLS);
    return { gate, skills, css, song };
  }

  it("refuses until the skill's SKILL.md was read, then lets it through", async () => {
    const { gate } = await fresh();
    expect(() => gate.requireSkill("modifying-page")).toThrow(/read_skill\(\{ name: "modifying-page" \}\)/);
    gate.markSkillRead("modifying-page");
    expect(() => gate.requireSkill("modifying-page")).not.toThrow();
    expect(() => gate.requireSkill("composing-song")).toThrow(/composing-song/);
  });

  it("is lifted by read_skill on SKILL.md, not by another file of the skill", async () => {
    const { gate, skills } = await fresh();
    const read = skills.skillsTools[1];
    await read.execute({ name: "modifying-page", file: "regions.md" });
    expect(gate.wasSkillRead("modifying-page")).toBe(false);
    await read.execute({ name: "modifying-page" });
    expect(gate.wasSkillRead("modifying-page")).toBe(true);
  });

  it("stops set_css, set_css_by_selector, set_variables and both play tools first, before any validation", async () => {
    const { css, song } = await fresh();
    const variables = await import("../../src/webmcp/client/tools/variables.js");
    const gated = [
      ...css.cssTools.filter((tool) => ["set_css", "set_css_by_selector"].includes(tool.name)),
      ...variables.variableTools.filter((tool) => tool.name === "set_variables"),
      ...song.treeSongTools.filter((tool) => ["play_tree_song", "play_song"].includes(tool.name)),
    ];
    expect(gated.map((tool) => tool.name).toSorted((a, b) => a.localeCompare(b))).toEqual(["play_song", "play_tree_song", "set_css", "set_css_by_selector", "set_variables"]);
    await Promise.all(
      gated.map((tool) => expect(Promise.resolve().then(() => tool.execute({}))).rejects.toThrow(/Read the skill first/)),
    );
  });

  it("is listed by list_skills, and each gated tool says so in its description", async () => {
    const { skills } = await fresh();
    const listed = z.array(z.object({ name: z.string(), requiredBy: z.array(z.string()) })).parse(JSON.parse((await skills.skillsTools[0].execute({})).content[0].text));
    for (const skill of listed) {
      for (const tool of skill.requiredBy) {
        const description = enabledTools.find((candidate) => candidate.name === tool)?.description;
        expect(description, tool).toContain(`\`${skill.name}\``);
      }
    }
    expect(listed.find((skill) => skill.name === "modifying-page")?.requiredBy).toContain("set_css");
  });
});
