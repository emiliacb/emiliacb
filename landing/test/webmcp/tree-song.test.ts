import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPlayer, parseSong, type SongEngine, type Song } from "../../src/client/lib/tree-song.js";
import { NOTES, SONG_NOTES } from "../../src/client/lib/tree-voice.js";

describe("the tree's notes", () => {
  it("are the eleven parts of the tree, low to high, named as the scale is spelled", () => {
    expect(NOTES.map((n) => n.name)).toEqual(["D2", "A2", "D3", "G3", "A3", "D4", "Eb4", "F#4", "A4", "Bb4", "D5"]);
  });
});

describe("the notes a song may write", () => {
  it("add C3 (wood) and C5 (bell), which belong to no part of the tree", () => {
    expect(SONG_NOTES.map((n) => n.name)).toEqual(["D2", "A2", "C3", "D3", "G3", "A3", "D4", "Eb4", "F#4", "A4", "Bb4", "C5", "D5"]);
    expect(SONG_NOTES.filter((n) => n.part === null).map((n) => [n.name, n.voice])).toEqual([
      ["C3", "wood"],
      ["C5", "glass bell"],
    ]);
    expect(NOTES.some((n) => n.part === null)).toBe(false);
  });

  it("are all parsed, with no part for the two Cs and C4 still refused", () => {
    const song = parseSong({ notes: "C3 C5+D5" });
    expect(song.steps[0].notes[0]).toMatchObject({ name: "C3", part: null, voice: "wood" });
    expect(song.steps[1].notes.map((n) => n.name)).toEqual(["C5", "D5"]);
    expect(() => parseSong({ notes: "C4" })).toThrow(/"C4" is not a note/);
  });
});

/** The start of each step, in ms, and the whole song's length. */
const starts = (song: Song) => song.steps.map((s) => s.startMs);
const lengths = (song: Song) => song.steps.map((s) => s.durationMs);

