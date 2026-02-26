const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const OUTPUT_DIR = "public"

// Ensure the vendor directory exists
const vendorDir = path.resolve(OUTPUT_DIR);
if (!fs.existsSync(vendorDir)) {
  fs.mkdirSync(vendorDir, { recursive: true });
}

/**
 * Bundles a single client-side JavaScript file using esbuild. This allows control over how much client side code we send.
 *
 * @param {object} options - The options for bundling.
 * @param {string} options.entry - The entry point file.
 * @param {string} options.outfile - The output file name.
 * @param {string} options.label - A descriptive label for the bundle.
 * @returns {Promise<void>} - A promise that resolves when the bundling is complete.
 */
async function bundleClientFile({ entry, outfile, label }: {
  entry: string;
  outfile: string;
  label: string;
}) {
  try {
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      minify: true,
      sourcemap: true,
      outfile: `${OUTPUT_DIR}/${outfile}`,
    });
    console.log(`${label} bundled successfully to ${outfile}`);
  } catch (error) {
    console.error(`Error bundling ${label}:`, error);
    process.exit(1);
  }
}

// Execute bundles
(async () => {
  await bundleClientFile({
    entry: "src/client/dotlottie.js",
    outfile: "_dotlottie-bundle.js",
    label: "Dotlottie player",
  });
  await bundleClientFile({
    entry: "src/client/dropdown.js",
    outfile: "_dropdown-bundle.js",
    label: "Dropdown",
  });
  await bundleClientFile({
    entry: "src/client/layout.js",
    outfile: "_layout-bundle.js",
    label: "Layout JS",
  });
  await bundleClientFile({
    entry: "src/client/posthog.js",
    outfile: "_posthog-bundle.js",
    label: "Posthog JS",
  });
  await bundleClientFile({
    entry: "src/client/phone-drag.js",
    outfile: "_phone-drag-bundle.js",
    label: "Phone drag",
  });
  await bundleClientFile({
    entry: "src/client/navigation.js",
    outfile: "_navigation-bundle.js",
    label: "Navigation",
  });
})();
