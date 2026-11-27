// Types for the plain-JS module next to it, so the WebMCP tool's tests can import it.
export type TreeNote = { name: string; midi: number; hz: number; part: string | null; voice: string };
export type EffectParam = { default: number; min: number; max: number; about: string };
export type EffectSpec = { scope: "note" | "song"; summary: string; params: Record<string, EffectParam> };

export const NOTE: Record<string, number>;
export const HELD: number;
export const FLANGE_MS: number;
export const FLANGE_DEPTH_MS: number;
export const FLANGE_HZ: number;
export const FLANGE_MIX: number;
export const FLANGE_FEED: number;
export const CEILING_HZ: number;
export const ECHO: { timeMs: number; feedback: number; dullHz: number; mix: number };
export const NOTES: readonly TreeNote[];
export const SONG_NOTES: readonly TreeNote[];
export const EFFECTS: Record<string, EffectSpec>;
export const NOTE_EFFECTS: readonly string[];
export const SONG_EFFECTS: readonly string[];
