// ── Synthesized sound effects (WebAudio, no assets) ─────────────────────────
// The AudioContext is created lazily on the first play call, which always
// happens inside a user gesture (keydown / touchend / click), satisfying
// browser autoplay policies. All functions are no-ops when sound is disabled
// or WebAudio is unavailable.

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

function ac(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface ToneOpts {
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  when?: number;
  slideTo?: number; // exponential glide target frequency
}

function tone(freq: number, { dur = 0.12, type = 'sine', gain = 0.12, when = 0, slideTo }: ToneOpts = {}): void {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

interface NoiseOpts {
  dur?: number;
  gain?: number;
  when?: number;
  filterFreq?: number;
}

function noise({ dur = 0.2, gain = 0.2, when = 0, filterFreq = 800 }: NoiseOpts = {}): void {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + when;
  const len = Math.max(1, Math.ceil(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

// Soft tick when a pending strip is pushed in.
export function playPush(): void {
  noise({ dur: 0.06, gain: 0.06, filterFreq: 2400 });
}

// Match blip — pitch climbs a pentatonic ladder as the combo builds.
const MATCH_STEPS = [0, 3, 5, 7, 12];
export function playMatch(combo: number): void {
  const step = MATCH_STEPS[Math.min(Math.max(combo, 1), MATCH_STEPS.length) - 1];
  const f = 440 * Math.pow(2, step / 12);
  tone(f, { type: 'triangle', dur: 0.1, gain: 0.14 });
  tone(f * 2, { type: 'sine', dur: 0.14, gain: 0.07, when: 0.03 });
}

// Bright ascending arpeggio for a 3+ board-wide wipe.
export function playBoardWipe(): void {
  [523.25, 659.25, 783.99].forEach((f, i) =>
    tone(f, { type: 'triangle', dur: 0.18, gain: 0.11, when: i * 0.055 })
  );
}

// Low thump + noise burst for bomb detonations.
export function playBomb(): void {
  noise({ dur: 0.25, gain: 0.22, filterFreq: 500 });
  tone(90, { type: 'sine', dur: 0.28, gain: 0.24, slideTo: 40 });
}

// Big descending boom for the center-cross nuke.
export function playNuke(): void {
  noise({ dur: 0.6, gain: 0.28, filterFreq: 400 });
  tone(160, { type: 'sawtooth', dur: 0.55, gain: 0.15, slideTo: 45 });
  tone(60, { type: 'sine', dur: 0.6, gain: 0.28, slideTo: 35 });
}

// Chime when the nuke meter reaches full charge.
export function playNukeReady(): void {
  tone(880, { type: 'sine', dur: 0.12, gain: 0.1 });
  tone(1318.5, { type: 'sine', dur: 0.22, gain: 0.1, when: 0.09 });
}

// Ascending fanfare for emptying the entire play area.
export function playCleanSweep(): void {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone(f, { type: 'triangle', dur: 0.22, gain: 0.12, when: i * 0.09 })
  );
  tone(2093, { type: 'sine', dur: 0.4, gain: 0.06, when: 0.36 });
}

// Quick shuffle for the pending-strip reroll.
export function playReroll(): void {
  noise({ dur: 0.05, gain: 0.1, filterFreq: 3000 });
  noise({ dur: 0.05, gain: 0.1, filterFreq: 3500, when: 0.07 });
}

// Descending three-note phrase on game over.
export function playGameOver(): void {
  tone(330, { type: 'triangle', dur: 0.25, gain: 0.12 });
  tone(247, { type: 'triangle', dur: 0.3, gain: 0.12, when: 0.18 });
  tone(185, { type: 'triangle', dur: 0.45, gain: 0.12, when: 0.38 });
}