describe("note values", () => {
  // At 60 bpm the beat is 1000 ms, so a value's length in ms is 4000 / its denominator.
  it.each([
    ["1", 4000],
    ["2", 2000],
    ["4", 1000],
    ["8", 500],
    ["16", 250],
    ["32", 125],
  ])("/%s lasts %d ms at 60 bpm", (value, ms) => {
    expect(lengths(parseSong({ notes: `D4/${value}`, bpm: 60 }))).toEqual([ms]);
  });

  it("follow bpm, the quarter note being the beat", () => {
    expect(lengths(parseSong({ notes: "D4/4 D4/8 D4/16", bpm: 120 }))).toEqual([500, 250, 125]);
    expect(lengths(parseSong({ notes: "D4/4", bpm: 100 }))).toEqual([600]);
    expect(parseSong({ notes: "D4/8 D4/8 D4/4" }).totalMs).toBeCloseTo(1200);
  });

  it("dots add half, and a second dot half of that", () => {
    expect(lengths(parseSong({ notes: "D4/4. D4/4.. D4/2. D4/8.", bpm: 60 }))).toEqual([1500, 1750, 3000, 750]);
  });

  it("triplets fit three in the time of two, and other tuplets are exact", () => {
    const triplet = parseSong({ notes: "D4/8t D4/8t D4/8t D4/4", bpm: 60 });
    expect(starts(triplet).map(Math.round)).toEqual([0, 333, 667, 1000]);
    expect(triplet.totalMs).toBeCloseTo(2000);
    expect(parseSong({ notes: "D4/16t5 D4/16t5 D4/16t5 D4/16t5 D4/16t5", bpm: 60 }).totalMs).toBeCloseTo(1000);
    expect(parseSong({ notes: "D4/4.t", bpm: 60 }).totalMs).toBeCloseTo(1000);
  });

  it("a group in parentheses is a tuplet, with rests and chords inside it", () => {
    const song = parseSong({ notes: "(D4 - A4+D5)/8t G3/4", bpm: 60 });
    expect(song.steps.map((s) => s.notes.map((n) => n.name))).toEqual([["D4"], [], ["A4", "D5"], ["G3"]]);
    expect(starts(song).map(Math.round)).toEqual([0, 333, 667, 1000]);
    expect(lengths(parseSong({ notes: "(D4 A4 D5 A4 D4)/16t5", bpm: 60 })).every((ms) => Math.abs(ms - 200) < 1e-9)).toBe(true);
    expect(() => parseSong({ notes: "(D4 A4)/8t" })).toThrow(/tuplet of 3 but holds 2/);
    expect(() => parseSong({ notes: "(D4 A4 D5)/8" })).toThrow(/group is a tuplet/);
    expect(() => parseSong({ notes: "(D4 A4 D5/8t" })).toThrow(/parentheses/);
  });

  it("rests take every value", () => {
    const song = parseSong({ notes: "D4/8 -/8 r/16 rest/16. _/4", bpm: 60 });
    expect(song.steps.map((s) => s.notes.length)).toEqual([1, 0, 0, 0, 0]);
    expect(lengths(song)).toEqual([500, 500, 250, 375, 1000]);
  });

  it("chords take every value", () => {
    const song = parseSong({ notes: "D4+A4/8. D4+F#4+A4+D5/16t", bpm: 60 });
    expect(song.steps.map((s) => s.notes.length)).toEqual([2, 4]);
    expect(song.steps[0].durationMs).toBe(750);
    expect(() => parseSong({ notes: "D4+A4+D5+F#4+A3/8" })).toThrow(/at most 4/);
  });

  it("ties join steps of the same notes into one longer step", () => {
    const song = parseSong({ notes: "D4/2~D4/4 A4/8~A4/8~A4/8 D4+A4/4~D4+A4/4 G3/4", bpm: 60 });
    expect(song.steps).toHaveLength(4);
    expect(lengths(song)).toEqual([3000, 1500, 2000, 1000]);
    expect(starts(song)).toEqual([0, 3000, 4500, 6500]);
    expect(lengths(parseSong({ notes: "D4/4~ D4/4", bpm: 60 }))).toEqual([2000]);
    expect(lengths(parseSong({ notes: "(D4 A4 A4)/8t~A4/4", bpm: 60 })).length).toBe(3);
  });

  it("ties hold a bowed note for its whole length", () => {
    const song = parseSong({ notes: [{ note: "D4", value: "1/4", tie: true, effect: "bow" }, { note: "D4", value: "1/2" }], bpm: 60 });
    expect(song.steps).toHaveLength(1);
    expect(song.steps[0]).toMatchObject({ effect: "bow", durationMs: 3000 });
  });

  it("keeps a step with no length one beat, and the older durations working", () => {
    expect(lengths(parseSong({ notes: "D4 D4*2 D4*0.5", bpm: 60 }))).toEqual([1000, 2000, 500]);
    expect(lengths(parseSong({ notes: [{ note: "D4", durationMs: 300 }, "A4"], bpm: 60 }))).toEqual([300, 1000]);
    expect(lengths(parseSong({ notes: ["D4/8", "A4*2", { note: "D5" }], bpm: 60 }))).toEqual([500, 2000, 1000]);
  });

  it("reads the same song written as a string, a list, or objects", () => {
    const text = parseSong({ notes: "D4/8. Eb4/16 A4/4t -/2 C5+D5/8~C5+D5/8", bpm: 90 });
    const list = parseSong({ notes: ["D4/8.", "Eb4/16", "A4/4t", "-/2", "C5+D5/8~C5+D5/8"], bpm: 90 });
    const objects = parseSong({
      bpm: 90,
      notes: [
        { note: "D4", value: "eighth", dotted: true },
        { note: "Eb4", value: "1/16" },
        { note: "A4", value: 4, tuplet: "triplet" },
        { note: "-", value: "half" },
        { note: ["C5", "D5"], value: "8", tie: true },
        { note: ["C5", "D5"], value: 8 },
      ],
    });
    expect(list).toEqual(text);
    expect(objects).toEqual(text);
  });

  it("takes the object form's names, double dots and tuplets", () => {
    const at = (step: object) => parseSong({ notes: [{ note: "D4", ...step }], bpm: 60 }).totalMs;
    expect(at({ value: "whole" })).toBe(4000);
    expect(at({ value: "thirty-second" })).toBe(125);
    expect(at({ value: "1/4", dotted: 2 })).toBe(1750);
    expect(at({ value: "1/4", dotted: false })).toBe(1000);
    expect(at({ value: "1/8", tuplet: 5 })).toBeCloseTo(400);
  });

  it("caps the song's length and its steps, and refuses a step too short to hear", () => {
    expect(() => parseSong({ notes: "D4/1 ".repeat(50), bpm: 60 })).toThrow(/at most 180 s/);
    expect(() => parseSong({ notes: "D4/32 ".repeat(513), bpm: 300 })).toThrow(/at most 512 steps/);
    expect(() => parseSong({ notes: "D4/32", bpm: 300 })).toThrow(/25 ms at 300 bpm/);
    expect(parseSong({ notes: "D4/32", bpm: 120 }).totalMs).toBeCloseTo(62.5);
  });

  it("says what is wrong with a value, a tie or a tuplet", () => {
    expect(() => parseSong({ notes: "D4/3" })).toThrow(/not a note value.*8 \(eighth\)/);
    expect(() => parseSong({ notes: "D4/64" })).toThrow(/not a note value/);
    expect(() => parseSong({ notes: "D4/" })).toThrow(/cannot read "D4\/"/);
    expect(() => parseSong({ notes: "D4/8..." })).toThrow(/cannot read/);
    expect(() => parseSong({ notes: "D4/8*2" })).toThrow(/cannot read/);
    expect(() => parseSong({ notes: "D4/8t4" })).toThrow(/tuplet "t4"/);
    expect(() => parseSong({ notes: "D4/4~A4/4" })).toThrow(/D4 is tied to A4.*same pitch/);
    expect(() => parseSong({ notes: "D4+A4/4~D4/4" })).toThrow(/D4\+A4 is tied to D4/);
    expect(() => parseSong({ notes: "D4/4~ -/4" })).toThrow(/tied to a rest/);
    expect(() => parseSong({ notes: "-/4~-/4" })).toThrow(/rest cannot be tied/);
    expect(() => parseSong({ notes: "D4/4 A4/4~" })).toThrow(/no step follows/);
    expect(() => parseSong({ notes: "D4/4~~D4/4" })).toThrow(/needs a step on both sides/);
    expect(() => parseSong({ notes: [{ note: "D4", value: "eighth", durationMs: 200 }] })).toThrow(/not both/);
    expect(() => parseSong({ notes: [{ note: "D4", dotted: true }] })).toThrow(/go with a value/);
    expect(() => parseSong({ notes: [{ note: "D4", value: 8, dotted: 3 }] })).toThrow(/dotted must be/);
    expect(() => parseSong({ notes: [{ note: "D4", value: 8, tuplet: 4 }] })).toThrow(/tuplet 4/);
    expect(() => parseSong({ notes: [{ note: "D4", value: 8, tie: "yes" }] })).toThrow(/tie must be/);
    expect(() => parseSong({ notes: [{ note: "D4", value: "eigth" }] })).toThrow(/not a note value/);
  });
});

