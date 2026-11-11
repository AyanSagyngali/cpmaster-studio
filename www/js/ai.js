// Gemini (Google AI Studio keys): the script, the scenes, real pictures (only keys with billing can draw) and the backup voice.
// Every call walks the keys: a key at its limit rests and the next one answers at once; an overloaded model gives way to the next model.
import * as K from './keys.js';

const API = 'https://generativelanguage.googleapis.com/v1beta/models/';
// best first; the list is filtered by what the keys actually offer (keys.check stores each key's model list)
const TEXT = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];
const FAST = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-flash-latest'];
const IMAGE = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image', 'gemini-nano-banana-2.1', 'gemini-3-pro-image', 'gemini-3.1-flash-lite-image'];
const TTS = ['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-3.8-flash-lite-tts'];

export class Stop extends Error { constructor() { super('Остановлено'); } }
const sleep = (ms, signal) => new Promise((ok, bad) => {
  const t = setTimeout(ok, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); bad(new Stop()); }, { once: true });
});

const offered = (models) => {
  const have = new Set(K.of('gemini').flatMap((k) => k.models || []));
  return have.size ? models.filter((m) => have.has(m)) : models;
};
// a model that refuses a thinking level steps down: minimal -> low -> the model's own default (models change without notice)
const THINK_STEPS = ['minimal', 'low', null], thinkStep = {};
const thinking = (m, level) => {
  if (!/^gemini-[3-9]/.test(m)) return thinkStep[m] ? null : { thinkingBudget: 0 };
  const lv = THINK_STEPS.slice(THINK_STEPS.indexOf(level || 'minimal')).concat(null)[thinkStep[m] || 0];
  return lv ? { thinkingLevel: lv } : null;
};

