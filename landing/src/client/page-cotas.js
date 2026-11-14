// The page in technical-drawing ink: whatever block the pointer touches is
// dimensioned (its height, in CSS millimetres), the pointer carries its
// velocity on a rule and its acceleration (not over a dimensioned block), and the right edge holds two
// marks at true scale, up to the start of the page and down to its end,
// meeting at the break (where a scrollbar's thumb would be). Nothing is drawn
// until the pointer moves; everything fades with distance from it and shortly
// after it leaves. The ink comes from the --cota-* properties in styles.css.
// Prototyped as an artifact; with reduced motion this does nothing.
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // data-air="off" on the script tag leaves the pointer's rule and
  // acceleration out, for the pages whose tree draws its own.
  const NO_AIR = !!(document.currentScript && document.currentScript.dataset.air === "off");
  const canvas = document.createElement("canvas");
  canvas.className = "page-cotas-plate";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const g = canvas.getContext("2d");
  let W = 0, Hh = 0, dpr = 1;

  /* ---- theme: the ink and the light-theme opacity lift, as on the tree ---- */
  const LIFT = 1.3;
  let lift = 1;
  const TONE = {};
  function isDark() {
    const t = document.documentElement.dataset.theme;
    return t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  }
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    TONE.length = cs.getPropertyValue("--cota-length").trim();
    TONE.measure = cs.getPropertyValue("--cota-measure").trim();
    TONE.force = cs.getPropertyValue("--cota-force").trim();
    lift = isDark() ? 1 : LIFT;
  }
  function A(x) {
    if (lift === 1) return x;
    return 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), lift);
  }
  function ink(kind) { g.strokeStyle = g.fillStyle = TONE[kind]; }
  const smooth = (u) => u * u * (3 - 2 * u);

  /* ---- focus: full strength within 50px of the pointer, fading to 320 ---- */
  const FOCUS_IN = 50, FOCUS_OUT = 320, FOCUS_MIN = 0.12;
  let focus = 0, fcx = 0, fcy = 0;
  function dim(x, y) {
    if (focus <= 0.001) return 1;
    const u = Math.min(1, Math.max(0, (Math.hypot(x - fcx, y - fcy) - FOCUS_IN) / (FOCUS_OUT - FOCUS_IN)));
    return 1 - focus * (1 - FOCUS_MIN) * smooth(u);
  }
  function mask() {
    if (focus <= 0.001) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gr = g.createRadialGradient(fcx, fcy, 0, fcx, fcy, FOCUS_OUT);
    gr.addColorStop(0, "#000");
    for (let k = 0; k <= 12; k++) {
      const d = FOCUS_IN + ((FOCUS_OUT - FOCUS_IN) * k) / 12;
      gr.addColorStop(d / FOCUS_OUT, `rgba(0,0,0,${A(dim(fcx + d, fcy)).toFixed(3)})`);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "destination-in";
    g.fillStyle = gr;
    g.fillRect(0, 0, W, Hh);
    g.globalCompositeOperation = "source-over";
  }

  /* ---- the blocks that can be dimensioned ---- */
  const blocks = [...document.querySelectorAll(
    "nav[aria-label] a.interactive, nav[aria-label] dropdown-trigger," +
    " [data-cota-row] > li > :is(a, dropdown-trigger), footer li > :is(a, dropdown-trigger)," +
    " #content .markdown-content > a, #content a:has(> article)," +
    " #content :is(h1, h2, h3, p, li):not([data-cota-row] *, a:has(> article) *)")].map((el) => ({ el, a: 0, want: 0, hold: 0 }));

  /** The box of the block's ink: the union of its text's line boxes. */
  const range = document.createRange();
  // A link is measured by its own box, the one its hover fills; anything else
  // by its text.
  function inkBox(el) {
    if (el.matches("a, dropdown-trigger")) {
      // The dropdown's trigger is a button inside its shadow root.
      const q = ((el.shadowRoot && el.shadowRoot.querySelector("button")) || el).getBoundingClientRect();
      return { left: q.left, top: q.top, right: q.right, bottom: q.bottom };
    }
    range.selectNodeContents(el);
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const q of range.getClientRects()) {
      if (q.width < 0.5 || q.height < 0.5) continue;
      l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
    }
    if (l === Infinity) {
      const q = el.getBoundingClientRect();
      return { left: q.left, top: q.top, right: q.right, bottom: q.bottom };
    }
    return { left: l, top: t, right: r, bottom: b };
  }

  /* ---- drawing: the dimension line, its arrowheads and its value ---- */
  // Arrowheads as AutoCAD draws them: closed and filled, three times as long
  // as they are wide. head() queues one; stroke() strokes the path and then
  // fills the queued heads in the same ink.
  const HEADS = [];
  function head(x, y, ux, uy, len) {
    const L = len * 1.5, w = L / 6, bx = x - ux * L, by = y - uy * L;
    HEADS.push([x, y, bx - uy * w, by + ux * w, bx + uy * w, by - ux * w]);
  }
  function stroke() {
    g.stroke();
    if (!HEADS.length) return;
    g.beginPath();
    for (const t of HEADS) { g.moveTo(t[0], t[1]); g.lineTo(t[2], t[3]); g.lineTo(t[4], t[5]); g.closePath(); }
    HEADS.length = 0;
    g.fill();
    g.beginPath();
  }
  function label(text, x, y, ang) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.font = FONT;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 0, 0);
    g.restore();
  }
  // CSS millimetres: CSS fixes 1in = 96px, so 1px = 25.4/96 mm. True to the
  // page's own units; a physical ruler on the screen will differ by device.
  // A touch screen has no hover: there a tap dimensions only the navbar's
  // links, the values are set smaller, and the scroll marks write theirs
  // along the rule.
  const COARSE = matchMedia("(hover: none), (pointer: coarse)").matches;
  const FONT = `300 ${COARSE ? 12 : 15}px "Barlow Condensed", sans-serif`;
  // CSS pixels to the inch. CSS says 96, about right on a desktop screen; a
  // phone draws them smaller, and by how much depends on the phone. What
  // phones share is their glass: about 65 mm across, whatever their pixels.
  // So a phone's narrow side in CSS px over 65 mm gives its scale (an iPhone
  // 13 152 to the inch, a Galaxy S25 about 148, a Pixel 7 161, each within
  // a few % of the real thing). A tablet is too wide to guess that way; 132,
  // an iPad's, does for one.
  const PX_IN = (() => {
    if (!COARSE) return 96;
    const short = Math.min(screen.width, screen.height);
    return short > 0 && short <= 480 ? (short * 25.4) / 65 : 132;
  })();
  const mm = (px) => {
    const v = (px * 25.4) / PX_IN;
    return `${v < 100 ? v.toFixed(1) : Math.round(v)} mm`;
  };

  /** A value on a 45° leader: a small arrowhead at (tx, ty), a diagonal out
   * toward (sx, sy) and a level shelf the value sits on. Turned back across
   * the box it measures, the diagonal runs on until the shelf clears it. */
  function leader(text, tx, ty, sx, sy, a, clear = 0) {
    let LEAD = 22;
    g.font = FONT;
    const tw = g.measureText(text).width;
    LEAD = Math.max(LEAD, clear);
    if (sx < 0 && tx - LEAD - tw - 8 < 6) sx = 1;
    if (sx > 0 && tx + LEAD + tw + 8 > W - 6) sx = -1;
    if (sy > 0 && ty + LEAD + 4 > Hh) sy = -1;
    if (sy < 0 && ty - LEAD - 18 < 0) sy = 1;
    const ex = tx + sx * LEAD, ey = ty + sy * LEAD;
    // A short landing, the value at its end and centred on it, as in an
    // AutoCAD multileader.
    const fx = ex + sx * 8;
    g.globalAlpha = A(a * 0.85);
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(tx, ty); g.lineTo(ex, ey); g.lineTo(fx, ey);
    head(tx, ty, -sx * Math.SQRT1_2, -sy * Math.SQRT1_2, 5);
    stroke();
    g.globalAlpha = A(a);
    g.textAlign = sx > 0 ? "left" : "right";
    g.textBaseline = "middle";
    g.fillText(text, fx + sx * 4, ey);
  }

  /** A vertical mark at x from y0 to y1, extension lines back to ex. Its value
   * is placed, like the scroll marks', where the screen can show it: on the
   * part of the mark in view, kept whole inside the screen, and on the other
   * side of the mark when the given one has no room. A level value that fits
   * on neither side moves, mark and all, to `alt` (right of the text). */
  function vMark(y0, y1, x, ex, text, kind, a, side, alt) {
    if (y1 - y0 < 2) return;
    const EDGE = 6;
    g.font = FONT;
    const seen0 = Math.min(y1, Hh - EDGE) - Math.max(y0, EDGE);
    let leadSide = -1;
    if (alt && alt.lead) {
      // A leader with no room on the left takes the whole mark to the right.
      const w0 = g.measureText(text).width;
      if (Math.max(EDGE, x) - 1 - 22 - w0 - 8 < EDGE) { x = alt.x - 4; ex = alt.ex; leadSide = 1; }
    }
    if (alt && !alt.lead && seen0 < 40) {
      const w0 = g.measureText(text).width;
      const room = side < 0 ? Math.max(EDGE, x) - 7 - w0 >= EDGE : x + 7 + w0 <= W - EDGE;
      if (!room && alt.x + 7 + w0 <= W - EDGE) { x = alt.x; ex = alt.ex; side = 1; }
      else if (!room) side = 0; // no side fits: the value goes over the mark
    }
    const dx = Math.max(EDGE, x) - x;
    x += dx; ex += dx;
    ink(kind);
    g.lineWidth = 0.9;
    g.globalAlpha = A(a * 0.85);
    g.beginPath();
    g.moveTo(x, y0); g.lineTo(x, y1);
    const s = Math.sign(ex - x) || 1;
    for (const y of [y0, y1]) { g.moveTo(ex - s * 2, y); g.lineTo(x - s * 5, y); }
    const hl = Math.min(6, (y1 - y0) / 2.5);
    head(x, y0, 0, -1, hl);
    head(x, y1, 0, 1, hl);
    stroke();
    g.globalAlpha = A(a);
    g.save();
    g.font = FONT;
    const tw = g.measureText(text).width;
    if (alt && alt.lead) {
      // On a leader from the mark's middle, down and away from the text.
      const my = (Math.max(y0, EDGE) + Math.min(y1, Hh - EDGE)) / 2;
      // The shelf sits under the navbar's rule, the diagonal crossing the bar.
      leader(text, x + leadSide, my, leadSide, 1, a, Math.max(y1 - my + 20, alt.below + 18 - my));
      g.restore();
      return;
    }
    const vy0 = Math.max(y0, EDGE), vy1 = Math.min(y1, Hh - EDGE);
    const seen = vy1 - vy0;
    if (seen >= 40) {
      // Along the mark, its whole length kept on screen.
      if (x + side * 17 < 0 || x + side * 17 > W) side = -side;
      const my = Math.min(Hh - tw / 2 - EDGE, Math.max(tw / 2 + EDGE, (vy0 + vy1) / 2));
      g.restore();
      label(text, x + side * 9, my, -Math.PI / 2);
      return;
    }
    if (side === 0) {
      // Level, above the mark's top end, in the gap over the block.
      g.textAlign = "left";
      g.textBaseline = "alphabetic";
      g.fillText(text, Math.max(EDGE, x - 4), Math.max(14, vy0 - 5));
      g.restore();
      return;
    }
    // Beside the mark, level.
    const out = side < 0 ? x - 7 - tw < EDGE : x + 7 + tw > W - EDGE;
    if (out) side = -side;
    g.textAlign = side < 0 ? "right" : "left";
    g.textBaseline = "middle";
    g.fillText(text, x + side * 7, Math.min(Hh - 10, Math.max(10, (vy0 + vy1) / 2)));
    g.restore();
  }

  function drawBlock(i, a) {
    const el = blocks[i].el;
    const box = inkBox(el);
    if (box.bottom < -40 || box.top > Hh + 40) return;
    const h = box.bottom - box.top;
    if (h < 1 || box.right - box.left < 1) return; // hidden at this width
    // Left of the text, clear of a list's bullet.
    const hx = box.left - (el.tagName === "LI" ? 30 : 12);
    // Links in a row (the navbar, the contact icons) take their values on
    // 45° leaders, their shelves under the row: under the navbar's rule when
    // the row is drawn on one ("rule"), else under the links themselves.
    const row = el.closest("[data-cota-row]");
    vMark(box.top, box.bottom, hx, box.left - (el.tagName === "LI" ? 20 : 0), mm(h), "measure", a, -1,
      { x: box.right + 12, ex: box.right + 2, lead: !!row,
        below: !row ? 0 : row.dataset.cotaRow === "rule" ? row.getBoundingClientRect().bottom : box.bottom });
  }

  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; Hh = innerHeight;
    // Sized to the window itself, not stretched to the layout viewport.
    canvas.style.width = `${W}px`;
    canvas.style.height = `${Hh}px`;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(Hh * dpr);
  }

  /* ---- the pointer: the block under it is touched, and stays a moment ---- */
  let px = -1e4, py = -1e4, here = false, pointerFocus = 0;
  function hit(x, y) {
    const pad = 6;
    for (const b of blocks) {
      const q = inkBox(b.el);
      if (q.right - q.left < 1) continue;
      if (x >= q.left - pad && x <= q.right + pad && y >= q.top - pad && y <= q.bottom + pad) return b;
    }
    return null;
  }
  const vel = { x: 0, y: 0, last: 0, lastNow: 0 };

  /* ---- the pointer's air: its velocity on a rule whose zero is where the
     pointer last stood still, and its acceleration; put away over something
     dimensioned until the pointer stops and sets off again ---- */
  const V1 = 2600, RISE = 0.05, FALL = 0.2;
  let airA = 0, tNow = 0, curAl = 0, curHold = 0, airVis = 1;
  function arrow(x0, y0, x1, y1, hl) {
    const d = Math.hypot(x1 - x0, y1 - y0) || 1;
    const ux = (x1 - x0) / d, uy = (y1 - y0) / d;
    g.beginPath();
    g.moveTo(x0, y0); g.lineTo(x1, y1);
    head(x1, y1, ux, uy, hl);
  }
  // The rule's direction and the arrow's reach, eased so the arrow glides.
  let dirX = 1, dirY = 0, reach = 0;
  // The furthest the arrow reached in the current movement: a dot on the rule
  // that stays until the next movement starts.
  // It fades out with the rings.
  let peak = 0, moved = false;
  // Where the pointer last stood still: the rule's zero for the movement
  // that leaves it. And whether this movement's air was put away over a
  // cota: once put away, it waits for the pointer to stop and set off again.
  let stillX = -1e4, stillY = -1e4, restX = -1e4, restY = -1e4, stowed = false;
  const FULL = 110;
  // CSS metres: 1px = 0.0254/96 m.
  const PX_M = 0.0254 / PX_IN;
  // `accel` follows the pointer; `peakAccel` is the most this movement
  // reached, the value shown, kept like the peak mark until the next one.
  let accel = 0, peakAccel = 0, prevVX = 0, prevVY = 0;
  function drawAir() {
    if (NO_AIR) return;
    const ux = dirX, uy = dirY;
    const x0 = restX, y0 = restY;
    ink("force");
    if (curAl > 0.01) {
      g.lineWidth = 0.7;
      g.globalAlpha = A(curAl * 0.35);
      g.beginPath();
      g.moveTo(x0, y0); g.lineTo(x0 + ux * FULL, y0 + uy * FULL);
      for (let k = 0; k <= 10; k++) {
        const len = k % 5 === 0 ? 6 : 3;
        const qx = x0 + ux * FULL * (k / 10), qy = y0 + uy * FULL * (k / 10);
        g.moveTo(qx, qy); g.lineTo(qx - uy * len, qy + ux * len);
      }
      stroke();
      if (reach > 0.01) {
        arrow(x0, y0, x0 + ux * FULL * reach, y0 + uy * FULL * reach, 6);
        g.globalAlpha = A(curAl * 0.6);
        g.lineWidth = 1;
        stroke();
      }
    }
    if (airA > 0.01 && peak > 0.01) {
      g.globalAlpha = A(airA * 0.6);
      g.lineWidth = 0.9;
      g.beginPath();
      g.arc(x0 + ux * FULL * peak, y0 + uy * FULL * peak, 3, 0, Math.PI * 2);
      stroke();
    }
    // The acceleration, on a leader to the peak mark (to the contact ring
    // before there is one), leaning off the rule on its upper side.
    if (airA > 0.01) {
      let nx = -uy, ny = ux;
      if (ny > 0) { nx = -nx; ny = -ny; }
      const sx = nx < 0 ? -1 : 1, sy = -1;
      let tx, ty;
      if (peak > 0.01) {
        tx = x0 + ux * FULL * peak + sx * 3 * Math.SQRT1_2;
        ty = y0 + uy * FULL * peak + sy * 3 * Math.SQRT1_2;
      } else {
        tx = x0 + sx * 3 * Math.SQRT1_2;
        ty = y0 + sy * 3 * Math.SQRT1_2;
      }
      ink("force");
      g.save();
      leader(`a = ${(peakAccel * PX_M).toFixed(2)} m/s²`, tx, ty, sx, sy, airA * 0.6);
      g.restore();
    }
  }

  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return; // a finger scrolls the page
    const dt = (e.timeStamp - vel.last) / 1000;
    if (here && dt > 0.001 && dt < 0.12) {
      vel.x += ((e.clientX - px) / dt - vel.x) * 0.5;
      vel.y += ((e.clientY - py) / dt - vel.y) * 0.5;
    } else {
      vel.x = vel.y = 0;
    }
    vel.last = e.timeStamp;
    vel.lastNow = performance.now();
    px = e.clientX; py = e.clientY; here = true;
    kick();
  }, { passive: true });
  document.addEventListener("pointerleave", () => { here = false; kick(); });
  addEventListener("blur", () => { here = false; kick(); });
  // On a touch screen a tap stands in for the pointer, for a moment.
  addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    px = e.clientX; py = e.clientY;
    const b = hit(px, py);
    if (b && b.el.closest('[data-cota-row="rule"]')) b.hold = 1.4;
    fcx = px; fcy = py; pointerFocus = 1.4;
    kick();
  }, { passive: true });
  // Scroll events do not bubble; caught on the way down, they come from
  // whichever element scrolls.
  // On a touch screen the marks show only while a finger is on the screen:
  // they go 0.2 s after it lifts, not after the page's momentum settles.
  let touching = false;
  addEventListener("scroll", () => {
    if (COARSE && !touching) return;
    scrollHold = 0.9; kick();
  }, { passive: true, capture: true });
  if (COARSE) {
    addEventListener("touchstart", () => { touching = true; }, { passive: true, capture: true });
    // A moment after the finger lifts, not the instant it does.
    const lift = () => { touching = false; scrollHold = Math.min(scrollHold, 0.2); kick(); };
    addEventListener("touchend", lift, { passive: true, capture: true });
    addEventListener("touchcancel", lift, { passive: true, capture: true });
  }

  /* ---- the scrollbar, as a dimension: a rule down the right edge, ticked at
     every tenth of the page, and on it the stretch of the page in view, with
     its offset. Shown while scrolling or with the pointer near the edge, and
     draggable like the bar it replaces. ---- */
  // The page scrolls itself, or #scroll-wrapper does with the AI layout on.
  const scrollerOf = () =>
    (document.documentElement.classList.contains("ai-layout-enabled") && document.getElementById("scroll-wrapper")) ||
    document.scrollingElement;
  // How far the scroller really scrolls. On a phone the page scrolls under the
  // browser's bars, and neither the root's clientHeight nor innerHeight says
  // for sure where it stops, shown or hidden. So the guess is the lower of the
  // two stops, raised to wherever the page is actually seen to scroll, and
  // forgotten once the page or the window changes size.
  let seen = { key: "", max: 0 };
  const maxOf = (s) => {
    const total = s.scrollHeight;
    if (s !== document.scrollingElement) return total - s.clientHeight;
    const key = `${total}|${s.clientHeight}|${innerHeight}`;
    if (seen.key !== key) seen = { key, max: total - Math.max(s.clientHeight, innerHeight) };
    seen.max = Math.min(total, Math.max(seen.max, s.scrollTop));
    return seen.max;
  };
  let scrollA = 0, scrollHold = 0, dragging = false;
  // On a touch screen the rule runs down the screen's very edge, its values
  // written along it on its left.
  const ruleX = () => W - (COARSE ? 1 : 14);
  const strip = document.createElement("div");
  strip.setAttribute("aria-hidden", "true");
  strip.style.cssText = "position:fixed;top:0;right:0;bottom:0;width:28px;z-index:61;touch-action:none";
  strip.className = "scroll-strip";
  document.body.appendChild(strip);
  function scrollTo(clientY) {
    // The inverse of the break: dragging puts the break under the pointer.
    const scroller = scrollerOf();
    const max = maxOf(scroller);
    scroller.scrollTop = Math.max(0, Math.min(1, clientY / Hh)) * max;
  }
  strip.addEventListener("pointerdown", (e) => {
    dragging = true;
    strip.classList.add("held");
    strip.setPointerCapture(e.pointerId);
    scrollTo(e.clientY);
    kick();
  });
  strip.addEventListener("pointermove", (e) => { if (dragging) scrollTo(e.clientY); });
  const drop = () => { dragging = false; strip.classList.remove("held"); kick(); };
  strip.addEventListener("pointerup", drop);
  strip.addEventListener("pointercancel", drop);

  /** Two marks at true scale on the right edge, up to the start of the page
   * and down to its end, meeting at the break. The break is where a scrollbar's
   * thumb would be, interpolated along it by how far the page has scrolled:
   * at its top edge at the start, at its bottom edge at the end. Thumb top is
   * st/total of the screen and its height clientHeight/total, so the break
   * comes to st/(total − clientHeight) of the screen: 0 at the start (y = 0)
   * and the screen's foot at the end (h − y = 0). Each end of the marks leaves
   * the screen once the page does, and its arrowhead with it. */
  const BREAK_R = 4;
  let diaA = 1;
  // How far each value on a touch screen has stepped aside from the circle.
  const aside = { y: 0, rest: 0 };
  const leanNow = { y: -1, rest: 1 };
  let leaning = false, frameDt = 0;
  function drawScroll() {
    if (scrollA < 0.01) return;
    const scroller = scrollerOf();
    const total = scroller.scrollHeight;
    const max = maxOf(scroller);
    if (max <= 1) return;
    // What is in view: the page from st on, to its end once scrolled all the way.
    const view = total - max;
    const x = ruleX();
    // Held within the page, so a rubber-band overscroll still reads 0.
    const st = Math.min(max, Math.max(0, scroller.scrollTop));
    const thumbTop = (st / total) * Hh;
    const thumbBot = ((st + view) / total) * Hh;
    const prog = Math.min(1, Math.max(0, st / max));
    const ref = thumbTop + prog * (thumbBot - thumbTop);
    const pageTop = -st;
    const pageEnd = total - st;
    const vis = (y) => y >= -1 && y <= Hh + 1;
    ink("measure");
    g.globalAlpha = A(scrollA * 0.85);
    g.lineWidth = 0.9;
    g.beginPath();
    // The break is a small circle on the rule, the two marks ending at it.
    g.moveTo(x, Math.max(pageTop, -10)); g.lineTo(x, ref - BREAK_R);
    g.moveTo(x, ref + BREAK_R); g.lineTo(x, Math.min(pageEnd, Hh + 10));
    for (const y of [pageTop, pageEnd]) if (vis(y)) { g.moveTo(x - 7, y); g.lineTo(x + 7, y); }
    if (vis(pageTop)) head(x, pageTop, 0, -1, Math.min(6, (ref - pageTop) / 2.5));
    if (vis(pageEnd)) head(x, pageEnd, 0, 1, Math.min(6, (pageEnd - ref) / 2.5));
    head(x, ref - BREAK_R, 0, 1, Math.min(6, (ref - BREAK_R - pageTop) / 2.5));
    head(x, ref + BREAK_R, 0, -1, Math.min(6, (pageEnd - ref - BREAK_R) / 2.5));
    stroke();
    g.beginPath();
    g.arc(x, ref, BREAK_R, 0, Math.PI * 2);
    g.stroke();
    // The values' boxes, so the diameter can give way to them.
    const taken = [];
    // The circle's diameter, small and level beside it, with no leader.
    // Where a value of the marks would run into it, it fades out instead.
    const diameter = () => {
      const text = `Ø ${mm(BREAK_R * 2)}`;
      g.font = `300 ${COARSE ? 10 : 12}px "Barlow Condensed", sans-serif`;
      const r = x - BREAK_R - 4, l = r - g.measureText(text).width, t = ref - 7, b = ref + 7;
      const clash = taken.some((q) => l < q.r + 3 && r > q.l - 3 && t < q.b + 3 && b > q.t - 3);
      const want = clash ? 0 : 1;
      diaA += (want - diaA) * (1 - Math.exp(-frameDt / 0.1));
      if (Math.abs(want - diaA) < 0.004) diaA = want;
      else leaning = true; // keep the loop running while it fades
      if (diaA < 0.01) return;
      ink("measure");
      g.save();
      g.globalAlpha = A(scrollA * 0.85 * diaA);
      g.textAlign = "right";
      g.textBaseline = "middle";
      g.fillText(text, r, ref);
      g.restore();
    };
    // The values in the page's own terms: where on the page the break stands.
    // At the top it is the page's start, all the way down its end, so y and
    // h − y reach exactly 0 there whatever the screen's bars are doing.
    const at = st + prog * view;
    const up = at, down = Math.max(0, total - at);
    // Each value on a leader: a 45° line from a fixed point on the mark, with a
    // small arrowhead on it, out to a horizontal shelf the value sits on.
    // y stays near the top of the screen and h − y near the bottom; a leader
    // slides only when its mark no longer reaches that point. y leans up,
    // h − y down, each flipped if it would leave the screen.
    const PIN = 56, PAD_V = 14, PAD_H = 10;
    const LEAD = 26;
    const put = (key, text, a, b, dir, pin) => {
      const y0 = Math.max(a, 0), y1 = Math.min(b, Hh);
      // The arrowhead keeps PAD_V clear of the break, on its side of the mark.
      // Once the mark is too short for that, the leader steps left instead,
      // up to PAD_H, by as much as the vertical room falls short.
      let lo = y0 + 4, hi = y1 - 4;
      if (key === "y") hi = Math.min(hi, ref - PAD_V);
      else lo = Math.max(lo, ref + PAD_V);
      let ay, shift = 0;
      if (hi >= lo) ay = Math.min(hi, Math.max(lo, pin));
      else {
        ay = (lo + hi) / 2;
        shift = PAD_H * Math.min(1, (lo - hi) / PAD_V);
      }
      ay = Math.min(Hh - 4, Math.max(4, ay));
      const tx = x - 1 - shift;
      g.font = FONT;
      const tw = g.measureText(text).width;
      if (ay + dir * (LEAD + 18) < 0 || ay + dir * (LEAD + 18) > Hh) dir = -dir;
      // A flip swings the leader through the horizontal instead of jumping.
      const d = (leanNow[key] += (dir - leanNow[key]) * (1 - Math.exp(-frameDt / 0.12)));
      if (Math.abs(dir - d) > 0.004) leaning = true;
      const ex = tx + 1 - LEAD, ey = ay + d * LEAD;
      const sx = ex - 8; // the landing, the value at its end
      ink("measure");
      g.globalAlpha = A(scrollA * 0.85);
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(ex, ey); g.lineTo(tx, ay);
      g.moveTo(ex, ey); g.lineTo(sx, ey);
      const hd = Math.hypot(LEAD, d * LEAD) || 1;
      head(tx, ay, LEAD / hd, (-d * LEAD) / hd, 5);
      stroke();
      g.globalAlpha = A(scrollA);
      g.save();
      g.textAlign = "right";
      g.textBaseline = "middle";
      g.fillText(text, sx - 4, ey);
      g.restore();
      taken.push({ l: sx - 4 - tw, r: sx - 4, t: ey - 9, b: ey + 9 });
    };
    leaning = false;
    if (COARSE) {
      // Along the mark, on its left, at the middle of the part of each
      // segment in view, kept whole on the screen.
      // Kept whole on the screen, a value can reach the circle at either end
      // of the page; there it steps aside by the circle's radius, eased.
      const along = (key, text, a, b) => {
        // Even at nothing (the page's very top or end) the value shows, as
        // on desktop, held whole on the screen beside the circle.
        if (b < -1 || a > Hh + 1) return;
        const v0 = Math.max(a, 6), v1 = Math.max(v0, Math.min(b, Hh - 6));
        g.font = FONT;
        const tw = g.measureText(text).width;
        const my = Math.min(Hh - tw / 2 - 6, Math.max(tw / 2 + 6, (v0 + v1) / 2));
        const near = my - tw / 2 < ref + BREAK_R + 3 && my + tw / 2 > ref - BREAK_R - 3;
        // Aside by the circle's radius: as close to the circle as it sits
        // to the rule.
        const want = near ? BREAK_R : 0;
        const d = (aside[key] += (want - aside[key]) * (1 - Math.exp(-frameDt / 0.12)));
        if (Math.abs(want - d) > 0.05) leaning = true;
        else aside[key] = want;
        ink("measure");
        g.globalAlpha = A(scrollA);
        label(text, x - 8 - aside[key], my, -Math.PI / 2);
        taken.push({ l: x - 15 - aside[key], r: x - 1 - aside[key], t: my - tw / 2, b: my + tw / 2 });
      };
      along("y", `y = ${mm(up)}`, pageTop, ref);
      along("rest", `h − y = ${mm(down)}`, ref, pageEnd);
      diameter();
      return;
    }
    put("y", `y = ${mm(up)}`, pageTop, ref, -1, PIN);
    put("rest", `h − y = ${mm(down)}`, ref, pageEnd, 1, Hh - PIN);
    diameter();
  }

  /* ---- the loop: eased in fast, out a little slower; asleep when idle ---- */
  const TAU_IN = 0.07, TAU_OUT = 0.35;
  let raf = 0, last = 0;
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function tick(now) {
    raf = 0;
    // A phone's bars can change the window's height without a resize event.
    if (innerHeight !== Hh || innerWidth !== W) layout();
    const dt = Math.min(0.05, (now - last) / 1000);
    frameDt = dt;
    last = now;
    const under = here ? hit(px, py) : null;
    let live = false;
    for (const b of blocks) {
      b.hold = Math.max(0, b.hold - dt);
      const want = b === under || b.hold > 0 ? 1 : 0;
      const tau = want > b.a ? TAU_IN : TAU_OUT;
      b.a += (want - b.a) * (1 - Math.exp(-dt / tau));
      if (Math.abs(want - b.a) < 0.004) b.a = want;
      else live = true;
      if (b.hold > 0) live = true;
    }
    if (performance.now() - vel.lastNow > 34) {
      const fade = Math.exp(-dt / 0.045);
      vel.x *= fade; vel.y *= fade;
    }
    const speed = Math.hypot(vel.x, vel.y);
    // |dv/dt|, eased so the figure can be read.
    if (dt > 0) {
      const raw = Math.hypot(vel.x - prevVX, vel.y - prevVY) / dt;
      accel += (raw - accel) * (1 - Math.exp(-dt / 0.15));
    }
    prevVX = vel.x; prevVY = vel.y;
    tNow += (Math.min(1, speed / V1) - tNow) * (1 - Math.exp(-dt / 0.05));
    if (here && speed > 40) {
      // A new movement wipes the last one's mark.
      if (!moved) {
        peak = 0; peakAccel = 0; moved = true;
        // Before any stop seen (the pointer just came in), where it is.
        if (stillX < -1e3) { stillX = px; stillY = py; }
        restX = stillX; restY = stillY;
        stowed = !!under;
      }
      curHold = 0.25;
      // The direction is the velocity's own, never eased: an eased angle
      // lags and points where the pointer no longer goes.
      dirX = vel.x / speed; dirY = vel.y / speed;
    } else {
      curHold = Math.max(0, curHold - dt);
      if (curHold === 0) moved = false;
      if (here && speed < 40) { stillX = px; stillY = py; }
    }
    reach += ((curHold > 0 ? tNow : 0) - reach) * (1 - Math.exp(-dt / 0.14));
    if (moved && reach > peak) peak = reach;
    if (moved && accel > peakAccel) peakAccel = accel;
    const wantCur = curHold > 0 ? 1 : 0;
    curAl += (wantCur - curAl) * (1 - Math.exp(-dt / (wantCur > curAl ? 0.1 : 0.35)));
    if (curAl < 0.004) curAl = 0;
    // The rings show only while the pointer moves.
    airA += (wantCur - airA) * (1 - Math.exp(-dt / (wantCur > airA ? 0.1 : 0.35)));
    if (airA < 0.004) airA = 0;
    pointerFocus = Math.max(0, pointerFocus - dt);
    scrollHold = Math.max(0, scrollHold - dt);
    const nearEdge = here && px > W - 90;
    const sw = scrollHold > 0 || dragging || nearEdge ? 1 : 0;
    scrollA += (sw - scrollA) * (1 - Math.exp(-dt / (sw > scrollA ? 0.08 : COARSE ? 0.08 : 0.45)));
    if (Math.abs(sw - scrollA) < 0.004) scrollA = sw;
    const fw = here || pointerFocus > 0 ? 1 : 0;
    focus += (fw - focus) * (1 - Math.exp(-dt / (fw > focus ? 0.15 : 0.5)));
    if (here) {
      const k = 1 - Math.exp(-dt / 0.06);
      fcx += (px - fcx) * k; fcy += (py - fcy) * k;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, Hh);
    // Over something dimensioned the pointer's air steps aside for its cota.
    if (under) stowed = true;
    const wantAir = stowed ? 0 : 1;
    airVis += (wantAir - airVis) * (1 - Math.exp(-dt / (wantAir > airVis ? 0.2 : 0.1)));
    if (Math.abs(wantAir - airVis) < 0.004) airVis = wantAir;
    else live = true;
    const keepA = airA, keepC = curAl;
    airA *= airVis; curAl *= airVis;
    drawAir();
    airA = keepA; curAl = keepC;
    mask();
    // Only touched blocks are drawn, so their marks skip the focus mask: a
    // wide block (a post's card) puts its mark far from the pointer.
    blocks.forEach((b, i) => { if (b.a > 0.004) drawBlock(i, b.a); });
    drawScroll();
    g.globalAlpha = 1;
    const moving = Math.hypot(px - fcx, py - fcy) > 0.3 && here;
    const airy = airA > 0 || speed > 1 || tNow > 0.002 || reach > 0.002 || curAl > 0;
    const scrolly = scrollHold > 0 || scrollA !== sw || leaning;
    if (live || moving || airy || scrolly || Math.abs(fw - focus) > 0.002) { raf = requestAnimationFrame(tick); last = now; }
  }

  readTheme();
  layout();
  addEventListener("resize", () => { layout(); kick(); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readTheme(); kick(); });
  new MutationObserver(() => { readTheme(); kick(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  // Nothing in the page's CSS uses the cotas' face, so the browser would not
  // fetch it for a canvas: ask for it, and redraw once it is in.
  document.fonts && document.fonts.load(FONT).then(kick, () => {});
  document.fonts && document.fonts.ready.then(kick);
})();
