// The arithmetic behind the page checks, kept apart from the DOM so it can be
// unit-tested: what a computed `filter` or `transform` does to how visible
// something is, how much of a box is on screen, and which reason is the common one.

/** What a computed `filter` does to what is under it: the strongest blur, and the opacity and brightness it multiplies in. */
export function parseFilter(text) {
  const result = { blur: 0, opacity: 1, brightness: 1 };
  for (const [, name, raw, unit] of String(text).matchAll(/(blur|opacity|brightness)\(\s*(-?[\d.]+)(px|%)?\s*\)/g)) {
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    if (name === "blur") result.blur = Math.max(result.blur, value);
    else result[name] *= unit === "%" ? value / 100 : value;
  }
  return result;
}

function matrixScale(transform) {
  const match = /^matrix(3d)?\(([^)]*)\)$/.exec(String(transform).trim());
  if (!match) return 1;
  const values = match[2].split(",").map(Number);
  if (values.some((value) => !Number.isFinite(value))) return 1;
  // matrix(a, b, c, d, e, f) and the 2D part of matrix3d (m11, m12, m21, m22).
  const [a, b, c, d] = match[1] ? [values[0], values[1], values[4], values[5]] : values;
  return Math.min(Math.hypot(a, b), Math.hypot(c, d));
}

function propertyScale(scale) {
  const numbers = String(scale).trim().split(/\s+/).map(Number);
  if (numbers.some((value) => !Number.isFinite(value))) return 1;
  return Math.min(Math.abs(numbers[0]), Math.abs(numbers[1] ?? numbers[0]));
}

/**
 * How much an element's own `transform` and `scale` shrink what is inside it
 * (the smaller of the two axes; 1 when they do not). Computed values only: "none" is 1.
 */
export function transformScale(transform, scale = "none") {
  return Math.min(matrixScale(transform), propertyScale(scale));
}

/** The width and height two boxes ({left, top, right, bottom}) have in common, 0 when they do not touch. */
export function overlap(a, b) {
  return {
    width: Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)),
    height: Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)),
  };
}

/** The most frequent entry of `items` and how often it occurs, or null for none. */
export function mostCommon(items) {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  let best = null;
  for (const [item, count] of counts) if (!best || count > best[1]) best = [item, count];
  return best;
}
