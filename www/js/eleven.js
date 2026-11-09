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
export const enough = (chars) => left() >= chars * 1.05;

// -> {bytes (mp3), chars: [..], starts: [..], ends: [..]} for one piece of text
export async function speak(text, voice, { signal, speed = 1, stability = 0.5 } = {}) {
  let lastErr = 'ElevenLabs не ответил';
  for (let i = 0; i < 24; i++) {
    if (signal?.aborted) throw new Error('Остановлено');
    const k = K.next('eleven', (x) => (x.left ?? 1e9) >= text.length && !(x.noVoice || []).includes(voice));
    if (!k) throw new Error('У ключей ElevenLabs кончились символы');
    let r, j;
    try {
      r = await fetch(`${API}/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
        method: 'POST', signal, headers: { 'xi-api-key': k.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability, similarity_boost: 0.8, style: 0.15, speed } }),
      });
      j = await r.json().catch(() => ({}));
    } catch { lastErr = 'нет интернета'; await new Promise((ok) => setTimeout(ok, 2000)); continue; }
    if (r.ok && j.audio_base64) {
      if (k.left != null) { k.left = Math.max(0, k.left - text.length); k.note = `осталось ${k.left.toLocaleString('ru')} символов`; K.save(); }
      const a = j.alignment || {};
      return { bytes: Uint8Array.from(atob(j.audio_base64), (c) => c.charCodeAt(0)), chars: a.characters || [], starts: a.character_start_times_seconds || [], ends: a.character_end_times_seconds || [] };
    }
    const st = j.detail?.status || '';
    if (st === 'quota_exceeded') { k.left = 0; k.note = 'символы кончились'; K.save(); continue; }
    if (st === 'voice_not_found') { k.noVoice = [...(k.noVoice || []), voice]; K.save(); continue; }
    if (r.status === 401) { K.bad(k, 'ключ не принят'); continue; }
    if (r.status === 429) { K.cool(k, 4000, 'занят'); await new Promise((ok) => setTimeout(ok, 800)); continue; }
    lastErr = `ElevenLabs: ${r.status} ${(j.detail?.message || '').slice(0, 120)}`;
  }
  throw new Error(lastErr);
}
