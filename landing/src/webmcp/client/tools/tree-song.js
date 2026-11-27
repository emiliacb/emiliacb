// WebMCP tools that play a song on the tree of the home page: the very voice a
// visitor hears when they brush its leaves, one note per part of the tree, and
// the tree answers each note by shaking and lighting up. The sound engine lives
// in src/client/tree-sway.js (a bundle of its own) and offers itself to the
// page as window.siteTreeSound; these tools are a thin skin over that.
//
// What the description tells the agent (the notes, the effects, their ranges
// and defaults) is printed from src/client/lib/tree-voice.js, the same numbers
// the engine plays with, so it cannot drift from what the tree does.
import {
  DEFAULT_BPM,
  DEFAULT_VELOCITY,
  MAX_BPM,
  MAX_CHORD,
  MAX_DOTS,
  MAX_SONG_MS,
  MAX_STEPS,
  MIN_BPM,
  MIN_STEP_MS,
  NOTE_VALUES,
  parseSong,
  TUPLETS,
} from "../../../client/lib/tree-song.js";
import { EFFECTS, NOTE_EFFECTS, SONG_EFFECTS, SONG_NOTES } from "../../../client/lib/tree-voice.js";
import { fail, ok } from "../core/result.js";

const noteLines = SONG_NOTES.map((n) => `  ${n.name.padEnd(3)} ${String(n.hz).padStart(6)} Hz  ${n.voice}${n.part ? "" : " (no part)"}`).join("\n");

const paramText = (params) =>
  Object.entries(params)
    .map(([key, p]) => `${key} (${p.min} to ${p.max}, default ${p.default}): ${p.about}`)
    .join("; ");

const effectLines = (names) =>
  names
    .map((name) => {
      const params = paramText(EFFECTS[name].params);
      return `  ${name}: ${EFFECTS[name].summary}${params ? ` Parameters: ${params}.` : ""}`;
    })
    .join("\n");

const VALUES = NOTE_VALUES.map((v) => `/${v.denominator} ${v.name}`).join(", ");
const TUPLET_COUNTS = Object.keys(TUPLETS).filter((n) => n !== "3").join(", ");

const PLAY_DESCRIPTION = `Plays a song on the tree of the home page, in the tree's own voice, the one the visitor hears when they brush its leaves. Each note is a part of the tree (the leaves are glass bells, the trunk and limbs are wood), and the part shakes and lights up as it sounds. Only the home page has the tree; elsewhere this fails.

The sound is a Hijaz scale on D (D Eb F# G A Bb C). The tree has eleven parts, one pitch each. C has no part: C3 and C5 are sounded in the tree's wood and bell voices without touching the tree (nothing shakes or lights for them), and only a song can play them. These are all the notes; other pitches cannot be played:
${noteLines}
Eb4, F#4 and Bb4 may also be written D#4, Gb4 and A#4.

Write the song in "notes", as one string of steps separated by spaces. A step is a note name, "-" for a rest, or "+" between names for a chord (at most ${MAX_CHORD} notes), then "/" and its note value: ${VALUES}, so D4/8 is an eighth note. The beat is a quarter note and "bpm" sets it, ${MIN_BPM} to ${MAX_BPM} (default ${DEFAULT_BPM}). After the value, "." adds half its length (A4/4. is a quarter and an eighth; at most ${MAX_DOTS} dots, ".." adds three quarters), and "t" makes it a triplet, three in the time of two (D4/8t); other tuplets are t${TUPLET_COUNTS.replaceAll(", ", ", t")} (5 in the time of 4, and so on). A group in parentheses writes a tuplet's notes at once: (D4 F#4 A4)/8t, with "-" for a rest inside it. "~" after a step ties it to the next, which must sound the same notes: D4/2~D4/4 is one note of three beats. A step with no value lasts one beat, and "*n" instead gives n beats (D4*2).
Examples (at the default tempo): "D4/8 Eb4/16 F#4/16 A4/4 -/8 D5/8 A4/4" (eighths and sixteenths with a rest); "D4/4. F#4/8 A4/4. D5/8" (a dotted rhythm); "(D4 F#4 A4)/8t (A4 F#4 D4)/8t D3/2" (two eighth triplets, then a half note); "D4+A4/2~D4+A4/4 G3/4" (a tied chord).
The song may also be a list of steps, each a string like that or an object { note, value?, dotted?, tuplet?, tie?, durationMs?, effect?, velocity? }: note is a name, "-" or a list of names for a chord; value is "1/8", "eighth" or 8; dotted is true (or 2 for a double dot); tuplet is "triplet" or a note count; tie is true to tie it to the next step; durationMs is how long until the next step in milliseconds (${MIN_STEP_MS} ms or more) in place of a value; effect is one of the step effects below; velocity is how hard it is struck, 0 to 1 (default ${DEFAULT_VELOCITY}). A step shorter than ${MIN_STEP_MS} ms at the bpm is refused. At most ${MAX_STEPS} steps and ${MAX_SONG_MS / 1000} seconds in all.

Step effects (the "effect" of a step):
${effectLines(NOTE_EFFECTS)}

Song effects (the "effects" object of the song, e.g. { "echo": { "feedback": 0.6 }, "tone": { "cutoffHz": 2500 } }), which shape the sound for as long as the song plays and rings, and then give it back to the tree:
${effectLines(SONG_EFFECTS)}

A browser keeps audio locked until the visitor has pressed something on the page, and a tool call does not count. If the sound is still locked, this tool opens the tree's own permission window on the page ("Decisión: árbol quiere ser escuchado" with Ignorar and Permitir, or "Allow" in English) and fails; ask the visitor to click Permitir in it, then call this tool again. If the visitor has turned the tree's sound off, it fails and says so: do not try to get around that. The song plays in the visitor's browser, so you cannot hear it; the result tells you it started, and the song keeps playing after this returns. A new song replaces the one playing, and stop_tree_song stops it.`;

