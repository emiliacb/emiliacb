/**
 * The gradient's sound, made as the tree's is (tree-sway.js): notes of a
 * Hijaz on D (D E♭ F♯ G A B♭), glass bells and rounder wood, under one soft
 * ceiling with an echo that loses its top each time. It is on unless the
 * footer's switch was last left off (the same "tree-sound" setting and
 * event), and, as a browser wants, starts on the first press on the page.
 *
 * The sheets ring like the tree's leaves when the hand brushes through their
 * edge, the biggest lowest. The hole has its own: a low drone that sinks as
 * it forms; the cursor's orbit as a tone that rises with its turning, the way
 * two stars spiralling together chirp; a scatter of bells when the tide takes
 * the cursor apart; a deep knock as it is swallowed; and the evaporation as a
 * run up the scale.
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
    for (let i = 0; i < 6; i++) {
      bell(note(Math.floor(Math.random() * 6), 2 + (Math.random() < 0.4 ? 1 : 0)), 0.35 + Math.random() * 0.3, Math.random() * 1.4 - 0.7, i * 0.05 + Math.random() * 0.06);
    }
  }

  /** The hole evaporating: a run up the scale, and a hiss. */
  function evaporate() {
    if (!live()) return;
    const run = [0, 2, 4, 6, 8, 10, 12, 14];
    run.forEach((s, i) => bell(note(s, 1), 0.5 + i * 0.05, (i / run.length) * 1.2 - 0.6, i * 0.045));
    const t = ac.currentTime;
    const n = ac.createBufferSource();
    n.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 3000;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    n.connect(f).connect(g).connect(bus);
    n.start(t);
    n.stop(t + 0.8);
  }

  return { start, bell, wood, drone, chirp, shatter, evaporate, live };
}
