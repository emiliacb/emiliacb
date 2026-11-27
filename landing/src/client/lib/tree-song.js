// Songs for the tree: reading what an agent (or anyone) writes, and playing it
// in time on the tree's own sound engine. Nothing here makes a sound itself:
// the player is given an `engine` by tree-sway.js, which owns the AudioContext,
// and asks it to strike or hold the tree's parts. That keeps the part that
// needs a browser (the engine) apart from the part that can be tested without
// one (this).
//
// A song is `{ notes, bpm?, effects? }`. `notes` is a list of steps, or one
// string of them:
//
//   "D4/8 Eb4/16 F#4/16 A4/4. -/8 (D4 F#4 A4)/8t D4/2~D4/4"
//
// where a step is a note name (see NOTES), `-` (or `_`, `r`, `rest`) for a
// rest, and `+` between names to sound them together. What follows says how
// long it lasts, in one of two ways:
//
//   /v   a note value: v is 1 (whole), 2, 4 (quarter, the beat), 8, 16 or 32,
//        so "/8" is an eighth. Dots after it lengthen it (`/4.` is a quarter
//        and an eighth, `/4..` adds a sixteenth too) and `t` after that makes
//        it a triplet (`/8t`: three in the time of two), or `t5`, `t6`, `t7`
//        or `t9` for those tuplets. "(D4 F#4 A4)/8t" writes the three steps of
//        a triplet at once; the group must hold as many steps as the tuplet.
//   *n   n beats (quarter notes), the older way: "D4*2".
//
// A `~` after a step ties it to the next one, which has to sound the same
// notes: the two become one longer note. A step with neither /v nor *n lasts
// one beat. A step can also be an object, `{ note, value?, dotted?, tuplet?,
// tie?, durationMs?, effect?, velocity? }`, where `note` is a name, a rest, or
// a list of names for a chord, and `value` is "1/8", "eighth" or 8. Whatever
// the form, a step is over when the next begins.
import { EFFECTS, NOTE_EFFECTS, SONG_EFFECTS, SONG_NOTES } from "./tree-voice.js";

export const DEFAULT_BPM = 100;
export const MIN_BPM = 20;
export const MAX_BPM = 300;
export const MIN_STEP_MS = 40;
export const MAX_STEP_MS = 16000;
export const MAX_STEPS = 512;
export const MAX_SONG_MS = 180000;
export const MAX_CHORD = 4;
export const DEFAULT_VELOCITY = 0.8;
// How long after the last note the song's effects stay on, for the echo and the
// bells to ring out under them before the sound goes back to its own.
export const TAIL_MS = 2500;

