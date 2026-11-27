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
  MAX_SONG_MS,
  MAX_STEPS,
  MIN_BPM,
  MIN_STEP_MS,
  parseSong,
} from "../../../client/lib/tree-song.js";
import { EFFECTS, NOTE_EFFECTS, NOTES, SONG_EFFECTS } from "../../../client/lib/tree-voice.js";
import { fail, ok } from "../core/result.js";

const noteLines = NOTES.map((n) => `  ${n.name.padEnd(3)} ${String(n.hz).padStart(6)} Hz  ${n.voice}`).join("\n");

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

const PLAY_DESCRIPTION = `Plays a song on the tree of the home page, in the tree's own voice, the one the visitor hears when they brush its leaves. Each note is a part of the tree (the leaves are glass bells, the trunk and limbs are wood), and the part shakes and lights up as it sounds. Only the home page has the tree; elsewhere this fails.

The sound is a Hijaz scale on D, and these eleven notes are all the tree has (a note is a part of it, with one pitch each; other pitches cannot be played):
${noteLines}
Eb4, F#4 and Bb4 may also be written D#4, Gb4 and A#4.

Write the song in "notes", as one string of steps separated by spaces, e.g. "D4 Eb4 F#4 - A4*2 D5+A4": a note name, a "-" for a rest, "+" between names for a chord (at most ${MAX_CHORD} notes), "*n" after a step for how many beats it lasts (one by default). Or as a list of steps, each a string like that or an object { note, durationMs?, effect?, velocity? }, where note is a name, "-" or a list of names for a chord, durationMs is how long until the next step (${MIN_STEP_MS} ms or more; by default one beat), effect is one of the step effects below and velocity is how hard it is struck, 0 to 1 (default ${DEFAULT_VELOCITY}). "bpm" sets the beat, ${MIN_BPM} to ${MAX_BPM} (default ${DEFAULT_BPM}). At most ${MAX_STEPS} steps and ${MAX_SONG_MS / 1000} seconds.

Step effects (the "effect" of a step):
${effectLines(NOTE_EFFECTS)}

Song effects (the "effects" object of the song, e.g. { "echo": { "feedback": 0.6 }, "tone": { "cutoffHz": 2500 } }), which shape the sound for as long as the song plays and rings, and then give it back to the tree:
${effectLines(SONG_EFFECTS)}

A browser keeps audio locked until the visitor has pressed something on the page, and a tool call does not count. If the sound is still locked, this tool opens the tree's own permission window on the page ("Decisión: árbol quiere ser escuchado" with Ignorar and Permitir, or "Allow" in English) and fails; ask the visitor to click Permitir in it, then call this tool again. If the visitor has turned the tree's sound off, it fails and says so: do not try to get around that. The song plays in the visitor's browser, so you cannot hear it; the result tells you it started, and the song keeps playing after this returns. A new song replaces the one playing, and stop_tree_song stops it.`;

const stepSchema = {
  oneOf: [
    { type: "string", description: 'A note ("D4"), a rest ("-"), a chord ("D4+A4"), each optionally followed by *beats ("D4*2").' },
    {
      type: "object",
      properties: {
        note: {
          oneOf: [{ type: "string" }, { type: "array", items: { type: "string" }, maxItems: MAX_CHORD }],
          description: 'A note name, "-" for a rest, or a list of names for a chord.',
        },
        durationMs: { type: "number", minimum: MIN_STEP_MS, description: "How long until the next step; with the bow effect, how long the note is held." },
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
  summary: "plays a song (notes, rests, chords, effects) on the home page's tree, which shakes and lights with each note",
  title: "Play a song on the tree",
  description: PLAY_DESCRIPTION,
  inputSchema: {
    type: "object",
    properties: {
      notes: {
        description: `The song: a string of steps ("D4 Eb4 F#4 - A4*2"), or a list of steps. The notes are ${NOTES.map((n) => n.name).join(", ")}.`,
        oneOf: [{ type: "string" }, { type: "array", items: stepSchema, minItems: 1, maxItems: MAX_STEPS }],
      },
      bpm: { type: "number", minimum: MIN_BPM, maximum: MAX_BPM, description: `Beats per minute; sets how long a step lasts when it has no durationMs (default ${DEFAULT_BPM}).` },
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
