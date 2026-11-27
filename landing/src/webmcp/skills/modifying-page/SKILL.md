---
name: modifying-page
description: "Use when the visitor asks to restyle, re-theme, redesign or edit this page, make it look like another site or product, change colours, fonts, sizes or text, or when a restyle left parts of the page untouched."
---

# Modifying the page

## Overview

A restyle is finished when every row of the checklist is filled and verified, not when the main content looks right. Variables first (they cascade into every region), CSS only for what they do not reach.

## When to use

- "Make it look like GitHub / a terminal", "dark minimal", "brutalist", "bigger text", "another font".
- A restyle that left the footer, a sidebar or the tree in the old look.
- Questions about the site or Emilia belong to `answering-questions`.

## Procedure

1. `get_variables`, always first: read the base tokens before changing anything.
2. Change tokens with `set_variables` (`mode: both`, unless the request is about one theme). Without that tool, write them with `set_css` on `:root`, repeated under `:root[data-theme=dark]` and the dark media query. Load fonts with `set_google_font` first.
3. Only then CSS (`set_css_by_selector`) for what tokens do not cover, region by region. Copy the checklist, one line per row, and fill each. `read_skill` with `file: "regions.md"` gives each row's selectors and pitfalls.
4. Verify each row with its check. A rejected call lists what broke: send a corrected change. `force: true` is for an effect that is intended.
5. Tell the visitor what changed and how to undo it: `reset_css`, `set_theme_mode` with `system`, or reload.

## Checklist: all rows are required

| Row | Restyle with | Verify with |
| --- | --- | --- |
| Tokens | `--color-paper`, `--color-ink`, `--color-accent` (footer, links), `--color-signal`, `--font-sans`, `--font-size-base`, `--radius-frame` | `get_variables` |
| Navbar | `#page-shell > nav`, `#page-shell > nav a` | `get_css_by_selector` |
| Content | `#content`, `.markdown-content` (h1, h2, a, pre, code) | `get_css_by_selector` on `#content h1` |
| Page shell | `#overlay-content`, `--radius-overlay` | `get_css_by_selector` |
| Gradient | `--g-a`, `--g-b` (`r g b`), `#gradient-bg` | `get_css_by_selector` |
| Tree (home) | `.cover-tree` (`filter`) and `.cover-tree path` (`fill`), `--tree-hue`, `--tree-invert`, `--tree-grad-a`, `--tree-grad-b`, `.tree-sound-ask` | `get_css_by_selector` on `.cover-tree path` |
| Cotas | `--cota-measure`, `--cota-length`, `--cota-scroll`, or `--cotas-display: none` | `get_variables` prefix `--cota` |
| Sidebars | `.sidebar-sheet`, `.sidebar-backdrop`, `.sidebar-scroll`, `.sidebar-actions` | `click_link_or_button` on a GitHub trigger (by id), then `get_css_by_selector` |
| Footer | `#scroll-wrapper > footer`, `#scroll-wrapper > footer a` | `get_css_by_selector` |
| Cursor | `--ic-ink`, `--ic-halo`, `--ic-fill` | `get_variables` prefix `--ic` |
| Buttons, links | `.interactive`, `.shadow-border`, `dropdown-trigger::part(trigger)` | `get_css_by_selector` |

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Only `#content` styled | Walk every row, footer and sidebars included. |
| Tree left in its old colours | Its fills and `filter` are not tokens: set them on `.cover-tree`. |
| Selector `footer` | It also hits the sidebars: use `#scroll-wrapper > footer`. |
| Light-mode tokens only | `set_variables` with `mode: both`, or repeat the tokens in both dark blocks. |
| CSS written before reading the variables | `get_variables` first, then `set_variables`. |
