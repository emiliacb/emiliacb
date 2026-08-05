// Pretext, exposed on `window.__pretext` as its own bundle instead of being
// linked into the panel bundle. Text layout is ~50kB of line-breaking and Unicode
// tables, and the AI layout is a desktop-only experiment most visitors never turn
// on, so activity-panel.js injects this on demand (when the layout goes on)
// rather than making every page load pay for it.
import {
  prepareWithSegments,
  layout,
  measureLineStats,
  measureNaturalWidth,
  clearCache,
} from "@chenglou/pretext";

window.__pretext = {
  prepareWithSegments: prepareWithSegments,
  layout: layout,
  measureLineStats: measureLineStats,
  measureNaturalWidth: measureNaturalWidth,
  clearCache: clearCache,
};
