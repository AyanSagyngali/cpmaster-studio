// The whole video, step by step: idea -> script (the style's master writer + an editor) -> voice with word timings ->
// pictures (3D world from a production bible, cards, or stick-figure scenes) -> sound -> montage on the phone.
// onStep(stage, done, total, text) feeds the progress screen; onScene(canvas) shows real stills as they are made.
import * as AI from './ai.js';
import * as EL from './eleven.js';
import * as A from './audio.js';
import * as F from './formats.js';
import { makeScene, heroParts, PALETTE } from './scene.js';
import { drawCardShot } from './cards.js';
import { castSetsPrompt, beatsPrompt, tidyCastSets, tidyBeats } from './bible.js';
import { blobs } from './store.js';

/* ---------------- the sound library: real effects made once by ElevenLabs, kept on the phone, reused ---------------- */
const normWord = (w) => String(w || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
async function shotSound(sfx, budget, { signal, wait }) {
  if (!sfx || sfx.kind === 'none') return null;
  const key = 'sfx:' + (sfx.prompt || sfx.kind).toLowerCase().replace(/\s+/g, ' ').trim();
  try {
    const b = await blobs.get(key);
    if (b) { budget.reused++; return await A.decode(b instanceof Uint8Array ? b : new Uint8Array(await b.arrayBuffer())); }
  } catch { /* not in the library */ }
  // the place is taken BEFORE the request (requests run in parallel), and given back if it fails
  if (sfx.prompt && budget.made < budget.max && EL.left() - EL.SFX_COST(2) * (budget.made + 1) >= budget.reserve) {
    budget.made++;
    try {
      const bytes = await EL.soundFx(sfx.prompt, 2, { signal });
      blobs.put(key, bytes).catch(() => {});
      return await A.decode(bytes);
    } catch (e) { budget.made--; if (signal?.aborted) throw e; wait(`Звук «${sfx.prompt}»: ${e.message} — беру синтез`); }
  }
  return A.SFX[sfx.kind]?.() || null;
}
// the moment a sound lands: on its word (a hair before it), else at the start of the shot
function soundTime(sfx, j, words, seg) {
  const target = normWord(sfx?.on);
  if (target) { const w = words.find((x) => x.j === j && normWord(x.w) === target) || words.find((x) => x.j === j && normWord(x.w).startsWith(target.slice(0, 5))); if (w) return Math.max(seg.t0, w.t0 - 0.03); }
  return seg.t0 + 0.05;
}

export const STAGES = [['script', 'Сценарий'], ['voice', 'Озвучка'], ['scenes', 'Кадры'], ['montage', 'Монтаж'], ['done', 'Готово']];
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
export async function pickStyle(topic, signal, wait) {
  try { const r = await AI.json(F.pickStylePrompt({ topic }), { fast: true, signal, onWait: wait }); if (F.STYLES[r.style] && r.style !== 'auto') return r.style; } catch (e) { if (signal?.aborted) throw e; }
  return /что если|what if/i.test(topic) ? 'razgon' : /топ|лучших|бесплатн|сравн|нейросет|приложен|tools?|apps?/i.test(topic) ? 'mascot' : /почему|как работает|why|how/i.test(topic) ? 'paper' : 'mult';
}

export async function make({ style, topic, kind, minutes = 10, lang = 'ru', voice, lessons = '', signal, onStep, onScene, onLog }) {
  const short = kind === 'short';
  const step = (s, d, t, text) => onStep?.(s, d, t, text);
  const wait = (m) => onLog?.(m);
  if (style === 'auto' || !F.STYLES[style]) { step('script', 0, 1, 'ИИ выбирает стиль'); style = await pickStyle(topic, signal, wait); wait(`Стиль: ${F.STYLES[style].name}`); }
  const pack = F.STYLES[style];
  // detail first: 3D and card styles render at 1080x1920, 30 fps; stick-figure scenes stay lighter for weak phones
  const crisp = pack.engine === 'world' || pack.engine === 'cards';
  const W = crisp ? (short ? 1080 : 1920) : (short ? 720 : 1280), H = crisp ? (short ? 1920 : 1080) : (short ? 1280 : 720), fps = crisp ? 30 : 24;

  /* 1. script: the style's master writer, then the editor */
  step('script', 0, 1, 'Сценарист пишет по мастер-промпту стиля');
  let lines, plan;
  const wps = F.WPS[lang] || 2.4;
  if (short) {
    const words = Math.round(46 * wps), n = pack.engine === 'world' ? 10 : 12;
    const r = await AI.json(F.linesPrompt({ style, topic, lang, lessons, words, n, short: true }), { signal, onWait: wait });
    step('script', 0, 1, 'Редактор усиливает сценарий');
    lines = await polish(r.lines || [], { style, topic, lang, lessons, short: true, signal, onWait: wait }); plan = { title: topic, hero: '', hero_look: '' };
  } else {
    plan = await AI.json(F.planPrompt({ style, topic, minutes, lang, lessons }), { signal, onWait: wait });
    const chapters = (Array.isArray(plan.chapters) ? plan.chapters : []).filter((c) => c && c.title);
    if (!chapters.length) throw new Error('Gemini не составил план глав');
    plan.chapters = chapters;
    const words = Math.round(minutes * 60 * wps), per = Math.round(words / chapters.length);
    let done = 0;
    const parts = await pool(chapters, 4, async (c, k) => {
      const r = await AI.json(F.linesPrompt({ style, topic, lang, lessons, words: per, n: Math.max(4, Math.round(per / 22)), plan, chapter: c, k }), { signal, onWait: wait });
      const out = await polish(r.lines || [], { style, topic, lang, lessons, short: false, signal, onWait: wait });
      step('script', ++done, chapters.length, `Глава ${done} из ${chapters.length}`);
      return out;
    });
    lines = parts.flat();
  }
  lines = lines.filter((l) => l && String(l.text || '').trim()).map((l) => ({ text: String(l.text).trim(), idea: String(l.idea || l.text) }));
  if (lines.length < 3) throw new Error('Gemini написал слишком короткий сценарий');
  step('script', 1, 1, `${lines.length} строк, ${lines.reduce((s, l) => s + l.text.split(/\s+/).length, 0)} слов`);

  /* 2. voice: ONE voice for the whole video. ElevenLabs if its characters are enough, else Gemini for everything */
  const chunks = []; let cur = [];
  for (const [i, l] of lines.entries()) { cur.push(i); if (cur.map((j) => lines[j].text).join(' ').length > 700) { chunks.push(cur); cur = []; } }
  if (cur.length) chunks.push(cur);
  const chars = lines.reduce((s, l) => s + l.text.length + 1, 0);
  let useEleven = EL.enough(chars);
  const V = pack.voice || F.STYLES.mult.voice;
  const speakAll = async () => {
    let done = 0;
    return pool(chunks, useEleven ? 2 : 3, async (idx) => {
      const text = idx.map((j) => lines[j].text).join(' ');
      let pcm, align = null;
      if (useEleven) { const r = await EL.speak(text, voice || V.el || EL.DEFAULT_VOICE, { signal, stability: V.stability, speed: V.speed, lang }); pcm = await A.decode(r.bytes); align = r; }
      else { const r = await AI.speak(text, V.gemini || 'Charon', V.style?.[lang] || V.style?.en || '', { signal, onWait: wait }); pcm = await A.decode(r.bytes); }
      step('voice', ++done, chunks.length, `${useEleven ? 'ElevenLabs' : 'Gemini'}: часть ${done} из ${chunks.length}`);
      return { idx, text, pcm, align };
    });
  };
  step('voice', 0, chunks.length, useEleven ? 'Озвучивает ElevenLabs' : 'Символов ElevenLabs мало — озвучивает Gemini');
  let parts;
  try { parts = await speakAll(); } catch (e) {
    if (!useEleven || signal?.aborted) throw e;
    wait(`ElevenLabs: ${e.message}. Переозвучиваю весь ролик голосом Gemini (один голос на ролик)`);
    useEleven = false; parts = await speakAll();
  }
  // lay the pieces end to end; every line and every word gets its start/end (ElevenLabs letter times, or by length)
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
      let wpos = a;
      for (const w of lines[j].text.split(/\s+/)) { const ws = p.text.indexOf(w, wpos); if (ws < 0) continue; words.push({ j, t0: base + tAt(ws), t1: base + tAt(ws + w.length), w: w.replace(/[«»"“”]/g, '') }); wpos = ws + w.length; }
    }
    at += p.pcm.length + gap;
  }
  for (let j = 0; j < segs.length; j++) { segs[j].t0 = j ? segs[j - 1].t1 : 0; if (j === segs.length - 1) segs[j].t1 = total / A.RATE + 0.6; }
  const duration = total / A.RATE + 0.6;
  const ctx = { style, pack, lang, lines, segs, words, duration, voiceTrack, short, W, H, fps, plan, topic, useEleven, signal, step, wait, onScene, lessons };

  if (pack.engine === 'world') return worldVideo(ctx);
  if (pack.engine === 'cards') return cardVideo({ ...ctx, theme: pack.theme });

  /* 3. stick-figure scenes: the hero once, then every scene (Gemini draws the place, directs the figures) */
  const L = LOOKS[style] || LOOKS.istorik;
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
  for (let j = 0; j < scenes.length; j++) if (!scenes[j]) scenes[j] = scenes[j - 1] || scenes.find(Boolean);
  if (!scenes.some(Boolean)) throw new Error('Gemini не смог нарисовать ни одной сцены');
  // What If keeps the look of its cover in every shot: dusk light, rim-lit silhouettes, dust in the beam
  if (style === 'razgon') for (const sc of scenes) if (sc) { sc.silhouette = true; if (!sc.light || sc.light.time === 'day') sc.light = { ...(sc.light || {}), time: 'dusk', x: sc.light?.x ?? W * 0.7, y: sc.light?.y ?? H * 0.3 }; sc.ambient = [...new Set([...(sc.ambient || []), 'motes'])].slice(0, 3); }
  const kinds = ['cut', 'cut', 'cut', 'whip', 'cut', 'flash'];
  const timeline = lines.map((l, j) => ({ kind: 'scene', t0: segs[j].t0, t1: segs[j].t1, scene: scenes[j], trans: kinds[j % kinds.length] }));
  const sfx = timeline.filter((x) => x.trans === 'whip').map((x) => [x.t1 - 0.3, A.whoosh()]).concat(timeline.filter((x) => x.trans === 'flash').map((x) => [x.t1 - 0.2, A.boom()]));
  const audio = A.mix(voiceTrack, { mood: pack.music, sfx });
  const job = { W, H, fps, duration, timeline, words, caption: 'shorts', plates: [], audio, rate: A.RATE, env: A.envelope(voiceTrack, 50) };
  return { job, plan, lines, style, script: lines.map((l) => l.text).join(' '), title: plan.title || topic, voice: useEleven ? 'ElevenLabs' : 'Gemini' };
}

/* ---------------- the 3D cartoon: a production bible, stills, sound on the beats ---------------- */
async function worldVideo({ style, pack, lang, lines, segs, words, duration, voiceTrack, W, H, fps, plan, topic, useEleven, signal, step, wait, onScene }) {
  // 1) the whole script once: the cast and the places
  step('scenes', 0, lines.length, 'Режиссёр читает весь сценарий: герои и места');
  let cs = null;
  for (const fast of [false, true]) {
    try { cs = await AI.json(castSetsPrompt({ topic, lines, lang }), { fast, signal, onWait: wait, think: 'low' }); break; }
    catch (e) { if (signal?.aborted) throw e; wait(`Режиссёр: ${e.message}${fast ? '' : ' — пробую быструю модель'}`); }
  }
  const bible = tidyCastSets(cs);
  const castIds = bible.cast.map((c) => c.id), setIds = bible.sets.map((x) => x.id);
  wait(`Герои: ${bible.cast.map((c) => c.name || c.id).join(', ')} · места: ${bible.sets.map((x) => x.name || x.id).join(', ')}`);
  // 2) then in order, three lines at a time, knowing the story so far and the next line: beats on exact words
  const perLine = [];
  let story = '', prevBeat = null;
  for (let i = 0; i < lines.length; i += 3) {
    const chunk = lines.slice(i, i + 3).map((l, k) => ({ i: i + k, text: l.text }));
    let raw = null;
    for (const fast of [false, true]) {
      try { raw = await AI.json(beatsPrompt({ topic, lines: chunk, cast: bible.cast, sets: bible.sets, story, next: lines[i + 3]?.text || '', total: lines.length }), { fast, signal, onWait: wait, think: 'low' }); break; }
      catch (e) { if (signal?.aborted) throw e; wait(`Кадры ${i + 1}–${i + chunk.length}: ${e.message}${fast ? '' : ' — пробую быструю модель'}`); }
    }
    const r = tidyBeats(raw, chunk, castIds, setIds, prevBeat);
    perLine.push(...r.beats); prevBeat = r.beats.at(-1)?.at(-1) || prevBeat;
    story = r.story || `${story} ${chunk.map((l) => l.text).join(' ')}`.slice(-400);
    step('scenes', Math.min(lines.length, i + 3), lines.length, `Кадры по порядку: ${Math.min(lines.length, i + 3)} из ${lines.length}`);
  }
  // every beat starts when its word is spoken (searched forward inside its line), so the picture never lags behind the voice
  const timeline = [];
  perLine.forEach((beats, j) => {
    const seg = segs[j], ws = words.filter((w) => w.j === j);
    let from = 0;
    const starts = beats.map((bt, k) => {
      if (!k || !bt.at) return seg.t0;
      const target = normWord(bt.at), idx = ws.findIndex((w, n) => n >= from && (normWord(w.w) === target || (target.length > 4 && normWord(w.w).startsWith(target.slice(0, 5)))));
      if (idx < 0) return null;
      from = idx + 1; return Math.max(seg.t0, ws[idx].t0 - 0.06);
    });
    const kept = beats.map((bt, k) => [bt, starts[k]]).filter(([, t0]) => t0 != null && t0 < seg.t1 - 0.4);
    kept.forEach(([bt, t0], k) => timeline.push({ kind: 'world', j, shot: { ...bt, line: j + 1 }, t0, t1: k < kept.length - 1 ? kept[k + 1][1] : seg.t1 }));
  });
  timeline.forEach((it, n) => { it.trans = n < timeline.length - 1 && timeline[n + 1].shot.set !== it.shot.set ? 'flash' : 'cut'; });
  // stills before the long render (the look check), shown on the progress screen
  try {
    const { World } = await import('./world3d.js');
    const sw = 270, sh = Math.round(270 * H / W), world = new World(sw, sh); world.load(structuredClone({ cast: bible.cast, sets: bible.sets }));
    for (const [j, it] of timeline.entries()) {
      if (j > 11) break;
      const c = document.createElement('canvas'); c.width = sw; c.height = sh;
      world.paint(c.getContext('2d'), structuredClone(it.shot), (it.t1 - it.t0) / 2, it.t1 - it.t0, it.t0 + 1, 0.2, null, sw, sh);
      onScene?.(c);
    }
    world.dispose?.();
  } catch (e) { wait(`Предпросмотр кадров не удался: ${e.message}`); }
  // sound on the beats: every effect lands on its word; real sounds from the library or ElevenLabs, synth as the last resort;
  // the voice keeps its reserve of credits (it is always more important than effects); the twist's sting stops the music
  step('scenes', lines.length, lines.length, 'Звукорежиссёр подбирает эффекты');
  const budget = { made: 0, reused: 0, max: lines.length > 20 ? 24 : 10, reserve: 2500 };
  const sfx = [];
  let stopAt = null;
  const sounds = await pool(timeline, 3, (it) => shotSound(it.shot.sfx, budget, { signal, wait }).then((pcm) => [soundTime(it.shot.sfx, it.j, words, it), pcm]));
  for (const [t, pcm] of sounds) if (pcm) sfx.push([t, pcm]);
  timeline.forEach((it) => { if (it.shot.sfx?.kind === 'sting' && it.t0 > duration * 0.5) stopAt = it.t0; if (it.trans === 'flash') sfx.push([it.t1 - 0.25, A.whoosh(0.5)]); });
  wait(`Звуки: ${budget.made} новых от ElevenLabs, ${budget.reused} из библиотеки`);
  const audio = A.mix(voiceTrack, { mood: pack.music, sfx, stopAt });
  const job = { W, H, fps, bitrate: 7_000_000, duration, timeline, words, caption: 'shorts', plates: [], audio, rate: A.RATE, env: A.envelope(voiceTrack, 50), world: { cast: bible.cast, sets: bible.sets } };
  return { job, plan, lines, style, bible, script: lines.map((l) => l.text).join(' '), title: plan.title || topic, voice: useEleven ? 'ElevenLabs' : 'Gemini' };
}

/* ---------------- card styles ---------------- */
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
  if (card.kind === 'scene') return null;                                 // fixed pictures are never used for a topic
  for (const key of ['points', 'lines', 'comments']) if (key in card) card[key] = asList(card[key]).map((v) => (typeof v === 'object' ? JSON.stringify(v) : v));
  if ('items' in card) card.items = asList(card.items).map((v) => (v && typeof v === 'object' ? v : { text: String(v) }));
  delete card.scene;
  return { card, mood: typeof x.mood === 'string' ? x.mood : 'happy', hot: asList(x.hot).map(String) };
}

// card styles: Gemini lays out the cards of many lines in one call, the code animates them
async function cardVideo({ style, pack, lang, lines, segs, words, duration, voiceTrack, W, H, fps, theme, plan, topic, useEleven, signal, step, wait, onScene }) {
  const B = 14, batches = [];
  for (let i = 0; i < lines.length; i += B) batches.push(lines.slice(i, i + B));
  step('scenes', 0, lines.length, 'Gemini раскладывает карточки');
  let done = 0;
  const parts = await pool(batches, 3, async (b) => {
    let cards = [];
    for (const fast of [true, false]) {
      try { cards = (await AI.json(F.cardsPrompt({ style, lines: b, lang }), { fast, signal, onWait: wait })).cards || []; break; }
      catch (e) { if (signal?.aborted) throw e; wait('Карточки: ' + e.message + (fast ? ' — пробую другую модель' : ' — собираю их из текста')); }
    }
    done += b.length; step('scenes', done, lines.length, `Карточки ${done} из ${lines.length}`);
    return b.map((l, i) => tidyCard(cards[i]));
  });
  const ofN = lines.filter((l) => ordinal(l.text)).length;
  const cards = parts.flat().map((c, j) => c || localCard(lines[j].text, j, lines.length, ofN));
  const timeline = lines.map((l, j) => ({ kind: 'card', theme, seed: j + 1, card: cards[j].card, mood: cards[j].mood, t0: segs[j].t0, t1: segs[j].t1, trans: j % 4 === 3 ? 'whip' : 'cut' }));
  for (const it of timeline.slice(0, 8)) {
    const c = document.createElement('canvas'); c.width = Math.round(W / 4); c.height = Math.round(H / 4);
    const x = c.getContext('2d'); x.scale(0.25, 0.25); drawCardShot(x, it, 1.6, it.t1 - it.t0, W, H, 0.3, it.t0 + 1.6); onScene?.(c);
  }
  const norm = (w) => String(w).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const capt = pack.captions === 'paper' ? words.map((w) => ({ ...w, hot: (cards[w.j]?.hot || []).some((h) => String(h).split(/\s+/).map(norm).includes(norm(w.w))) })) : [];
  const sfx = timeline.map((x) => [x.t0 + 0.03, A.pop()]).concat(timeline.filter((x) => x.trans === 'whip').map((x) => [x.t1 - 0.3, A.whoosh()]));
  const audio = A.mix(voiceTrack, { mood: pack.music, sfx });
  const job = { W, H, fps, bitrate: 6_000_000, duration, timeline, words: capt, caption: theme, plates: [], audio, rate: A.RATE, env: A.envelope(voiceTrack, 50) };
  return { job, plan, lines, style, script: lines.map((l) => l.text).join(' '), title: plan.title || topic, voice: useEleven ? 'ElevenLabs' : 'Gemini' };
}

// runs the montage worker; resolves with the MP4 bytes
export function montage(job, { signal, onProgress, onCover } = {}) {
  return new Promise((ok, bad) => {
    const w = new Worker(new URL('./render-worker.js', import.meta.url), { type: 'module' });
    // nothing is transferred: the page keeps its own scenes and sound, so an interrupted montage can simply run again
    signal?.addEventListener('abort', () => { w.postMessage({ type: 'stop' }); setTimeout(() => w.terminate(), 500); bad(new Error('Остановлено')); }, { once: true });
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') onProgress?.(m);
      else if (m.type === 'cover') onCover?.(m.bmp);
      else if (m.type === 'done') { w.terminate(); ok(new Uint8Array(m.buffer)); }
      else if (m.type === 'error') { w.terminate(); bad(new Error(m.message)); }
    };
    w.onerror = (e) => { w.terminate(); bad(new Error('Монтаж упал: ' + (e.message || 'ошибка потока'))); };
    w.postMessage({ type: 'render', job });
  });
}

export async function meta({ style, topic, title, script, lang, signal }) {
  try { return await AI.json(F.metaPrompt({ style, topic, title, script, lang }), { fast: true, signal }); } catch { return { title, description: '', tags: [] }; }
}
