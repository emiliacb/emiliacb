// The page's effect switches, read from the tokens (see FX SWITCHES in
// src/styles.css): `--fx-ui-warp` and `--fx-shockwave`, each "on" or "off".
//
// They are read from the computed style at the moment an effect would start,
// not cached, so a change made at runtime (an agent's set_variables, or any
// stylesheet that redefines them) is honoured by the very next effect without
// anything having to listen. Reading one custom property off the root is
// cheap, and none of the callers runs more than once a frame. Anything other
// than the exact word "off" counts as on, so a typo in an override never
// silently removes an effect.

/**
 * @param {"--fx-ui-warp" | "--fx-shockwave"} name the switch.
 * @returns {boolean} whether the effect may run now.
 */
export function fxOn(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() !== "off";
}
