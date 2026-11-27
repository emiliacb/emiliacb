// What get_variables says about the BASE tokens: one line of purpose and what
// derives from each, written from the tokens comment at the top of
// src/styles.css (which is the source of truth: change both together;
// test/webmcp/variables.test.ts checks every name here is declared there).
// Everything else the site declares on :root is derived from these.

export const BASE_TOKENS = [
  {
    name: "--color-paper",
    purpose: "The page's ground, and the card, sheet and window grounds.",
    derives: "the stone scale (stone-50...950), --tree-paper, the surfaces (--color-raised, --color-code-bg).",
  },
  {
    name: "--color-ink",
    purpose: "The text, the rules drawn in ink, the cotas' dark end.",
    derives:
      "the stone scale (swapped with paper in dark); --color-on-ink, the text on ink (the ink cursor's halo, the mascot's bubbles), which is " +
      "read from the ink's lightness (near black or white), automatic, and overridable by setting it yourself.",
  },
  {
    name: "--color-accent",
    purpose: "The highlight: link fills (and the table of contents'), the footer, the blog and course cards, the hovered Allow button. Yellow in light, deep blue in dark.",
    derives:
      "--color-on-accent, the text on all of those (the footer's text and links, the highlighted links and cards, the hovered Allow button): " +
      "automatic, read from the accent's lightness (near black above it, white below it), so any accent stays readable; " +
      "set --color-on-accent yourself only to override it.",
  },
  {
    name: "--color-signal",
    purpose: "The thin accent: link underlines, the loading bar. Green in light, blue in dark.",
    derives: "--color-signal-bar, --color-signal-line, --color-signal-text (shades of it in OKLCH).",
  },
  {
    name: "--tree-hue",
    purpose: "The hue (0-360) of the tree's ink, its equations and the cotas. 143 (green) in light, 323 (pink) in dark.",
    derives: "every --tree-ink-*, --tree-ink, --cota-*; the tree and the cotas repaint when it changes.",
  },
  {
    name: "--g-a",
    purpose: 'The gradient background\'s first colour, as "r g b" channels (not a colour), e.g. "252 190 80".',
    derives: "the five gradient layers, the lens and the ripple of the cursor's fall.",
  },
  {
    name: "--g-b",
    purpose: 'The gradient background\'s second colour, as "r g b" channels, e.g. "135 207 183".',
    derives: "the five gradient layers, the lens and the ripple of the cursor's fall.",
  },
  {
    name: "--tree-grad-a",
    purpose:
      'The top of the tree\'s leaves and trunk gradient (and the start of the sound window\'s bar), as "r g b" channels. It is what is painted, ' +
      "per mode: light and dark have a pair each (nothing is inverted), so a value set for a mode shows as it is in that mode.",
    derives:
      "the tree's leaves and trunk (the SVG, at once), the tree-sound window's bar and, read from the bar's colours, " +
      "its title and close button (near black or white, automatic). The tree's canvases (anatomy, cotas) take their ink from --tree-hue, not from this.",
  },
  {
    name: "--tree-grad-b",
    purpose: 'The bottom of the tree\'s leaves and trunk gradient (and the end of the sound window\'s bar), as "r g b" channels; per mode, like --tree-grad-a.',
    derives: "the same as --tree-grad-a: the tree's leaves and trunk, the tree-sound window's bar and its text.",
  },
  { name: "--font-sans", purpose: "The text face.", derives: "all text." },
  { name: "--font-cota", purpose: "The cotas' face (and the sidebars' numbers).", derives: "the cotas." },
  { name: "--font-script", purpose: "The tree's formulas' face.", derives: "the tree's equations." },
  {
    name: "--font-size-base",
    purpose: "The root font size, a percentage so the visitor's own setting is respected. Every size is in rem, so this scales type and spacing together.",
    derives: "every size on the site.",
  },
  { name: "--radius-frame", purpose: "The corner of the AI layout's cards (page, footer, panel).", derives: "the cards." },
  { name: "--radius-overlay", purpose: "The corner of the page once scrolled past (6rem on md+).", derives: "the page's corners, the footer's backdrop." },
  { name: "--size-content", purpose: "The width of the text column.", derives: "the page's layout." },
  {
    name: "--cotas-display",
    purpose: 'Whether the cotas (the ink dimensions drawn over the page) show: "block" or "none".',
    derives: "the cotas' canvas and its measuring.",
  },
];

/**
 * The agent's overrides as one list for a token: [{ mode, value }].
 * @param {{ light: Record<string, string>, dark: Record<string, string> }} variables
 */
export function overridesOf(variables, name) {
  const found = [];
  if (variables.light[name] !== undefined) found.push({ mode: "light", value: variables.light[name] });
  if (variables.dark[name] !== undefined) found.push({ mode: "dark", value: variables.dark[name] });
  return found;
}
