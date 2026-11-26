/**
 * The gradient's sound, made as the tree's is (tree-sway.js): notes of a
 * Hijaz on D (D E♭ F♯ G A B♭), glass bells and rounder wood, under one soft
 * ceiling with an echo that loses its top each time. It is on unless the
 * footer's switch was last left off (the same "tree-sound" setting and
 * event), and, as a browser wants, starts on the first press on the page.
 *
 * The sheets' own voice is electric, not the tree's glass: an FM zap with a
 * crackle, when the hand brushes through a sheet's edge. The hole has a low
 * drone that sinks as it forms; the cursor's orbit as a tone that rises with
 * its turning, the way two stars spiralling together chirp; a scatter of
 * sparks when the tide takes the cursor apart; a deep knock as it is swallowed; the evaporation as its
 * tone climbing faster and faster to a burst; and the sheets' own notes as
 * they come back out.
 */
const SOUND_KEY = "tree-sound";
const FIRST_PRESS = ["pointerdown", "keydown", "touchend"];

// D3 up to D6 in the scale.
const D = 146.83;
const SCALE = [1, 1.0595, 1.2599, 1.3348, 1.4983, 1.5874]; // D E♭ F♯ G A B♭
export const note = (step, octave = 0) =>
  D * SCALE[((step % 6) + 6) % 6] * Math.pow(2, octave + Math.floor(step / 6));

