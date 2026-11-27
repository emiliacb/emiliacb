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
//   "D4 Eb4*2 - A4+D5"   a note, a note held 2 beats, a rest, a chord
//
// where a step is a note name (see NOTES), `-` (or `_`, `r`, `rest`) for a
// rest, `+` between names to sound them together, and `*n` after it for how
// many beats it lasts (one by default). A step can also be an object,
// `{ note, durationMs?, effect?, velocity? }`, where `note` is a name, a rest,
// or a list of names for a chord. Whatever the form, a step is over when the
// next begins.
import { EFFECTS, NOTE_EFFECTS, NOTES, SONG_EFFECTS } from "./tree-voice.js";

export const DEFAULT_BPM = 100;
export const MIN_BPM = 20;
export const MAX_BPM = 300;
export const MIN_STEP_MS = 40;
export const MAX_STEP_MS = 16000;
export const MAX_STEPS = 256;
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
const BY_MIDI = new Map(NOTES.map((note) => [note.midi, note]));

/** The names an agent may use, as one line, for the messages that reject one. */
export const noteNames = () => NOTES.map((note) => note.name).join(", ");

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

/** One written step as { notes, beats | durationMs, effect, velocity }, still without its place in time. */
function readStep(raw, number) {
  const where = `Step ${number}`;
  if (typeof raw === "string") {
    const [head, beats] = raw.trim().split("*");
    const count = beats === undefined ? 1 : Number(beats);
    if (!(count > 0)) throw new RangeError(`${where}: "${raw}" has no sensible length after *; write a number of beats such as D4*2.`);
    return { notes: pitches(head, where), beats: count, effect: "strike", velocity: DEFAULT_VELOCITY };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw) || raw.note === undefined) {
    throw new RangeError(`${where} must be a note name such as "D4", or an object { note, durationMs?, effect?, velocity? }.`);
  }
  const effect = raw.effect ?? "strike";
  if (!NOTE_EFFECTS.includes(effect)) {
    throw new RangeError(`${where}: effect "${String(effect)}" is not one a step can have. The step effects are ${NOTE_EFFECTS.join(", ")}.`);
  }
  return {
    notes: pitches(raw.note, where),
    durationMs: numberIn(raw.durationMs, `${where}: durationMs`, [MIN_STEP_MS, MAX_STEP_MS], undefined),
    beats: 1,
    effect,
    velocity: numberIn(raw.velocity, `${where}: velocity`, [0, 1], DEFAULT_VELOCITY),
  };
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

/** Puts the steps in time: each begins where the one before ends. */
function inTime(steps, bpm) {
  const beat = 60000 / bpm;
  let at = 0;
  const timed = steps.map((step) => {
    const durationMs = step.durationMs ?? Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, step.beats * beat));
    const timedStep = { notes: step.notes, effect: step.effect, velocity: step.velocity, startMs: at, durationMs };
    at += durationMs;
    return timedStep;
  });
  return { steps: timed, totalMs: at };
}

/**
 * Reads a song, or throws a RangeError whose message says what is wrong and
 * what would be right. Returns { bpm, steps, totalMs, effects }, each step
 * { notes (the NOTES entries it sounds, none for a rest), effect, velocity,
 * startMs, durationMs }.
 */
export function parseSong(input) {
  const song = typeof input === "object" && input !== null && !Array.isArray(input) ? input : {};
  const bpm = numberIn(song.bpm, "bpm", [MIN_BPM, MAX_BPM], DEFAULT_BPM);
  const list = typeof song.notes === "string" ? song.notes.trim().split(/\s+/).filter(Boolean) : song.notes;
  if (!Array.isArray(list) || list.length === 0) {
    throw new RangeError(`notes must be a list of steps, or a string such as "D4 Eb4 F#4 - A4". The notes are ${noteNames()}.`);
  }
  if (list.length > MAX_STEPS) throw new RangeError(`A song has at most ${MAX_STEPS} steps; this one has ${list.length}.`);
  const { steps, totalMs } = inTime(list.map((raw, i) => readStep(raw, i + 1)), bpm);
  if (totalMs > MAX_SONG_MS) throw new RangeError(`A song lasts at most ${MAX_SONG_MS / 1000} s; this one lasts ${Math.round(totalMs / 1000)} s. Shorten it or raise bpm.`);
  if (!steps.some((step) => step.notes.length > 0)) throw new RangeError("The song is all rests: give it at least one note.");
  return { bpm, steps, totalMs, effects: readEffects(song.effects) };
}

/**
 * The player. `engine` is what the tree gives it:
 *   ready()                  whether the tree can be heard now
 *   strike(part, velocity)   rings a part's note as a brush would
 *   hold(part, velocity)     holds it, as a press does; returns a function that lets go
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
        const release = engine.hold(note.part, step.velocity);
        releases.add(release);
        later(step.durationMs, () => {
          releases.delete(release);
          release();
        });
      } else engine.strike(note.part, step.velocity);
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
