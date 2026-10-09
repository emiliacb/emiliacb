import type { Lang } from "../shared/lang";
import type { Dict } from "../shared/i18n";
import type { Content } from "./content/types";

/**
 * Names of the browser bundles: one per top-level file in src/client/
 * (src/client/forest.js → "forest").
 */
export type ClientEntry =
  | "activity-logger"
  | "activity-panel"
  | "distortion"
  | "dotlottie"
  | "dropdown"
  | "email-link"
  | "forest"
  | "gradient-distortion"
  | "layout"
  | "mascot-bot"
  | "navigation"
  | "posthog"
  | "pretext"
  | "side-photo";

export type Assets = {
  /** Hashed URL of a client bundle, e.g. "/assets/forest-3HX2K.js". */
  script(name: ClientEntry): string;
  /** Hashed URL of the compiled Tailwind stylesheet. */
  css: string;
  /** Changes on every build whose output changed; versions the service worker caches. */
  buildId: string;
};

/** Everything a page or component needs to render. No Hono Context, no fs, no process.env. */
export type RenderCtx = {
  lang: Lang;
  t: Dict;
  assets: Assets;
  content: Content;
};