export function makeSound() {
  let want = true;
  try {
    want = localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    // No storage: wanted, as for a first visit.
  }
  let ac = null, bus = null, noiseBuf = null;

  function start() {
    if (!want) return;
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        ac = new AC();
        bus = ac.createGain();
        const out = ac.createBiquadFilter();
        const echo = ac.createDelay(1);
        const back = ac.createGain();
        const dull = ac.createBiquadFilter();
        const wet = ac.createGain();
        out.type = "lowpass";
        out.frequency.value = 5200;
        echo.delayTime.value = 0.27;
        back.gain.value = 0.42;
        dull.type = "lowpass";
        dull.frequency.value = 1800;
        wet.gain.value = 0.5;
        bus.connect(out).connect(ac.destination);
        bus.connect(echo).connect(dull).connect(back).connect(echo);
        dull.connect(wet).connect(out);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const ch = noiseBuf.getChannelData(0);
        for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      }
      if (ac.state === "suspended") ac.resume();
    } catch {
      ac = null;
    }
  }
  function onFirstPress() {
    start();
    if (ac && ac.state === "running") for (const t of FIRST_PRESS) removeEventListener(t, onFirstPress, true);
  }
  for (const t of FIRST_PRESS) addEventListener(t, onFirstPress, { capture: true, passive: true });
  addEventListener(SOUND_KEY, (e) => {
    want = !!e.detail;
    if (want) start();
    else if (ac) ac.suspend();
  });

  const live = () => want && ac && ac.state === "running";
  const panned = (pan) => {
    if (!ac.createStereoPanner || !pan) return bus;
    const p = ac.createStereoPanner();
    p.pan.value = Math.max(-0.8, Math.min(0.8, pan));
    p.connect(bus);
    return p;
  };
  function voice(f, level, rise, fall, to, at = ac.currentTime) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + rise);
    g.gain.exponentialRampToValueAtTime(0.0001, at + rise + fall);
    osc.connect(g).connect(to);
    osc.start(at);
    osc.stop(at + rise + fall + 0.05);
  }

  /** A glass bell, as a leaf: a pure tone with partials out of tune with it
   * that die away sooner. Below 200 Hz its overtones carry the pitch, for
   * small speakers. */
  function bell(f, strength = 0.5, pan = 0, delay = 0) {
    if (!live()) return;
    const at = ac.currentTime + delay;
    const to = panned(pan);
    const vol = 0.03 + 0.06 * Math.min(1, strength);
    const long = 1.6;
    const low = Math.max(0, Math.min(1, (200 - f) / 130));
    voice(f, vol, 0.01, long, to, at);
    voice(f * 2, vol * (0.22 + 0.5 * low), 0.01, long * 0.55, to, at);
    voice(f * 2.76, vol * 0.16, 0.006, long * 0.3, to, at);
    voice(f * 5.4, vol * 0.05, 0.004, long * 0.14, to, at);
  }

  /** Wood: rounder and shorter, its low notes carried by their overtones. */
  function wood(f, strength = 0.5, pan = 0) {
    if (!live()) return;
    const to = panned(pan);
    const vol = 0.05 + 0.07 * Math.min(1, strength);
    const long = 1.3;
    const low = Math.max(0, Math.min(1, (200 - f) / 130));
    voice(f, vol * (1 + 0.3 * low), 0.02, long, to);
    voice(f * 2, vol * (0.22 + 0.6 * low), 0.014, long * 0.55, to);
    voice(f * 3, vol * (0.08 + 0.42 * low), 0.016, long * 0.38, to);
    if (low > 0) voice(f * 4, vol * 0.22 * low, 0.016, long * 0.24, to);
  }

  /** A held sound: returns { set(params), stop() }. */
  function drone() {
    if (!live()) return null;
    const t = ac.currentTime;
    const g = ac.createGain();
    g.gain.value = 0.0001;
    g.connect(bus);
    // The root and its fifth, low, with the overtones that carry them.
    const parts = [[D / 2, 1], [D, 0.7], [D * 1.5, 0.45], [D * 0.75, 0.5], [D * 2.25, 0.25], [D * 2, 0.2]].map(([f, l], i) => {
      const o = ac.createOscillator();
      const og = ac.createGain();
      o.type = "sine";
      o.frequency.value = f;
      o.detune.value = (i % 2 ? 4 : -4);
      og.gain.value = l;
      o.connect(og).connect(g);
      o.start(t);
      return o;
    });
    // And a rumble: noise, low and narrow.
    const n = ac.createBufferSource();
    n.buffer = noiseBuf;
    n.loop = true;
    const nf = ac.createBiquadFilter();
    nf.type = "lowpass";
    nf.frequency.value = 260;
    const ng = ac.createGain();
    ng.gain.value = 0.9;
    n.connect(nf).connect(ng).connect(g);
    n.start(t);
    return {
      // level 0 to 1, and how far down it has sunk (0 to 1 octave).
      set(level, sink) {
        const now = ac.currentTime;
        g.gain.setTargetAtTime(0.0001 + 0.045 * level, now, 0.08);
        const k = Math.pow(2, -sink);
        parts.forEach((o, i) => o.detune.setTargetAtTime((i % 2 ? 4 : -4) + 1200 * Math.log2(k), now, 0.1));
        nf.frequency.setTargetAtTime(120 + 300 * level, now, 0.1);
      },
      stop(fade = 0.4) {
        const now = ac.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime(0.0001, now, fade / 4);
        for (const o of parts) o.stop(now + fade + 0.1);
        n.stop(now + fade + 0.1);
      },
    };
  }

  /** The orbit's tone: { set(f, level, phase), stop() }, swelling once a turn. */
  function chirp() {
    if (!live()) return null;
    const t = ac.currentTime;
    const g = ac.createGain();
    g.gain.value = 0.0001;
    const to = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (to) { g.connect(to).connect(bus); } else g.connect(bus);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g2 = ac.createGain();
    o1.type = "sine";
    o2.type = "triangle";
    g2.gain.value = 0.25;
    o1.connect(g);
    o2.connect(g2).connect(g);
    o1.start(t); o2.start(t);
    return {
      set(f, level, phase) {
        const now = ac.currentTime;
        o1.frequency.setTargetAtTime(f, now, 0.03);
        o2.frequency.setTargetAtTime(f * 2, now, 0.03);
        g.gain.setTargetAtTime(0.0001 + 0.03 * level * (0.65 + 0.35 * Math.cos(phase)), now, 0.02);
        if (to) to.pan.setTargetAtTime(0.6 * Math.cos(phase), now, 0.02);
      },
      stop(fade = 0.15) {
        const now = ac.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime(0.0001, now, fade / 4);
        o1.stop(now + fade + 0.1); o2.stop(now + fade + 0.1);
      },
    };
  }

  /** The cursor coming apart: bells high in the scale, scattered. */
  function shatter() {
    for (let i = 0; i < 7; i++) {
      zap(note(Math.floor(Math.random() * 6), 1 + (Math.random() < 0.5 ? 1 : 0)), 0.4 + Math.random() * 0.4, Math.random() * 1.4 - 0.7, i * 0.045 + Math.random() * 0.05, 0.35);
    }
  }

  /** The sheets' own voice, electric rather than glass: a carrier frequency-
   * modulated at an unharmonic ratio, its modulation dying away fast (a metal
   * zap that settles toward a pure tone), bent a little down as a field
   * collapsing would, through a narrow wobbling filter, with a crackle of
   * sparks on top. `short` shortens it. Its pitch's overtones carry it on
   * small speakers. */
  function zap(f, strength = 0.5, pan = 0, delay = 0, short = 1) {
    if (!live()) return;
    const at = ac.currentTime + delay;
    const to = panned(pan);
    const s = Math.min(1, strength);
    const long = (0.55 + 0.35 * s) * short;
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, at);
    out.gain.exponentialRampToValueAtTime(0.03 + 0.05 * s, at + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, at + long);
    // A narrow band that wanders, as a field through a coil.
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 3;
    band.frequency.setValueAtTime(f * 6, at);
    band.frequency.exponentialRampToValueAtTime(f * 2, at + long);
    const wob = ac.createOscillator(), wobG = ac.createGain();
    wob.frequency.value = 7 + 5 * Math.random();
    wobG.gain.value = f * 0.8;
    wob.connect(wobG).connect(band.frequency);
    band.connect(out).connect(to);
    const car = ac.createOscillator(), mod = ac.createOscillator(), idx = ac.createGain();
    car.type = "sine";
    mod.type = "sine";
    car.frequency.setValueAtTime(f * 2, at);
    car.frequency.exponentialRampToValueAtTime(f * 1.94, at + long);
    mod.frequency.setValueAtTime(f * 2 * 1.414, at);
    idx.gain.setValueAtTime(f * (4 + 6 * s), at);
    idx.gain.exponentialRampToValueAtTime(f * 0.05, at + long * 0.5);
    mod.connect(idx).connect(car.frequency);
    car.connect(band);
    // A dry share of the carrier, so the note is heard as well as the buzz.
    const dry = ac.createGain();
    dry.gain.value = 0.35;
    car.connect(dry).connect(out);
    // The sparks: noise, high, in a few quick spits.
    const n = ac.createBufferSource();
    n.buffer = noiseBuf;
    n.playbackRate.value = 0.7 + Math.random() * 0.6;
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2500;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, at);
    for (let k = 0; k < 4; k++) {
      const tk = at + k * 0.018 + Math.random() * 0.01;
      ng.gain.setValueAtTime(0.0001, tk);
      ng.gain.linearRampToValueAtTime((0.25 + 0.4 * s) / (k + 1), tk + 0.003);
      ng.gain.linearRampToValueAtTime(0.0001, tk + 0.012);
    }
    n.connect(hp).connect(ng).connect(out);
    for (const o of [car, mod, wob]) { o.start(at); o.stop(at + long + 0.05); }
    n.start(at, Math.random());
    n.stop(at + 0.12);
  }

  /** The hole evaporating. A hole is the hotter the smaller (Hawking:
   * T ∝ 1/M), so it sounds its forming the other way round: its low tone
   * climbs, as 1/r_s, faster and faster as it shrinks over `shrink` s, and
   * then goes in a burst, a deep thump and a rush of air that darkens as it
   * dies. */
  function evaporate(shrink = 0.6) {
    if (!live()) return;
    const t = ac.currentTime, end = t + shrink;
    // The climb: the drone's root, as r_s goes from all to almost nothing.
    const N = 48, curve = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1), sm = u * u * (3 - 2 * u);
      curve[i] = Math.min(1500, (D / 2) / Math.max(0.05, 1 - Math.pow(sm, 1.4)));
    }
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.06, end - 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.04);
    g.connect(bus);
    [[1, 1, "sine"], [2, 0.45, "triangle"], [3, 0.2, "sine"]].forEach(([m, l, type]) => {
      const o = ac.createOscillator(), og = ac.createGain();
      o.type = type;
      o.frequency.setValueCurveAtTime(curve.map((f) => f * m), t, shrink);
      og.gain.value = l;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(end + 0.1);
    });
    // The burst. A thump that drops, with the overtones small speakers play...
    const th = ac.createGain();
    th.gain.setValueAtTime(0.0001, end);
    th.gain.exponentialRampToValueAtTime(0.13, end + 0.01);
    th.gain.exponentialRampToValueAtTime(0.0001, end + 0.6);
    th.connect(bus);
    [[1, 1], [2, 0.5], [3, 0.3]].forEach(([m, l]) => {
      const o = ac.createOscillator(), og = ac.createGain();
      o.frequency.setValueAtTime(95 * m, end);
      o.frequency.exponentialRampToValueAtTime(38 * m, end + 0.35);
      og.gain.value = l;
      o.connect(og).connect(th);
      o.start(end);
      o.stop(end + 0.7);
    });
    // ...and a rush of air, bright at first and darkening as it dies.
    const n = ac.createBufferSource();
    n.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(7000, end);
    f.frequency.exponentialRampToValueAtTime(250, end + 1.1);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, end);
    ng.gain.exponentialRampToValueAtTime(0.07, end + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.0001, end + 1.2);
    n.connect(f).connect(ng).connect(bus);
    n.start(end);
    n.stop(end + 1.3);
  }

  /** The sheets coming back out of the hole, each ringing its own note as it
   * opens, the small ones first. */
  function reform(tones) {
    tones.forEach((f, i) => zap(f, 0.35, (i / Math.max(1, tones.length - 1)) * 0.8 - 0.4, 0.1 + i * 0.09));
  }

  return { start, bell, wood, zap, drone, chirp, shatter, evaporate, reform, live };
}
