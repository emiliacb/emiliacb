const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

// Ensure the vendor directory exists
const vendorDir = path.resolve("public");
if (!fs.existsSync(vendorDir)) {
  fs.mkdirSync(vendorDir, { recursive: true });
}

// Bundle the dotlottie player
async function bundleDotlottiePlayer() {
  try {
    await esbuild.build({
      entryPoints: ["src/entrypoints/dotlottie-entry.js"],
      bundle: true,
      minify: true,
      format: "esm",
      outfile: "public/dotlottie-bundle.js",
    });
    console.log(
      "Dotlottie player bundled successfully to public/dotlottie-bundle.js"
    );
  } catch (error) {
    console.error("Error bundling dotlottie player:", error);
    process.exit(1);
  }
}

bundleDotlottiePlayer();
