import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPlayer, parseSong, type SongEngine } from "../../src/client/lib/tree-song.js";
import { NOTES } from "../../src/client/lib/tree-voice.js";

describe("the tree's notes", () => {
  it("are the eleven parts of the tree, low to high, named as the scale is spelled", () => {
    expect(NOTES.map((n) => n.name)).toEqual(["D2", "A2", "D3", "G3", "A3", "D4", "Eb4", "F#4", "A4", "Bb4", "D5"]);
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
    expect(() => parseSong({ notes: "D4 C4" })).toThrow(/"C4" is not a note of the tree.*D2, A2, D3/);
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
