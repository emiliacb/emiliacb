import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-plugin";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "site",
          environment: "node",
          include: ["test/site/**/*.test.ts"],
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
              assets: { directory: "./test/worker/fixtures/dist" },
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
