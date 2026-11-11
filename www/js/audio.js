// Sound: the narration pieces are decoded and laid end to end; the music bed and the effects are synthesised here
// (nothing external, nothing licensed) and mixed into one mono track (48 kHz) for the encoder.
// The rule of the best cartoon shorts: music sits at HALF the voice level (−6 dB, measured on the voice's loud parts),
// effects at half or less with peaks capped below the voice, so the narration always stays clear.
export const RATE = 48000;
const TAU = Math.PI * 2;

let ctx;
const ac = () => (ctx ||= new (globalThis.AudioContext || globalThis.webkitAudioContext)({ sampleRate: RATE }));

export async function decode(bytes) {
  const buf = await ac().decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const ch = buf.getChannelData(0);
  if (buf.sampleRate === RATE) return new Float32Array(ch);
  const off = new OfflineAudioContext(1, Math.ceil(buf.duration * RATE), RATE);       // resample to 48 kHz
  const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
  return (await off.startRendering()).getChannelData(0).slice();
}

// trim silence at both ends (TTS pieces start and end with air)
export function trim(a, thr = 0.012) {
  let s = 0, e = a.length - 1;
  while (s < e && Math.abs(a[s]) < thr) s++;
  while (e > s && Math.abs(a[e]) < thr) e--;
  return a.subarray(Math.max(0, s - RATE * 0.03), Math.min(a.length, e + RATE * 0.06));
}

// loudness per video frame, 0..1: drives talking mouths
export function envelope(a, fps) {
  const step = RATE / fps, out = new Float32Array(Math.ceil(a.length / step));
  for (let i = 0; i < out.length; i++) {
    let s = 0; const a0 = Math.floor(i * step), a1 = Math.min(a.length, Math.floor((i + 1) * step));
    for (let j = a0; j < a1; j += 4) s += a[j] * a[j];
    out[i] = Math.min(1, Math.sqrt(s / Math.max(1, (a1 - a0) / 4)) * 5);
  }
  return out;
}

