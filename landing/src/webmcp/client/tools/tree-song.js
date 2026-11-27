// WebMCP tools that play a song on the tree of the home page: the very voice a
// visitor hears when they brush its leaves, one note per part of the tree, and
// the tree answers each note by shaking and lighting up. The sound engine lives
// in src/client/tree-sway.js (a bundle of its own) and offers itself to the
// page as window.siteTreeSound; these tools are a thin skin over that.
//
// What the help (get_tool_help) tells the agent (the notes, the effects, their ranges
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
import { EFFECTS, latinName, NOTE_EFFECTS, SONG_EFFECTS, SONG_NOTES } from "../../../client/lib/tree-voice.js";
import { fail, ok } from "../core/result.js";
import { requireSkill } from "../core/skill-gate.js";

const noteLines = SONG_NOTES.map((n) => `  ${n.name.padEnd(3)} ${latinName(n.name).padEnd(4)} ${String(n.hz).padStart(6)} Hz  ${n.voice}${n.part ? "" : " (no part)"}`).join("\n");

// "Do = C, Re = D, Mi♭ = Eb ...": each pitch class the tree has, once, from C up.
const pitchClasses = new Map(SONG_NOTES.map((n) => [n.midi % 12, n.name.replace(/\d+$/, "")]));
const latinPairs = [...pitchClasses]
  .sort(([a], [b]) => a - b)
  .map(([, name]) => `${latinName(name)} = ${name}`)
  .join(", ");

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

// The description is all that is read before the agent calls, and it is cut at
// about 900 characters, so it holds only the basics. The full text (the notes,
// the rhythm syntax, the effects) is PLAY_HELP, served by get_tool_help, and the
// skill composing-song teaches how to write a song.
const PLAY_DESCRIPTION =
  "Plays a song on the tree of the home page, in the tree's own voice: each note is a part of the tree, which " +
  'shakes and lights as it sounds. `notes` is a string such as "D4/8 Eb4/16 A4/4." (note, "/" and its value; ' +
  '"-" is a rest, "+" a chord) and `bpm` the tempo. Home page only. The visitor must allow the sound once: ' +
  "the call may reject with a sentence to tell them. Fails until you read the skill `composing-song` with " +
  "read_skill. Full details: get_tool_help.";

