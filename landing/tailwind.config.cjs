// Every colour the templates use is a CSS custom property defined in
// src/styles.css (read the comment on its :root block first: it lists the base
// tokens and what derives from what). The templates keep the Tailwind names
// they were written with (stone-100, yellow-300, blue-900, ...), and those
// names now point at the tokens, so re-skinning the site is a matter of
// changing a few variables, not hunting classes.
//
// A colour is written as a color-mix() against transparent rather than as an
// rgb() channel triplet, because the tokens are not triplets: they are
// whatever CSS colour the token holds (a hex, an hsl(), another color-mix()).
// `<alpha-value>` is what Tailwind swaps for the opacity of the utility
// (`bg-stone-800/80` -> 0.8, a plain `bg-stone-800` -> 1).
const token = (name) => `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

// The neutral scale, steps and all. The typography plugin's `prose-stone`
// reads every step from 50 to 950, so none can be left to the default palette.
const STONE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const stone = Object.fromEntries(STONE_STEPS.map((step) => [step, token(`--color-stone-${step}`)]));

// The templates were written against Tailwind's palette, and name its
// light-mode and dark-mode shades side by side (`bg-yellow-300
// dark:bg-blue-900`). Both shades of a pair point at the same token, which
// holds the shade of the mode the page is in, so that the pair says the same
// thing in either mode and the dark variant is only a spelling the templates
// no longer need to change.
const accent = token("--color-accent");
const signal = token("--color-signal");
const signalBar = token("--color-signal-bar");
const signalLine = token("--color-signal-line");
const signalText = token("--color-signal-text");

// The typography plugin's `stone` theme reads Tailwind's own palette, not this
// config's, so its hexes would stay as they were. The same assignments, spelled
// with the tokens (copied from the plugin's styles.js, which is where to look
// if it ever changes them).
const proseVar = (step) => `var(--color-${step})`;
const prose = {
  body: proseVar("stone-700"),
  headings: proseVar("stone-900"),
  lead: proseVar("stone-600"),
  links: proseVar("stone-900"),
  bold: proseVar("stone-900"),
  counters: proseVar("stone-500"),
  bullets: proseVar("stone-300"),
  hr: proseVar("stone-200"),
  quotes: proseVar("stone-900"),
  "quote-borders": proseVar("stone-200"),
  captions: proseVar("stone-500"),
  kbd: proseVar("stone-900"),
  "kbd-shadows": "color-mix(in srgb, var(--color-stone-900) 10%, transparent)",
  code: proseVar("stone-900"),
  "pre-code": proseVar("stone-200"),
  "pre-bg": proseVar("stone-800"),
  "th-borders": proseVar("stone-300"),
  "td-borders": proseVar("stone-200"),
  "invert-body": proseVar("stone-300"),
  "invert-headings": proseVar("white"),
  "invert-lead": proseVar("stone-400"),
  "invert-links": proseVar("white"),
  "invert-bold": proseVar("white"),
  "invert-counters": proseVar("stone-400"),
  "invert-bullets": proseVar("stone-600"),
  "invert-hr": proseVar("stone-700"),
  "invert-quotes": proseVar("stone-100"),
  "invert-quote-borders": proseVar("stone-700"),
  "invert-captions": proseVar("stone-400"),
  "invert-kbd": proseVar("white"),
  "invert-kbd-shadows": "color-mix(in srgb, var(--color-white) 10%, transparent)",
  "invert-code": proseVar("white"),
  "invert-pre-code": proseVar("stone-300"),
  "invert-pre-bg": "color-mix(in srgb, var(--color-black) 50%, transparent)",
  "invert-th-borders": proseVar("stone-600"),
  "invert-td-borders": proseVar("stone-700"),
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Dark when <html data-theme="dark"> forces it, or when the system is dark
  // and <html data-theme="light"> does not force the other way. The selector
  // is wrapped in :where() so the dark variant adds no specificity, as the
  // media query it replaces did not: a dark utility still loses to a
  // `hover:` one of the same property, as before. `html` itself carries the
  // attribute, hence the `&` alternative beside the descendant one.
  darkMode: [
    "variant",
    [
      "@media (prefers-color-scheme: dark) { &:where(:not([data-theme=light], [data-theme=light] *)) }",
      "&:where([data-theme=dark], [data-theme=dark] *)",
    ],
  ],
  content: ["./src/site/**/*.{html,ts}", "./src/client/**/*.{js,ts}", "./src/shared/**/*.ts", "./src/webmcp/**/*.{js,ts}"],
  theme: {
    extend: {
      fontFamily: {
        sans: "var(--font-sans)",
        cota: "var(--font-cota)",
      },
      typography: {
        stone: {
          css: Object.fromEntries(Object.entries(prose).map(([name, value]) => [`--tw-prose-${name}`, value])),
        },
      },
      colors: {
        // The semantic names, for what is written from now on.
        paper: token("--color-paper"),
        ink: token("--color-ink"),
        accent,
        // The text on a colour, and the black-or-white hover: roles that the
        // stylesheet derives (see --color-on-accent) and the templates name,
        // so that a highlighted element and its text stay a pair in any palette.
        "on-accent": token("--color-on-accent"),
        strong: token("--color-strong"),
        "on-strong": token("--color-on-strong"),
        signal,
        "code-bg": token("--color-code-bg"),
        "code-ink": token("--color-code-ink"),
        white: token("--color-white"),
        black: token("--color-black"),
        stone,
        yellow: { 300: accent },
        blue: { 400: signalText, 500: signalLine, 600: signalBar, 700: signal, 900: accent },
        green: { 300: signal, 400: signalBar, 500: signalLine, 700: signalText },
        red: { 500: token("--color-focus") },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
