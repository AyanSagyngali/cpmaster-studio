// API keys: recognised from any pasted text, checked, and rotated. When one key hits a limit the next one takes over at once.
import { kv } from './store.js';

// Google AI Studio keys come in two shapes (old «AIza…», new «AQ.…»); ElevenLabs keys are «sk_» + 48 hex
const RE = {
  gemini: /\b(?:AIza[0-9A-Za-z_-]{35}|AQ\.[0-9A-Za-z_-]{30,90})/g,
  eleven: /\bsk_[0-9a-f]{40,64}\b/g,
};

export function detect(text) {
  const out = { gemini: [], eleven: [] };
  for (const kind of Object.keys(RE)) out[kind] = [...new Set(String(text).match(RE[kind]) || [])];
  return out;
}
export const tail = (k) => '…' + k.slice(-4);

/* ---------------- the pool ---------------- */
// key record: {key, kind, ok, note, cool (until ms), image (true | false | null = unknown), left, total, reset}
let pool = null;
export async function load() { pool = await kv.get('keys', []); return pool; }
export const all = () => pool || [];
export const of = (kind) => all().filter((k) => k.kind === kind);
export const save = () => kv.set('keys', pool);

export async function add(text) {
  await load();
  const found = detect(text);
  let added = 0;
  for (const kind of ['gemini', 'eleven']) for (const key of found[kind]) {
    if (pool.some((k) => k.key === key)) continue;
    pool.push({ key, kind, ok: null, note: 'проверяю', cool: 0, image: null });
    added++;
  }
  await save();
  return { added, found: found.gemini.length + found.eleven.length };
}
export async function remove(key) { pool = all().filter((k) => k.key !== key); await save(); }

// round robin over usable keys of a kind; `want` filters further (e.g. keys that can draw)
const cursor = { gemini: 0, eleven: 0 };
export function next(kind, want = () => true) {
  const now = Date.now();
  const list = of(kind).filter((k) => k.ok !== false && k.cool <= now && want(k));
  if (!list.length) return null;
  return list[cursor[kind]++ % list.length];
}
export function soonest(kind, want = () => true) {
  const list = of(kind).filter((k) => k.ok !== false && want(k));
  return list.length ? Math.min(...list.map((k) => k.cool)) : Infinity;
}
export function cool(k, ms, note) { k.cool = Date.now() + ms; k.coolKind = /дн/.test(note || '') ? 'day' : 'minute'; if (note) k.note = note; save(); }

/* ---------------- honest usage: Google resets the free Gemini quota at midnight Pacific time ---------------- */
const LA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
function laParts() { const p = Object.fromEntries(LA.formatToParts(new Date()).map((x) => [x.type, x.value])); return p; }
export const pacificDay = () => { const p = laParts(); return `${p.year}-${p.month}-${p.day}`; };
// when the Gemini daily quota comes back (a real moment in the phone's own time zone)
export function geminiReset() { const p = laParts(); const passed = (+p.hour * 3600 + +p.minute * 60 + +p.second) * 1000; return Date.now() + 864e5 - passed; }
let saveT = 0;
// one successful Gemini request on this key today
export function used(k) {
  const d = pacificDay(); if (k.day !== d) { k.day = d; k.used = 0; }
  k.used = (k.used || 0) + 1; clearTimeout(saveT); saveT = setTimeout(save, 1500);
}
export const usedToday = (k) => (k.day === pacificDay() ? k.used || 0 : 0);
export function bad(k, note) { k.ok = false; k.note = note; save(); }

/* ---------------- checking ---------------- */
export async function check(k) {
  try {
    if (k.kind === 'gemini') {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(k.key)}`);
      if (r.status === 400 || r.status === 401 || r.status === 403) { k.ok = false; k.note = 'ключ не принят'; }
      else if (r.ok) {
        const j = await r.json();
        k.ok = true; k.note = 'Gemini работает';
        k.models = (j.models || []).map((m) => m.name.replace('models/', ''));
      } else { k.ok = null; k.note = `Google ответил ${r.status}`; }
    } else {
      const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': k.key } });
      if (r.status === 401) { k.ok = false; k.note = 'ключ не принят'; }
      else if (r.ok) {
        const j = await r.json();
        k.ok = true; k.total = j.character_limit; k.left = Math.max(0, j.character_limit - j.character_count);
        k.reset = (j.next_character_count_reset_unix || 0) * 1000;
        k.note = `осталось ${k.left.toLocaleString('ru')} символов`;
      } else { k.ok = null; k.note = `ElevenLabs ответил ${r.status}`; }
    }
  } catch { k.ok = null; k.note = 'нет интернета'; }
  return k;
}
export async function checkAll(onEach = () => {}) {
  await load();
  await Promise.all(all().map(async (k) => { await check(k); onEach(k); }));
  await save();
  return all();
}
export const ready = () => of('gemini').some((k) => k.ok) || of('eleven').some((k) => k.ok);
