// Pretext, exposed on `window.__pretext` as its own bundle instead of being
// linked into the mascot bundle. Text layout is ~50kB of line-breaking and
// Unicode tables, and the mascot is a desktop-only easter egg most visitors
// never click, so the mascot loader injects this on demand (prefetched on
// hover) rather than making every page load pay for it.
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