const RESTS = new Set(["-", "_", "r", "rest"]);
const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTAL = { "": 0, "#": 1, "♯": 1, b: -1, "♭": -1 };
const NAME = /^([A-Ga-g])([#b♯♭]?)(-?\d)$/;
const BY_MIDI = new Map(SONG_NOTES.map((note) => [note.midi, note]));

/** The names an agent may use, as one line, for the messages that reject one. */
export const noteNames = () => SONG_NOTES.map((note) => note.name).join(", ");

/** The tree's note a written name means, or null. D#4 is Eb4: the same pitch has one part. */
function noteNamed(raw) {
  const m = NAME.exec(String(raw).trim());
  if (!m) return null;
  const midi = 12 * (Number(m[3]) + 1) + SEMITONE[m[1].toUpperCase()] + ACCIDENTAL[m[2]];
  return BY_MIDI.get(midi) ?? null;
}

/** A number within its bounds [min, max], or the fallback where it was left out. */
function numberIn(value, label, [min, max], fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be a number from ${min} to ${max}, not ${JSON.stringify(value)}.`);
  }
  return value;
}

/** The notes one step sounds, from a name, a list of names or a "+" chord; [] for a rest. */
function pitches(raw, where) {
  const names = Array.isArray(raw) ? raw : String(raw).split("+");
  if (names.length === 1 && RESTS.has(String(names[0]).trim().toLowerCase())) return [];
  if (names.length > MAX_CHORD) throw new RangeError(`${where}: a chord has at most ${MAX_CHORD} notes.`);
  return names.map((name) => {
    const note = noteNamed(name);
    if (!note) {
      throw new RangeError(
        `${where}: "${String(name)}" is not a note of the tree. The only notes are ${noteNames()} ` +
          "(Eb4, F#4 and Bb4 may also be written D#4, Gb4 and A#4); use - for a rest.",
      );
    }
    return note;
  });
}

// The note values, by how many of them make a whole note. The beat is a quarter.
export const NOTE_VALUES = [
  { denominator: 1, name: "whole" },
  { denominator: 2, name: "half" },
  { denominator: 4, name: "quarter" },
  { denominator: 8, name: "eighth" },
  { denominator: 16, name: "sixteenth" },
  { denominator: 32, name: "thirty-second" },
];
export const MAX_DOTS = 2;
// A tuplet of n notes takes the time of this many of the same value: a triplet
// is 3 in the time of 2, a quintuplet 5 in the time of 4. Only the usual ones
// are allowed, so that a typo for a count is an error and not a strange rhythm.
export const TUPLETS = { 3: 2, 5: 4, 6: 4, 7: 4, 9: 8 };

const VALUE_BY_NAME = new Map([...NOTE_VALUES.map((v) => [v.name, v.denominator]), ["thirtysecond", 32]]);
const VALUES_TEXT = NOTE_VALUES.map((v) => `${v.denominator} (${v.name})`).join(", ");
// What follows a note in the compact string: /value, dots, and a tuplet letter.
const PLAIN_STEP = /^([^/*]+)(?:\/(\d+)(\.{0,2})(t\d?)?|\*(.*))?$/;
const GROUP_STEP = /^\(([^()]*)\)\/(\d+)(\.{0,2})(t\d?)$/;
// A step, or a parenthesised group with whatever is written against it.
const TOKENS = /\([^()]*\)\S*|[^\s(]+/g;

/** The denominator of a note value written as 8, "8", "1/8" or "eighth". */
function readValue(raw, where) {
  const text = String(raw).trim().toLowerCase();
  const found = VALUE_BY_NAME.get(text) ?? Number(/^(?:1\/)?(\d+)$/.exec(text)?.[1]);
  if (!NOTE_VALUES.some((v) => v.denominator === found)) {
    throw new RangeError(`${where}: ${JSON.stringify(raw)} is not a note value. The values are ${VALUES_TEXT}; write 8, "1/8" or "eighth".`);
  }
  return found;
}

/** The note count of a tuplet written as "triplet", 3, or "t5": one of the TUPLETS. */
function readTuplet(raw, where) {
  const count = raw === "triplet" || raw === "t" ? 3 : Number(String(raw).replace(/^t/, ""));
  if (!Object.hasOwn(TUPLETS, count)) {
    throw new RangeError(`${where}: tuplet ${JSON.stringify(raw)} is not one this knows. Use "triplet" (t) or one of ${Object.keys(TUPLETS).join(", ")} notes (t5).`);
  }
  return count;
}

/** How many beats (quarter notes) a value lasts, with its dots and tuplet. */
function beatsOf(denominator, dots, tuplet) {
  return (4 / denominator) * (2 - 2 ** -dots) * (tuplet ? TUPLETS[tuplet] / tuplet : 1);
}

/** Splits a string of steps on spaces, keeping a "(...)" group whole. */
function tokenize(text) {
  if (text.replace(TOKENS, "").trim() !== "" || /\([^()]*\(/.test(text)) {
    throw new RangeError(`Unbalanced or nested parentheses in "${text}": a group is written (D4 F#4 A4)/8t, and holds no other group.`);
  }
  return text.match(TOKENS) ?? [];
}

/** One step of the compact string, with no ~ in it; a group is several steps. */
function readToken(token, where) {
  if (token.startsWith("(")) {
    const group = GROUP_STEP.exec(token);
    if (!group) throw new RangeError(`${where}: a group is a tuplet, written with its value and t after it, as in (D4 F#4 A4)/8t; this is "${token}".`);
    const members = group[1].trim().split(/\s+/).filter(Boolean);
    const count = readTuplet(group[4], where);
    if (members.length !== count) {
      throw new RangeError(`${where}: "${token}" is a tuplet of ${count} but holds ${members.length} steps; use - for a rest inside it.`);
    }
    const beats = beatsOf(readValue(group[2], where), group[3].length, count);
    return members.map((member) => ({ effect: "strike", velocity: DEFAULT_VELOCITY, notes: pitches(member, where), beats, rhythmic: true }));
  }
  const parts = PLAIN_STEP.exec(token);
  if (!parts) {
    throw new RangeError(
      `${where}: cannot read "${token}". After a note write / and a value (${VALUES_TEXT}), then dots and t if wanted, ` +
        'as in "D4/8", "D4/4." or "D4/8t"; or write beats with * ("D4*2").',
    );
  }
  const [, name, denominator, dots, tuplet, beats] = parts;
  if (denominator !== undefined) {
    const count = tuplet === undefined ? undefined : readTuplet(tuplet, where);
    return [{ effect: "strike", velocity: DEFAULT_VELOCITY, notes: pitches(name, where), beats: beatsOf(readValue(denominator, where), dots.length, count), rhythmic: true }];
  }
  const length = beats === undefined ? 1 : Number(beats);
  if (!(length > 0)) throw new RangeError(`${where}: "${token}" has no sensible length after *; write a number of beats such as D4*2, or a value such as D4/8.`);
  return [{ effect: "strike", velocity: DEFAULT_VELOCITY, notes: pitches(name, where), beats: length }];
}

/** A token with its ties: "D4/2~D4/4" is two steps, the first tied to the second. */
function readString(token, where) {
  const parts = token.split("~");
  const tiedLast = parts.at(-1) === "";
  if (tiedLast) parts.pop();
  if (parts.length === 0 || parts.includes("")) throw new RangeError(`${where}: a ~ needs a step on both sides, as in D4/2~D4/4 (in "${token}").`);
  return parts.flatMap((part, i) => {
    const steps = readToken(part, where);
    // The ~ ties the step before it to the one after it; for a group, its last step.
    steps.at(-1).tie = i < parts.length - 1 || tiedLast;
    return steps;
  });
}

/** The length an object step asks for, as { beats, rhythmic } for a value, or {} for the default or a durationMs. */
function objectLength(raw, hasMs, where) {
  if (raw.value === undefined) {
    if (raw.dotted !== undefined || raw.tuplet !== undefined) throw new RangeError(`${where}: dotted and tuplet go with a value, such as value: "1/8".`);
    return {};
  }
  if (hasMs) throw new RangeError(`${where}: give a value or a durationMs, not both.`);
  let dots = Number(raw.dotted ?? 0);
  if (raw.dotted === true) dots = 1;
  if (![0, 1, MAX_DOTS].includes(dots)) {
    throw new RangeError(`${where}: dotted must be true, false, 1 or ${MAX_DOTS} (a double dot), not ${JSON.stringify(raw.dotted)}.`);
  }
  const tuplet = raw.tuplet === undefined ? undefined : readTuplet(raw.tuplet, where);
  return { beats: beatsOf(readValue(raw.value, where), dots, tuplet), rhythmic: true };
}

/** One object step as { notes, beats | durationMs, ... }. */
function readObject(raw, where) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw) || raw.note === undefined) {
    throw new RangeError(`${where} must be a note name such as "D4", or an object { note, value?, dotted?, tuplet?, tie?, durationMs?, effect?, velocity? }.`);
  }
  const effect = raw.effect ?? "strike";
  if (!NOTE_EFFECTS.includes(effect)) {
    throw new RangeError(`${where}: effect "${String(effect)}" is not one a step can have. The step effects are ${NOTE_EFFECTS.join(", ")}.`);
  }
  if (raw.tie !== undefined && typeof raw.tie !== "boolean") throw new RangeError(`${where}: tie must be true or false.`);
  const durationMs = numberIn(raw.durationMs, `${where}: durationMs`, [MIN_STEP_MS, MAX_STEP_MS], undefined);
  return {
    notes: pitches(raw.note, where),
    durationMs,
    beats: 1,
    effect,
    velocity: numberIn(raw.velocity, `${where}: velocity`, [0, 1], DEFAULT_VELOCITY),
    tie: raw.tie === true,
    ...objectLength(raw, durationMs !== undefined, where),
  };
}

