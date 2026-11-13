// The cursor, drawn by the page in the cotas' style so one shape can morph
// into the next (a native cursor swaps instantly): an arrow, a pointing hand
// on what can be pressed, an I-beam over text, a double arrow on the scroll
// mark and a closed hand while holding it. Each role comes from the inherited
// --cur-role property (styles.css). Every shape is one closed outline plus up
// to four strokes, resampled to the same number of points, so any two blend
// point by point. Only for a fine pointer that can hover; the native cursor
// stays until the first mouse move, and on touch.
(() => {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const NS = "http://www.w3.org/2000/svg";
  const el = document.createElement("div");
  el.id = "ink-cursor";
  el.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "-32 -32 64 64");
  for (const c of ["ic-halo", "ic-fill", "ic-ink"]) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("class", c);
    svg.appendChild(p);
  }
  el.appendChild(svg);
  const src = document.createElementNS(NS, "svg");
  src.setAttribute("width", "0");
  src.setAttribute("height", "0");
  src.setAttribute("aria-hidden", "true");
  src.style.position = "absolute";
  document.body.append(el, src);

  // The dropdown's button sets its own cursor inside its shadow root.
  for (const dd of document.querySelectorAll("dropdown-trigger")) {
    if (!dd.shadowRoot) continue;
    const st = document.createElement("style");
    st.textContent = "button{cursor:inherit}";
    dd.shadowRoot.append(st);
  }

  // Hotspot, outline and strokes of each role, in a 32px box.
  const SHAPES = {
    "default": {
      "hot": [
        4,
        3
      ],
      "outline": "M4 3L4 24L9.5 18.5L13 27L16.5 25.5L13 17L20.5 17Z",
      "strokes": []
    },
    "pointer": {
      "hot": [
        12,
        4
      ],
      "outline": "M10.5 5.5A1.5 1.5 0 0 1 13.5 5.5V13A1.5 1.5 0 0 1 16.5 13V14A1.5 1.5 0 0 1 19.5 14V15A1.5 1.5 0 0 1 22.5 15V21C22.5 25 20.5 28 17 28H14C11.5 28 10 26.5 8.5 24.5L5.2 19.6A1.6 1.6 0 0 1 7.8 17.6L10.5 20Z",
      "strokes": [
        "M13.5 13V17",
        "M16.5 14V17",
        "M19.5 15V17"
      ]
    },
    "text": {
      "hot": [
        16,
        16
      ],
      "outline": "M16 7V25V7",
      "strokes": [
        "M13 7H19",
        "M13 25H19"
      ]
    },
    "ns": {
      "hot": [
        16,
        16
      ],
      "outline": "M16 3L22 10L18.5 10L18.5 22L22 22L16 29L10 22L13.5 22L13.5 10L10 10Z",
      "strokes": []
    },
    "grab": {
      "hot": [
        16,
        16
      ],
      "outline": "M8.5 14V12A1.75 1.75 0 0 1 12 12A1.75 1.75 0 0 1 15.5 12A1.75 1.75 0 0 1 19 12A1.75 1.75 0 0 1 22.5 12V19C22.5 23 20.5 25.5 17 25.5H14C10.5 25.5 8.5 23 8.5 19.5Z",
      "strokes": [
        "M12 12V14.5",
        "M15.5 12V14.5",
        "M19 12V14.5",
        "M8.5 16.5C10.5 15.5 13 15.5 15 16.8"
      ]
    }
  };
  const ROLES = Object.keys(SHAPES);
  const N_OUT = 72, N_STROKE = 14, SLOTS = 4;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Sample a path to n points, the hotspot moved to the origin.
  function sample(d, n, hot, closed) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    src.appendChild(p);
    const L = p.getTotalLength();
    const pts = [];
    for (let i = 0; i < n; i++) {
      const q = p.getPointAtLength((L * i) / (closed ? n : n - 1));
      pts.push([q.x - hot[0], q.y - hot[1]]);
    }
    p.remove();
    return pts;
  }
  const area = (pts) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  const centroid = (pts) => pts.reduce((c, p) => [c[0] + p[0] / pts.length, c[1] + p[1] / pts.length], [0, 0]);

  // Every cursor as the same number of points: the outline, then SLOTS strokes;
  // a stroke a cursor lacks is a point (it grows out of, or shrinks into, nothing).
  const FORMS = {};
  for (const r of ROLES) {
    const s = SHAPES[r];
    let out = sample(s.outline, N_OUT, s.hot, true);
    if (area(out) < 0) out.reverse();
    const strokes = [];
    for (let k = 0; k < SLOTS; k++) {
      if (s.strokes[k]) strokes.push(sample(s.strokes[k], N_STROKE, s.hot, false));
      else strokes.push(null);
    }
    FORMS[r] = { out, strokes };
  }
  for (const r of ROLES) {
    const c = centroid(FORMS[r].out);
    FORMS[r].strokes = FORMS[r].strokes.map((st) => st || Array.from({ length: N_STROKE }, () => [c[0], c[1]]));
  }
  // Outlines start where they best line up with the default arrow's, so a
  // morph turns as little as it can.
  function align(a, b) {
    let best = 0, bestD = Infinity;
    for (let o = 0; o < b.length; o++) {
      let d = 0;
      for (let i = 0; i < a.length; i += 3) { const q = b[(i + o) % b.length]; d += (a[i][0] - q[0]) ** 2 + (a[i][1] - q[1]) ** 2; }
      if (d < bestD) { bestD = d; best = o; }
    }
    return b.slice(best).concat(b.slice(0, best));
  }
  for (const r of ROLES) if (r !== ROLES[0]) FORMS[r].out = align(FORMS[ROLES[0]].out, FORMS[r].out);

  const copy = (f) => ({ out: f.out.map((p) => p.slice()), strokes: f.strokes.map((s) => s.map((p) => p.slice())) });
  let shown = copy(FORMS[ROLES[0]]);
  let from = copy(shown), to = FORMS[ROLES[0]], t0 = 0, role = ROLES[0], raf = 0;
  const DUR = 200;
  const ease = (u) => 1 - Math.pow(1 - u, 3);
  const [halo, fill, ink] = el.querySelectorAll("path");

  const poly = (pts, close) => "M" + pts.map((p) => p[0].toFixed(2) + " " + p[1].toFixed(2)).join("L") + (close ? "Z" : "");
  function render() {
    // A stroke shrunk to (nearly) a point is left out: its round caps would
    // leave a dot.
    const span = (pts) => Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) +
      Math.hypot(pts[0][0] - pts[pts.length >> 1][0], pts[0][1] - pts[pts.length >> 1][1]);
    const strokes = shown.strokes.filter((s) => span(s) > 0.6).map((s) => poly(s, false)).join("");
    const outline = poly(shown.out, true);
    fill.setAttribute("d", outline);
    halo.setAttribute("d", outline + strokes);
    ink.setAttribute("d", outline + strokes);
  }
  function frame(now) {
    const u = Math.min(1, (now - t0) / DUR), k = ease(u);
    const mix = (a, b) => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * k, p[1] + (b[i][1] - p[1]) * k]);
    shown = { out: mix(from.out, to.out), strokes: from.strokes.map((s, i) => mix(s, to.strokes[i])) };
    render();
    raf = u < 1 ? requestAnimationFrame(frame) : 0;
  }
  function setRole(r) {
    if (!FORMS[r] || r === role) return;
    role = r;
    from = copy(shown);
    to = FORMS[r];
    if (reduced) { shown = copy(to); render(); return; }
    t0 = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
  }
  render();

  const root = document.documentElement;
  const roleOf = (t) => getComputedStyle(t && t.nodeType === 1 ? t : (t && t.parentElement) || root).getPropertyValue("--cur-role").trim() || "default";
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    root.classList.add("ink-cursor");
    el.classList.add("on");
    el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    setRole(roleOf(e.composedPath()[0]));
  }, { passive: true, capture: true });
  const roleAt = (x, y) => setRole(roleOf(document.elementFromPoint(x, y)));
  addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    el.classList.add("press");
    setTimeout(() => roleAt(e.clientX, e.clientY));
  }, true);
  addEventListener("pointerup", (e) => { el.classList.remove("press"); setTimeout(() => roleAt(e.clientX, e.clientY)); }, true);
  root.addEventListener("mouseleave", () => el.classList.remove("on"));
})();
