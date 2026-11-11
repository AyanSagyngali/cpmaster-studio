// The whole video, step by step like AE.LAH: script -> voice -> scenes -> montage. One video at a time.
// onStep(stage, done, total, text) feeds the progress screen; onScene(bitmap) shows real frames as they are made.
import * as AI from './ai.js';
import * as EL from './eleven.js';
import * as A from './audio.js';
import * as F from './formats.js';
import { makeScene, heroParts, PALETTE } from './scene.js';
import { drawCardShot } from './cards.js';

export const STAGES = [['script', 'Сценарий'], ['voice', 'Озвучка'], ['scenes', 'Сцены'], ['montage', 'Монтаж'], ['done', 'Готово']];
const LOOKS = {
  istorik: { palette: PALETTE, look: '' },
  razgon: { palette: 'deep navy #1d2440, dusk purple #3b2f55, warm amber #f2a541, soft gold #f6c86a, coral #e0664f, teal shadow #2f5d62, fog #c9c3d6, and black #0d0d12', look: 'Cinematic low-key light: ONE strong light source (a window, a lamp, a sunset), deep purple and navy shadows, warm amber highlights, soft glow shapes.' },
};
// the editor's pass never breaks a video: a bad answer keeps the draft
async function polish(lines, o) {
  try {
    const r = await AI.json(F.polishPrompt({ ...o, lines }), { signal: o.signal, onWait: o.onWait });
    const out = (r.lines || []).filter((l) => l && String(l.text || '').trim());
    return out.length === lines.length ? out : lines;
  } catch (e) { if (o.signal?.aborted) throw e; return lines; }
}
const pool = async (items, n, fn) => {                                // n requests at once, keeps order
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
};

// «Авто»: Gemini picks the style from the topic (a quick guess from words if it can not answer)
async function pickStyle(topic, signal, wait) {
  try { const r = await AI.json(F.pickStylePrompt({ topic }), { fast: true, signal, onWait: wait }); if (F.STYLES[r.style] && r.style !== 'auto') return r.style; } catch (e) { if (signal?.aborted) throw e; }
  return /сказк|ночь|дет|малыш|кит|море|мор[еяю]|рыб|bedtime|fairy|kids|story/i.test(topic) ? 'film' : /истори|войн|импери|хан|царь|век\b|history/i.test(topic) ? 'istorik' : /что если|what if/i.test(topic) ? 'razgon' : 'paper';
}

