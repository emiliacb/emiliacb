// What the rest of the site calls into. Everything here is a no-op with
// WEBMCP_ENABLED false (src/webmcp/enabled.ts).
export { renderAgentNote, renderHead, renderScript } from "./layout";
export { renderLlmsSection } from "./llms";
export { renderBuildFiles, renderPagesManifest, MANIFEST_PATH, type ManifestEntry } from "./manifest";
export { renderRedirects } from "./redirects";
