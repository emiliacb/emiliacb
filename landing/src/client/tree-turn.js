// The home's content turns, a little, about the tree, like a hand on a dial
// whose pin is the tree: towards the side of the tree the pointer is on, and
// more the nearer the pointer gets, so moving towards the tree is answered and
// moving away lets the page settle back. The tree itself never moves.
//
// Only the angle and the pin are set here, as --tree-turn and --tree-x/-y on
// #content; the transform that uses them, with the page's lean, is in
// styles.css. Only #content turns: it is the element the view transition
// animates, so it may leave the page turned and arrive straight, where the
// navbar, which is not animated, has to look the same on every page.
//
// With reduced motion, on touch screens and below md, this does nothing and
// the content keeps the lean alone.
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine)").matches) return;
  const tree = document.querySelector("#tree-illustration .cover-tree");
  const content = document.getElementById("content");
  if (!tree || !content) return;

  const MAX = 2; // degrees, with the pointer at the tree
  const REACH = 1100; // px from the tree where the turn starts
  const EASE = 0.08; // of the way to the target each frame

  // The pin: the tree's middle, a little above half its height. In viewport
  // coordinates, read again on scroll; and from the content's own top-left as
  // laid out, which only a resize or a late font moves.
  let tx = 0, ty = 0;
  function measureTree() {
    const r = tree.getBoundingClientRect();
    tx = r.left + r.width / 2;
    ty = r.top + r.height * 0.45;
  }
  function measure() {
    measureTree();
    // The content's transform is set aside to read where it is laid out.
    content.style.transform = "none";
    const c = content.getBoundingClientRect();
    content.style.transform = "";
    content.style.setProperty("--tree-x", `${(tx - c.left).toFixed(1)}px`);
    content.style.setProperty("--tree-y", `${(ty - c.top).toFixed(1)}px`);
  }

  // The content lies to the left of the tree (angle π from it). The sine of
  // the pointer's angle from there is 0 on that line and beyond the tree, 1
  // straight above the tree and -1 straight below, so the turn never jumps as
  // the pointer goes round.
  let px = null, py = null, a = 0, raf = 0;
  function frame() {
    raf = 0;
    let target = 0;
    if (px !== null) {
      const near = Math.max(0, Math.min(1, 1 - Math.hypot(px - tx, py - ty) / REACH));
      const side = Math.sin(Math.atan2(py - ty, px - tx) - Math.PI);
      target = MAX * side * near * near * (3 - 2 * near);
    }
    a += (target - a) * EASE;
    if (Math.abs(target - a) < 1e-3) a = target;
    content.style.setProperty("--tree-turn", `${a.toFixed(3)}deg`);
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
