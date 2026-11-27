# Regions: selectors and pitfalls

Facts checked against the site's code and in the browser. Each row of the checklist in SKILL.md has a section here, ending in how to verify it.

## Tokens

Set on `:root`. Base tokens: `--color-paper` (ground), `--color-ink` (text), `--color-accent` (link fills, the footer), `--color-signal` (underlines, loading bar), `--font-sans`, `--font-size-base` (a percentage; every size is in rem, so it scales type and spacing), `--radius-frame`, `--radius-overlay`, `--size-content`. The grey scale (`--color-stone-*`) derives from paper and ink, so changing those two moves every neutral. Role tokens, when a look needs them: `--color-raised` (cards), `--color-hairline`, `--color-code-bg`, `--color-code-ink`, `--color-strong`, `--color-on-strong`.

`--color-on-accent` is the text on the accent (the footer, the sound window's hover). It is derived from the accent, so a new accent keeps readable text; `--color-on-ink` and `--color-on-strong` are derived the same way. Set one only to override, and read the footer's colours back to check.

Dark mode swaps the neutral scale, so a dark palette written into the light block shows correctly only in light mode. Use `set_variables` with `mode: both`, or force one mode with `set_theme_mode`. Without `set_variables`, write `set_css` on `:root`, repeated under `:root[data-theme=dark]` and the dark media query.

Radius: `--radius-frame` and `--radius-overlay` are the only radius tokens; most of the site's corners are square. Pick square or round once and apply it through them (and `border-radius` on the few elements that have one), not element by element.

Verify with `get_variables`.

## Navbar

`#page-shell > nav` (sticky). Links are `#page-shell > nav a`. On phones the About entry is a `dropdown-trigger`.

Its line is the nav's first `div` (`#page-shell > nav > div:first-of-type`): a grey bottom border (from the stone scale, so it follows paper and ink) with a 2px accent line on its `::before` that is green in light and blue in dark: Tailwind colours, not tokens. Restyle both on purpose: recolour the border and the `::before`'s `border-bottom-color`, or hide them.

On the home and every page with the tree, on desktop, the nav is tilted by 1.5 degrees on purpose (it leans with the tree, and a view transition carries it between pages). Keep the tilt unless the visitor asks otherwise: do not set `transform` or `rotate` on `#page-shell > nav`, and never "fix" it.

Verify with `get_css_by_selector` on `#page-shell > nav > div:first-of-type`.

## Content

`#content` is the text column (`--size-content`), `.markdown-content` the prose. Headings, `a`, `pre` and `code` are restyled with `.markdown-content h1` and the like; links are filled with the accent. The home's content also leans and bends with the tree's sound: leave `transform` alone.

## Page shell

`#overlay-content` is the page's sheet. Once scrolled it gets `.scrolled` and rounds its bottom corners with `--radius-overlay`; the footer runs behind those corners, so keep the footer's background close to the sheet's.

## Gradient

`#gradient-bg`. On pages without the tree it is five `.grad-layer` discs coloured by `--g-a` and `--g-b` (`r g b` channels, not colours). On the home it is empty. `start_black_hole`, when listed, is a click effect on it.

## Tree (home and `labs/distortion-bg`)

`#tree-illustration` holds `.cover-tree` (an SVG), a canvas for its anatomy drawn from `--tree-ink-*` (all derived from `--tree-hue`), and the floating equations, which render in a shadow root: agent CSS does not reach them, so restyle them with `--tree-hue` and `--tree-ink-*`. Its colours are tokens, with the same meaning in light and dark (no inversion): `--tree-grad-a` and `--tree-grad-b` (`r g b`) are the leaves and trunk as you see them, and `--tree-hue` (0-360) is the ink. Set them for both modes (`mode: both`) and the drawing, the canvas and the sound window `.tree-sound-ask` (its title bar) agree. `.tree-tilt-sign` shows only on touch. `play_tree_song`, when listed, plays the tree.

Verify with `get_variables` (prefix `--tree`) and a screenshot in both modes.

## Cotas

The dimension lines in ink that measure the page and follow the pointer, drawn over the page on `.page-cotas-plate`. They are part of the look: a restyle recolours or hides them, it does not leave them in the old ink. Ink tokens: `--cota-measure`, `--cota-length`, `--cota-force`, `--cota-scroll`, all derived from `--tree-hue`, so changing the hue moves them with the tree. Their numbers use `--font-cota`. `--cotas-display: none` hides them.

Verify with `get_variables` (prefix `--cota`).

## Effects that distort the page

Two effects bend the whole page and would show it in its old look: the warp while the tree sounds (`--fx-ui-warp`) and the black hole's shockwave (`--fx-shockwave`). Both are `off` as soon as you change any style, and come back with `reset_css` or a reload. Turn one back on only if the restyle should keep it: `set_variables({ variables: { "--fx-ui-warp": "on" } })`.

## Sidebars

GitHub, LinkedIn, Email and Schedule are `ui-drawer` elements already in the page, shown only when opened: `.sidebar-sheet` (surface), `.sidebar-backdrop`, `.sidebar-scroll` (body), `.sidebar-actions` (bottom bar), `.sidebar-number` (the big figure), `.sidebar-close`. A sidebar of the agent's own is `#custom-sidebar`. Open one with `click_link_or_button`: the contact row and the footer have the same trigger, listed once with the other id in `alsoAt`. Ids belong to one page load, so list again after navigating.

Verify by opening one, then `get_css_by_selector` on `.sidebar-sheet`.

## Footer

`#scroll-wrapper > footer`: sticky at the bottom, behind the content sheet, filled with `--color-accent`, with a negative top margin and padding that use `--radius-overlay`. Do not set its margin or padding. Its links use `.interactive`.

A full-page screenshot does not show it, because it sits behind the sheet until the page is scrolled to the end. Verify by scrolling to the bottom, or with `get_css_by_selector` on `#scroll-wrapper > footer` and on `#scroll-wrapper > footer a`.

## Cursor

On desktop the native cursor is hidden (`html.ink-cursor * { cursor: none !important }`) and `#ink-cursor`, a fixed SVG, is drawn on top in `--ic-ink`, `--ic-halo` and `--ic-fill`. Over a sidebar the system cursor returns.

The shape follows the inherited `--cur-role` (`default`, `text`, `pointer`, `ns`, `grab`): links, buttons, `summary` and `label` are `pointer`, prose in `#content` is `text`. Restyle the cursor with the three tokens, never with `cursor:` on elements: it is overridden and the native one stays hidden; do not unhide it unless the visitor asks. Whatever you insert or overlay must not cover `#ink-cursor` (keep its `z-index` below the cursor's), and a clickable element you add that is not a link or button should set `--cur-role: pointer`.

Verify by moving the mouse over each kind of element and over your additions.

## Buttons and links

`.interactive` (hover and press transitions), `.shadow-border` (card edge from `--shadow-edge*`), and `dropdown-trigger::part(trigger)` for the menus: a part selector is the only way into their shadow root.

## Fonts

`--font-sans` is the text face; the cotas use `--font-cota` and the tree's formulas `--font-script`.