describe("parseSong", () => {
  it("reads the compact string with rests, chords and lengths", () => {
    const song = parseSong({ notes: "D4 Eb4*2 - A4+D5", bpm: 120 });
    expect(song.steps.map((s) => s.notes.map((n) => n.name))).toEqual([["D4"], ["Eb4"], [], ["A4", "D5"]]);
    expect(song.steps.map((s) => s.startMs)).toEqual([0, 500, 1500, 2000]);
    expect(song.totalMs).toBe(2500);
  });

  it("takes objects, and spells the same pitch either way", () => {
    const song = parseSong({ notes: [{ note: "d#4", durationMs: 300, effect: "bow", velocity: 0.4 }, { note: ["Gb4", "bb4"] }] });
    expect(song.steps[0]).toMatchObject({ effect: "bow", velocity: 0.4, durationMs: 300 });
    expect(song.steps[0].notes[0].name).toBe("Eb4");
    expect(song.steps[1].notes.map((n) => n.name)).toEqual(["F#4", "Bb4"]);
  });

  it("rejects a note the tree does not have, and lists the ones it has", () => {
    expect(() => parseSong({ notes: "D4 C4" })).toThrow(/"C4" is not a note of the tree.*D2, A2, C3, D3/);
  });

  it("rejects what cannot be played", () => {
    expect(() => parseSong({ notes: "-  -" })).toThrow(/all rests/);
    expect(() => parseSong({ notes: [] })).toThrow(/list of steps/);
    expect(() => parseSong({ notes: "D4", bpm: 5 })).toThrow(/bpm/);
    expect(() => parseSong({ notes: [{ note: "D4", effect: "reverb" }] })).toThrow(/strike, bow/);
    expect(() => parseSong({ notes: "D4", effects: { reverb: {} } })).toThrow(/echo, tone/);
    expect(() => parseSong({ notes: "D4", effects: { echo: { feedback: 2 } } })).toThrow(/effects.echo.feedback/);
    expect(() => parseSong({ notes: "D4*0" })).toThrow(/length/);
  });

  it("fills in each effect's parameters with the engine's own values", () => {
    expect(parseSong({ notes: "D4", effects: { echo: { feedback: 0.6 }, tone: {} } }).effects).toEqual({
      echo: { timeMs: 270, feedback: 0.6, mix: 0.5 },
      tone: { cutoffHz: 5200 },
    });
  });
});

