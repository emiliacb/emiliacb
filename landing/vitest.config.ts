import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { cloudflareTest } from "@cloudflare/vitest-plugin";

// WebMCP: see src/webmcp/README.md. The skills are imported as text, which
// build.ts gives esbuild a loader for; Vite needs the same.
const markdownAsText = {
  name: "markdown-as-text",
  enforce: "pre" as const,
  load(id: string) {
    if (id.endsWith(".md")) return `export default ${JSON.stringify(readFileSync(id, "utf8"))};`;
    return null;
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [markdownAsText],
        test: {
          name: "site",
          environment: "node",
          include: ["test/site/**/*.test.ts", "test/webmcp/**/*.test.ts"],
        },
      },
      {
        // The Workers runtime is a Vite plugin
        // (cloudflareTest) that sets the pool itself.
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.jsonc" },
            // Tests use a fixture asset tree so they do not need `npm run build`.
            miniflare: {
              assets: { directory: "./test/worker/fixtures/assets" },
            },
          }),
        ],
        test: {
          name: "worker",
          include: ["test/worker/**/*.test.ts"],
        },
      },
    ],
  },
});
