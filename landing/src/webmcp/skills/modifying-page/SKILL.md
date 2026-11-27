---
name: modifying-page
description: "Use when the visitor asks to restyle, re-theme, redesign or edit this page, make it look like another site or product, change colours, fonts, sizes or text, or when a restyle left parts of the page untouched."
---

# Modifying the page

## Overview

A restyle is finished when every row of the checklist is filled and verified, not when the main content looks right.

## When to use

- "Make it look like a terminal", "dark minimal", "bigger text", "another font".
- A restyle that left the footer, a sidebar or the tree in the old look.

## Procedure

1. `get_variables` first. Load fonts with `set_google_font`.
2. Change tokens with `set_variables` (`mode: both`).
3. Only then CSS (`set_css_by_selector`), region by region. `read_skill` with `file: "regions.md"` gives selectors, pitfalls and how to verify each row.
4. A rejected call lists what broke: send a corrected change. `force: true` is for an effect that is intended.
5. Tell the visitor what changed and how to undo it: `reset_css`, `set_theme_mode` with `system`, or reload.

## Required for every restyle

- **Tokens first.** CSS only for what tokens do not reach.
- **Contrast.** Check text on every background you changed: page, accent (footer), buttons, sidebars, the tree's sound window. Body text 4.5:1 or more. `--color-on-accent` follows the accent by itself; verify it, set it only to override.
- **One radius language**, square or round, through `--radius-frame` and `--radius-overlay` (and any radius token `get_variables` lists), never per element.

## Checklist: all rows are required

| Row | Restyle with |
| --- | --- |
| Tokens | `--color-paper`, `--color-ink`, `--color-accent`, `--color-signal`, `--font-sans`, `--font-size-base`, radii |
| Navbar | `#page-shell > nav`; its line is `#page-shell > nav > div:first-of-type` and its `::before`. Its tilt on the tree pages is deliberate: keep it |
| Content, shell | `#content`, `.markdown-content`, `#overlay-content` |
| Gradient | `--g-a`, `--g-b` (`r g b`) |
| Tree (home) | `--tree-hue`, `--tree-grad-a`, `--tree-grad-b` (`r g b`, as seen in each mode) |
| Cotas | `--cota-*`, `--tree-hue`, `--font-cota`, or `--cotas-display: none`: restyle or hide them, never ignore them |
| Sidebars | `.sidebar-sheet`, `.sidebar-backdrop`, `.sidebar-actions` |
| Footer | `#scroll-wrapper > footer`, `--color-accent` |
| Cursor | `--ic-ink`, `--ic-halo`, `--ic-fill` |
| Buttons, links | `.interactive`, `dropdown-trigger::part(trigger)` |

## Craft

- One personality: radius, borders, shadows, type and motion match in every region.
- Transitions name exact properties (never `all`), 250 ms or less, ease-out with a strong curve such as `cubic-bezier(0.23, 1, 0.32, 1)`, never ease-in. Never animate from `scale(0)`.
- Hover effects behind `@media (hover: hover) and (pointer: fine)`; pressable things get `:active { transform: scale(0.97) }`.
- Under `prefers-reduced-motion` keep opacity and colour, drop movement.
- Unseen details compound: check focus, hover and sidebars, not only the first screen.

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Selector `footer` | It also hits the sidebars: use `#scroll-wrapper > footer`. |
| Full-page screenshot to check the footer | It is sticky behind the sheet: scroll to the bottom, or `get_css_by_selector`. |
| Light-mode tokens only | `mode: both`. |
| Ids reused after navigating | They are per page load: list again. |
