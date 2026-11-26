/**
 * The gradient's sound, on the tree's engine (tree-sway.js): one soft
 * ceiling with an echo that loses its top each time, and its scale, a Hijaz
 * on D, where anything is pitched. It is on unless the
 * footer's switch was last left off (the same "tree-sound" setting and
 * event), and, as a browser wants, starts on the first press on the page.
 *
 * The sheets' own voice is electric and magnetic, not the tree's glass, and
 * not a note: a gritty buzz with sparks when the hand brushes through a
 * sheet's edge. The hole has a low drone that sinks as it forms; the cursor's
 * orbit as a tone that rises with its turning, the way two stars spiralling
 * together chirp; a crackle of discharges over a sagging minor chord when
 * the tide takes the cursor apart; a dull thud as it is swallowed; and an explosion when it goes: the
 * pressure building, a deep boom, a blast of air, debris, a long tail.
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

  // Noise, filtered and shaped: one call for every rush, rumble and crackle.
  function noise(at, dur, type, f0, f1, level, rise = 0.01, q = 0.7, to = bus) {
    const n = ac.createBufferSource();
    n.buffer = noiseBuf;
    n.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, at);
    f.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + rise);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    n.connect(f).connect(g).connect(to);
    n.start(at, Math.random() * 1.5);
    n.stop(at + dur + 0.05);
  }
  // Sparks: a few spits of high noise at random within `span` s.
  function sparks(at, span, count, level, to = bus) {
    for (let k = 0; k < count; k++) {
      const tk = at + Math.random() * span;
      noise(tk, 0.012 + Math.random() * 0.02, "highpass", 2500 + Math.random() * 3000, 4000, level * (0.4 + Math.random() * 0.6), 0.002, 0.7, to);
    }
  }
  // Grit: a soft clip, for the buzz.
  let grit = null;
  function gritCurve() {
    if (grit) return grit;
    grit = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; grit[i] = Math.tanh(x * 3.5); }
    return grit;
  }

  /** The cursor coming apart: a burst of crackling discharges over a minor
   * chord, sad, that sags a little flat as it dies away. D minor (D F A),
   * with the F natural the scale's F♯ would have made major. */
  function shatter() {
    if (!live()) return;
    for (let i = 0; i < 6; i++) zap(D * (0.4 + Math.random() * 0.8), 0.5 + Math.random() * 0.4, Math.random() * 1.4 - 0.7, i * 0.05 + Math.random() * 0.05, 0.6);
    sparks(ac.currentTime, 0.5, 14, 0.05);
    minor();
  }
  function minor() {
    const at = ac.currentTime, long = 2.8;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.05, at + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, at + long);
    const soft = ac.createBiquadFilter();
    soft.type = "lowpass";
    soft.frequency.setValueAtTime(2200, at);
    soft.frequency.exponentialRampToValueAtTime(500, at + long);
    soft.connect(g).connect(bus);
    // D3 F3 A3 D4, and D2 under them for weight.
    [[D / 2, 0.6], [D, 1], [D * Math.pow(2, 3 / 12), 0.9], [D * Math.pow(2, 7 / 12), 0.8], [D * 2, 0.5]].forEach(([f, l], i) => {
      for (const det of [-6, 6]) {
        const o = ac.createOscillator(), og = ac.createGain();
        o.type = "triangle";
        o.frequency.value = f;
        o.detune.setValueAtTime(det, at);
        o.detune.linearRampToValueAtTime(det - 45, at + long);
        og.gain.value = l * 0.5;
        o.connect(og).connect(soft);
        o.start(at + i * 0.025);
        o.stop(at + long + 0.05);
      }
    });
  }

  /** The sheets' own voice: electric and magnetic, not a note. A gritty buzz,
   * low like mains hum (a sawtooth and a square a hair apart, beating),
   * through a narrow resonant band that sweeps down as a discharge does, with
   * a crackle of sparks. `f` only sets how low it hums. */
  function zap(f, strength = 0.5, pan = 0, delay = 0, short = 1) {
    if (!live()) return;
    const at = ac.currentTime + delay;
    const to = panned(pan);
    const s = Math.min(1, strength);
    const dur = (0.16 + 0.14 * s) * short;
    const hum = f / 2.5;
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, at);
    out.gain.exponentialRampToValueAtTime(0.03 + 0.05 * s, at + 0.004);
    out.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    out.connect(to);
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 5;
    band.frequency.setValueAtTime(2600 + 1400 * s, at);
    band.frequency.exponentialRampToValueAtTime(420, at + dur);
    const shape = ac.createWaveShaper();
    shape.curve = gritCurve();
    shape.connect(band).connect(out);
    const saw = ac.createOscillator(), sq = ac.createOscillator(), sg = ac.createGain();
    saw.type = "sawtooth";
    sq.type = "square";
    saw.frequency.value = hum;
    sq.frequency.value = hum * 1.013;
    sg.gain.value = 0.6;
    saw.connect(shape);
    sq.connect(sg).connect(shape);
    // A jitter on the hum, as a field that will not settle.
    const jit = ac.createOscillator(), jg = ac.createGain();
    jit.type = "square";
    jit.frequency.value = 23 + Math.random() * 17;
    jg.gain.value = hum * 0.08;
    jit.connect(jg);
    jg.connect(saw.frequency);
    jg.connect(sq.frequency);
    for (const o of [saw, sq, jit]) { o.start(at); o.stop(at + dur + 0.05); }
    sparks(at, dur * 0.8, 3 + Math.round(4 * s), 0.04 + 0.05 * s, to);
  }

  /** A dull thud, the cursor swallowed: a low drop with the overtones small
   * speakers can play, and no note in it. */
  function thud(strength = 1) {
    if (!live()) return;
    const at = ac.currentTime;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.09 * strength, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
    g.connect(bus);
    [[1, 1], [2.1, 0.5], [3.3, 0.25]].forEach(([m, l]) => {
      const o = ac.createOscillator(), og = ac.createGain();
      o.frequency.setValueAtTime(80 * m, at);
      o.frequency.exponentialRampToValueAtTime(34 * m, at + 0.3);
      og.gain.value = l;
      o.connect(og).connect(g);
      o.start(at);
      o.stop(at + 0.5);
    });
    noise(at, 0.25, "lowpass", 900, 120, 0.04, 0.004);
  }

  /** The hole going off. First the pressure builds over `build` s, a rush of
   * noise rising in pitch over a swelling rumble, the drone's last; then the
   * explosion: a deep boom that drops (its overtones for small speakers), a
   * blast of air that darkens as it spreads, debris crackling down, and a
   * long low tail. */
  function evaporate(build = 0.6) {
    if (!live()) return;
    const t = ac.currentTime, end = t + build;
    // The build: rising, then cut dead at the blast.
    noise(t, build, "bandpass", 300, 4500, 0.05, build * 0.9, 1.4);
    noise(t, build, "lowpass", 60, 160, 0.06, build * 0.9, 0.9);
    // The boom.
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, end);
    g.gain.exponentialRampToValueAtTime(0.16, end + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 1.6);
    g.connect(bus);
    [[1, 1], [2, 0.55], [3, 0.3], [4.2, 0.15]].forEach(([m, l]) => {
      const o = ac.createOscillator(), og = ac.createGain();
      o.frequency.setValueAtTime(70 * m, end);
      o.frequency.exponentialRampToValueAtTime(26 * m, end + 0.9);
      og.gain.value = l;
      o.connect(og).connect(g);
      o.start(end);
      o.stop(end + 1.7);
    });
    // The blast of air, bright at first, darkening; and a long low tail.
    noise(end, 1.4, "lowpass", 6000, 180, 0.12, 0.006, 0.6);
    noise(end, 3.2, "lowpass", 300, 50, 0.07, 0.05, 0.8);
    // Debris: crackles thinning out.
    for (let k = 0; k < 22; k++) {
      const tk = end + 0.08 + Math.pow(Math.random(), 1.8) * 1.6;
      noise(tk, 0.02 + Math.random() * 0.05, "bandpass", 800 + Math.random() * 2500, 600, 0.02 + Math.random() * 0.03, 0.003, 2);
    }
  }

  return { start, bell, wood, zap, thud, drone, chirp, shatter, evaporate, live };
}