describe("createPlayer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const makeEngine = () => {
    const log: string[] = [];
    const engine: SongEngine = {
      ready: () => true,
      strike: (part) => log.push(`strike ${part}`),
      hold: (part) => {
        log.push(`hold ${part}`);
        return () => log.push(`release ${part}`);
      },
      effects: (fx) => log.push(fx ? `fx ${Object.keys(fx).join(",")}` : "fx off"),
    };
    return { engine, log };
  };

  it("sounds each step in time, then puts the effects back after the tail", () => {
    const { engine, log } = makeEngine();
    const player = createPlayer(engine);
    player.play({ notes: "D4 - A3", bpm: 60, effects: { echo: {} } });
    expect(log).toEqual(["fx echo", "strike leaf:crown"]);
    vi.advanceTimersByTime(2000);
    expect(log.slice(-1)).toEqual(["strike twig"]);
    expect(player.state()).toMatchObject({ playing: true, step: 3, notesSounded: 2 });
    vi.advanceTimersByTime(1000);
    expect(player.state()).toMatchObject({ playing: false, ended: "finished" });
    vi.advanceTimersByTime(3000);
    expect(log.slice(-1)).toEqual(["fx off"]);
  });

  it("plays C3 and C5 on no part, with their own pitch and voice", () => {
    const calls: unknown[][] = [];
    const { engine } = makeEngine();
    engine.strike = (...args) => void calls.push(args);
    createPlayer(engine).play({ notes: "C3 C5 D4", bpm: 60 });
    vi.advanceTimersByTime(2100);
    expect(calls).toEqual([
      [null, 0.8, 130.81, "wood"],
      [null, 0.8, 523.25, "glass bell"],
      ["leaf:crown", 0.8, 293.66, "glass bell"],
    ]);
  });

  it("holds a bowed note for its duration and lets go of it on stop", () => {
    const { engine, log } = makeEngine();
    const player = createPlayer(engine);
    player.play({ notes: [{ note: "D3", effect: "bow", durationMs: 1000 }, { note: "D4", effect: "bow", durationMs: 4000 }] });
    vi.advanceTimersByTime(1100);
    expect(log).toContain("release left");
    expect(log).toContain("hold leaf:crown");
    player.stop();
    expect(log.slice(-2)).toEqual(["release leaf:crown", "fx off"]);
    expect(player.state()).toMatchObject({ playing: false, ended: "stopped" });
  });

  it("refuses to start where the sound is not running, and stops if it goes", () => {
    const { engine } = makeEngine();
    let ready = false;
    engine.ready = () => ready;
    const player = createPlayer(engine);
    expect(() => player.play({ notes: "D4" })).toThrow(/not running/);
    ready = true;
    player.play({ notes: "D4 D4 D4" });
    ready = false;
    vi.advanceTimersByTime(5000);
    expect(player.state()).toMatchObject({ playing: false, notesSounded: 1 });
  });
});
