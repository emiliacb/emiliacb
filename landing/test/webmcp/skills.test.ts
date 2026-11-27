import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { Lang } from "../../src/shared/lang";
import { dictionaries } from "../../src/shared/i18n";
import { loadContent } from "../../src/site/content";
import type { RenderCtx } from "../../src/site/context";
import { renderLlmsTxt } from "../../src/site/markdown";
import { SKILLS } from "../../src/webmcp/client/skills/index.js";
import { parseSkill } from "../../src/webmcp/client/skills/parse.js";
import { setSkills } from "../../src/webmcp/client/skills/store.js";
import { enabledTools } from "../../src/webmcp/client/tools/index.js";
import { skillsTools } from "../../src/webmcp/client/tools/skills.js";
import { renderBuildFiles } from "../../src/webmcp/site";
import { readSkills, renderSkillFiles } from "../../src/webmcp/site/skills";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function setup() {
  const content = await loadContent(root);
  const assets = { script: (name: string) => `/assets/${name}.js`, css: "/x.css", buildId: "test" };
  const ctxFor = (lang: Lang): RenderCtx => ({ lang, t: dictionaries[lang], assets, content });
  return { ctxFor };
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

describe("skills", () => {
  const onDisk = readSkills();

  it("has the two skills, each named for its folder, with a triggering description", () => {
    expect(onDisk.map((skill) => skill.name)).toEqual(["answering-questions", "modifying-page"]);
    for (const skill of onDisk) {
      expect(skill.name, skill.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(skill.description, skill.name).toMatch(/^Use when/);
      expect(skill.description.length, skill.name).toBeLessThan(400);
      expect(words(skill.body), `${skill.name} is a short skill`).toBeLessThan(500);
    }
  });

  it("parses frontmatter, and refuses a file without it", () => {
    expect(parseSkill('---\nname: x\ndescription: "Use when y: z"\n---\n# X\n')).toMatchObject({
      name: "x",
      description: "Use when y: z",
      body: "# X\n",
    });
    expect(() => parseSkill("# no frontmatter")).toThrow(/frontmatter/);
    expect(() => parseSkill("---\nname: x\n---\n")).toThrow(/name and a description/);
  });

  it("is bundled into the client exactly as it is on disk", () => {
    expect(SKILLS.map((skill) => skill.name)).toEqual(onDisk.map((skill) => skill.name));
    for (const skill of onDisk) {
      const bundled = SKILLS.find((candidate) => candidate.name === skill.name);
      expect(bundled?.markdown, skill.name).toBe(skill.markdown);
      expect(Object.keys(bundled?.files ?? {}).toSorted(), skill.name).toEqual(Object.keys(skill.files).toSorted());
    }
  });

  it("is published at /mcp/skills/<name>/..., and linked from llms.txt and the docs", async () => {
    const { ctxFor } = await setup();
    const paths = renderSkillFiles().map((file) => file.path);
    expect(paths).toContain("/mcp/skills/modifying-page/SKILL.md");
    expect(paths).toContain("/mcp/skills/answering-questions/SKILL.md");
    expect(renderBuildFiles(ctxFor).map((file) => file.path)).toEqual(expect.arrayContaining(paths));

    const txt = renderLlmsTxt(ctxFor);
    const section = txt.slice(txt.indexOf("## WebMCP tools"));
    expect(section.indexOf("/en/mcp.md")).toBeLessThan(section.indexOf("- `get_css`"));
    for (const skill of onDisk) expect(section).toContain(`https://emiliacabral.com/mcp/skills/${skill.name}/SKILL.md`);
  });

  it("is offered by list_skills and read_skill", async () => {
    setSkills(SKILLS);
    const [list, read] = skillsTools;
    const listed: unknown = JSON.parse((await list.execute({})).content[0].text);
    expect(listed).toMatchObject(onDisk.map((skill) => ({ name: skill.name })));
    const whole = (await read.execute({ name: "modifying-page" })).content[0].text;
    expect(whole).toContain("name: modifying-page");
    const extra = (await read.execute({ name: "modifying-page", file: "regions.md" })).content[0].text;
    expect(extra).toContain("Regions");
    await expect(Promise.resolve().then(() => read.execute({ name: "nope" }))).rejects.toThrow(/list_skills/);
    await expect(Promise.resolve().then(() => read.execute({ name: "modifying-page", file: "x.md" }))).rejects.toThrow(/regions\.md/);
  });

  it("is pointed at by the descriptions of the tools that change the page or answer from it", () => {
    const byName = new Map(enabledTools.map((tool) => [tool.name, tool.description]));
    for (const name of ["set_css", "set_css_by_selector", "get_variables", "set_google_font", "insert_element", "set_text_content"]) {
      expect(byName.get(name), name).toContain("`modifying-page`");
    }
    for (const name of ["open_custom_sidebar", "create_article", "list_md_pages", "read_md_page", "click_link_or_button"]) {
      expect(byName.get(name), name).toContain("`answering-questions`");
    }
  });
});
