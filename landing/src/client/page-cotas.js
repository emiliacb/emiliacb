// The page in technical-drawing ink: whatever block the pointer touches is
// dimensioned (its height, in CSS millimetres), the pointer carries its rings,
// its velocity on a rule and its acceleration, and the right edge holds two
// marks at true scale, up to the start of the page and down to its end,
// meeting at the break (where a scrollbar's thumb would be). Nothing is drawn
// until the pointer moves; everything fades with distance from it and shortly
// after it leaves. The ink comes from the --cota-* properties in styles.css.
// Prototyped as an artifact; with reduced motion this does nothing.
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // data-air="off" on the script tag leaves the pointer's rings, rule and
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
    TONE.circle = cs.getPropertyValue("--cota-circle").trim();
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
  function head(x, y, ux, uy, len) {
    g.moveTo(x - len * (ux * 0.9 - uy * 0.4), y - len * (uy * 0.9 + ux * 0.4));
    g.lineTo(x, y);
    g.lineTo(x - len * (ux * 0.9 + uy * 0.4), y - len * (uy * 0.9 - ux * 0.4));
  }
  function label(text, x, y, ang) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.font = `italic 15px "EB Garamond", serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 0, 0);
    g.restore();
  }
  // CSS millimetres: CSS fixes 1in = 96px, so 1px = 25.4/96 mm. True to the
  // page's own units; a physical ruler on the screen will differ by device.
  const mm = (px) => {
    const v = (px * 25.4) / 96;
    return `${v < 100 ? v.toFixed(1) : Math.round(v)} mm`;
  };

  /** A value on a 45° leader: a small arrowhead at (tx, ty), a diagonal out
   * toward (sx, sy) and a level shelf the value sits on. Turned back across
   * the box it measures, the diagonal runs on until the shelf clears it. */
  function leader(text, tx, ty, sx, sy, a, clear = 0) {
    let LEAD = 22;
    g.font = `italic 15px "EB Garamond", serif`;
    const tw = g.measureText(text).width;
    LEAD = Math.max(LEAD, clear);
    if (sx < 0 && tx - LEAD - tw - 8 < 6) sx = 1;
    if (sx > 0 && tx + LEAD + tw + 8 > W - 6) sx = -1;
    if (sy > 0 && ty + LEAD + 4 > Hh) sy = -1;
    if (sy < 0 && ty - LEAD - 18 < 0) sy = 1;
    const ex = tx + sx * LEAD, ey = ty + sy * LEAD;
    const fx = ex + sx * (tw + 8);
    g.globalAlpha = A(a * 0.85);
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(tx, ty); g.lineTo(ex, ey); g.lineTo(fx, ey);
    head(tx, ty, -sx * Math.SQRT1_2, -sy * Math.SQRT1_2, 5);
    g.stroke();
    g.globalAlpha = A(a);
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.fillText(text, Math.min(ex, fx) + 4, ey - 4);
  }

  /** A vertical mark at x from y0 to y1, extension lines back to ex. Its value
   * is placed, like the scroll marks', where the screen can show it: on the
   * part of the mark in view, kept whole inside the screen, and on the other
   * side of the mark when the given one has no room. A level value that fits
   * on neither side moves, mark and all, to `alt` (right of the text). */
  function vMark(y0, y1, x, ex, text, kind, a, side, alt) {
    if (y1 - y0 < 2) return;
    const EDGE = 6;
    g.font = `italic 15px "EB Garamond", serif`;
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
    g.stroke();
    g.globalAlpha = A(a);
    g.save();
    g.font = `italic 15px "EB Garamond", serif`;
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

  /* ---- the pointer's air, as on the tree: the contact ring thickens with
     speed, the wake ring around it, and the velocity on a rule ---- */
  const CONTACT = 24, WAKE = 80, V1 = 2600, RISE = 0.05, FALL = 0.2;
  let airA = 0, tNow = 0, curAl = 0, curHold = 0;
  function arrow(x0, y0, x1, y1, hl) {
    const d = Math.hypot(x1 - x0, y1 - y0) || 1;
    const ux = (x1 - x0) / d, uy = (y1 - y0) / d;
    g.beginPath();
    g.moveTo(x0, y0); g.lineTo(x1, y1);
    g.moveTo(x1 - hl * (ux * 0.9 - uy * 0.45), y1 - hl * (uy * 0.9 + ux * 0.45));
    g.lineTo(x1, y1);
    g.lineTo(x1 - hl * (ux * 0.9 + uy * 0.45), y1 - hl * (uy * 0.9 - ux * 0.45));
  }
  // The rule's direction and the arrow's reach, eased so the arrow glides.
  let dirX = 1, dirY = 0, reach = 0;
  // The furthest the arrow reached in the current movement: a dot on the rule
  // that stays until the next movement starts.
  // It fades out with the rings.
  let peak = 0, moved = false;
  const FULL = 110;
  // CSS metres: 1px = 0.0254/96 m.
  const PX_M = 0.0254 / 96;
  // `accel` follows the pointer; `peakAccel` is the most this movement
  // reached, the value shown, kept like the peak mark until the next one.
  let accel = 0, peakAccel = 0, prevVX = 0, prevVY = 0;
  function drawAir() {
    if (NO_AIR) return;
    if (airA > 0.01) {
      ink("circle");
      g.lineWidth = 0.8 + 1.2 * reach;
      g.globalAlpha = A(airA * (0.25 + 0.3 * reach));
      g.beginPath(); g.arc(px, py, CONTACT, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 0.7;
      g.globalAlpha = A(airA * 0.18);
      g.beginPath(); g.arc(px, py, WAKE, 0, Math.PI * 2); g.stroke();
    }
    const ux = dirX, uy = dirY;
    const x0 = px + ux * CONTACT, y0 = py + uy * CONTACT;
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
      g.stroke();
      if (reach > 0.01) {
        arrow(x0, y0, x0 + ux * FULL * reach, y0 + uy * FULL * reach, 6);
        g.globalAlpha = A(curAl * 0.6);
        g.lineWidth = 1;
        g.stroke();
      }
    }
    if (airA > 0.01 && peak > 0.01) {
      g.globalAlpha = A(airA * 0.6);
      g.lineWidth = 0.9;
      g.beginPath();
      g.arc(x0 + ux * FULL * peak, y0 + uy * FULL * peak, 3, 0, Math.PI * 2);
      g.stroke();
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
        tx = px + sx * CONTACT * Math.SQRT1_2;
        ty = py + sy * CONTACT * Math.SQRT1_2;
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
    if (b) b.hold = 1.4;
    fcx = px; fcy = py; pointerFocus = 1.4;
    kick();
  }, { passive: true });
  // Scroll events do not bubble; caught on the way down, they come from
  // whichever element scrolls.
  addEventListener("scroll", () => { scrollHold = 0.9; kick(); }, { passive: true, capture: true });

  /* ---- the scrollbar, as a dimension: a rule down the right edge, ticked at
     every tenth of the page, and on it the stretch of the page in view, with
     its offset. Shown while scrolling or with the pointer near the edge, and
     draggable like the bar it replaces. ---- */
  // The page scrolls itself, or #scroll-wrapper does with the AI layout on.
  const scrollerOf = () =>
    (document.documentElement.classList.contains("ai-layout-enabled") && document.getElementById("scroll-wrapper")) ||
    document.scrollingElement;
  let scrollA = 0, scrollHold = 0, dragging = false;
  const ruleX = () => W - 14;
  const strip = document.createElement("div");
  strip.setAttribute("aria-hidden", "true");
  strip.style.cssText = "position:fixed;top:0;right:0;bottom:0;width:28px;z-index:61;touch-action:none";
  strip.className = "scroll-strip";
  document.body.appendChild(strip);
  function scrollTo(clientY) {
    // The inverse of the break: dragging puts the break under the pointer.
    const scroller = scrollerOf();
    const max = scroller.scrollHeight - scroller.clientHeight;
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
  const leanNow = { y: -1, rest: 1 };
  let leaning = false, frameDt = 0;
  function drawScroll() {
    if (scrollA < 0.01) return;
    const scroller = scrollerOf();
    const total = scroller.scrollHeight;
    if (total <= scroller.clientHeight + 1) return;
    const x = ruleX();
    const st = scroller.scrollTop;
    const view = scroller.clientHeight;
    const thumbTop = (st / total) * Hh;
    const thumbBot = ((st + view) / total) * Hh;
    const prog = Math.min(1, Math.max(0, st / (total - view)));
    const ref = thumbTop + prog * (thumbBot - thumbTop);
    const pageTop = -st;
    const pageEnd = total - st;
    const vis = (y) => y >= -1 && y <= Hh + 1;
    ink("measure");
    g.globalAlpha = A(scrollA * 0.85);
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(x, Math.max(pageTop, -10)); g.lineTo(x, Math.min(pageEnd, Hh + 10));
    g.moveTo(x - 7, ref); g.lineTo(x + 7, ref);
    for (const y of [pageTop, pageEnd]) if (vis(y)) { g.moveTo(x - 7, y); g.lineTo(x + 7, y); }
    if (vis(pageTop)) head(x, pageTop, 0, -1, Math.min(6, (ref - pageTop) / 2.5));
    if (vis(pageEnd)) head(x, pageEnd, 0, 1, Math.min(6, (pageEnd - ref) / 2.5));
    head(x, ref, 0, 1, Math.min(6, (ref - pageTop) / 2.5));
    head(x, ref, 0, -1, Math.min(6, (pageEnd - ref) / 2.5));
    g.stroke();
    g.globalAlpha = A(scrollA);
    const up = ref - pageTop, down = pageEnd - ref;
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
      g.font = `italic 15px "EB Garamond", serif`;
      const tw = g.measureText(text).width;
      if (ay + dir * (LEAD + 18) < 0 || ay + dir * (LEAD + 18) > Hh) dir = -dir;
      // A flip swings the leader through the horizontal instead of jumping.
      const d = (leanNow[key] += (dir - leanNow[key]) * (1 - Math.exp(-frameDt / 0.12)));
      if (Math.abs(dir - d) > 0.004) leaning = true;
      const ex = tx + 1 - LEAD, ey = ay + d * LEAD;
      const sx = ex - tw - 8;
      ink("measure");
      g.globalAlpha = A(scrollA * 0.85);
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(ex, ey); g.lineTo(tx, ay);
      g.moveTo(ex, ey); g.lineTo(sx, ey);
      const hd = Math.hypot(LEAD, d * LEAD) || 1;
      head(tx, ay, LEAD / hd, (-d * LEAD) / hd, 5);
      g.stroke();
      g.globalAlpha = A(scrollA);
      g.save();
      g.textAlign = "left";
      g.textBaseline = "alphabetic";
      g.fillText(text, sx + 4, ey - 4);
      g.restore();
    };
    leaning = false;
    put("y", `y = ${mm(up)}`, pageTop, ref, -1, PIN);
    put("rest", `h − y = ${mm(down)}`, ref, pageEnd, 1, Hh - PIN);
  }

  /* ---- the loop: eased in fast, out a little slower; asleep when idle ---- */
  const TAU_IN = 0.07, TAU_OUT = 0.35;
  let raf = 0, last = 0;
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function tick(now) {
    raf = 0;
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
      if (!moved) { peak = 0; peakAccel = 0; moved = true; }
      curHold = 0.25;
      // The direction is the velocity's own, never eased: an eased angle
      // lags and points where the pointer no longer goes.
      dirX = vel.x / speed; dirY = vel.y / speed;
    } else {
      curHold = Math.max(0, curHold - dt);
      if (curHold === 0) moved = false;
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
    scrollA += (sw - scrollA) * (1 - Math.exp(-dt / (sw > scrollA ? 0.08 : 0.45)));
    if (Math.abs(sw - scrollA) < 0.004) scrollA = sw;
    const fw = here || pointerFocus > 0 ? 1 : 0;
    focus += (fw - focus) * (1 - Math.exp(-dt / (fw > focus ? 0.15 : 0.5)));
    if (here) {
      const k = 1 - Math.exp(-dt / 0.06);
      fcx += (px - fcx) * k; fcy += (py - fcy) * k;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, Hh);
    drawAir();
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
  document.fonts && document.fonts.ready.then(kick);
})();
