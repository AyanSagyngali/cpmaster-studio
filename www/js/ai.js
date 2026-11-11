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

// What Google said in a 429. The text says little; the real reason is in error.details:
// QuotaFailure.violations[].quotaId (…PerDay… / …PerMinute…), quotaValue (the limit; "0" = no quota on this plan), RetryInfo.retryDelay.
export function quotaInfo(err = {}) {
  const det = Array.isArray(err.details) ? err.details : [], msg = String(err.message || '');
  const v = det.flatMap((d) => d.violations || []);
  const ids = v.map((x) => `${x.quotaId || ''} ${x.quotaMetric || ''}`).join(' ');
  const num = (re) => { const x = v.find((y) => re.test(y.quotaId || '')); return x && x.quotaValue != null ? +x.quotaValue : null; };
  const retry = det.find((d) => d.retryDelay)?.retryDelay || msg.match(/retry in ([\d.]+)\s*s/i)?.[1];
  const info = det.find((d) => d.metadata)?.metadata || {};
  const all = `${ids} ${msg} ${info.quota_metric || ''} ${info.quota_limit || ''}`;
  return {
    // a limit of the WHOLE key (Google's "API requests … per minute for a region"), not of one model
    key: !v.some((x) => x.quotaDimensions?.model) && /API requests|for a region|PerRegion|api_requests/i.test(all),
    day: /PerDay/i.test(ids) || (!v.length && /per day|daily/i.test(msg)),
    zero: v.some((x) => String(x.quotaValue) === '0') || /limit: 0\b/.test(msg),
    retry: retry ? parseFloat(retry) * 1000 : 0,
    perDay: num(/Requests.*PerDay|PerDay.*Requests/i),
    perMinute: num(/Requests.*PerMinute|PerMinute.*Requests/i),
  };
}

export const MODELS = { text: TEXT, fast: FAST, image: IMAGE, tts: TTS };
const PATIENCE = 20000;                       // a better model is worth waiting this long for before a weaker one takes over
const recent = new Map();                     // `key|model` -> request times in the last minute (pacing by the learned per-minute quota)
const told = new Set();                       // switch notices already shown
const at = (t) => new Date(t).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });

// until when (key, model) can not be asked; <= now = free
function blocked(k, m, now) {
  const l = K.limitOf(k, m, now);
  let t = Math.max(l ? l.until : 0, k.cool || 0);           // k.cool: the whole key rests (Google limits the key itself)
  const cap = k.quota?.[m]?.minute;
  if (cap) {
    const xs = (recent.get(`${k.key}|${m}`) || []).filter((x) => x > now - 60000);
    recent.set(`${k.key}|${m}`, xs);
    if (xs.length >= cap) t = Math.max(t, xs[xs.length - cap] + 60500);
  }
  return t;
}
// best model first; inside a model the key that rested longest. -> {m, k} | {wait, m?} | {none}
function choose(models, want, busy, now) {
  let soon = Infinity, why = '';
  for (const m of models) {
    const b = busy.get(m) || 0;
    if (b > now) { if (b < soon) { soon = b; why = `${m} перегружена`; } continue; }
    const keys = K.of('gemini').filter((k) => k.ok !== false && want(k) && K.offers(k, m));
    if (!keys.length) continue;
    const free = keys.filter((k) => blocked(k, m, now) <= now);
    if (free.length) {
      const k = free.sort((a, b2) => (a.last || 0) - (b2.last || 0))[0];
      k.last = now;
      return { m, k };
    }
    const minute = keys.filter((k) => K.limitOf(k, m, now)?.kind !== 'day' && K.limitOf(k, m, now)?.kind !== 'none').map((k) => blocked(k, m, now));
    const t = minute.length ? Math.min(...minute) : Infinity;
    if (t - now <= PATIENCE) return { wait: t, why: `все ключи модели ${m} на минутном лимите` };
    if (t < soon) { soon = t; why = `все ключи на минутном лимите`; }
  }
  return soon < Infinity ? { wait: soon, why } : { none: true };
}

// one generateContent call over keys and models. kind: 'text' | 'fast' | 'image' | 'tts'
async function call(kind, body, { signal, tries = 40, onWait, think } = {}) {
  const models = offered(MODELS[kind] || TEXT);
  if (!models.length) throw new Error('У ключей Gemini нет подходящей модели');
  const busy = new Map();                                       // model -> overloaded / not answering until
  const want = kind === 'image' ? (k) => k.image !== false : () => true;
  let lastErr = 'Gemini не ответил';
  for (let sent = 0; sent < tries;) {
    if (signal?.aborted) throw new Stop();
    const now = Date.now();
    if (kind === 'image' && !K.of('gemini').some((x) => x.ok !== false && x.image !== false)) return null;   // no key can draw at all
    const c = choose(models, want, busy, now);
    if (c.none) {
      if (kind === 'image') return null;
      const any = K.of('gemini').filter((k) => k.ok !== false);
      if (!any.length) throw new Error('Нет рабочих ключей Gemini');
      throw new Error(`Дневной лимит Gemini кончился на всех ключах и моделях. Обновится в ${at(K.geminiReset())}. Добавь ключи из других проектов Google или подожди`);
    }
    if (c.wait) {
      const wait = Math.min(60000, Math.max(1000, c.wait - now));
      onWait?.(`Gemini: ${c.why}, жду ${Math.ceil(wait / 1000)} с`);
      await sleep(wait, signal);
      continue;
    }
    const { m, k } = c;
    if (m !== models[0] && !told.has(`${kind}|${m}`)) {
      const off = models.slice(0, models.indexOf(m)).filter((x) => !(busy.get(x) > now)).map((x) => x).join(', ');
      if (off) { told.add(`${kind}|${m}`); onWait?.(`Gemini: у ${off} лимит на всех ключах, работаю на ${m}`); }
    }
    sent++;
    let r, j;
    const tm = new AbortController(), timer = setTimeout(() => tm.abort(), kind === 'image' ? 90000 : 60000);   // a stuck request goes to the next model / key
    const onAbort = () => tm.abort(); signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const rk = `${k.key}|${m}`; recent.set(rk, [...(recent.get(rk) || []), Date.now()]);
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
      K.used(k, m);
      if (k.strikes) { k.strikes = 0; k.note = 'Gemini работает'; }
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
      const q = quotaInfo(j.error);
      K.learn(k, m, { day: q.perDay, minute: q.perMinute });
      if (q.key) { K.rest(k, 'Google режет ключ: лимит запросов для региона'); lastErr = 'Google режет ключи'; continue; }
      if (q.zero) {                                              // this key's plan has no quota for this model: other models / keys go on
        if (kind === 'image') { k.image = false; K.save(); continue; }
        K.limit(k, m, 'none', K.geminiReset()); continue;
      }
      if (q.day) { K.limit(k, m, 'day', K.geminiReset()); lastErr = `дневной лимит ${m}`; continue; }
      K.limit(k, m, 'minute', Date.now() + (q.retry || 20000) + 500); lastErr = `минутный лимит ${m}`; continue;
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
