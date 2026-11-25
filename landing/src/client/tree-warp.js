// The home's content twirls, a little, about the foot of the tree: every point
// turns about it, those near the tree more than those far away, so the page's
// straight lines bend into arcs around the tree, like ripples spreading from
// its foot. The nearer the pointer gets to the tree the stronger the twirl, so
// moving towards the tree is answered and moving away lets the page settle
// back. The tree is not part of #content, so it never bends.
//
// A twist that varies with distance is not a transform CSS can do; it is an
// SVG filter on #content (feDisplacementMap) instead of a canvas copy of the
// page, so the DOM stays the page: the text stays live and selectable, links
// keep working where they are, and the view transition captures the bent
// content as it is. The map of the twist is drawn once per layout; a frame only
// sets the filter's scale, and the filter is taken off altogether at rest.
//
// Only #content bends: it is the element the view transition animates, so it
// may leave the page bent and arrive straight, where the navbar, which is not
// animated, has to look the same on every page.
//
// With reduced motion, on touch screens and below md, this does nothing.
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine)").matches) return;
  const tree = document.querySelector("#tree-illustration .cover-tree");
  const content = document.getElementById("content");
  if (!tree || !content) return;

  const MAX = 0.1; // radians of twist (~6°) at the falloff radius, pointer at the tree
  const FALLOFF = 350; // px: the twist's angle halves at this distance from the foot
  const REACH = 1100; // px from the tree where the twirl starts
  const EASE = 0.08; // of the way to the target each frame
  const STEP = 4; // px of page per pixel of the map; the twist is smooth
  const PAD = 160; // px around #content the filter may draw into

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  // sRGB, or the map's values are read through a gamma curve and the twist
  // comes out lopsided.
  svg.innerHTML =
    '<filter id="tree-warp" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse">' +
    '<feImage result="map" preserveAspectRatio="none"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" scale="0"/>' +
    "</filter>";
  document.body.appendChild(svg);
  const filter = svg.querySelector("filter");
  const image = svg.querySelector("feImage");
  const displace = svg.querySelector("feDisplacementMap");

  // The pull's centre: the tree's middle, in viewport coordinates, read again
  // on scroll. The twist's centre is the tree's foot, in #content's own
  // coordinates (before its lean), which only a resize or a late font moves.
  let tx = 0, ty = 0, range = 0;
  function measureTree() {
    const r = tree.getBoundingClientRect();
    tx = r.left + r.width / 2;
    ty = r.top + r.height * 0.45;
  }
  function measure() {
    measureTree();
    const r = tree.getBoundingClientRect();
    // The trunk stands a little left of the drawing's middle.
    const footX = r.left + r.width * 0.49, footY = r.bottom;
    // Where #content is laid out, and its transform, set aside to read it. Its
    // transform turns it about its top-left, so the foot in its coordinates is
    // the foot's offset from there, turned back.
    const filterWas = content.style.filter;
    content.style.filter = "";
    const m = new DOMMatrix(getComputedStyle(content).transform);
    content.style.transform = "none";
    const c = content.getBoundingClientRect();
    content.style.transform = "";
    content.style.filter = filterWas;
    const foot = m.inverse().transformPoint(new DOMPoint(footX - c.left, footY - c.top));
    drawMap(c.width, c.height, foot.x, foot.y);
  }

  // The map holds, for each point, where it reads the page from for a twist
  // of one radian (small angles: a quarter turn of the offset from the foot,
  // scaled by the angle there), scaled into 0..255 around 128 per axis. The
  // filter's scale then sets the twist: offset = scale * (value - 0.5).
  function drawMap(w, h, fx, fy) {
    const x0 = -PAD, y0 = -PAD, W = w + 2 * PAD, H = h + 2 * PAD;
    const cw = Math.ceil(W / STEP), ch = Math.ceil(H / STEP);
    const vx = new Float32Array(cw * ch), vy = new Float32Array(cw * ch);
    let most = 1e-6;
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const dx = x0 + (i + 0.5) * (W / cw) - fx, dy = y0 + (j + 0.5) * (H / ch) - fy;
        const turn = 1 / (1 + Math.hypot(dx, dy) / FALLOFF);
        const k = j * cw + i;
        // Turned clockwise by `turn`, a point shows what was turn back from it.
        vx[k] = turn * dy;
        vy[k] = -turn * dx;
        most = Math.max(most, Math.abs(vx[k]), Math.abs(vy[k]));
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const g = canvas.getContext("2d");
    const img = g.createImageData(cw, ch);
    for (let k = 0; k < cw * ch; k++) {
      img.data[k * 4] = Math.round(127.5 + (127.5 * vx[k]) / most);
      img.data[k * 4 + 1] = Math.round(127.5 + (127.5 * vy[k]) / most);
      img.data[k * 4 + 2] = 128;
      img.data[k * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (const el of [filter, image]) {
      el.setAttribute("x", x0);
      el.setAttribute("y", y0);
      el.setAttribute("width", W);
      el.setAttribute("height", H);
    }
    image.setAttribute("href", canvas.toDataURL());
    range = most;
    apply();
  }

  // The twist's angle. Clockwise (the content far from the tree rises) when
  // the pointer is above the tree's middle, anticlockwise below it, by the
  // sine of the pointer's angle from the content's side of the tree, so it
  // never jumps as the pointer goes round.
  let px = null, py = null, a = 0, raf = 0;
  function apply() {
    if (Math.abs(a) < 2e-4) {
      content.style.filter = "";
      return;
    }
    displace.setAttribute("scale", (2 * a * range).toFixed(2));
    content.style.filter = "url(#tree-warp)";
  }
  function frame() {
    raf = 0;
    let target = 0;
    if (px !== null) {
      const near = Math.max(0, Math.min(1, 1 - Math.hypot(px - tx, py - ty) / REACH));
      const side = Math.sin(Math.atan2(py - ty, px - tx) - Math.PI);
      target = MAX * side * near * near * (3 - 2 * near);
    }
    a += (target - a) * EASE;
    if (Math.abs(target - a) < 1e-4) a = target;
    apply();
    if (a !== target) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  measure();
  addEventListener("load", measure);
  if (document.fonts) document.fonts.ready.then(measure);
  addEventListener("resize", measure, { passive: true });
  addEventListener("scroll", () => { measureTree(); kick(); }, { passive: true });
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    px = e.clientX;
    py = e.clientY;
    kick();
  }, { passive: true });
  const leave = () => { px = null; kick(); };
  document.documentElement.addEventListener("pointerleave", leave);
  addEventListener("blur", leave);
})();
