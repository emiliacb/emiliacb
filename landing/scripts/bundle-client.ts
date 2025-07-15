const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const OUTPUT_DIR = "public"

// Ensure the vendor directory exists
const vendorDir = path.resolve(OUTPUT_DIR);
if (!fs.existsSync(vendorDir)) {
  fs.mkdirSync(vendorDir, { recursive: true });
}

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
      format: "esm",
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
    entry: "src/client/dotlottie-entry.js",
    outfile: "dotlottie-bundle.js",
    label: "Dotlottie player",
  });
  await bundleClientFile({
    entry: "src/client/dropdown.js",
    outfile: "dropdown-bundle.js",
    label: "Dropdown",
  });
})();
