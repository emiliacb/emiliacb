# Regions: selectors and pitfalls

Facts checked against the site's code and in the browser. Each row of the checklist in SKILL.md has a section here.

## Tokens

Set on `:root`. Base tokens: `--color-paper` (ground), `--color-ink` (text), `--color-accent` (link fills, the footer), `--color-signal` (underlines, loading bar), `--font-sans`, `--font-size-base` (a percentage; every size is in rem, so it scales type and spacing), `--radius-frame`, `--radius-overlay`, `--size-content`. The grey scale (`--color-stone-*`) derives from paper and ink, so changing those two moves every neutral. Role tokens, when a look needs them: `--color-raised` (cards), `--color-hairline`, `--color-code-bg`, `--color-code-ink`, `--color-strong`, `--color-on-strong`.

Dark mode swaps the neutral scale, so a dark palette written into the light block shows correctly only in light mode. Force one mode with `set_theme_mode`, or repeat the tokens in `:root[data-theme=dark]` and in the dark media query.

## Navbar

`#page-shell > nav` (sticky; on the home on desktop it leans 1.5 degrees with the tree). Links are `#page-shell > nav a`; its rule is the `div` child with `border-b`. On phones the About entry is a `dropdown-trigger`. Do not set `transform` on it: the lean and the view transition use it.

## Content

`#content` is the text column (`--size-content`), `.markdown-content` the prose. Headings, `a`, `pre` and `code` are restyled with `.markdown-content h1` and the like; links are filled with the accent. The home's content also leans and bends with the tree's sound: leave `transform` alone.

## Page shell

`#overlay-content` is the page's sheet. Once scrolled it gets `.scrolled` and rounds its bottom corners with `--radius-overlay`; the footer runs behind those corners, so keep the footer's background close to the sheet's.

## Gradient

`#gradient-bg`. On pages without the tree it is five `.grad-layer` discs coloured by `--g-a` and `--g-b` (`r g b` channels, not colours). On the home it is empty. `start_black_hole`, when listed, is a click effect on it.

## Tree (home and `labs/distortion-bg`)

`#tree-illustration` holds `.cover-tree` (an SVG whose paint is fixed in the markup, plus a `filter: invert(1)` in dark mode), a canvas for its anatomy drawn from `--tree-ink-*` (all derived from `--tree-hue`), and `.tree-floats`, the floating equations. To recolour the drawing: `.cover-tree { filter: none }` and `.cover-tree path { fill: ... }`, and set `--tree-invert: 0` so what is drawn beside it agrees. The sound permission window `.tree-sound-ask` takes its title bar from `--tree-grad-a` and `--tree-grad-b` (`r g b`). `.tree-tilt-sign` shows only on touch. `play_tree_song`, when listed, plays the tree.

## Cotas

The dimension lines drawn over the page, on `.page-cotas-plate`. Ink: `--cota-measure`, `--cota-length`, `--cota-force`, `--cota-scroll`. `--cotas-display: none` hides them.

## Sidebars

GitHub, LinkedIn, Email and Schedule are `ui-drawer` elements already in the page, shown only when opened: `.sidebar-sheet` (surface), `.sidebar-backdrop`, `.sidebar-scroll` (body), `.sidebar-actions` (bottom bar), `.sidebar-number` (the big figure), `.sidebar-close`. A sidebar of the agent's own is `#custom-sidebar`. Open one with `click_link_or_button`; the footer and the contact row both have a GitHub trigger, so click by id.

## Footer

`#scroll-wrapper > footer`: sticky at the bottom, filled with `--color-accent`, with a negative top margin and padding that use `--radius-overlay`. Do not set its margin or padding. Its links use `.interactive`.

## Cursor

`#ink-cursor`, drawn in `--ic-ink`, `--ic-halo` and `--ic-fill`. Over a sidebar the system cursor returns.

## Buttons and links

`.interactive` (hover and press transitions), `.shadow-border` (card edge from `--shadow-edge*`), and `dropdown-trigger::part(trigger)` for the menus: a part selector is the only way into their shadow root.

## Fonts

`--font-sans` is the text face; the cotas use `--font-cota` and the tree's formulas `--font-script`.
