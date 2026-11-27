// Types for the plain-JS module next to it, so the WebMCP tool's tests can import it.
import type { TreeNote } from "./tree-voice.js";

export type SongStep = {
  notes: TreeNote[];
  effect: string;
  velocity: number;
  startMs: number;
  durationMs: number;
};
export type Song = {
  bpm: number;
  steps: SongStep[];
  totalMs: number;
  effects: Record<string, Record<string, number>>;
};
export type SongEngine = {
  ready(): boolean;
  strike(part: string | null, velocity: number, hz: number, voice: string): void;
  hold(part: string | null, velocity: number, hz: number, voice: string): () => void;
  effects(fx: Record<string, Record<string, number>> | null): void;
};
export type SongState = { playing: boolean; step: number; steps: number; notesSounded: number; ended: string };

export const DEFAULT_BPM: number;
export const MIN_BPM: number;
export const MAX_BPM: number;
export const MIN_STEP_MS: number;
export const MAX_STEP_MS: number;
export const MAX_STEPS: number;
export const MAX_SONG_MS: number;
export const MAX_CHORD: number;
export const DEFAULT_VELOCITY: number;
export const TAIL_MS: number;
export const MAX_DOTS: number;
export const NOTE_VALUES: { denominator: number; name: string }[];
export const TUPLETS: Record<number, number>;
export function noteNames(): string;
export function parseSong(input: unknown): Song;
export function createPlayer(engine: SongEngine): {
  play(input: unknown): { steps: number; bpm: number; durationMs: number; effects: Song["effects"] };
  stop(reason?: string): void;
  state(): SongState;
};