/** The steps one item of "notes" writes: a string may hold several, with ties and groups. */
function readItem(raw, number) {
  const where = `Step ${number}`;
  const steps = typeof raw === "string" ? tokenize(raw.trim()).flatMap((token) => readString(token, where)) : [readObject(raw, where)];
  for (const step of steps) step.number = number;
  return steps;
}

/** Throws unless a step tied from `open` sounds the same notes, as a tie needs. */
function checkTie(open, step) {
  const was = open.notes.map((n) => n.name).join("+");
  const now = step.notes.map((n) => n.name).join("+") || "a rest";
  if (was !== now) {
    throw new RangeError(`Step ${step.number}: ${was} is tied to ${now}, but a tie joins notes of the same pitch, as in D4/4~D4/8.`);
  }
}

/** Joins each step that is tied to the one after it: the same notes, held as one. */
function joinTies(steps) {
  const joined = [];
  let open = null;
  for (const step of steps) {
    if (step.tie && step.notes.length === 0) throw new RangeError(`Step ${step.number}: a rest cannot be tied.`);
    if (open) {
      checkTie(open, step);
      open.durationMs += step.durationMs;
      open.rhythmic ||= step.rhythmic;
      if (!step.tie) open = null;
    } else {
      joined.push(step);
      open = step.tie ? step : null;
    }
  }
  if (open) throw new RangeError(`Step ${open.number}: ends with a tie, but no step follows it to tie to.`);
  return joined;
}