const stepSchema = {
  oneOf: [
    { type: "string", description: 'A step of the string form: "D4/8", "A4/4.", "-/8", "D4+A4/2", "D4/2~D4/4", "(D4 F#4 A4)/8t", or "D4*2" for beats.' },
    {
      type: "object",
      properties: {
        note: {
          oneOf: [{ type: "string" }, { type: "array", items: { type: "string" }, maxItems: MAX_CHORD }],
          description: 'A note name, "-" for a rest, or a list of names for a chord.',
        },
        value: { description: 'The note value: "1/8", "eighth" or 8 (whole 1, half 2, quarter 4, sixteenth 16, thirty-second 32). The beat is a quarter.', oneOf: [{ type: "string" }, { type: "number" }] },
        dotted: { description: "Lengthens the value by half (true or 1), or by three quarters (2).", oneOf: [{ type: "boolean" }, { type: "integer", minimum: 1, maximum: MAX_DOTS }] },
        tuplet: { description: '"triplet" (or 3), or 5, 6, 7 or 9, the number of notes played in the time of fewer (a triplet fits three in two).', oneOf: [{ type: "string" }, { type: "integer" }] },
        tie: { type: "boolean", description: "Ties this step to the next, which must have the same note (or chord): they sound as one long note." },
        durationMs: { type: "number", minimum: MIN_STEP_MS, description: "In place of a value: how long until the next step; with the bow effect, how long the note is held." },
        effect: { type: "string", enum: NOTE_EFFECTS, description: "How the note is sounded; strike by default." },
        velocity: { type: "number", minimum: 0, maximum: 1, description: `How hard it is struck, 0 to 1 (default ${DEFAULT_VELOCITY}).` },
      },
      required: ["note"],
    },
  ],
};

const songEffectsSchema = {
  type: "object",
  description: "Effects on the sound of the whole song.",
  properties: Object.fromEntries(
    SONG_EFFECTS.map((name) => [
      name,
      {
        type: "object",
        description: EFFECTS[name].summary,
        properties: Object.fromEntries(
          Object.entries(EFFECTS[name].params).map(([key, p]) => [
            key,
            { type: "number", minimum: p.min, maximum: p.max, description: `${p.about} (default ${p.default})` },
          ]),
        ),
      },
    ]),
  ),
};

