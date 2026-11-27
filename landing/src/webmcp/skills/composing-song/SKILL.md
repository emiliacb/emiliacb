---
name: composing-song
description: "Use when the visitor asks to play, compose or improvise music, a melody or a song on the tree, or mentions notes, rhythm or the tree's sound."
---

# Composing a song for the tree

## Overview

`play_tree_song` (alias `play_song`) plays on the tree of the home page: each note is a part of the tree, which shakes and lights as it sounds. Only the notes below exist; any other is refused.

## Notes

D2, A2, C3, D3, G3, A3, C4, D4, Eb4, F#4, A4, Bb4, C5, D5. The scale is a Hijaz on D (D Eb F# G A Bb C). C3, C4 and C5 sound but belong to no part: nothing shakes for them. Also accepted: D#4, Gb4, A#4.

Latin names work in any case, with the same octave: Do=C, Re=D, Mi=E, Fa=F, Sol=G, La=A, Si=B, with # or b (Sib4 is Bb4, Fa#4 is F#4). "Tocá un do" means C4. Only the pitches listed above are on the tree.

## Rhythm

A song is a string of steps separated by spaces. A step is a note, `-` for a rest, or notes joined by `+` for a chord (at most 4), then `/` and a value: `/1` whole, `/2`, `/4` quarter (the beat), `/8`, `/16`, `/32`. A dot after the value adds half (`A4/4.`), `t` makes a triplet (`D4/8t`), `~` ties a step to the next one with the same notes. No value means one beat; `*2` means two beats. `bpm` sets the beat (default 100).

- `"D4/8 Eb4/16 F#4/16 A4/4 -/8 D5/8 A4/4"` eighths, sixteenths and a rest.
- `"D4/4. F#4/8 A4/4. D5/8"` a dotted rhythm.
- `"D4+A4/2~D4+A4/4 G3/4"` a tied chord, then a note.

## Effects and limits

Per step, `effect` is `strike` (default) or `bow` (held). Per song, `effects` shapes the sound: `echo` (timeMs, feedback, mix) and `tone` (cutoffHz). Steps may also be objects with `velocity` (0 to 1). At most 512 steps and 180 seconds; a step shorter than 40 ms is refused. A new song replaces the one playing; `stop_tree_song` stops it. Every parameter and range: `get_tool_help` for `play_tree_song`.

## Where and when it can play

- Only the home page has the tree. Elsewhere, navigate home first.
- The browser keeps audio locked until the visitor presses something. The call may reject with a sentence for the visitor: say it to them word for word (it names the button and where it is), wait for their answer, then call again once. Never retry in a loop and never say a song is playing when the call failed.
- If the visitor turned the sound off, only they can turn it back on. Do not work around it.
- You cannot hear it: success means it started.

## Common mistakes

| Mistake | Fix |
| --- | --- |
| A note outside the list (E4, F4) | Use a listed note, or its Latin name. |
| Steps with no value in a long song | Each lasts a beat: write values. |
| Retrying after the audio sentence | Relay it, wait, call once. |
