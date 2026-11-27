// What the tree sounds with, as plain data: the notes of its scale, the
// settings of the effects its sound goes through, and what a song may ask of
// them. tree-sway.js plays with these very numbers, and the WebMCP tool that
// plays songs on the tree (src/webmcp/client/tools/tree-song.js) prints them
// for the agent from here, so what an agent is told can never drift from what
// the tree does. Nothing in this file touches the page.

// Every part's note, in hertz: a Hijaz on D (D E♭ F♯ G A B♭), with its two
// semitones and the wide step between them. The leaves have the scale, the
// bigger the leaf the lower; the wood holds the root, the fourth and the
// fifth beneath them.
export const NOTE = {
  "leaf:crown": 293.66, "leaf:left": 311.13, "leaf:twig": 369.99, "leaf:stem": 440, "leaf:elbow": 466.16, "leaf:right": 587.33,
  trunk: 73.42, stem: 110, left: 146.83, right: 196, twig: 220,
};

// How much of its strike a held note settles to.
export const HELD = 0.5;

// A held note goes out through a light flanger, which a brushed one does not:
// a copy of it FLANGE_MS behind, that lag swept FLANGE_DEPTH_MS either way
// FLANGE_HZ times a second, mixed in at FLANGE_MIX and fed back FLANGE_FEED.
export const FLANGE_MS = 3;
export const FLANGE_DEPTH_MS = 1.8;
export const FLANGE_HZ = 0.35;
export const FLANGE_MIX = 0.45;
export const FLANGE_FEED = 0.35;

// Everything goes out under one soft ceiling (a low-pass at CEILING_HZ), and
// part of it round an echo that loses its top each time: the air the notes
// hang in. The echo is ECHO.timeMs long, fed back ECHO.feedback through a
// low-pass at ECHO.dullHz, and mixed in at ECHO.mix.
export const CEILING_HZ = 5200;
export const ECHO = { timeMs: 270, feedback: 0.42, dullHz: 1800, mix: 0.5 };

// The pitch names a song writes: flats for the scale's own E♭ and B♭ and a
// sharp for its F♯, the way the scale is spelled.
const PITCH_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

/** The MIDI number nearest to a frequency (A4 = 440 Hz = 69). */
const midiOf = (hz) => Math.round(69 + 12 * Math.log2(hz / 440));

/**
 * Every note the tree has, low to high: its name (D2 to D5), its frequency,
 * the part that rings it, and what that part sounds like. These eleven are all
 * there is: a note is a part of the tree, and each part has one pitch.
 */
export const NOTES = Object.entries(NOTE)
  .map(([part, hz]) => {
    const midi = midiOf(hz);
    return {
      name: `${PITCH_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`,
      midi,
      hz,
      part,
      voice: part.startsWith("leaf:") ? "glass bell" : "wood",
    };
  })
  .sort((a, b) => a.hz - b.hz);

/**
 * What a song can ask for. `note` effects shape one step (the `effect` of a
 * step); `song` effects shape the sound the whole song goes out through, for as
 * long as it plays and its tail rings, and are put back after. Each parameter
 * has the engine's own value as its default.
 */
export const EFFECTS = {
  strike: {
    scope: "note",
    summary:
      "the note as the tree rings it when a hand brushes it: struck, then left to die away (about 1.6 s for a bell, 1.1 s for wood). The default.",
    params: {},
  },
  bow: {
    scope: "note",
    summary:
      `the note as the tree holds it when a visitor presses on it: it settles to ${HELD * 100}% of its strike and stays for the step's durationMs, ` +
      `through a light flanger (a copy ${FLANGE_MS} ms behind, swept ${FLANGE_DEPTH_MS} ms either way ${FLANGE_HZ} times a second), then dies away. ` +
      "The other parts answer it by sympathy, as a violin's open strings do.",
    params: {},
  },
  echo: {
    scope: "song",
    summary: `the air the notes hang in: a repeat that loses its top each time. The tree always has one (${ECHO.timeMs} ms, feedback ${ECHO.feedback}, mix ${ECHO.mix}); this changes it for the song.`,
    params: {
      timeMs: { default: ECHO.timeMs, min: 40, max: 900, about: "how long before the repeat, in milliseconds" },
      feedback: { default: ECHO.feedback, min: 0, max: 0.75, about: "how much of each repeat comes round again: more is a longer tail" },
      mix: { default: ECHO.mix, min: 0, max: 1, about: "how loud the repeats are next to the notes" },
    },
  },
  tone: {
    scope: "song",
    summary: `how bright everything sounds: the soft ceiling every sound goes out under (a low-pass, ${CEILING_HZ} Hz by default). Lower is darker and softer, higher is brighter.`,
    params: {
      cutoffHz: { default: CEILING_HZ, min: 500, max: 12000, about: "the frequency above which the sound is cut away, in hertz" },
    },
  },
};

/** The effects a step may name, and those a whole song may set. */
export const NOTE_EFFECTS = Object.keys(EFFECTS).filter((name) => EFFECTS[name].scope === "note");
export const SONG_EFFECTS = Object.keys(EFFECTS).filter((name) => EFFECTS[name].scope === "song");
// The scale's seventh degree, C, has no part of its own: each part has one
// pitch, and what a visitor brushes or presses must stay as it is. A song may
// still play it, twice, one low and one high, in a voice of the tree's but on no
// part of it: nothing shakes, lights or answers in sympathy, and the visitor
// cannot play them. C3 is wood, where the wood's own notes lie (D2 to G3); C5
// is a glass bell, among the bells' (D4 to D5). Below C3 a laptop's speakers
// give nothing and above C5 the bell is thin, so these are the two that sound
// well, one beside each end of the tree's range.
const EXTRA = [
  { name: "C3", hz: 130.81, voice: "wood" },
  { name: "C5", hz: 523.25, voice: "glass bell" },
];

/**
 * Every note a song may write, low to high: the eleven NOTES, and C3 and C5,
 * which have no `part` (null): the song sounds them in their `voice` alone.
 */
export const SONG_NOTES = [...NOTES, ...EXTRA.map((note) => ({ name: note.name, midi: midiOf(note.hz), hz: note.hz, part: null, voice: note.voice }))].sort((a, b) => a.hz - b.hz);
