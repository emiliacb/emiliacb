// Going back closes a sheet: on Android, ui-sdk listens for it with a
// CloseWatcher. But the request goes to the document that has the focus, and
// once an embedded frame (Cal.com's calendar) has been touched, that is the
// frame, which has nothing to close, so the browser left the page instead.
//
// guardBack(drawer), called as a drawer opens, puts an entry of its own in
// the history (same URL), so that a back press takes it and closes the
// drawer, wherever the focus is. Closed any other way (the X, Escape,
// outside, or the CloseWatcher when the focus is on the page), the entry is
// taken back off. A frame that adds entries of its own (Cal.com, when a time
// is picked) is gone back through first, which is what it should do.
const KEY = "sidebar";
const watched = new WeakSet();
let guarded = null;

const ours = (drawer) => Boolean(history.state && history.state[KEY] === drawer.id);

window.addEventListener("popstate", function () {
  const drawer = guarded;
  if (!drawer || ours(drawer)) return;
  guarded = null;
  if (drawer.open) drawer.open = false;
});

export function guardBack(drawer) {
  if (!watched.has(drawer)) {
    watched.add(drawer);
    drawer.addEventListener("openchangecomplete", function () {
      if (drawer.open || guarded !== drawer) return;
      guarded = null;
      if (ours(drawer)) history.back();
    });
  }
  if (guarded === drawer) return;
  guarded = drawer;
  history.pushState({ [KEY]: drawer.id }, "");
}
