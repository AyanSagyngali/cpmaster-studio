// The whole video, step by step like AE.LAH: script -> voice -> scenes -> montage. One video at a time.
// onStep(stage, done, total, text) feeds the progress screen; onScene(bitmap) shows real frames as they are made.
import * as AI from './ai.js';
import * as EL from './eleven.js';
import * as A from './audio.js';
import * as F from './formats.js';
import { makeScene, heroParts, PALETTE } from './scene.js';

export const STAGES = [['script', 'Сценарий'], ['voice', 'Озвучка'], ['scenes', 'Сцены'], ['montage', 'Монтаж'], ['done', 'Готово']];
const LOOKS = {
  istorik: { palette: PALETTE, look: '' },
  razgon: { palette: 'deep navy #1d2440, dusk purple #3b2f55, warm amber #f2a541, soft gold #f6c86a, coral #e0664f, teal shadow #2f5d62, fog #c9c3d6, and black #0d0d12', look: 'Cinematic low-key light: ONE strong light source (a window, a lamp, a sunset), deep purple and navy shadows, warm amber highlights, soft glow shapes.' },
};
const pool = async (items, n, fn) => {                                // n requests at once, keeps order
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
};

export async function make({ style, topic, kind, minutes = 10, lang = 'ru', voice, lessons = '', signal, onStep, onScene, onLog }) {
  const short = kind === 'short';
  const W = short ? 720 : 1280, H = short ? 1280 : 720, fps = 24;
  const step = (s, d, t, text) => onStep?.(s, d, t, text);
  const wait = (m) => onLog?.(m);

  /* 1. script */
  step('script', 0, 1, 'Gemini пишет сценарий');
  let lines, plan;
  if (short) {
    const r = await AI.json(F.linesPrompt({ style, topic, lang, lessons, words: lang === 'ru' ? 120 : 140, n: 12, short: true }), { signal, onWait: wait });
    lines = r.lines; plan = { title: topic, hero: '', hero_look: '' };
  } else {
    plan = await AI.json(F.planPrompt({ style, topic, minutes, lang, lessons }), { signal, onWait: wait });
    const words = Math.round(minutes * (lang === 'ru' ? 130 : 150)), per = Math.round(words / plan.chapters.length);
    let done = 0;
    const parts = await pool(plan.chapters, 4, async (c, k) => {
      const r = await AI.json(F.linesPrompt({ style, topic, lang, lessons, words: per, n: Math.max(4, Math.round(per / 20)), plan, chapter: c, k }), { signal, onWait: wait });
      step('script', ++done, plan.chapters.length, `Глава ${done} из ${plan.chapters.length}`);
      return r.lines;
    });
    lines = parts.flat();
  }
  lines = lines.filter((l) => l && String(l.text || '').trim()).map((l) => ({ text: String(l.text).trim(), idea: String(l.idea || l.text) }));
  if (lines.length < 3) throw new Error('Gemini написал слишком короткий сценарий');
  step('script', 1, 1, `${lines.length} сцен, ${lines.reduce((s, l) => s + l.text.split(/\s+/).length, 0)} слов`);

  /* 2. voice: ONE voice for the whole video. ElevenLabs if its characters are enough, else Gemini for everything */
  const chunks = []; let cur = [];
  for (const [i, l] of lines.entries()) { cur.push(i); if (cur.map((j) => lines[j].text).join(' ').length > 700) { chunks.push(cur); cur = []; } }
  if (cur.length) chunks.push(cur);
  const chars = lines.reduce((s, l) => s + l.text.length + 1, 0);
  let useEleven = EL.enough(chars);
  const speakAll = async () => {
    let done = 0;
    return pool(chunks, useEleven ? 2 : 3, async (idx) => {
      const text = idx.map((j) => lines[j].text).join(' ');
      let pcm, align = null;
      if (useEleven) { const r = await EL.speak(text, voice || EL.DEFAULT_VOICE, { signal, stability: 0.42, speed: short ? 1.08 : 1.02 }); pcm = await A.decode(r.bytes); align = r; }
      else { const r = await AI.speak(text, lang === 'ru' ? 'Charon' : 'Puck', lang === 'ru' ? 'Говори как живой ютубер-рассказчик: дружелюбно, энергично, с улыбкой, в хорошем темпе:' : 'Say like an engaging YouTube narrator: friendly, energetic, warm, at a good pace:', { signal, onWait: wait }); pcm = await A.decode(r.bytes); }
      step('voice', ++done, chunks.length, `${useEleven ? 'ElevenLabs' : 'Gemini'}: часть ${done} из ${chunks.length}`);
      return { idx, text, pcm, align };
    });
  };
  step('voice', 0, chunks.length, useEleven ? 'Озвучивает ElevenLabs' : 'Символы ElevenLabs кончились — озвучивает Gemini');
  let parts;
  try { parts = await speakAll(); } catch (e) {
    if (!useEleven || signal?.aborted) throw e;
    wait('ElevenLabs не смог озвучить всё видео: переозвучиваю целиком голосом Gemini (один голос на ролик)');
    useEleven = false; parts = await speakAll();
  }
  // lay the pieces end to end; every line gets its start/end (from ElevenLabs' letter times, or by length)
  const segs = [], words = [], gap = Math.round(A.RATE * 0.12);
  let total = 0;
  for (const p of parts) total += p.pcm.length + gap;
  const voiceTrack = new Float32Array(total);
  let at = 0;
  for (const p of parts) {
    voiceTrack.set(p.pcm, at);
    const base = at / A.RATE, dur = p.pcm.length / A.RATE;
    let off = 0;
    for (const j of p.idx) {
      const a = off, b = off + lines[j].text.length; off = b + 1;
      const tAt = (c) => (p.align?.starts?.length ? (p.align.starts[Math.min(c, p.align.starts.length - 1)] ?? 0) : (c / p.text.length) * dur);
      segs[j] = { t0: base + tAt(a), t1: base + tAt(b) };
      // words for the Shorts captions
      let wpos = a;
      for (const w of lines[j].text.split(/\s+/)) { const ws = p.text.indexOf(w, wpos); if (ws < 0) continue; words.push({ t0: base + tAt(ws), t1: base + tAt(ws + w.length), w: w.replace(/[«»"“”]/g, '') }); wpos = ws + w.length; }
    }
    at += p.pcm.length + gap;
  }
  for (let j = 0; j < segs.length; j++) { segs[j].t0 = j ? segs[j - 1].t1 : 0; if (j === segs.length - 1) segs[j].t1 = total / A.RATE + 0.6; }
  const duration = total / A.RATE + 0.6;

  /* 3. scenes: the hero once, then every scene (Gemini draws the place, directs the figures) */
  const L = LOOKS[style];
  step('scenes', 0, lines.length, 'Gemini придумывает героя');
  const hp = await heroParts(await AI.json(F.heroPrompt({ style, look: plan.hero_look || `Hero of: ${topic}`, palette: L.palette }), { fast: true, signal, onWait: wait }));
  let made = 0;
  const scenes = await pool(lines, 5, async (l, j) => {
    let sc;
    for (let a = 0; a < 2 && !sc; a++) {
      try { sc = (await makeScene({ text: l.text, idea: l.idea, seconds: segs[j].t1 - segs[j].t0, W, H, hero: plan.hero ? `The hero: ${plan.hero}.` : '', lessons, palette: L.palette, look: L.look }, { signal, onWait: wait, heroParts: hp })).scene; }
      catch (e) { if (signal?.aborted) throw e; wait(`Сцена ${j + 1}: ${e.message}, пробую ещё раз`); }
    }
    step('scenes', ++made, lines.length, `Сцена ${made} из ${lines.length}`);
    if (sc?.back) onScene?.(sc.back);
    return sc;
  });
  // a scene that failed twice borrows its neighbour
  for (let j = 0; j < scenes.length; j++) if (!scenes[j]) scenes[j] = scenes[j - 1] || scenes.find(Boolean);

  /* 4. montage */
  const kinds = ['cut', 'cut', 'cut', 'whip', 'cut', 'flash'];
  const timeline = lines.map((l, j) => ({ kind: 'scene', t0: segs[j].t0, t1: segs[j].t1, scene: scenes[j], trans: kinds[j % kinds.length] }));
  const sfx = timeline.filter((x) => x.trans === 'whip').map((x) => [x.t1 - 0.3, A.whoosh()]).concat(timeline.filter((x) => x.trans === 'flash').map((x) => [x.t1 - 0.2, A.boom()]));
  const audio = A.mix(voiceTrack, { energetic: short, sfx });
  const job = { W, H, fps, duration, timeline, words: short ? words : [], plates: [], audio, rate: A.RATE, env: A.envelope(voiceTrack, 50) };
  const script = lines.map((l) => l.text).join(' ');
  return { job, plan, lines, script, title: plan.title || topic, voice: useEleven ? 'ElevenLabs' : 'Gemini' };
}

// runs the montage worker; resolves with the MP4 bytes
export function montage(job, { signal, onProgress } = {}) {
  return new Promise((ok, bad) => {
    const w = new Worker(new URL('./render-worker.js', import.meta.url), { type: 'module' });
    const transfer = [job.audio.buffer, job.env.buffer];
    for (const it of job.timeline) for (const b of [it.scene?.back, it.scene?.front, ...(it.scene?.actors || []).flatMap((a) => [a.hat, a.item])]) if (b && !transfer.includes(b)) transfer.push(b);
    signal?.addEventListener('abort', () => { w.postMessage({ type: 'stop' }); setTimeout(() => w.terminate(), 500); bad(new Error('Остановлено')); }, { once: true });
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') onProgress?.(m);
      else if (m.type === 'done') { w.terminate(); ok(new Uint8Array(m.buffer)); }
      else if (m.type === 'error') { w.terminate(); bad(new Error(m.message)); }
    };
    w.onerror = (e) => { w.terminate(); bad(new Error('Монтаж упал: ' + (e.message || 'ошибка потока'))); };
    w.postMessage({ type: 'render', job }, transfer);
  });
}

export async function meta({ style, topic, title, script, lang, signal }) {
  try { return await AI.json(F.metaPrompt({ style, topic, title, script, lang }), { fast: true, signal }); } catch { return { title, description: '', tags: [] }; }
}