/** Puts the steps in time: each begins where the one before ends. */
function inTime(steps, bpm) {
  const beat = 60000 / bpm;
  // A step written by value keeps its exact length, so one too short to hear
  // at this bpm is an error; a step in beats or milliseconds is bent into range.
  const lengths = steps.map((step) => ({
    ...step,
    durationMs: step.durationMs ?? (step.rhythmic ? step.beats * beat : Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, step.beats * beat))),
  }));
  let at = 0;
  const timed = joinTies(lengths).map((step) => {
    if (step.durationMs < MIN_STEP_MS) {
      throw new RangeError(`Step ${step.number}: lasts ${Math.round(step.durationMs)} ms at ${bpm} bpm, under the ${MIN_STEP_MS} ms a step needs. Lower bpm or use a longer value.`);
    }
    const timedStep = { notes: step.notes, effect: step.effect, velocity: step.velocity, startMs: at, durationMs: step.durationMs };
    at += step.durationMs;
    return timedStep;
  });
  return { steps: timed, totalMs: at };
}

/** One song effect's parameters, each filled in (`given` may be true, for all defaults). */
function readEffect(name, given) {
  const params = EFFECTS[name].params;
  const set = given === true ? {} : (given ?? {});
  for (const key of Object.keys(set)) {
    if (!(key in params)) throw new RangeError(`effects.${name}.${key} is not a parameter. ${name} has ${Object.keys(params).join(", ")}.`);
  }
  return Object.fromEntries(
    Object.entries(params).map(([key, p]) => [key, numberIn(set[key], `effects.${name}.${key}`, [p.min, p.max], p.default)]),
  );
}

/** The song-wide effects asked for, each with every parameter filled in. */
function readEffects(raw) {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new RangeError(`effects must be an object such as { "echo": { "feedback": 0.6 } }. The song effects are ${SONG_EFFECTS.join(", ")}.`);
  }
  for (const name of Object.keys(raw)) {
    if (!SONG_EFFECTS.includes(name)) {
      throw new RangeError(`effects.${name} is not a song effect. They are ${SONG_EFFECTS.join(", ")} (strike and bow go on a step's effect).`);
    }
  }
  return Object.fromEntries(Object.entries(raw).map(([name, given]) => [name, readEffect(name, given)]));
}

