/**
 * Finds the largest empty area of the viewport for the side photo on compact
 * screens, where there is no free column beside the text.
 *
 * 1. Rasterize what is on screen into a coarse occupancy grid. Text is
 *    measured line by line (Range.getClientRects on every text node), so the
 *    ragged right edge of short lines counts as free space, not only the gaps
 *    between blocks. Images, buttons, links and the footer count as occupied.
 * 2. For every cell, find the largest empty square ending there (maximal
 *    square dynamic programming, linear in the number of cells).
 * 3. Score each candidate: bigger is better, far from the preferred point is
 *    worse. The photo may spill past its square by OVERFLOW.
 */

const CELL = 8; // px per grid cell
const PAD = 6; // breathing room around text, px
const MOVE_COST = 0.18; // px of size traded per px of travel

export const MIN_SIZE = 128; // smallest photo worth showing, px
export const MAX_SIZE = 300; // never grow beyond this, px
const OVERFLOW = 1.25; // how far past the free square the photo may grow

export type Square = { left: number; top: number; size: number };

const OCCUPYING = "img, svg, button, nav, a, footer, pre";

/**
 * Largest empty square in the viewport-sized band of the page that starts at
 * the top of the document, in document coordinates. `scrollY` is the current
 * scroll, used to bring every measured box back to the top of the page.
 */
export function findFreeSquare(
  ignore: Element,
  near: { x: number; y: number },
  scrollY: number,
): Square | null {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cols = Math.ceil(vw / CELL);
  const rows = Math.ceil(vh / CELL);
  const grid = new Uint8Array(cols * rows);

  const overlay = document.getElementById("overlay-content");
  const overlayBottom = (overlay?.getBoundingClientRect().bottom ?? Infinity) + scrollY;

  // Closed dropdowns and other hidden UI still report layout boxes.
  const visible = (el: Element | null): el is Element =>
    !!el &&
    !ignore.contains(el) &&
    el.checkVisibility({ opacityProperty: true, visibilityProperty: true });

  // The footer sits fixed behind #overlay-content and only shows below its
  // bottom edge, so anything outside the overlay only occupies that part.
  const mark = (r: { left: number; right: number; top: number; bottom: number }, el: Element) => {
    const rTop = r.top + scrollY;
    const bottom = r.bottom + scrollY;
    const top = overlay && !overlay.contains(el) ? Math.max(rTop, overlayBottom) : rTop;
    if (bottom <= top || bottom < 0 || top > vh || r.right <= r.left) return;
    const c0 = Math.max(0, Math.floor((r.left - PAD) / CELL));
    const c1 = Math.min(cols - 1, Math.floor((r.right + PAD) / CELL));
    const r0 = Math.max(0, Math.floor((top - PAD) / CELL));
    const r1 = Math.min(rows - 1, Math.floor((bottom + PAD) / CELL));
    for (let y = r0; y <= r1; y++) grid.fill(1, y * cols + c0, y * cols + c1 + 1);
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    if (!visible(parent)) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) mark(r, parent);
  }
  for (const el of document.querySelectorAll(OCCUPYING)) {
    if (visible(el)) mark(el.getBoundingClientRect(), el);
  }

  const dp = new Uint16Array(cols * rows);
  let best: (Square & { score: number }) | null = null;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (grid[i]) continue;
      dp[i] = x && y ? 1 + Math.min(dp[i - 1], dp[i - cols], dp[i - cols - 1]) : 1;
      const free = dp[i] * CELL;
      const size = Math.min(free * OVERFLOW, MAX_SIZE);
      if (size < MIN_SIZE) continue;
      // dp gives the bottom-right corner; center the photo on the free
      // square and keep any spill on screen.
      const left = Math.min(Math.max(0, (x + 1) * CELL - free + (free - size) / 2), vw - size);
      const top = Math.min(Math.max(0, (y + 1) * CELL - free + (free - size) / 2), vh - size);
      const dist = Math.hypot(left + size / 2 - near.x, top + size / 2 - near.y);
      const score = size - dist * MOVE_COST;
      if (!best || score > best.score) best = { left, top, size, score };
    }
  }
  return best;
}
