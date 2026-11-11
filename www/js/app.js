// CPMaster Studio: the screens. Keys -> style + topic -> the live process -> the video (download, share, rate) -> history, chat, settings.
import * as K from './keys.js';
import * as AI from './ai.js';
import * as EL from './eleven.js';
import { kv, videos, uid } from './store.js';
import { make, montage, meta, STAGES } from './pipeline.js';
import { STYLES, STYLE_ORDER, LANG_NAMES, ideasPrompt, tipsPrompt } from './formats.js';
import { cover } from './covers.js';
import { knowledgeHtml, generalHtml } from './knowledge.js';
import * as SV from './save.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const view = $('#view');
let toastT;
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.className = 'on'; clearTimeout(toastT); toastT = setTimeout(() => (t.className = ''), 2600); };

const S = { tab: 'home', job: null, settings: { style: 'mult', kind: 'short', minutes: 10, lang: 'ru', voices: {} }, topic: '' };
const anims = new Set();                                                // running preview animations, stopped on every screen change

function show(html, { title = 'CPMaster Studio', back = null, tabs = true } = {}) {
  anims.forEach((stop) => stop()); anims.clear();
  view.className = 'out';
  // each screen resolves its own render: a double tap must not hand the buttons to a page that is replaced right after
  let done; const shown = new Promise((ok) => (done = ok));
  clearTimeout(show.pending);                                            // the newer screen wins; the older one never renders
  show.pending = setTimeout(() => {
    view.innerHTML = html; view.className = ''; void view.offsetWidth; view.style.animation = 'none'; void view.offsetWidth; view.style.animation = '';
    $('#title').textContent = title;
    $('#back').hidden = !back; $('#back').onclick = back;
    $('#tabs').hidden = !tabs;
    document.querySelectorAll('.tabs button').forEach((b) => (b.dataset.tab === S.tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    scrollTo(0, 0);
    view.dispatchEvent(new Event('shown'));
    done();
  }, 130);
  return shown;
}
const lessons = async () => (await kv.get('lessons', [])).map((l, i) => `${i + 1}. ${l}`).join('\n');

/* ---------------- keys: honest limits, nothing invented ---------------- */
const fmtN = (n) => Math.round(n).toLocaleString('ru');
const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
// what one video really costs in ElevenLabs characters (from this phone's own videos; an estimate until there are some)
async function avgCost(kind) {
  const st = await kv.get('stats', []);
  const xs = st.filter((x) => x.kind === kind && x.eleven > 0).slice(-10).map((x) => x.eleven);
  return xs.length ? { v: xs.reduce((a, b) => a + b, 0) / xs.length, real: true } : { v: kind === 'short' ? 1300 : 9000, real: false };
}
async function keysScreen(first) {
  await K.load();
  const el = K.of('eleven'), gm = K.of('gemini'), cost = await avgCost('short'), now = Date.now(), reset = K.geminiReset();
  const resetAt = new Date(reset).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  const elLeft = el.filter((k) => k.ok !== false).reduce((s, k) => s + (k.left || 0), 0), shorts = Math.floor(elLeft / cost.v);
  const gmOk = gm.filter((k) => k.ok && !(k.cool > now)).length, gmCool = gm.filter((k) => k.ok && k.cool > now).length;
  const elRows = el.map((k) => {
    const total = k.total || Math.max(k.left || 0, 10000), left = k.left ?? 0, frac = Math.max(0, Math.min(1, left / total)), low = frac < 0.15, n = Math.floor(left / cost.v);
    const state = k.ok === false ? ['bad', k.note || 'не работает'] : k.ok == null ? ['', 'проверяю'] : low ? ['low', 'мало'] : ['ok', 'работает'];
    return `<div class="key2"><div class="krow"><b>ElevenLabs</b><code>${esc(K.tail(k.key))}</code><span class="pill ${state[0]}">${esc(state[1])}</span><button data-del="${esc(k.key)}" aria-label="Удалить ключ">✕</button></div>
      <div class="meter ${low ? 'low' : ''}"><i style="--w:${(frac * 100).toFixed(1)}%"></i></div>
      <div class="kinfo">${fmtN(left)} из ${fmtN(total)} символов · ≈ ${n} ${plural(n, 'шортс', 'шортса', 'шортсов')}${k.reset ? ` · обновится ${new Date(k.reset).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}` : ''}</div></div>`;
  }).join('');
  const gmRows = gm.map((k) => {
    const cool = k.cool > now, day = cool && k.coolKind === 'day';
    const state = k.ok === false ? ['bad', k.note || 'не работает'] : k.ok == null ? ['', 'проверяю'] : day ? ['low', 'дневной лимит'] : cool ? ['low', 'минутный лимит'] : ['ok', 'работает'];
    const when = day ? ` · снова работает в ${resetAt}` : cool ? ` · освободится через <span data-cd="${k.cool}"></span>` : '';
    return `<div class="key2"><div class="krow"><b>Gemini</b><code>${esc(K.tail(k.key))}</code><span class="pill ${state[0]}">${esc(state[1])}</span><button data-del="${esc(k.key)}" aria-label="Удалить ключ">✕</button></div>
      <div class="kinfo">сегодня ${K.usedToday(k)} ${plural(K.usedToday(k), 'запрос', 'запроса', 'запросов')}${when}</div></div>`;
  }).join('');
  await show(`${first ? '<p class="note" style="margin:8px 4px 14px;font-size:15px;color:var(--t2)">Чтобы начать, вставь ключи Google AI Studio (Gemini) и ElevenLabs. Можно сразу много, в любом виде — программа сама найдёт и проверит каждый.</p>' : ''}
    <div class="sum"><div><b>${fmtN(elLeft)}</b><span>символов ElevenLabs</span><small>≈ ${shorts} ${plural(shorts, 'шортс', 'шортса', 'шортсов')} ${cost.real ? 'по твоим роликам' : '(оценка)'}</small></div><div><b>${gmOk}</b><span>ключей Gemini работают</span><small>${gmCool ? `${gmCool} на лимите` : 'все свободны'}</small></div></div>
    <textarea id="paste" rows="4" placeholder="Вставь сюда ключи: AIza… / AQ.… для Gemini, sk_… для ElevenLabs"></textarea>
    <div style="margin-top:10px" class="row"><button class="btn" id="addKeys">Добавить и проверить</button><button class="btn ghost" id="recheck">Обновить лимиты</button></div>
    ${el.length ? `<h2>ElevenLabs (${el.length})</h2><div class="card">${elRows}</div>` : ''}
    ${gm.length ? `<h2>Gemini (${gm.length})</h2><div class="card">${gmRows}</div>` : ''}
    ${!el.length && !gm.length ? '<div class="card"><p class="note" style="margin:0">Пока нет ключей.</p></div>' : ''}
    <p class="note">Остаток символов ElevenLabs показывает сам ElevenLabs. Остаток Gemini Google не показывает, поэтому приложение считает запросы само; бесплатные лимиты Gemini обновляются каждый день в ${resetAt}. Ключи хранятся только на этом телефоне.</p>
    ${!first ? '' : `<div style="margin-top:16px"><button class="btn ghost" id="go" ${K.ready() ? '' : 'disabled'}>Дальше</button></div>`}`,
  { title: 'Ключи', back: first ? null : () => tab('settings'), tabs: !first });
  const tick = () => view.querySelectorAll('[data-cd]').forEach((x) => { const s2 = Math.max(0, Math.ceil((+x.dataset.cd - Date.now()) / 1000)); x.textContent = s2 > 90 ? `${Math.ceil(s2 / 60)} мин` : `${s2} с`; });
  tick(); const iv = setInterval(tick, 1000); anims.add(() => clearInterval(iv));
  $('#addKeys').onclick = async () => {
    const r = await K.add($('#paste').value);
    if (!r.found) return toast('Ключей не нашёл. Скопируй их целиком.');
    toast(`Найдено ${r.found}, новых ${r.added}. Проверяю…`);
    await K.checkAll(); keysScreen(first);
  };
  $('#recheck').onclick = async () => { toast('Проверяю все ключи…'); await K.checkAll(); keysScreen(first); };
  view.querySelectorAll('[data-del]').forEach((b2) => (b2.onclick = async () => { await K.remove(b2.dataset.del); keysScreen(first); }));
  if (first) $('#go').onclick = () => tab('home');
}

/* ---------------- home: the gallery of styles ---------------- */
async function home() {
  if (S.job) return progressScreen();
  const el = EL.left(), cost = await avgCost('short');
  await show(`<div class="gallery">${STYLE_ORDER.map((id) => `<button class="scard" data-style="${id}"><canvas width="360" height="450"></canvas><div class="sname"><b>${esc(STYLES[id].name)}</b><small>${esc(STYLES[id].tagline)}</small></div></button>`).join('')}</div>
    <button class="item" id="limits" style="margin-top:14px"><div><b>Лимиты ключей</b><span>ElevenLabs ${fmtN(el)} символов · ≈ ${Math.floor(el / cost.v)} шортсов · Gemini ${K.of('gemini').filter((k) => k.ok).length} ключей</span></div></button>`, { title: 'Выбери стиль' });
  view.querySelectorAll('.scard').forEach((b2) => { anims.add(cover(b2.querySelector('canvas'), b2.dataset.style)); b2.onclick = () => styleScreen(b2.dataset.style); });
  $('#limits').onclick = () => keysScreen(false);
}

/* ---------------- one style: topic, ideas, AI advice, format, language, voice ---------------- */
const ALL_VOICES = () => [...EL.VOICES, { id: 'j9K9HnBcmgA6xNWqjlX0', name: 'Emin — эпичный рассказчик' }];
const EXAMPLES = { mult: 'Что если я выиграю чемпионат мира по футболу', razgon: 'Что если бы ты не спал месяц?', istorik: 'Ты — караванщик на Шёлковом пути, 1350 год', paper: 'Почему мы откладываем дела и как это обойти', mascot: '4 бесплатные нейросети вместо платной подписки', auto: 'Любая тема — ИИ сам выберет стиль' };
async function styleScreen(id) {
  const st = S.settings; st.style = id; kv.set('settings', st);
  const pack = STYLES[id], voices = ALL_VOICES(), mine = st.voices?.[id] || '';
  await show(`<div class="shero"><canvas width="720" height="560"></canvas><div class="sname"><b>${esc(pack.name)}</b><small>${esc(pack.about)}</small></div></div>
    <h2>Тема</h2><textarea id="topic" rows="3" placeholder="Например: ${esc(EXAMPLES[id] || '')}">${esc(S.topic)}</textarea>
    <div class="row" style="margin-top:8px"><button class="btn ghost" id="ideas">🎲 Идеи</button><button class="btn ghost" id="tips">💡 Совет ИИ</button></div>
    <div id="out"></div>
    <h2>Формат</h2><div class="seg" id="kind"><button data-v="short" aria-pressed="${st.kind === 'short'}">Шортс · до 1 мин</button><button data-v="long" aria-pressed="${st.kind === 'long'}">Лонг</button></div>
    <div id="mins" style="margin-top:8px" ${st.kind === 'long' ? '' : 'hidden'}><div class="seg">${[5, 10, 15].map((m) => `<button data-m="${m}" aria-pressed="${st.minutes === m}">${m} мин</button>`).join('')}</div></div>
    <h2>Язык</h2><div class="seg" id="lang">${Object.entries(LANG_NAMES).map(([k2, n]) => `<button data-l="${k2}" aria-pressed="${st.lang === k2}">${n}</button>`).join('')}</div>
    <h2>Голос</h2><select id="voice"><option value="">Голос стиля${pack.voice ? ` (${esc(voices.find((v) => v.id === pack.voice.el)?.name.split(' —')[0] || '')})` : ''}</option>${voices.map((v) => `<option value="${v.id}" ${mine === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
    <details class="kb"><summary>Что умеет стиль</summary>${knowledgeHtml(id)}</details>
    <div style="margin-top:18px"><button class="btn" id="start">Запустить</button></div>
    <p class="note n" id="cost"></p>`, { title: pack.name, back: home });
  anims.add(cover(view.querySelector('.shero canvas'), id));
  const seg = (sel, attr, set) => view.querySelectorAll(`${sel} [data-${attr}]`).forEach((b2) => (b2.onclick = () => { set(b2.dataset[attr]); kv.set('settings', st); b2.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b2)); showCost(); }));
  const showCost = async () => { const c = await avgCost(st.kind), el = EL.left(); $('#cost').textContent = `Один ${st.kind === 'short' ? 'шортс' : 'лонг'} ≈ ${fmtN(c.v)} символов ElevenLabs${c.real ? '' : ' (оценка)'} · сейчас есть ${fmtN(el)}. ${el < c.v ? 'Не хватит — озвучит Gemini.' : ''}`; };
  seg('#kind', 'v', (v) => { st.kind = v; $('#mins').hidden = v !== 'long'; });
  seg('#mins', 'm', (v) => (st.minutes = +v));
  seg('#lang', 'l', (v) => (st.lang = v));
  showCost();
  $('#voice').onchange = (e) => { st.voices = { ...(st.voices || {}), [id]: e.target.value }; kv.set('settings', st); };
  $('#topic').oninput = (e) => (S.topic = e.target.value);
  const busy = (b2, on, label) => { b2.disabled = on; b2.textContent = on ? 'Думаю…' : label; };
  $('#ideas').onclick = async (e) => {
    const b2 = e.currentTarget; busy(b2, true);
    try {
      const r = await AI.json(ideasPrompt({ style: id === 'auto' ? 'mult' : id, lang: st.lang, hint: S.topic.trim(), lessons: await lessons() }), { fast: true });
      const ideas = (Array.isArray(r.ideas) ? r.ideas : []).filter((x) => x && x.title).slice(0, 8);
      $('#out').innerHTML = ideas.length ? `<div class="ideas">${ideas.map((x, i) => `<button class="idea" data-i="${i}"><b>${esc(x.title)}</b>${x.hook ? `<span>«${esc(x.hook)}»</span>` : ''}${x.twist ? `<small>Поворот: ${esc(x.twist)}</small>` : ''}${x.truth ? `<em>${esc(x.truth)}</em>` : ''}</button>`).join('')}</div>` : '<p class="note">Gemini не прислал идей, попробуй ещё раз.</p>';
      view.querySelectorAll('.idea').forEach((x) => (x.onclick = () => { S.topic = ideas[+x.dataset.i].title; $('#topic').value = S.topic; toast('Тема выбрана'); view.querySelectorAll('.idea').forEach((y) => y.setAttribute('aria-pressed', y === x)); }));
    } catch (err) { toast('Gemini: ' + err.message); }
    busy(b2, false, '🎲 Идеи');
  };
  $('#tips').onclick = async (e) => {
    const b2 = e.currentTarget; busy(b2, true);
    try {
      const r = await AI.json(tipsPrompt({ style: id, topic: S.topic.trim(), lang: st.lang, kind: st.kind, voices }), { fast: true });
      const v = voices.find((x) => x.id === r.voice);
      $('#out').innerHTML = `<div class="card tips">${r.topic ? `<div class="tip-topic">${esc(r.topic)}</div>` : ''}<div class="kinfo">${r.kind === 'long' ? `Лонг ${r.minutes || 10} мин` : 'Шортс'}${v ? ` · ${esc(v.name.split(' —')[0])}` : ''}</div>${r.why ? `<p class="note" style="margin:6px 0">${esc(r.why)}</p>` : ''}<ul>${(Array.isArray(r.tips) ? r.tips : []).slice(0, 3).map((t2) => `<li>${esc(t2)}</li>`).join('')}</ul><button class="btn small" id="apply">Применить совет</button></div>`;
      $('#apply').onclick = () => { if (r.topic) S.topic = String(r.topic); if (r.kind === 'short' || r.kind === 'long') st.kind = r.kind; if ([5, 10, 15].includes(+r.minutes)) st.minutes = +r.minutes; if (v) st.voices = { ...(st.voices || {}), [id]: v.id }; kv.set('settings', st); toast('Совет применён'); styleScreen(id); };
    } catch (err) { toast('Gemini: ' + err.message); }
    busy(b2, false, '💡 Совет ИИ');
  };
  $('#start').onclick = () => start();
}

/* ---------------- the knowledge base ---------------- */
async function knowledgeScreen() {
  await show(`${generalHtml()}${STYLE_ORDER.map((id) => `<details class="kb"><summary>${esc(STYLES[id].name)}</summary>${knowledgeHtml(id)}</details>`).join('')}`, { title: 'База знаний', back: () => tab('settings') });
}

/* ---------------- the job ---------------- */
async function start() {
  const topic = S.topic.trim();
  if (!topic) return toast('Напиши тему видео');
  if (!K.of('gemini').some((k) => k.ok)) return toast('Нужен хотя бы один рабочий ключ Gemini');
  const ctl = new AbortController(), st = { ...S.settings };
  const job = S.job = { ctl, topic, st, stage: 'script', counts: {}, text: '', thumbs: [], log: [], started: Date.now(), preview: null, frame: 0, total: 0, fps: 0 };
  let lock; try { lock = await navigator.wakeLock?.request('screen'); } catch { /* no wake lock */ }
  const elBefore = EL.left();
  progressScreen();
  const upd = () => { if (S.tab === 'home' && S.job === job) paintProgress(); };
  try {
    const r = await make({ style: st.style, topic, kind: st.kind, minutes: st.minutes, lang: st.lang, voice: st.voices?.[st.style] || '', lessons: await lessons(), signal: ctl.signal,
      onStep: (s, d, t, x) => { job.stage = s; job.counts[s] = [d, t]; job.text = x; upd(); },
      // a small COPY: the scene bitmaps are handed over to the montage thread later and stop existing here
      onScene: (b) => { const c = document.createElement('canvas'); c.height = 184; c.width = Math.round(184 * b.width / b.height); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); job.thumbs.push(c); upd(); },
      onLog: (m) => { job.log.push(m); upd(); } });
    job.stage = 'montage'; job.text = 'Телефон монтирует видео'; upd();
    // Android takes the video encoder away from an app that is not on screen: an interrupted montage waits for the user to come back and runs again
    let mp4;
    for (let attempt = 1; ; attempt++) {
      coverFrames.length = 0;
      try { mp4 = await montage(r.job, { signal: ctl.signal, onCover: (b) => coverFrames.push(b), onProgress: (p) => { job.frame = p.frame; job.total = p.total; job.fps = p.fps; job.eta = p.eta; if (p.preview) job.preview = p.preview; upd(); } }); break; }
      catch (e) {
        if (ctl.signal.aborted || attempt >= 4) throw e;
        job.log.push(`Монтаж прервался (${e.message}). ${document.hidden ? 'Продолжу, когда вернёшься в приложение' : 'Повторяю'}`);
        if (document.hidden) { job.text = 'Ждёт тебя: вернись в приложение, монтаж продолжится'; upd(); await new Promise((ok) => document.addEventListener('visibilitychange', function f() { if (!document.hidden) { document.removeEventListener('visibilitychange', f); ok(); } })); }
        job.text = `Монтаж, попытка ${attempt + 1}`; job.frame = 0; upd();
        await new Promise((ok) => setTimeout(ok, 800));
      }
    }
    job.text = 'Сохраняю'; upd();
    saveCover(r.style || st.style, coverFrames).catch(() => {});        // the style's cover = a real piece of this video
    // the finished video is never lost: phone file first, the app's own storage if that fails, and it plays from memory right away
    const id = uid();
    let ref;
    try { ref = await SV.put(id, mp4); } catch (e) { job.log.push('Файл в Документы не записался: ' + e.message + ' — храню в приложении'); try { ref = await SV.putLocal(id, mp4); } catch (e2) { job.log.push('Память браузера не приняла файл: ' + e2.message); ref = { kind: 'mem', id }; } }
    liveUrls[id] = URL.createObjectURL(new Blob([mp4], { type: 'video/mp4' }));
    // from here on nothing may lose the finished video: every step is optional, the video is shown in any case
    // the title help may wait at most 20 s (keys at their limit must not hold the finished video)
    let m = {}; try { const x = await Promise.race([meta({ style: st.style, topic, title: r.title, script: r.script, lang: st.lang }), new Promise((ok) => setTimeout(() => ok(null), 20000))]); if (x && typeof x === 'object') m = x; } catch { /* no title help */ }
    let thumb = ''; try { thumb = job.thumbs[0] ? await thumbData(job.thumbs[0]) : ''; } catch { /* no thumbnail */ }
    const rec = { id, created: Date.now(), topic, title: String(m.title || r.title || topic), description: String(m.description || ''), tags: Array.isArray(m.tags) ? m.tags.map(String) : [], style: r.style || st.style, kind: st.kind, seconds: Math.round(r.job.duration), voice: r.voice, ref, thumb, rating: 0, script: r.script, took: Math.round((Date.now() - job.started) / 1000) };
    try { const stt = await kv.get('stats', []); stt.push({ kind: st.kind, style: rec.style, eleven: Math.max(0, elBefore - EL.left()), at: Date.now() }); await kv.set('stats', stt.slice(-40)); } catch { /* stats are optional */ }
    try { await videos.put(rec); } catch (e) { job.log.push('История не записалась: ' + e.message); rec.note = 'Не сохранилось в историю: ' + e.message + '. Нажми «Скачать», чтобы не потерять видео.'; }
    if (job.log.length && !rec.note && ref.kind === 'mem') rec.note = job.log.slice(-1)[0];
    S.job = null;
    try { new Notification('Видео готово', { body: rec.title }); } catch { /* no notifications here */ }
    toast('Видео готово');
    if (S.tab === 'home') result(rec);
  } catch (e) {
    const stage = job.stage;
    S.job = null;
    if (ctl.signal.aborted) { toast('Остановлено'); if (S.tab === 'home') home(); return; }
    // the error stays on screen with the details needed to fix it (stage, error type, browser)
    const info = `Этап: ${stage}\nОшибка: ${e?.name || ''} ${e?.message || e}\nБраузер: ${navigator.userAgent}\nWebCodecs: ${typeof VideoEncoder !== 'undefined' ? 'видео да' : 'видео нет'}, ${typeof AudioEncoder !== 'undefined' ? 'звук да' : 'звук нет'}, OffscreenCanvas: ${typeof OffscreenCanvas !== 'undefined' ? 'да' : 'нет'}`;
    S.tab = 'home';
    await show(`<div class="card"><b>Видео не получилось</b><pre style="white-space:pre-wrap;font-size:12px;color:var(--t2);margin:10px 0 0">${esc(info)}</pre></div>
      <div style="margin-top:12px" class="row"><button class="btn ghost" id="cp">Скопировать</button><button class="btn" id="again">Назад</button></div>`, { title: 'Ошибка' });
    $('#cp').onclick = async () => { try { await navigator.clipboard.writeText(info); toast('Скопировано'); } catch { toast('Выдели текст и скопируй'); } };
    $('#again').onclick = () => home();
  } finally { try { await lock?.release(); } catch { /* ok */ } }
}
const coverFrames = [];
async function saveCover(style, frames) {
  if (frames.length < 6) return;
  const out = [];
  for (const b of frames) { const c = new OffscreenCanvas(b.width, b.height); c.getContext('2d').drawImage(b, 0, 0); out.push(await c.convertToBlob({ type: 'image/jpeg', quality: 0.82 })); b.close?.(); }
  const { blobs } = await import('./store.js'); await blobs.put('cover:' + style, out);
}
async function thumbData(b) {
  const c = document.createElement('canvas'); c.width = 160; c.height = Math.round(160 * b.height / b.width);
  c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.7);
}

async function progressScreen() {
  await show(`<div class="card"><div class="stages" id="stages"></div><div class="bar"><i id="bar" style="width:0"></i></div><div class="log" id="log"></div></div>
    <h2 id="liveH">Что уже сделано</h2><div class="strip" id="strip"></div><canvas class="live" id="live" hidden></canvas>
    <div style="margin-top:16px"><button class="btn ghost" id="stop">Остановить</button></div>
    <p class="note">Не закрывай приложение до конца монтажа. Можно смотреть другие вкладки.</p>`, { title: 'Делаю видео' });
  $('#stop').onclick = () => S.job?.ctl.abort();
  S.job.drawn = 0; paintProgress();
}
function paintProgress() {
  const j = S.job, box = $('#stages'); if (!j || !box) return;
  const order = STAGES.map((s) => s[0]), cur = order.indexOf(j.stage);
  box.innerHTML = STAGES.slice(0, 4).map(([id, name], i) => {
    const c = j.counts[id], cls = i < cur ? 'done' : i === cur ? 'on' : '';
    const info = id === 'montage' && j.total ? `${Math.round(j.frame / j.total * 100)}% · ${j.fps.toFixed(0)} к/с · ещё ${Math.ceil(j.eta || 0)} с` : c ? `${c[0]} / ${c[1]}` : '';
    return `<div class="stage ${cls}"><span class="mark"></span><span>${name}${i === cur && j.text ? `<br><small>${esc(j.text)}</small>` : ''}</span><small class="n">${info}</small></div>`;
  }).join('');
  const frac = j.stage === 'montage' && j.total ? 0.75 + 0.25 * j.frame / j.total : (cur + (j.counts[j.stage] ? j.counts[j.stage][0] / Math.max(1, j.counts[j.stage][1]) : 0)) / 4;
  $('#bar').style.width = `${Math.round(frac * 100)}%`;
  $('#log').textContent = j.log.slice(-3).join('\n');
  const strip = $('#strip');
  for (; j.drawn < j.thumbs.length; j.drawn++) { const b = j.thumbs[j.drawn], c = document.createElement('canvas'); c.height = 92; c.width = Math.round(92 * b.width / b.height); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); strip.append(c); strip.scrollLeft = strip.scrollWidth; }
  if (j.preview) { const live = $('#live'); live.hidden = false; live.width = j.preview.width; live.height = j.preview.height; live.getContext('2d').drawImage(j.preview, 0, 0); $('#liveH').textContent = 'Монтаж: кадр прямо сейчас'; }
}

/* ---------------- result ---------------- */
const liveUrls = {};                                                    // videos made in this session play straight from memory
async function result(rec, { post = false } = {}) {
  let src = liveUrls[rec.id];
  if (!src) try { src = await SV.url(rec.ref); } catch { src = ''; }
  await show(`<video src="${esc(src)}" controls playsinline autoplay></video>
    <h2 style="font-size:18px;color:var(--t1);margin-top:14px">${esc(rec.title)}</h2>
    <div class="row"><button class="btn" id="dl">Скачать</button><button class="btn ghost" id="sh">Залить в соцсеть</button></div>
    <div class="row" id="nets" ${post ? '' : 'hidden'}><button class="btn small ghost" data-net="TikTok">TikTok</button><button class="btn small ghost" data-net="YouTube">YouTube</button><button class="btn small ghost" data-net="Instagram">Instagram</button></div>
    <h2>Оценка (учит программу)</h2><div class="rate">${Array.from({ length: 10 }, (_, i) => `<button data-r="${i + 1}" aria-pressed="${rec.rating === i + 1}">${i + 1}</button>`).join('')}</div>
    <textarea id="why" rows="2" style="margin-top:8px" placeholder="Что не так или что понравилось? (необязательно)"></textarea>
    <h2>Для YouTube</h2><div class="card stack"><div>${esc(rec.title)}</div><div style="color:var(--t2);font-size:14px;white-space:pre-wrap">${esc(rec.description || '')}</div><div style="color:var(--t3);font-size:13px">${esc((rec.tags || []).join(', '))}</div><button class="btn small ghost" id="copy">Скопировать</button></div>
    ${rec.note ? `<p class="note">${esc(rec.note)}</p>` : ''}<p class="note n">${rec.seconds} с · голос ${esc(rec.voice)} · сделано за ${Math.floor(rec.took / 60)} мин ${rec.took % 60} с</p>`,
  { title: 'Готово', back: () => (S.tab === 'history' ? history() : home()) });
  $('#dl').onclick = async () => { if (rec.ref.kind === 'mem') { const a = document.createElement('a'); a.href = src; a.download = `${rec.title}.mp4`; a.click(); return; } toast(await SV.download(rec.ref, rec.title)); };
  // posting goes through the phone's share sheet: the text is copied first, the user picks the app, pastes it as the caption
  $('#sh').onclick = () => { $('#nets').hidden = !$('#nets').hidden; };
  view.querySelectorAll('[data-net]').forEach((b) => (b.onclick = async () => {
    const tags = (rec.tags || []).map((t) => '#' + String(t).replace(/[\s#]+/g, '')).join(' ');
    const text = b.dataset.net === 'YouTube' ? `${rec.title}

${rec.description || ''}

${tags}` : `${rec.title} ${tags}`;
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked */ }
    toast(`Подпись скопирована. В списке выбери ${b.dataset.net} и вставь её`);
    rec.posted = [...new Set([...(rec.posted || []), b.dataset.net])]; videos.put(rec);
    if (rec.ref.kind === 'mem') { const f = new File([await (await fetch(src)).blob()], `${rec.title}.mp4`, { type: 'video/mp4' }); navigator.share?.({ files: [f], title: rec.title }).catch(() => {}); }
    else SV.share(rec.ref, rec.title).catch(() => {});
  }));
  $('#copy').onclick = async () => { await navigator.clipboard?.writeText(`${rec.title}\n\n${rec.description}\n\n${(rec.tags || []).join(', ')}`); toast('Скопировано'); };
  view.querySelectorAll('[data-r]').forEach((b) => (b.onclick = async () => {
    rec.rating = +b.dataset.r; await videos.put(rec);
    view.querySelectorAll('[data-r]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    learn(`Оценка видео «${rec.title}» (${STYLES[rec.style]?.name || rec.style}, ${rec.kind}): ${rec.rating} из 10. Комментарий: ${$('#why').value || 'нет'}. Сценарий: ${rec.script.slice(0, 1500)}`);
  }));
}

/* ---------------- learning: chat and ratings become lessons that every prompt follows ---------------- */
async function learn(text, chat = false) {
  const ls = await kv.get('lessons', []);
  try {
    const r = await AI.json(`Ты — редактор приложения, которое делает YouTube-видео со стикменами (сценарий Gemini, озвучка ElevenLabs, анимация). Владелец ${chat ? 'пишет тебе в чат' : 'поставил оценку видео'}:
«${text}»
Текущие уроки (правила, которые получают сценарист и аниматор): ${ls.map((l, i) => `${i}. ${l}`).join(' | ') || 'нет'}
Настройки: ${JSON.stringify(S.settings)}
Сделай выводы. Верни JSON {"reply": "короткий ответ владельцу по-русски: что именно ты изменишь", "add": ["новые уроки — конкретные правила для сценариста/аниматора/озвучки, без воды"], "remove": [номера уроков, которые больше не нужны], "settings": {"lang"?: "ru"|"en", "minutes"?: 5|10|15}}.
Если оценка 8+ — закрепи то, что получилось. Если всё и так ясно — "add": [].`, { fast: true });
    const keep = ls.filter((_, i) => !(r.remove || []).includes(i)).concat((r.add || []).filter(Boolean)).slice(-40);
    await kv.set('lessons', keep);
    if (r.settings) { Object.assign(S.settings, Object.fromEntries(Object.entries(r.settings).filter(([k]) => ['lang', 'minutes'].includes(k)))); await kv.set('settings', S.settings); }
    if (!chat) toast('Учёл оценку');
    return r.reply || 'Понял.';
  } catch (e) { if (!chat) toast('Оценка сохранена'); return 'Не получилось связаться с Gemini: ' + e.message; }
}

async function chat() {
  const msgs = await kv.get('chat', []), ls = await kv.get('lessons', []);
  await show(`<div class="msgs" id="msgs">${msgs.length ? msgs.map((m) => `<div class="msg ${m.me ? 'me' : 'ai'}">${esc(m.t)}</div>`).join('') : '<p class="note">Пиши, что не так: «озвучка глючит», «сцены скучные», «больше юмора». Программа запомнит и не будет повторять ошибку.</p>'}</div>
    <div class="compose"><textarea id="msg" rows="1" placeholder="Сообщение"></textarea><button class="btn" id="send" aria-label="Отправить"><svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button></div>
    <h2>Чему программа научилась (${ls.length})</h2><div class="card">${ls.map((l, i) => `<div class="lesson"><span>${esc(l)}</span><button data-forget="${i}" aria-label="Забыть">✕</button></div>`).join('') || '<p class="note" style="margin:0">Пока ничего.</p>'}</div>`, { title: 'Чат' });
  scrollTo(0, document.body.scrollHeight);
  $('#send').onclick = async () => {
    const t = $('#msg').value.trim(); if (!t) return;
    msgs.push({ me: true, t }); $('#msg').value = '';
    $('#msgs').insertAdjacentHTML('beforeend', `<div class="msg me">${esc(t)}</div><div class="msg ai" id="typing">…</div>`);
    const reply = await learn(t, true);
    msgs.push({ me: false, t: reply }); await kv.set('chat', msgs.slice(-60));
    chat();
  };
  view.querySelectorAll('[data-forget]').forEach((b) => (b.onclick = async () => { ls.splice(+b.dataset.forget, 1); await kv.set('lessons', ls); chat(); }));
}

/* ---------------- history ---------------- */
async function history() {
  const list = await videos.all();
  await show(list.length ? list.map((v) => `<button class="item" data-open="${v.id}">${v.thumb ? `<img src="${v.thumb}" alt="">` : '<span class="ph"></span>'}<div><b>${esc(v.title)}</b><span class="n">${new Date(v.created).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${v.kind === 'short' ? 'шортс' : 'лонг'} · ${v.seconds} с${v.rating ? ` · ${v.rating}/10` : ''}${v.posted?.length ? ` · залито: ${esc(v.posted.join(', '))}` : ''}</span></div></button><button class="btn small ghost" data-post="${v.id}" style="margin:-4px 0 10px">Залить</button>`).join('')
    + `<div style="margin-top:16px"><button class="btn ghost" id="clear">Очистить все видео</button></div>` : '<p class="empty">Здесь будут твои видео.</p>', { title: 'Видео' });
  view.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => result(list.find((v) => v.id === b.dataset.open))));
  view.querySelectorAll('[data-post]').forEach((b) => (b.onclick = () => result(list.find((v) => v.id === b.dataset.post), { post: true })));
  const c = $('#clear'); if (c) c.onclick = async () => { if (!confirm('Удалить все видео с телефона?')) return; for (const v of list) { await SV.remove(v.ref); await videos.del(v.id); } toast('Память освобождена'); history(); };
}

/* ---------------- settings ---------------- */
async function settings() {
  await show(`<button class="item" id="keys"><div><b>Ключи и лимиты</b><span>Gemini ${K.of('gemini').filter((k) => k.ok).length} · ElevenLabs ${EL.left().toLocaleString('ru')} символов</span></div></button>
    <button class="item" id="kb" style="margin-top:8px"><div><b>База знаний</b><span>Что умеет каждый стиль и как он устроен</span></div></button>
    <h2>Память</h2><button class="btn ghost" id="cache">Очистить видео и чат</button>
    <button class="btn ghost" id="sfx" style="margin-top:8px">Очистить библиотеку звуков</button>
    <p class="note">Голос выбирается на экране каждого стиля. Если у ElevenLabs кончатся символы, всё видео озвучит Gemini — один голос на ролик.</p>
    <p class="note n" id="ver2"></p>`, { title: 'Настройки' });
  $('#keys').onclick = () => keysScreen(false);
  $('#kb').onclick = () => knowledgeScreen();
  $('#cache').onclick = async () => { if (!confirm('Удалить все видео и переписку?')) return; const list = await videos.all(); for (const v of list) { await SV.remove(v.ref); await videos.del(v.id); } await kv.set('chat', []); toast('Готово, память освобождена'); };
  $('#sfx').onclick = async () => { if (!confirm('Удалить сохранённые звуки? Их придётся создавать заново.')) return; const { blobs } = await import('./store.js'); const all = await blobs.keys?.(); if (all) for (const k of all) if (String(k).startsWith('sfx:')) await blobs.del(k); toast('Библиотека звуков очищена'); };
  try { const v = await (await fetch('version.json', { cache: 'no-store' })).json(); $('#ver2').textContent = `Версия ${v.version}`; } catch { /* local */ }
}

/* ---------------- navigation ---------------- */
function tab(name) { S.tab = name; ({ home, history, chat, settings })[name](); }
document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => tab(b.dataset.tab)));

(async () => {
  Object.assign(S.settings, await kv.get('settings', {}));
  try {
    const v = await (await fetch('version.json', { cache: 'no-store' })).json(); $('#ver').textContent = v.version;
    // Safari keeps old files for a while: a newer version on GitHub reloads the page under a new address, so every file comes fresh
    const b = globalThis.BUILD;
    if (v.commit && b && b !== '__BUILD__' && v.commit !== b && sessionStorage.getItem('reloadedFor') !== v.commit && !S.job) {
      sessionStorage.setItem('reloadedFor', v.commit); location.replace(`${location.pathname}?v=${v.commit}`); return;
    }
  } catch { /* local */ }
  try { Notification.requestPermission?.(); } catch { /* ok */ }
  await K.load();
  if (!K.ready()) { await K.checkAll(); }
  if (!K.ready()) return keysScreen(true);
  tab('home');
  K.checkAll();                                                         // refresh limits quietly
})();