/** Every step the song's "notes" write, in order, or a RangeError for a list that is empty, too long or unreadable. */
function readList(notes) {
  const list = typeof notes === "string" ? tokenize(notes.trim()) : notes;
  if (!Array.isArray(list) || list.length === 0) {
    throw new RangeError(`notes must be a list of steps, or a string such as "D4/8 Eb4/8 F#4/4 -/4 A4/2". The notes are ${noteNames()}.`);
  }
  if (list.length > MAX_STEPS) throw new RangeError(`A song has at most ${MAX_STEPS} steps; this one has ${list.length}.`);
  const written = list.flatMap((raw, i) => readItem(raw, i + 1));
  if (written.length > MAX_STEPS) throw new RangeError(`A song has at most ${MAX_STEPS} steps; this one has ${written.length}.`);
  return written;
}

/**
 * Reads a song, or throws a RangeError whose message says what is wrong and
 * what would be right. Returns { bpm, steps, totalMs, effects }, each step
 * { notes (the NOTES entries it sounds, none for a rest), effect, velocity,
 * startMs, durationMs }. A tied step is one step, as long as all of it.
 */
export function parseSong(input) {
  const song = typeof input === "object" && input !== null && !Array.isArray(input) ? input : {};
  const bpm = numberIn(song.bpm, "bpm", [MIN_BPM, MAX_BPM], DEFAULT_BPM);
  const written = readList(song.notes);
  const { steps, totalMs } = inTime(written, bpm);
  if (totalMs > MAX_SONG_MS) throw new RangeError(`A song lasts at most ${MAX_SONG_MS / 1000} s; this one lasts ${Math.round(totalMs / 1000)} s. Shorten it or raise bpm.`);
  if (!steps.some((step) => step.notes.length > 0)) throw new RangeError("The song is all rests: give it at least one note.");
  return { bpm, steps, totalMs, effects: readEffects(song.effects) };
}

/**
 * The player. `engine` is what the tree gives it:
 *   ready()                  whether the tree can be heard now
 *   strike(part, velocity, hz, voice)  rings a part as a brush would, at hz; with no part (null), a note that
 *                               belongs to none, such as C3: only its voice ("wood" or "glass bell") is heard
 *   hold(part, velocity, hz, voice)  holds it, as a press does; returns a function that lets go
 *   effects(fx | null)       sets the song's effects on the sound, or puts them back
 * It plays one song at a time; a new one replaces the one playing.
 */
export function createPlayer(engine) {
  let run = null;
  let sounded = 0;
  let ended = "";
  const timers = new Set();
  const releases = new Set();

  const later = (ms, fn) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, Math.max(0, ms));
    timers.add(id);
  };

  function stop(reason = "stopped") {
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const release of releases) release();
    releases.clear();
    if (run) engine.effects(null);
    if (run?.playing) ended = reason;
    if (run) run.playing = false;
  }

  function finish(reason) {
    if (!run?.playing) return;
    run.playing = false;
    ended = reason;
    // The song is over, but its last notes are still ringing: its effects stay for them.
    later(TAIL_MS, () => engine.effects(null));
  }

  function sound(step) {
    for (const note of step.notes) {
      if (step.effect === "bow") {
        const release = engine.hold(note.part, step.velocity, note.hz, note.voice);
        releases.add(release);
        later(step.durationMs, () => {
          releases.delete(release);
          release();
        });
      } else engine.strike(note.part, step.velocity, note.hz, note.voice);
      sounded++;
    }
  }

  function fire(mine, index) {
    if (run !== mine || !mine.playing) return;
    if (!engine.ready()) return finish("the tree's sound was turned off or closed");
    const step = mine.song.steps[index];
    mine.step = index;
    sound(step);
    const next = mine.song.steps[index + 1];
    if (next) later(mine.t0 + next.startMs - performance.now(), () => fire(mine, index + 1));
    else later(step.durationMs, () => finish("finished"));
  }

  function play(input) {
    const song = parseSong(input);
    if (!engine.ready()) throw new Error("The tree's sound is not running.");
    stop("replaced");
    sounded = 0;
    ended = "";
    run = { song, step: -1, playing: true, t0: performance.now() };
    engine.effects(song.effects);
    fire(run, 0);
    return { steps: song.steps.length, bpm: song.bpm, durationMs: song.totalMs, effects: song.effects };
  }

  const state = () => ({
    playing: run?.playing ?? false,
    step: run ? run.step + 1 : 0,
    steps: run ? run.song.steps.length : 0,
    notesSounded: sounded,
    ended,
  });

  return { play, stop, state };
}