// one generateContent call over keys and models. kind: 'text' | 'fast' | 'image' | 'tts'
async function call(kind, body, { signal, tries = 40, onWait, think } = {}) {
  const models = offered(kind === 'image' ? IMAGE : kind === 'tts' ? TTS : kind === 'fast' ? FAST : TEXT);
  if (!models.length) throw new Error('У ключей Gemini нет подходящей модели');
  const busy = new Map();                                       // model -> overloaded until
  let lastErr = 'Gemini не ответил';
  for (let i = 0; i < tries; i++) {
    if (signal?.aborted) throw new Stop();
    const m = models.find((x) => (busy.get(x) || 0) <= Date.now()) || models[i % models.length];
    const want = kind === 'image' ? (k) => k.image !== false : () => true;
    const k = K.next('gemini', want);
    if (!k) {
      if (kind === 'image' && !K.of('gemini').some((x) => x.ok !== false && x.image !== false)) return null;     // no key can draw at all
      const wait = Math.min(60000, Math.max(1500, K.soonest('gemini', want) - Date.now()));
      onWait?.(`Все ключи Gemini на минутном лимите, жду ${Math.ceil(wait / 1000)} с`);
      await sleep(wait, signal);
      continue;
    }
    let r, j;
    const tm = new AbortController(), timer = setTimeout(() => tm.abort(), kind === 'image' ? 90000 : 60000);   // a stuck request goes to the next model / key
    const onAbort = () => tm.abort(); signal?.addEventListener('abort', onAbort, { once: true });
    try {
      r = await fetch(`${API}${m}:generateContent?key=${encodeURIComponent(k.key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: tm.signal,
        body: JSON.stringify(kind === 'image' || kind === 'tts' || !thinking(m, think) ? body : { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: thinking(m, think) } }),
      });
      j = await r.json().catch(() => ({}));
    } catch (e) {
      if (signal?.aborted) throw new Stop();
      if (tm.signal.aborted) { busy.set(m, Date.now() + 60000); lastErr = 'Gemini долго не отвечал'; continue; }
      lastErr = 'нет интернета'; await sleep(2000, signal); continue;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
    if (r.ok) {
      K.used(k);
      const parts = j.candidates?.[0]?.content?.parts || [];
      if (kind === 'image' || kind === 'tts') {
        const d = parts.find((p) => p.inlineData)?.inlineData;
        if (d) { if (kind === 'image') k.image = true; return d; }
        lastErr = 'модель не вернула ' + (kind === 'image' ? 'картинку' : 'звук'); busy.set(m, Date.now() + 30000); continue;
      }
      const text = parts.map((p) => p.text || '').join('');
      if (text) return text;
      lastErr = 'пустой ответ'; continue;
    }
    const msg = j.error?.message || '';
    if (r.status === 429) {
      if (/limit: 0/.test(msg)) {                               // the free plan has no quota for this model at all
        if (kind === 'image') { k.image = false; K.save(); continue; }
        busy.set(m, Date.now() + 3600e3); continue;
      }
      const retry = (j.error?.details || []).find((d) => d.retryDelay)?.retryDelay;
      const perDay = /per day|PerDay/i.test(msg);
      K.cool(k, perDay ? 3600e3 : retry ? parseFloat(retry) * 1000 + 500 : 20000, perDay ? 'дневной лимит' : 'минутный лимит');
      continue;
    }
    if (r.status === 503 || r.status === 500 || r.status === 504) { busy.set(m, Date.now() + 20000); lastErr = 'Gemini перегружен'; await sleep(600, signal); continue; }
    if (r.status === 404) { busy.set(m, Date.now() + 864e5); continue; }
    if (r.status === 400 && /thinking/i.test(msg) && kind !== 'image' && kind !== 'tts' && (thinkStep[m] || 0) < 2) { thinkStep[m] = (thinkStep[m] || 0) + 1; continue; }
    if (r.status === 400 && /API key/i.test(msg)) { K.bad(k, 'ключ не принят'); continue; }
    if (r.status === 403) { K.bad(k, 'доступ запрещён'); continue; }
    lastErr = `Gemini: ${r.status} ${msg.slice(0, 120)}`;
    if (r.status === 400) throw new Error(lastErr);
  }
  throw new Error(lastErr);
}

// JSON answer: the model is asked for JSON and the answer is parsed; a broken answer is asked again
export async function json(prompt, { fast = false, temperature = 0.9, signal, onWait, think } = {}) {
  for (let a = 0; a < 3; a++) {
    const text = await call(fast ? 'fast' : 'text', { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature, responseMimeType: 'application/json' } }, { signal, onWait, think });
    try { return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { /* try again */ }
  }
  throw new Error('Gemini вернул неправильный JSON три раза подряд');
}

export async function text(prompt, { fast = false, temperature = 0.8, signal } = {}) {
  return call(fast ? 'fast' : 'text', { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature } }, { signal });
}

// a real picture (keys with billing only). null = no key can draw: the caller animates the scene instead
export async function image(prompt, aspect, { signal, onWait } = {}) {
  const d = await call('image', { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } } }, { signal, onWait, tries: 25 });
  if (!d) return null;
  return new Blob([Uint8Array.from(atob(d.data), (c) => c.charCodeAt(0))], { type: d.mimeType || 'image/png' });
}
export const canDraw = () => K.of('gemini').some((k) => k.ok !== false && k.image !== false);
export const drawsForSure = () => K.of('gemini').some((k) => k.ok && k.image === true);

// the backup voice: Gemini TTS. -> {bytes: Uint8Array, mime}
export async function speak(textToSay, voice = 'Charon', style = 'Say in a calm, measured documentary narrator tone, at a steady even pace:', { signal, onWait } = {}) {
  const d = await call('tts', {
    contents: [{ parts: [{ text: `${style}\n\n${textToSay}` }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
  }, { signal, onWait, tries: 30 });
  return { bytes: Uint8Array.from(atob(d.data), (c) => c.charCodeAt(0)), mime: d.mimeType || 'audio/wav' };
}
