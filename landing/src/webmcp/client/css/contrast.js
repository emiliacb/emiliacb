// Pure color math for the page health contrast check (WCAG 2.x relative
// luminance, no DOM), so it can be unit-tested.

/** "rgb(1, 2, 3)" / "rgba(1 2 3 / 0.5)" as {r, g, b, a}, or null for any other notation. */
export function parseRgb(text) {
  const match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i.exec(
    text.trim(),
  );
  if (!match) return null;
  let a = 1;
  if (match[4] !== undefined) a = match[5] ? Number(match[4]) / 100 : Number(match[4]);
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a };
}

/** `top` painted over an opaque or translucent `bottom`. */
export function blend(top, bottom) {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (t, b) => (t * top.a + b * bottom.a * (1 - top.a)) / a;
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
}

function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(color) {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/** 1 (identical) to 21 (black on white). */
export function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
