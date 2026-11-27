# WebMCP

The site exposes tools to the browser agent of whoever is visiting, through
[WebMCP](https://webmachinelearning.github.io/webmcp/) (`document.modelContext`).
The agent runs on the visitor's side: there is no endpoint and no API key, and
everything a tool changes lives in that tab.

## Persistence

What an agent changes (its CSS, loaded Google Fonts, articles and the forced
colour mode) is kept while the visitor navigates the site in this tab (links,
back and forward) and a reload restores the original. An article is kept but not
shown again until `create_article` is called with `show`. What the DOM tools put
on a page (`insert_element`, `set_text_content`, `open_custom_sidebar`) is not
kept: navigating clears it. It is never shared with
another tab or a later visit. All of it is stored through
`src/client/lib/nav-storage.js`: sessionStorage under the `nav:` prefix, emptied
once per document load when `performance` says the load was a reload (the
inline script in the layout's `<head>` does the same for the theme key before
the first paint). A new tool that keeps state across pages must use it too, not
sessionStorage or localStorage directly.

Everything about the feature is in this folder, plus a handful of one-line
calls into it (listed at the bottom). `WEBMCP_ENABLED` in `enabled.ts` turns
all of it off at build time.

## What lives where

```
src/webmcp/
  enabled.ts            WEBMCP_ENABLED, the one flag
  styles.css            CSS the tools and the docs page need, @import-ed by src/styles.css
  skills/               the agent skills, <name>/SKILL.md (+ other .md files), see below
  client/               runs in the browser
    index.js            the entry logic: restore saved CSS, register the tools
    core/               context.js (document.modelContext, polyfill, error guard),
                        result.js (ok/fail), sanitize.js (HTML the agent sends),
                        skill-gate.js (tools that fail until their skill was read)
    css/                what set_css and friends are built on: state.js (variable
                        overrides, rules, kept with src/client/lib/nav-storage.js; announces every commit
                        with `tokenschange` so the canvases repaint),
                        variables.js (set_variables' checks and the light/dark
                        blocks), tokens.js (what get_variables says about the
                        base tokens), declarations.js, apply.js (apply, then
                        roll back if the page got unusable, unless forced),
                        health.js and contrast.js (the checks), shield.js (the
                        visitor's restore notice, shown only for a forced change)
    content/            articles.js (create_article's storage and display),
                        text.js, and the on-demand Markdown renderer:
                        render-markdown.js (the only `marked` import),
                        markdown-entry.js, markdown-loader.js
    skills/             parse.js (frontmatter), index.js (the skills' files
                        imported as text), store.js, hints.js (the one-sentence
                        pointers the tool descriptions end with)
    tools/              one file per tool group, and index.js, the list of
                        enabled groups (skills.js: list_skills, read_skill)
  site/                 runs at build time
    catalog.ts          name + summary of every tool, read from tools/index.js
    llms.ts             the "WebMCP tools" section of /llms.txt
    manifest.ts         dist/webmcp/pages.json, what list_md_pages reads
    layout.ts           the hidden note, the <head> tags, the <script> tag and
                        the footer link
    routes.ts           where the docs page lives (/mcp), and the Worker routes
    skills.ts           reads the skills' files; the build publishes them at
                        /mcp/skills/<name>/SKILL.md
    docs/               the short /{lang}/mcp page and its .md: the tool list
                        comes from the catalog, copy.ts holds the rest of its
                        words in both languages
    redirects.ts        /webmcp (+ .md, per language) and the old /labs/webmcp
                        (with and without a language), all 301 to /mcp
    robots.ts           the Allow lines for robots.txt, spliced in by the build
    index.ts            what the rest of the site imports
```

Two bundles are built from it, both from tiny top-level files of
`src/client/` (the build only treats those as entries):

- `webmcp` (`src/client/webmcp.js`): every page loads it, deferred.
- `webmcp-markdown` (`src/client/webmcp-markdown.js`): `marked`, about 50 KB.
  No page loads it. `create_article` injects it the first time it runs, from
  the hashed URL in `<meta name="asset:webmcp-markdown">`, the way `sidebars.js`
  loads `ui-drawer`.

## How a tool is defined

A tool is a plain object in a group file (`client/tools/*.js`):

```js
const getThing = {
  name: "get_thing",              // snake_case, unique
  summary: "the thing, read-only", // one line, shown in llms.txt
  title: "Get the thing",
  description: "What it does, what it takes, what it returns, for an agent.", // at most 700 characters
  help: "Optional Markdown with the rest; get_tool_help returns it.",
  inputSchema: { type: "object", properties: { ... } },
  annotations: { readOnlyHint: true },
  execute(input) {
    return ok({ ... });           // or `throw fail("what happened, what to try")`
  },
};
export const thingTools = [getThing];
```

`execute` may be async. Whatever it throws is cleaned up by `core/context.js`
before the agent sees it: a `fail(...)` message goes through as written, a bug
becomes a generic message and a console warning.

A description is cut by the agent's client at about 900 characters, so a test
holds every one to 700 (and the play tools to 500): lead with what it does,
then the key inputs and the one caveat, and put the rest in the input
properties (at most 200 characters each), in `help`, or in a skill. A tool that
works much better after reading a skill can call `requireSkill(name)`
(`core/skill-gate.js`) first in `execute`; `read_skill` unlocks it for the tab.

## Adding a tool in 3 steps

1. Write the tool object in a group file in `client/tools/` (or a new group file
   that exports an array), with a `summary`.
2. If it is a new group, import it in `client/tools/index.js` and spread it into
   `enabledTools`.
3. Run `npm test`. llms.txt is generated from `enabledTools`, so there is
   nothing else to update; the tests check the definitions are complete and that
   llms.txt lists every tool.

## How agents find the tools

- Native WebMCP: a browser that implements it shows `document.modelContext` tools
  directly; `core/context.js` registers on it.
- Polyfill: without it, `core/context.js` installs a small `document.modelContext`
  (`getTools`, `executeTool`) so an agent that can run JavaScript in the tab
  (Claude in Chrome, for one) can still call the tools.
- `/llms.txt`: its "WebMCP tools" section links the docs page and the skills,
  lists every tool with its summary and explains the JavaScript way in.
- The docs page, `/{lang}/mcp` (and `/mcp.md`): how to connect, every tool with
  its input schema, the skills, safety. Generated from the tool definitions, so
  it cannot drift. It is not in `PAGES` (that would drag it into the manifest,
  llms.txt's page list and the 404's site map), so the build, the Worker and
  robots.txt get it from `site/routes.ts`. It is not a remote MCP server.
- The hidden note: every page starts with a visually hidden paragraph that says
  how to list and call the tools from the tab and where the docs are. The
  `<head>` has `rel="describedby"` (`/mcp.md`) and `rel="help"` (`/{lang}/mcp`)
  links, and the footer a visible "MCP" link, for the same reason: an
  agent that is not told the tools exist does not look for them.
- The skills: `read_skill` / `list_skills` (WebMCP has no skill primitive), and
  the tool descriptions that change the page or answer from it end with a
  sentence pointing at the right one (`client/skills/hints.js`).

## Skills

A skill is `skills/<name>/SKILL.md`: YAML frontmatter with `name` (the folder's
name) and a one-line `description` ("Use when ..."), then Markdown. Other `.md`
files in the folder are read with `read_skill({ name, file })`. To add one:
write the folder, import its files in `client/skills/index.js`, and run the
tests (they hold the folders, the bundle and the published files together). The
files are bundled as text (esbuild's `.md` loader in `scripts/build.ts`) and
published at `/mcp/skills/<name>/...` for agents that can install skills.

## Turning it off

Set `WEBMCP_ENABLED = false` in `enabled.ts`. The build then renders no script
tag, no `<meta>`, no note, no footer link, no docs pages, no llms.txt section,
no `pages.json`, no skills files, no redirects and no WebMCP lines in
robots.txt, and it does not bundle the two `webmcp*.js` entries. The Worker
registers no `/mcp` route either (`WEBMCP_LANGLESS_ROUTES` is empty), so
`/mcp` and `/mcp.md` fall through to the assets and answer 404. Two leftovers
are harmless: `"/mcp", "/mcp.md"` stay in `run_worker_first` in `wrangler.jsonc`
(static JSON, it cannot read the flag; the Worker just passes those requests to
the assets), and `src/webmcp/styles.css` is still `@import`-ed into the
stylesheet by `src/styles.css`, so its few rules (`#custom-sidebar`,
`.webmcp-docs`) are still built, unused.

## How to remove WebMCP

Delete the folder, then remove these (grep `WebMCP: see src/webmcp/README.md`):

1. `src/webmcp/` itself.
2. `src/client/webmcp.js` and `src/client/webmcp-markdown.js`: the two entries.
3. `src/site/components/layout.ts`: the `import * as webmcp` line and the three
   `webmcp.render*` calls (note, head, script). `src/site/components/footer.ts`:
   the import and the `webmcp.renderFooterLink` call.
4. `src/site/markdown/index.ts`: the import and the `...renderWebmcpLlmsSection()`
   line in `renderLlmsTxt`.
5. `scripts/build.ts`: the `import * as webmcp` line, the docs import, the
   `loader: { ".md": "text" }` line, the `site`/`pages` and `markdownFiles` lines
   that add the docs pages, the `renderBuildFiles` loop and the
   `...webmcp.renderRedirects()` line.
5b. `src/worker/index.ts` (the `WEBMCP_LANGLESS_ROUTES` import and spread) and
    `wrangler.jsonc` (`"/mcp", "/mcp.md"` in `run_worker_first`). The
    `webmcp.renderRobots` and `webmcp.isDisabledClientEntry` calls in
    `scripts/build.ts` go with its other `webmcp` lines (the robots.txt write
    becomes a plain copy of `public/robots.txt`).
6. `src/site/context.ts`: `"webmcp"` and `"webmcp-markdown"` in `ClientEntry`.
7. `src/styles.css`: the `@import "./webmcp/styles.css"` line (the file must be
   inlined by the Tailwind CLI, which it is: postcss-import is built in).
8. `tailwind.config.cjs`: `./src/webmcp/**/*.{js,ts}` in `content`.
9. `.oxlintrc.json`: `src/webmcp/client/**` in the `unicorn/no-array-sort` override.
10. `vitest.config.ts`: `test/webmcp/**/*.test.ts` in the `site` project, the
    `markdownAsText` plugin, and delete `test/webmcp/`.

`window.siteSidebars` in `src/client/sidebars.js` (`openCustom`, `close`) stays:
it is a generic API of the site's sidebars that `open_custom_sidebar` happens to
use. Remove it too if nothing else will call it.