/* ---------------- music beds: short loops with a groove, one per mood ---------------- */
const noise = (() => { let s = 12345; return () => ((s = (s * 16807) % 2147483647) / 1073741823.5 - 1); })();
const note = (m) => 440 * Math.pow(2, (m - 69) / 12);
const MOODS = {
  playful: { bpm: 112, root: 50, prog: [0, 5, 7, 5], scale: [0, 2, 4, 7, 9, 12], kick: true, snare: true, pluck: 'square', pad: 0.5 },
  epic: { bpm: 92, root: 45, prog: [0, 8, 3, 10], scale: [0, 3, 7, 12], kick: true, snare: true, pluck: 'saw', pad: 1 },
  tense: { bpm: 84, root: 40, prog: [0, 1, 0, 6], scale: [0, 3, 6, 7], kick: true, snare: false, pluck: 'sine', pad: 1 },
  tech: { bpm: 120, root: 48, prog: [0, 3, 8, 7], scale: [0, 3, 7, 10, 12, 15], kick: true, snare: true, pluck: 'square', pad: 0.4 },
  calm: { bpm: 72, root: 52, prog: [0, 5, 9, 7], scale: [0, 4, 7, 11, 12], kick: false, snare: false, pluck: 'sine', pad: 0.8 },
};
export function music(seconds, mood = 'playful') {
  if (mood === true) mood = 'playful'; if (mood === false) mood = 'calm';
  const M = MOODS[mood] || MOODS.playful, n = Math.ceil(seconds * RATE), out = new Float32Array(n);
  const beat = 60 / M.bpm, bar = beat * 4;
  // render one 4-bar loop, then repeat it (cheap on a phone even for a 15-minute video)
  const L = Math.ceil(bar * 4 * RATE), loop = new Float32Array(L);
  for (let b = 0; b < 4; b++) {
    const chordRoot = M.root + M.prog[b];
    for (let i = 0; i < Math.ceil(bar * RATE); i++) {                      // pad: a soft chord that breathes
      const t = i / RATE, k = b * Math.ceil(bar * RATE) + i; if (k >= L) break;
      let v = 0; for (const iv of [0, 7, 12, 16]) v += Math.sin(TAU * note(chordRoot + iv) * t + iv) * 0.25;
      loop[k] += v * 0.06 * M.pad * (0.7 + 0.3 * Math.sin(TAU * t / bar));
    }
    for (let s = 0; s < 8; s++) {                                          // a plucked melody on the off-beats
      const t0 = b * bar + s * beat / 2, m = chordRoot + 12 + M.scale[(s * 3 + b) % M.scale.length], f = note(m);
      const k0 = Math.floor(t0 * RATE), len = Math.floor(RATE * beat * 0.45);
      for (let i = 0; i < len && k0 + i < L; i++) { const t = i / RATE, ph = (f * t) % 1; const w = M.pluck === 'square' ? (ph < 0.5 ? 1 : -1) * 0.5 : M.pluck === 'saw' ? ph * 2 - 1 : Math.sin(TAU * ph); loop[k0 + i] += w * Math.exp(-t * 9) * 0.05; }
    }
    for (let q = 0; q < 4; q++) {                                          // bass, kick, snare, hats
      const t0 = b * bar + q * beat, k0 = Math.floor(t0 * RATE);
      for (let i = 0; i < Math.floor(RATE * beat * 0.9) && k0 + i < L; i++) { const t = i / RATE; loop[k0 + i] += Math.sin(TAU * note(chordRoot - 12) * t) * Math.exp(-t * 3) * 0.1; }
      if (M.kick) for (let i = 0; i < RATE * 0.25 && k0 + i < L; i++) { const t = i / RATE; loop[k0 + i] += Math.sin(TAU * (55 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 14) * 0.28; }
      if (M.snare && q % 2) for (let i = 0; i < RATE * 0.18 && k0 + i < L; i++) { const t = i / RATE; loop[k0 + i] += noise() * Math.exp(-t * 22) * 0.1; }
      for (const h of [0, 0.5]) { const kh = Math.floor((t0 + h * beat) * RATE); for (let i = 0; i < RATE * 0.04 && kh + i < L; i++) loop[kh + i] += noise() * Math.exp(-i / RATE * 90) * 0.035; }
    }
  }
  for (let i = 0; i < n; i++) out[i] = loop[i % L];
  return out;
}

/* ---------------- effects ---------------- */
const make = (len, f) => { const n = Math.floor(len * RATE), out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = f(i / RATE, i / n); return out; };
export function whoosh(len = 0.6) { let lp = 0; return make(len, (t, u) => { lp += (noise() - lp) * (0.04 + 0.5 * Math.sin(Math.PI * u)); return lp * Math.sin(Math.PI * u) * 0.5; }); }
export const pop = () => make(0.12, (t) => Math.sin(TAU * (900 - 2600 * t) * t) * Math.exp(-t * 38) * 0.35);
export const chime = () => make(1.2, (t) => (Math.sin(TAU * 1318 * t) + 0.5 * Math.sin(TAU * 1976 * t)) * Math.exp(-t * 4) * 0.08);
export const boom = () => make(0.6, (t) => Math.sin(TAU * (70 - 40 * t) * t) * Math.exp(-t * 7) * 0.7 + noise() * Math.exp(-t * 30) * 0.2);
export const ding = () => make(0.9, (t) => (Math.sin(TAU * 1760 * t) + 0.4 * Math.sin(TAU * 2640 * t)) * Math.exp(-t * 6) * 0.22);
export const thud = () => make(0.3, (t) => Math.sin(TAU * (120 - 200 * t) * t) * Math.exp(-t * 20) * 0.6 + noise() * Math.exp(-t * 60) * 0.15);
export function crash() { let lp = 0; return make(1.4, (t) => { lp += (noise() - lp) * 0.6; return (lp * 0.5 + Math.sin(TAU * 60 * t) * 0.3) * Math.exp(-t * 3); }); }
export function crowd(len = 2.2) { let a = 0, b = 0; return make(len, (t, u) => { a += (noise() - a) * 0.08; b += (noise() - b) * 0.3; return (a * 0.9 + b * 0.25) * Math.sin(Math.PI * Math.min(1, u * 1.6)) * 0.5; }); }
export const sting = () => make(1.6, (t) => (Math.sin(TAU * 55 * t) * 0.7 + Math.sin(TAU * 82.4 * t) * 0.4 + noise() * Math.exp(-t * 18) * 0.3) * Math.exp(-t * 1.6) * 0.6);
export const magic = () => make(1.1, (t) => { let v = 0; for (let k = 0; k < 5; k++) { const tk = t - k * 0.07; if (tk > 0) v += Math.sin(TAU * (1200 + k * 320) * tk) * Math.exp(-tk * 7); } return v * 0.08; });
export function splash() { let lp = 0; return make(0.8, (t) => { lp += (noise() - lp) * 0.35; return lp * Math.exp(-t * 6) * 0.6; }); }
export const laugh = () => make(0.7, (t) => Math.sin(TAU * (380 + 80 * Math.sin(TAU * 9 * t)) * t) * Math.max(0, Math.sin(TAU * 9 * t)) * Math.exp(-t * 2) * 0.25);
export const SFX = { whoosh, pop, chime, boom, ding, thud, crash, crowd, sting, magic, splash, laugh };

/* ---------------- the mix ---------------- */
// gated RMS: the loudness of the voice where it actually speaks (silence does not count)
function gatedRms(a) {
  const win = Math.floor(RATE * 0.05); let sum = 0, cnt = 0;
  for (let i = 0; i + win <= a.length; i += win) { let s = 0; for (let j = i; j < i + win; j += 2) s += a[j] * a[j]; const r = Math.sqrt(s / (win / 2)); if (r > 0.01) { sum += r * r; cnt++; } }
  return cnt ? Math.sqrt(sum / cnt) : 0.1;
}
function rms(a) { let s = 0; for (let i = 0; i < a.length; i += 2) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, a.length / 2)) || 1e-6; }

