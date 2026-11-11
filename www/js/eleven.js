// ElevenLabs: the main voice. It returns the sound AND the time of every letter (the Shorts captions use it word by word).
// A key runs out -> the next key with enough characters. ONE voice for the whole video: when ElevenLabs cannot voice
// the whole video, the caller uses Gemini for the whole video instead (never two voices in one video).
import * as K from './keys.js';

const API = 'https://api.elevenlabs.io/v1';
export const VOICES = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George — тёплый рассказчик' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel — ведущий' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian — глубокий' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill — мудрый' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie — энергичный' },
];
export const DEFAULT_VOICE = VOICES[0].id;

export const left = () => K.of('eleven').filter((k) => k.ok !== false).reduce((s, k) => s + (k.left || 0), 0);
// one piece of the voice (~700 characters) must fit into ONE key, so crumbs smaller than a piece do not count
export const PIECE = 750;
export const enough = (chars) => K.of('eleven').filter((k) => k.ok !== false && (k.left ?? 1e9) >= Math.min(PIECE, chars)).reduce((s, k) => s + (k.left ?? 1e9), 0) >= chars * 1.05;
// best fit: the key with the SMALLEST balance that still holds this text, so big balances stay whole for long videos
const fit = (need, feature, extra = () => true) => K.best('eleven',
  (x) => (x.left ?? 1e9) >= need && !(x.noPerm || []).includes(feature) && extra(x),
  (x) => x.left ?? 1e12);
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
// what ElevenLabs answered when it said no -> what to do with this key
function refuse(k, r, j, feature) {
  const st = j.detail?.status || '', why = String(j.detail?.message || '');
  if (st === 'quota_exceeded') { k.left = 0; k.note = 'символы кончились'; K.save(); return 'next'; }
  if (st === 'detected_unusual_activity') { K.bad(k, 'ElevenLabs заблокировал бесплатный план этого ключа (VPN или много аккаунтов)'); return 'next'; }
  if (st === 'missing_permissions') { k.noPerm = [...new Set([...(k.noPerm || []), feature])]; k.note = `у ключа нет права: ${feature === 'sfx' ? 'звуки' : 'озвучка'}`; K.save(); return 'next'; }
  if (st === 'invalid_api_key' || r.status === 401) { K.bad(k, 'ключ не принят'); return 'next'; }
  if (r.status === 429) {                                        // too many at once / system busy: this key rests a moment, another one goes on
    K.cool(k, st === 'system_busy' || /busy/i.test(why) ? 5000 : 2500, 'занят'); return 'wait';
  }
  if (r.status >= 500) { K.cool(k, 3000, 'ElevenLabs перегружен'); return 'wait'; }
  return '';
}

// -> {bytes (mp3), chars: [..], starts: [..], ends: [..]} for one piece of text
// Kazakh is read by Eleven v3; if a key can not use it, the multilingual model reads it instead
export async function speak(text, voice, { signal, speed = 1, stability = 0.5, lang = 'ru' } = {}) {
  let lastErr = 'ElevenLabs не ответил';
  let model = lang === 'kk' ? 'eleven_v3' : 'eleven_multilingual_v2';
  for (let i = 0; i < 24; i++) {
    if (signal?.aborted) throw new Error('Остановлено');
    const k = fit(text.length, 'tts', (x) => !(x.noVoice || []).includes(voice));
    if (!k) {
      if (K.of('eleven').some((x) => x.ok !== false && (x.left ?? 1e9) >= text.length && x.cool > Date.now())) { await pause(1500); continue; }
      throw new Error('У ключей ElevenLabs кончились символы');
    }
    let r, j;
    try {
      r = await fetch(`${API}/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
        method: 'POST', signal, headers: { 'xi-api-key': k.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: model, voice_settings: model === 'eleven_v3' ? { stability: 0.5 } : { stability, similarity_boost: 0.8, style: 0.15, speed: Math.max(0.7, Math.min(1.2, speed)) } }),
      });
      j = await r.json().catch(() => ({}));
    } catch { lastErr = 'нет интернета'; await pause(2000); continue; }
    if (r.ok && j.audio_base64) {
      if (k.left != null) { k.left = Math.max(0, k.left - text.length); k.note = `осталось ${k.left.toLocaleString('ru')} символов`; K.save(); }
      const a = j.alignment || {};
      return { bytes: Uint8Array.from(atob(j.audio_base64), (c) => c.charCodeAt(0)), chars: a.characters || [], starts: a.character_start_times_seconds || [], ends: a.character_end_times_seconds || [] };
    }
    const st = j.detail?.status || '';
    // the voice is not open to this key (not in its library / library voices need a paid plan): other keys may have it
    if (st === 'voice_not_found' || st === 'paid_plan_required' || r.status === 402) { k.noVoice = [...new Set([...(k.noVoice || []), voice])]; K.save(); continue; }
    if ((r.status === 400 || r.status === 422) && model === 'eleven_v3' && !/quota/.test(st)) { model = 'eleven_multilingual_v2'; continue; }
    const act = refuse(k, r, j, 'tts');
    if (act === 'next') continue;
    if (act === 'wait') { await pause(800); continue; }
    lastErr = `ElevenLabs: ${r.status} ${(j.detail?.message || '').slice(0, 120)}`;
  }
  throw new Error(lastErr);
}

// Sound effects made by ElevenLabs from a short English description ("a stadium crowd roars").
// Costs credits (about 40 per second of sound), so callers keep a library and ask only for new sounds.
export const SFX_COST = (seconds) => Math.ceil(seconds * 40);
export async function soundFx(text, seconds = 2, { signal } = {}) {
  const need = SFX_COST(seconds);
  for (let i = 0; i < 8; i++) {
    if (signal?.aborted) throw new Error('Остановлено');
    const k = fit(need, 'sfx');
    if (!k) throw new Error('у ключей ElevenLabs мало символов для звуков');
    let r;
    try {
      r = await fetch(`${API}/sound-generation`, { method: 'POST', signal, headers: { 'xi-api-key': k.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, duration_seconds: seconds, prompt_influence: 0.55 }) });
    } catch { await pause(1500); continue; }
    if (r.ok) {
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (k.left != null) { k.left = Math.max(0, k.left - need); k.note = `осталось ${k.left.toLocaleString('ru')} символов`; K.save(); }
      return bytes;
    }
    const j = await r.json().catch(() => ({}));
    const act = refuse(k, r, j, 'sfx');
    if (act === 'next') continue;
    if (act === 'wait') { await pause(800); continue; }
    throw new Error(`ElevenLabs звуки: ${r.status} ${(j.detail?.message || '').slice(0, 100)}`);
  }
  throw new Error('ElevenLabs не дал звук');
}