export async function make({ style, topic, kind, minutes = 10, lang = 'ru', voice, lessons = '', signal, onStep, onScene, onLog }) {
  const short = kind === 'short';
  const step = (s, d, t, text) => onStep?.(s, d, t, text);
  const wait = (m) => onLog?.(m);
  if (style === 'auto') { step('script', 0, 1, 'ИИ выбирает стиль'); style = await pickStyle(topic, signal, wait); wait(`Стиль: ${F.STYLES[style].name}`); }
  // card and scene styles render like the reels in the video: 1080x1920, 30 fps; stick figures stay lighter for weak phones
  const crisp = F.STYLES[style].engine === 'cards';
  const W = crisp ? (short ? 1080 : 1920) : (short ? 720 : 1280), H = crisp ? (short ? 1920 : 1080) : (short ? 1280 : 720), fps = crisp ? 30 : 24;

  /* 1. script */
  step('script', 0, 1, 'Gemini пишет сценарий');
  let lines, plan;
  if (short) {
    const r = await AI.json(F.linesPrompt({ style, topic, lang, lessons, words: lang === 'ru' ? 120 : 140, n: 12, short: true }), { signal, onWait: wait });
    step('script', 0, 1, 'Редактор усиливает сценарий');
    lines = await polish(r.lines || [], { style, topic, lang, lessons, short: true, signal, onWait: wait }); plan = { title: topic, hero: '', hero_look: '' };
  } else {
    plan = await AI.json(F.planPrompt({ style, topic, minutes, lang, lessons }), { signal, onWait: wait });
    const words = Math.round(minutes * (lang === 'ru' ? 130 : 150)), per = Math.round(words / plan.chapters.length);
    let done = 0;
    const parts = await pool(plan.chapters, 4, async (c, k) => {
      const r = await AI.json(F.linesPrompt({ style, topic, lang, lessons, words: per, n: Math.max(4, Math.round(per / 20)), plan, chapter: c, k }), { signal, onWait: wait });
      const out = await polish(r.lines || [], { style, topic, lang, lessons, short: false, signal, onWait: wait });
      step('script', ++done, plan.chapters.length, `Глава ${done} из ${plan.chapters.length}`);
      return out;
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
      if (useEleven) { const r = await EL.speak(text, voice || EL.DEFAULT_VOICE, { signal, stability: 0.42, speed: style === 'film' ? 0.95 : short ? 1.08 : 1.02 }); pcm = await A.decode(r.bytes); align = r; }
      else { const r = await AI.speak(text, lang === 'ru' ? 'Charon' : 'Puck', style === 'film' ? (lang === 'ru' ? 'Рассказывай как тёплый сказочник: спокойно, мягко, с паузами и улыбкой:' : 'Tell it like a warm bedtime storyteller: calm, soft, with pauses and a smile:') : lang === 'ru' ? 'Говори как живой ютубер-рассказчик: дружелюбно, энергично, с улыбкой, в хорошем темпе:' : 'Say like an engaging YouTube narrator: friendly, energetic, warm, at a good pace:', { signal, onWait: wait }); pcm = await A.decode(r.bytes); }
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
      for (const w of lines[j].text.split(/\s+/)) { const ws = p.text.indexOf(w, wpos); if (ws < 0) continue; words.push({ j, t0: base + tAt(ws), t1: base + tAt(ws + w.length), w: w.replace(/[«»"“”]/g, '') }); wpos = ws + w.length; }
    }
    at += p.pcm.length + gap;
  }
  for (let j = 0; j < segs.length; j++) { segs[j].t0 = j ? segs[j - 1].t1 : 0; if (j === segs.length - 1) segs[j].t1 = total / A.RATE + 0.6; }
  const duration = total / A.RATE + 0.6;

  const theme = F.STYLES[style].theme;
  if (F.STYLES[style].engine === 'cards') return cardVideo({ style, lang, lines, segs, words, duration, voiceTrack, short, W, H, fps, theme, plan, topic, useEleven, signal, step, wait, onScene });

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
  return { job, plan, lines, script, style, title: plan.title || topic, voice: useEleven ? 'ElevenLabs' : 'Gemini' };
}

// when Gemini can not lay out the cards, they are built from the line itself
const ORD = { первый: 1, первая: 1, первое: 1, второй: 2, вторая: 2, второе: 2, третий: 3, третья: 3, третье: 3, четвертый: 4, четвёртый: 4, четвертая: 4, четвёртая: 4, пятый: 5, пятая: 5, first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
const ordinal = (t) => ORD[String(t).toLowerCase().match(/^[\p{L}]+/u)?.[0]] || 0;
const ICONS = ['💡', '🔥', '⚡', '🎯', '🤔', '🚀', '👀', '✨'];
function localCard(text, j, total, of) {
  const words = text.replace(/[«»"]/g, '').split(/\s+/), head = words.slice(0, 5).join(' ').replace(/[,.:;—-]+$/, '');
  const n = ordinal(text);
  if (n) { const name = text.split(/[—–-]/)[1]?.split(/[,.]/)[0]?.trim() || words.slice(1, 3).join(' '); return { card: { kind: 'step', n, of: Math.max(of, n), icon: '⭐', title: name }, mood: 'happy', hot: [words[0]] }; }
  if (j === total - 1) return { card: { kind: 'title', icon: '💬', text: head, sub: 'Пиши в комментах' }, mood: 'wink', hot: [] };
  if (/^(минус|но|правда|однако|косяк|зато|but|however|the catch)/i.test(text)) return { card: { kind: 'stamp', text: words.slice(0, 7).join(' '), stamp: /^зато/i.test(text) ? 'ПЛЮС' : 'МИНУС' }, mood: 'smug', hot: [] };
  return { card: { kind: 'title', icon: ICONS[j % ICONS.length], text: head }, mood: ['happy', 'surprised', 'think', 'laugh'][j % 4], hot: [] };
}

// Gemini sometimes answers a list with a string or an object: every card is brought to the shape the drawing expects
const asList = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
function tidyCard(x) {
  const c = x?.card;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const card = { ...c, kind: String(c.kind || 'title') };
  for (const key of ['points', 'lines', 'comments']) if (key in card) card[key] = asList(card[key]).map((v) => (typeof v === 'object' ? JSON.stringify(v) : v));
  if ('items' in card) card.items = asList(card.items).map((v) => (v && typeof v === 'object' ? v : { text: String(v) }));
  return { card, mood: typeof x.mood === 'string' ? x.mood : 'happy', hot: asList(x.hot).map(String) };
}

// card styles: Gemini lays out the cards of many lines in one call, the code animates them
async function cardVideo({ style, lang, lines, segs, words, duration, voiceTrack, short, W, H, fps, theme, plan, topic, useEleven, signal, step, wait, onScene }) {
  const B = 14, batches = [];
  for (let i = 0; i < lines.length; i += B) batches.push(lines.slice(i, i + B));
  step('scenes', 0, lines.length, 'Gemini раскладывает карточки');
  let done = 0;
  const parts = await pool(batches, 3, async (b) => {
    let cards = [];
    for (const fast of [true, false]) {                                    // the fast model first, the main one if it fails
      try { cards = (await AI.json(F.cardsPrompt({ style, lines: b, lang }), { fast, signal, onWait: wait })).cards || []; break; }
      catch (e) { if (signal?.aborted) throw e; wait('Карточки: ' + e.message + (fast ? ' — пробую другую модель' : ' — собираю их из текста')); }
    }
    done += b.length; step('scenes', done, lines.length, `Карточки ${done} из ${lines.length}`);
    return b.map((l, i) => tidyCard(cards[i]));
  });
  const ofN = lines.filter((l) => ordinal(l.text)).length;
  const cards = parts.flat().map((c, j) => c || localCard(lines[j].text, j, lines.length, ofN));
  const film = theme === 'film';
  // a film keeps one continuous shot while the scene stays the same, and dissolves softly when it changes
  const same = (j) => film && j > 0 && cards[j].card?.scene === cards[j - 1].card?.scene;
  const timeline = lines.map((l, j) => ({ kind: 'card', theme, seed: j + 1, card: cards[j].card, mood: cards[j].mood, t0: segs[j].t0, t1: segs[j].t1, trans: film ? 'fade' : j % 4 === 3 ? 'whip' : 'cut' }));
  for (let j = timeline.length - 1; j > 0; j--) if (same(j)) { const a = timeline[j - 1], b = timeline[j]; b.seed = a.seed; b.cont = true; a.trans = 'cut'; }
  for (const it of timeline.slice(0, 6)) {                                 // real frames for the progress screen
    const c = document.createElement('canvas'); c.width = Math.round(W / 4); c.height = Math.round(H / 4);
    const x = c.getContext('2d'); x.scale(0.25, 0.25); drawCardShot(x, it, 1.6, it.t1 - it.t0, W, H, 0.3, it.t0 + 1.6); onScene?.(c);
  }
  // the paper style shows the words; the key words of each line get the accent pill
  const norm = (w) => String(w).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const capt = theme === 'paper' || theme === 'film' ? words.map((w) => ({ ...w, hot: (cards[w.j]?.hot || []).some((h) => String(h).split(/\s+/).map(norm).includes(norm(w.w))) })) : [];
  // sound on the beats: a pop when a card lands, a whoosh on a whip, a soft bell when a fairy-tale scene changes
  const sfx = film
    ? timeline.filter((x, j) => j && !x.cont).map((x) => [x.t0, A.chime()])
    : timeline.map((x) => [x.t0 + 0.03, A.pop()]).concat(timeline.filter((x) => x.trans === 'whip').map((x) => [x.t1 - 0.3, A.whoosh()]));
  const audio = A.mix(voiceTrack, { energetic: !film, sfx });
  const job = { W, H, fps, bitrate: W * H >= 2e6 ? 6_000_000 : undefined, duration, timeline, words: capt, caption: theme, plates: [], audio, rate: A.RATE, env: A.envelope(voiceTrack, 50) };
  return { job, plan, lines, style, script: lines.map((l) => l.text).join(' '), title: plan.title || topic, voice: useEleven ? 'ElevenLabs' : 'Gemini' };
}

// runs the montage worker; resolves with the MP4 bytes
export function montage(job, { signal, onProgress } = {}) {
  return new Promise((ok, bad) => {
    const w = new Worker(new URL('./render-worker.js', import.meta.url), { type: 'module' });
    // nothing is transferred: the page keeps its own scenes and sound, so an interrupted montage can simply run again
    const transfer = [];
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
