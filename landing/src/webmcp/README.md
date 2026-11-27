# WebMCP

The site exposes tools to the browser agent of whoever is visiting, through
[WebMCP](https://webmachinelearning.github.io/webmcp/) (`document.modelContext`).
The agent runs on the visitor's side: there is no endpoint and no API key, and
everything a tool changes lives in that tab.

Everything about the feature is in this folder, plus a handful of one-line
calls into it (listed at the bottom). `WEBMCP_ENABLED` in `enabled.ts` turns
all of it off at build time.

## What lives where

```
src/webmcp/
  enabled.ts            WEBMCP_ENABLED, the one flag
  styles.css            CSS the tools need (the custom sidebar), @import-ed by src/styles.css
  client/               runs in the browser
    index.js            the entry logic: restore saved CSS, register the tools
    core/               context.js (document.modelContext, polyfill, error guard),
                        result.js (ok/fail), sanitize.js (HTML the agent sends)
    css/                what set_css and friends are built on: state.js (rules,
                        sessionStorage), declarations.js, apply.js (apply, then
                        roll back if the page got unusable, unless forced),
                        health.js and contrast.js (the checks), shield.js (the
                        visitor's restore notice, shown only for a forced change)
    content/            articles.js (create_article's storage and display),
                        text.js, and the on-demand Markdown renderer:
                        render-markdown.js (the only `marked` import),
                        markdown-entry.js, markdown-loader.js
    tools/              one file per tool group, and index.js, the list of
                        enabled groups
  site/                 runs at build time
    catalog.ts          name + summary of every tool, read from tools/index.js
    llms.ts             the "WebMCP tools" section of /llms.txt
    manifest.ts         dist/webmcp/pages.json, what list_md_pages reads
    layout.ts           the hidden note, the <meta> and the <script> tag
    redirects.ts        the old /labs/webmcp URLs
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
  description: "What it does, what it takes, what it returns, for an agent.",
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
- `/llms.txt`: its "WebMCP tools" section lists every tool with its summary and
  explains the JavaScript way in.
- The hidden note: every page starts with a visually hidden paragraph that tells
  an agent reading the page to read llms.txt.

## Turning it off

Set `WEBMCP_ENABLED = false` in `enabled.ts`. The build then renders no script
tag, no `<meta>`, no note, no llms.txt section, no `pages.json` and no
redirects. (The two bundles are still built, nothing refers to them.)

## How to remove WebMCP

Delete the folder, then remove these (grep `WebMCP: see src/webmcp/README.md`):

1. `src/webmcp/` itself.
2. `src/client/webmcp.js` and `src/client/webmcp-markdown.js`: the two entries.
3. `src/site/components/layout.ts`: the `import * as webmcp` line and the three
   `webmcp.render*` calls (note, head, script).
4. `src/site/markdown/index.ts`: the import and the `...renderWebmcpLlmsSection()`
   line in `renderLlmsTxt`.
5. `scripts/build.ts`: the `import * as webmcp` line, the `renderBuildFiles`
   loop and the `...webmcp.renderRedirects()` line.
6. `src/site/context.ts`: `"webmcp"` and `"webmcp-markdown"` in `ClientEntry`.
7. `src/styles.css`: the `@import "./webmcp/styles.css"` line (the file must be
   inlined by the Tailwind CLI, which it is: postcss-import is built in).
8. `tailwind.config.cjs`: `./src/webmcp/**/*.{js,ts}` in `content`.
9. `.oxlintrc.json`: `src/webmcp/client/**` in the `unicorn/no-array-sort` override.
10. `vitest.config.ts`: `test/webmcp/**/*.test.ts` in the `site` project, and
    delete `test/webmcp/`.

`window.siteSidebars` in `src/client/sidebars.js` (`openCustom`, `close`) stays:
it is a generic API of the site's sidebars that `open_custom_sidebar` happens to
use. Remove it too if nothing else will call it.