/** What the page offers (window.siteTreeSound, from tree-sway.js), or null where there is no tree. */
function treeSound() {
  const api = window.siteTreeSound;
  return api && typeof api.play === "function" ? api : null;
}

const NO_TREE =
  "There is no tree on this page, so there is nothing to play it on. The tree is on the home page of the site " +
  "(and is not drawn for a visitor who asked for reduced motion). Open the home page and call this tool again.";

/** The fail() for a sound that could not be started, saying what to ask the visitor. */
function lockedMessage(status) {
  const spanish = (document.documentElement.lang || "").startsWith("es");
  const allow = spanish ? '"Permitir"' : '"Allow" (in Spanish, "Permitir")';
  const messages = {
    off:
      "The visitor has turned the tree's sound off (with the switch in the page's footer, or by choosing Ignorar/Ignore in the tree's window). " +
      "That is their choice, so nothing was played. Ask them to turn the tree's sound on, then call this tool again.",
    window:
      "The browser is keeping audio locked until the visitor interacts with the page, and a tool call does not count as that. " +
      `The tree's permission window ("Decisión: árbol quiere ser escuchado") is now showing on the page. Ask the visitor to click ${allow} in it, then call play_tree_song again.`,
    press:
      "The browser is keeping audio locked until the visitor interacts with the page, and a tool call does not count as that. " +
      "Ask the visitor to tap or click anywhere on the page, then call play_tree_song again.",
    unsupported: "This browser has no Web Audio, so the tree cannot make sound here.",
  };
  return fail(messages[status] ?? messages.press);
}

/** Reads the song first, so a mistake in it is told even where the sound is locked. */
function readSong(input) {
  try {
    parseSong(input);
  } catch (error) {
    if (error instanceof RangeError) throw fail(`${error.message} Nothing was played.`);
    throw error;
  }
}

const playTreeSong = {
  name: "play_tree_song",
  summary: "plays a song (notes with rhythmic values, rests, chords, effects) on the home page's tree, which shakes and lights with each note",
  title: "Play a song on the tree",
  description: PLAY_DESCRIPTION,
  inputSchema: {
    type: "object",
    properties: {
      notes: {
        description: `The song: a string of steps ("D4/8 Eb4/16 F#4/16 A4/4. -/8"), or a list of steps. The notes are ${SONG_NOTES.map((n) => n.name).join(", ")}.`,
        oneOf: [{ type: "string" }, { type: "array", items: stepSchema, minItems: 1, maxItems: MAX_STEPS }],
      },
      bpm: { type: "number", minimum: MIN_BPM, maximum: MAX_BPM, description: `Beats (quarter notes) per minute; sets how long every note value lasts (default ${DEFAULT_BPM}).` },
      effects: songEffectsSchema,
    },
    required: ["notes"],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  async execute(input) {
    readSong(input);
    const tree = treeSound();
    if (!tree) throw fail(NO_TREE);
    const status = await tree.unlock();
    if (status !== "running") throw lockedMessage(status);
    try {
      const started = tree.play(input);
      return ok({
        started: true,
        steps: started.steps,
        bpm: started.bpm,
        durationMs: started.durationMs,
        effects: started.effects,
        note: "It is playing in the visitor's browser and goes on after this returns. Call stop_tree_song to stop it.",
      });
    } catch (error) {
      if (error instanceof RangeError) throw fail(`${error.message} Nothing was played.`);
      throw error;
    }
  },
};

const stopTreeSong = {
  name: "stop_tree_song",
  summary: "stops the song the tree is playing",
  title: "Stop the tree's song",
  description:
    "Stops the song started with play_tree_song, if one is playing: the notes that are held let go (and die away as a released note does), " +
    "the tree's effects go back to its own, and no more notes are rung. It does not touch what the visitor plays on the tree themselves. " +
    "Safe to call when nothing is playing.",
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  execute() {
    const tree = treeSound();
    if (!tree) return ok({ stopped: false, note: "There is no tree on this page, so nothing is playing." });
    const before = tree.state();
    tree.stop();
    return ok({ stopped: before.playing, note: before.playing ? "The song was stopped." : "Nothing was playing." });
  },
};

export const treeSongTools = [playTreeSong, stopTreeSong];
