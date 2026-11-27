// Reads any CSS colour as [r, g, b], each 0 to 1.
//
// A computed colour is no longer always "rgb(r, g, b)": the palette is made
// of color-mix() and relative colours (see the tokens in styles.css), which
// a browser serialises as color(srgb 0.96 0.96 0.95) or oklch(...). Picking
// the first three numbers out of such a string reads the wrong channels, so
// the colour is painted on a one-pixel canvas and read back, which is the
// browser's own conversion to sRGB, whatever the notation was.

/** @type {CanvasRenderingContext2D | null} */
let probe = null;

/**
 * @param {string} css any colour the browser understands.
 * @returns {[number, number, number]} black if it does not understand it.
 */
export function rgbOf(css) {
  if (!probe) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    probe = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!probe) return [0, 0, 0];
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}