// voice + music bed (exactly half the voice level) + effects at times -> one track.
// stopAt: the twist line — the music stops there (a sting), then a quiet drone carries the payoff
export function mix(voice, { energetic, mood, sfx = [], stopAt = null } = {}) {
  const n = voice.length + RATE, out = new Float32Array(n);
  const vr = gatedRms(voice);
  let vpeak = 0; for (let i = 0; i < voice.length; i++) vpeak = Math.max(vpeak, Math.abs(voice[i]));
  const bed = music(n / RATE, mood || (energetic === false ? 'calm' : 'playful'));
  const bedGain = (vr * 0.5) / rms(bed);
  const stop = stopAt == null ? n : Math.floor(stopAt * RATE), fade = RATE * 0.3;
  for (let i = 0; i < n; i++) {
    let g = bedGain;
    if (i > stop) g *= Math.max(0, 1 - (i - stop) / fade);
    out[i] = (i < voice.length ? voice[i] : 0) + bed[i] * g + (i > stop ? Math.sin(TAU * 55 * i / RATE) * vr * 0.12 * Math.min(1, (i - stop) / fade) : 0);
  }
  for (const [t, clip] of sfx) {
    if (!clip?.length) continue;
    let cp = 0; for (let i = 0; i < clip.length; i++) cp = Math.max(cp, Math.abs(clip[i]));
    const g = Math.min((vr * 0.5) / rms(clip), (vpeak * 0.7) / (cp || 1));   // half the voice, never louder than 70 % of its peak
    const s = Math.floor(t * RATE); for (let i = 0; i < clip.length && s + i < n; i++) if (s + i >= 0) out[s + i] += clip[i] * g;
  }
  // one gain + a soft peak limit for the whole mix (no pumping, the ratios stay)
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const G = peak > 0.95 ? 0.95 / peak : 1; if (G !== 1) for (let i = 0; i < n; i++) out[i] *= G;
  return out;
}
