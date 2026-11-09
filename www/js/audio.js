// Sound: the narration pieces are decoded and laid end to end, our own quiet music bed and whooshes are synthesised,
// everything is mixed into one mono track (48 kHz) for the encoder. Nothing external, nothing licensed.
export const RATE = 48000;

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

// the music bed: a soft drone chord that breathes (like the AE.LAH ranks pad), and a light pulse for Shorts
export function music(seconds, energetic = false) {
  const n = Math.ceil(seconds * RATE), out = new Float32Array(n);
  const chord = energetic ? [110, 164.8, 220, 277.2] : [98, 146.8, 196, 246.9];
  for (let i = 0; i < n; i++) {
    const t = i / RATE, sw = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.07 * t);
    let v = 0;
    for (let k = 0; k < chord.length; k++) v += Math.sin(2 * Math.PI * chord[k] * t + k) * (1 / (k + 1.4));
    if (energetic) { const b = (t * 2) % 1; v += Math.sin(2 * Math.PI * 55 * t) * Math.exp(-b * 9) * 1.6; }
    out[i] = v * 0.055 * sw;
  }
  return out;
}

export function whoosh(len = 0.6) {
  const n = Math.floor(len * RATE), out = new Float32Array(n);
  let lp = 0, seed = 7;
  for (let i = 0; i < n; i++) {
    seed = (seed * 16807) % 2147483647;
    const noise = seed / 1073741823.5 - 1, u = i / n, k = 0.04 + 0.5 * Math.sin(Math.PI * u);
    lp += (noise - lp) * k;
    out[i] = lp * Math.sin(Math.PI * u) * 0.5;
  }
  return out;
}

export function boom(len = 0.5) {
  const n = Math.floor(len * RATE), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / RATE; out[i] = Math.sin(2 * Math.PI * (70 - 40 * t) * t) * Math.exp(-t * 7) * 0.7; }
  return out;
}

// voice + music (ducked under the voice) + effects at times -> one track
export function mix(voice, { energetic = false, sfx = [] } = {}) {
  const n = voice.length + RATE, out = new Float32Array(n);
  const bed = music(n / RATE, energetic), env = envelope(voice, 50);
  for (let i = 0; i < n; i++) {
    const e = env[Math.min(env.length - 1, Math.floor(i / (RATE / 50)))] || 0;
    out[i] = (i < voice.length ? voice[i] : 0) + bed[i] * (1 - Math.min(0.6, e * 1.2));
  }
  for (const [t, clip] of sfx) { const s = Math.floor(t * RATE); for (let i = 0; i < clip.length && s + i < n; i++) out[s + i] += clip[i]; }
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0.98) { const g = 0.98 / peak; for (let i = 0; i < n; i++) out[i] *= g; }
  return out;
}