const PLAY_HELP = `# play_tree_song

Plays a song on the tree of the home page, in the tree's own voice, the one the visitor hears when they brush its leaves. Each note is a part of the tree (the leaves are glass bells, the trunk and limbs are wood), and the part shakes and lights up as it sounds. Only the home page has the tree; elsewhere this fails.

The sound is a Hijaz scale on D (D Eb F# G A Bb C). The tree has eleven parts, one pitch each. C has no part: C3 and C5 are sounded in the tree's wood and bell voices without touching the tree (nothing shakes or lights for them), and only a song can play them. These are all the notes; other pitches cannot be played:
${noteLines}
Eb4, F#4 and Bb4 may also be written D#4, Gb4 and A#4.
The Latin (solfege) names work as well, in any case, with the same octave numbers and the same # or b (or the signs ♯ and ♭): ${latinPairs}. So "tocá un do" is C4 ("Do4"), and Do4/8, re4, Sib4, Fa#4 and Mi♭4 are all notes. Middle C is C4.

Write the song in "notes", as one string of steps separated by spaces. A step is a note name, "-" for a rest, or "+" between names for a chord (at most ${MAX_CHORD} notes), then "/" and its note value: ${VALUES}, so D4/8 is an eighth note. The beat is a quarter note and "bpm" sets it, ${MIN_BPM} to ${MAX_BPM} (default ${DEFAULT_BPM}). After the value, "." adds half its length (A4/4. is a quarter and an eighth; at most ${MAX_DOTS} dots, ".." adds three quarters), and "t" makes it a triplet, three in the time of two (D4/8t); other tuplets are t${TUPLET_COUNTS.replaceAll(", ", ", t")} (5 in the time of 4, and so on). A group in parentheses writes a tuplet's notes at once: (D4 F#4 A4)/8t, with "-" for a rest inside it. "~" after a step ties it to the next, which must sound the same notes: D4/2~D4/4 is one note of three beats. A step with no value lasts one beat, and "*n" instead gives n beats (D4*2).
Examples (at the default tempo): "D4/8 Eb4/16 F#4/16 A4/4 -/8 D5/8 A4/4" (eighths and sixteenths with a rest); "D4/4. F#4/8 A4/4. D5/8" (a dotted rhythm); "(D4 F#4 A4)/8t (A4 F#4 D4)/8t D3/2" (two eighth triplets, then a half note); "D4+A4/2~D4+A4/4 G3/4" (a tied chord).
The song may also be a list of steps, each a string like that or an object { note, value?, dotted?, tuplet?, tie?, durationMs?, effect?, velocity? }: note is a name, "-" or a list of names for a chord; value is "1/8", "eighth" or 8; dotted is true (or 2 for a double dot); tuplet is "triplet" or a note count; tie is true to tie it to the next step; durationMs is how long until the next step in milliseconds (${MIN_STEP_MS} ms or more) in place of a value; effect is one of the step effects below; velocity is how hard it is struck, 0 to 1 (default ${DEFAULT_VELOCITY}). A step shorter than ${MIN_STEP_MS} ms at the bpm is refused. At most ${MAX_STEPS} steps and ${MAX_SONG_MS / 1000} seconds in all.

Step effects (the "effect" of a step):
${effectLines(NOTE_EFFECTS)}

Song effects (the "effects" object of the song, e.g. { "echo": { "feedback": 0.6 }, "tone": { "cutoffHz": 2500 } }), which shape the sound for as long as the song plays and rings, and then give it back to the tree:
${effectLines(SONG_EFFECTS)}

Audio needs the visitor's permission, once: a browser keeps it locked until the visitor has pressed something on the page, and a tool call does not count as that. So this tool can FAIL, and when it does nothing was played. If the sound is still locked, it brings up the tree's own permission window on the page ("Decisión: árbol quiere ser escuchado" with Ignorar and Permitir, or "Allow" in English) and rejects with a sentence to tell the visitor, word for word, in the chat: where the window is and which button to click. Tell them that, wait for them to answer, and call this tool again; do not retry in a loop, and do not claim the song played. If the visitor has turned the tree's sound off (the speaker button in the footer, or Ignorar in the window), it rejects too, and only they can turn it back on: do not try to get around that. The song plays in the visitor's browser, so you cannot hear it; success means the sound was running and the song started, and it keeps playing after this returns. A new song replaces the one playing, and stop_tree_song stops it.`;

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

const PLACES = {
  es: {
    middle: "en el centro de la pantalla",
    row: { top: "arriba", middle: "", bottom: "abajo" },
    column: { left: "a la izquierda", center: "", right: "a la derecha" },
    unknown: "en la pantalla",
  },
  en: {
    middle: "in the middle of the screen",
    row: { top: "top", middle: "", bottom: "bottom" },
    column: { left: "left", center: "", right: "right" },
    unknown: "on the screen",
  },
};

/** Where the window is, in the visitor's words ("abajo a la derecha"), from the thirds of the screen the engine reports. */
function placeText(place, spanish) {
  const words = PLACES[spanish ? "es" : "en"];
  if (!place) return words.unknown;
  if (place.x === "center" && place.y === "middle") return words.middle;
  const row = words.row[place.y];
  const column = words.column[place.x];
  if (spanish) return [row, column].filter(Boolean).join(" ");
  if (row && column) return `${row} ${column}`;
  return row ? `at the ${row}` : `on the ${column}`;
}

/**
 * The fail() for a sound that could not be started. It opens with the sentence
 * the agent says to the visitor (in the page's language, the one thing the
 * visitor needs: which button, and where), then what the agent does. The
 * button names are the window's own (tree-sway.js), and its place is where the
 * engine says it is on this screen, so it is right on a phone too.
 */
function lockedMessage(status, place) {
  const spanish = (document.documentElement.lang || "").startsWith("es");
  const where = placeText(place, spanish);
  const say = (visitor, then) =>
    `${visitor}\n\nThat sentence is for the visitor: say it to them in the chat, word for word, ${then} Nothing was played.`;
  const waitThenRetry = "wait for their answer, and call play_tree_song again once. Do not call it again in a loop, and do not tell them a song is playing.";
  const messages = {
    window: say(
      spanish
        ? `Para escuchar al árbol, hacé clic en "Permitir" en la ventana del árbol (${where}) y avisame.`
        : `To hear the tree, click "Allow" in the tree's window (${where}) and let me know.`,
      `${waitThenRetry} (The browser keeps audio locked until the visitor presses something, and a tool call does not count. The tree's window, "Decisión: árbol quiere ser escuchado" with Ignorar and Permitir, is now on screen.)`,
    ),
    press: say(
      spanish
        ? "Para escuchar al árbol, hacé clic o tocá en cualquier parte de la página y avisame."
        : "To hear the tree, click or tap anywhere on the page and let me know.",
      `${waitThenRetry} (The browser keeps audio locked until the visitor presses something, and there is no window to ask with.)`,
    ),
    off: say(
      spanish
        ? "Apagaste el sonido del árbol, así que no puedo hacerlo sonar. Si querés escucharlo, activá el botón del parlante al pie de la página y avisame."
        : "The tree's sound is turned off, so I cannot play it. If you want to hear it, turn the speaker button at the bottom of the page back on and let me know.",
      "and wait. Only the visitor can turn the sound back on; do not try to get around it. If they say they did, " +
      "call play_tree_song again once.",
    ),
    unsupported: say(
      spanish
        ? "Este navegador no puede reproducir audio, así que el árbol no puede sonar acá."
        : "This browser cannot play audio, so the tree cannot make sound here.",
      "and do not try again.",
    ),
  };
  messages.ignored = messages.off.replace(
    spanish ? "Apagaste el sonido del árbol, así que no puedo hacerlo sonar." : "The tree's sound is turned off, so I cannot play it.",
    spanish
      ? 'Elegiste "Ignorar" en la ventana del árbol, así que quedó en silencio, y esa ventana no vuelve a aparecer.'
      : 'You chose "Ignore" in the tree\'s window, so it stays silent, and that window does not come back.',
  );
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
  summary: "plays a song (notes with rhythmic values, rests, chords, effects) on the home page's tree, which shakes and lights with each note; fails until the visitor has allowed the sound",
  title: "Play a song on the tree",
  description: PLAY_DESCRIPTION,
  help: PLAY_HELP,
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
    requireSkill("composing-song");
    readSong(input);
    const tree = treeSound();
    if (!tree) throw fail(NO_TREE);
    const status = await tree.unlock();
    if (status !== "running") throw lockedMessage(status, tree.place?.());
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
      // The sound stopped being able to play between the check and the song
      // (the visitor turned it off, the browser suspended the audio): the same
      // as if it had never been running, never a success.
      throw lockedMessage(tree.state().wanted ? "press" : "off", tree.place?.());
    }
  },
};

// The same tool under a shorter name, for agents that look for "play song": it
// shares the definition, so the input, the checks and the gate cannot differ.
const playSong = {
  ...playTreeSong,
  name: "play_song",
  summary: "alias of play_tree_song: plays a song on the home page's tree",
  title: "Play a song",
  description:
    "Alias of play_tree_song: plays a song on the tree of the home page, with the same input (`notes`, `bpm`, " +
    "`effects`). Fails until you read the skill `composing-song` with read_skill. Full details: get_tool_help.",
};

const stopTreeSong = {
  name: "stop_tree_song",
  summary: "stops the song the tree is playing",
  title: "Stop the tree's song",
  description:
    "Stops the song started with play_tree_song, if one is playing: the notes that are held let go (and die " +
    "away as a released note does), " +
    "the tree's effects go back to its own, and no more notes are rung. It does not touch what the visitor " +
    "plays on the tree themselves. " +
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

export const treeSongTools = [playTreeSong, stopTreeSong, playSong];
