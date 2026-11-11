// The production bible of a 3D cartoon video, made as a CHAIN (the way a director reads a script):
//  1) castSetsPrompt — read the whole script once: design everyone who appears and every place, ONCE;
//  2) beatsPrompt — then go through the script IN ORDER, a few lines at a time, knowing the story so far and the next
//     line: every line becomes 1–3 BEATS, each starting on an exact word, so the picture changes exactly when the
//     narrator says it (no delay, no picture about something else).
// tidy*() repair any answer, so the renderer never meets a missing id, a NaN or an unknown word.
import { FACE_NAMES } from './bean.js';

export const KIT = ['house', 'hut', 'tower', 'castle', 'wall', 'fence', 'bridge', 'tree', 'pine', 'palm', 'bush', 'flowers', 'hill', 'mountain', 'rock', 'water', 'boat', 'ship', 'table', 'desk', 'chair', 'bed', 'throne', 'crate', 'barrel', 'lamp', 'sign', 'board', 'screen', 'paper', 'column', 'temple', 'pyramid', 'tent', 'car', 'bus', 'building', 'skyscraper', 'stadium', 'goal', 'ball', 'trophy', 'podium', 'bookshelf', 'computer', 'cannon', 'flag', 'campfire', 'statue', 'gate', 'well', 'cart', 'rocket', 'plane', 'cloud', 'stairs', 'road', 'field', 'crowd', 'bench', 'sofa', 'door', 'plant', 'tv', 'laptop', 'window', 'floodlight', 'lockers', 'ceilinglamp', 'emoji'];
const GROUNDS = ['grass', 'sand', 'snow', 'dirt', 'stone', 'road', 'water', 'field', 'moon', 'wood', 'tiles'];
const TIMES = ['day', 'golden', 'dusk', 'night', 'interior', 'storm', 'space'];
const POSES = ['hang', 'wave', 'point', 'up', 'cheer', 'hip', 'cross', 'hold', 'reach', 'thumb', 'facepalm', 'shrug'];
const ACTIONS = ['idle', 'walk', 'run', 'hop', 'jump', 'dance', 'fall', 'shake', 'nod', 'cheer'];
const SIZES = ['wide', 'medium', 'two', 'close', 'insert', 'extreme'];
const ANGLES = ['eye', 'low', 'high', 'top'];
const MOVES = ['push', 'pull', 'orbit', 'pan', 'crane', 'drop', 'static'];
export const FX = ['confetti', 'sparkles', 'hearts', 'zzz', 'question', 'exclaim', 'rain', 'snow', 'dust', 'flash', 'shake', 'smoke', 'stars', 'tears', 'money'];
export const SFX = ['whoosh', 'pop', 'ding', 'thud', 'boom', 'crash', 'crowd', 'sting', 'magic', 'splash', 'laugh', 'none'];
const HATS = 'none|cap|tophat|crown|helmet|hood|cowboy|headband|beanie|chef|turban|astronaut|wizard|pirate|graduate|police|pilot|captain|firefighter|viking|headphones|hijab|beret|santa';
const OUTFITS = 'tunic|suit|dress|robe|armor|jersey|apron|space|labcoat|uniform|hoodie|overalls|kimono|robot';
const PROPS = 'spear|sword|ball|trophy|phone|book|cup|flag|money|torch|laptop|paper|sign|bag|microphone|wand|shield|hammer|umbrella|camera|guitar|none, or ANY single emoji';
const TEXT_LANG = { en: 'in English', kk: 'in Kazakh', ru: 'in Russian' };

/* ---------------- 1. cast and sets, from the whole script ---------------- */
export function castSetsPrompt({ topic, lines, lang, look }) {
  return `You are the casting director and set designer of a vertical animated short: a 3D cartoon world (toon light, ink outlines, painted textures) with flat bean-head cartoon characters. ${look || ''}
TOPIC: ${topic}
THE WHOLE SCRIPT (read it all first):
${lines.map((l, i) => `${i + 1}. ${l.text}`).join('\n')}
Design, ONCE for the whole video and FOR THIS TOPIC AND ERA, everything the script needs:
"cast": everyone who appears or should be seen (1–6), each with a fixed look: {"id": short id, "name": str, "role": one line, "look": {"skin": "#hex", "hair": "#hex", "hairStyle": "short|spiky|long|bun|bald", "hat": "${HATS}", "hatColor": "#hex", "outfit": "${OUTFITS}", "top": "#hex", "bottom": "#hex", "number": n, "cape": "#hex"|null, "beard": "#hex"|null, "moustache": "#hex"|null, "glasses": bool, "sunglasses": bool, "scarf": "#hex"|null, "medal": bool, "ears": "none|cat|dog|bear|rabbit|mouse|fox", "earColor": "#hex", "antenna": 0|1|2, "prop": "${PROPS}", "propText": str|null}, "scale": 0.7 child / 1 adult / 1.4 giant}. If the script says "you", the viewer is the hero: design that hero.
"sets": every place of the story (1–5), each built ONCE: {"id": short id, "name": str, "ground": "${GROUNDS.join('|')}", "time": "${TIMES.join('|')}", "room": null or {"wall": "#hex", "floor": "#hex", "floorKind": "planks|tiles|stone", "outside": "day|night"}, "objects": [{"id": short id (give an id to every object the script talks about), "type": one of ${KIT.join(', ')}, "x": n, "z": n, "y": n, "rot": degrees, "scale": n, "w": n, "h": n, "color": "#hex", "color2": "#hex", "text": "writing on it"}]}. 10–22 objects per set: a rich, believable place. Actors stand in x −3..3, z −2..2: keep that free; frame it with objects at |x| 4..12 and z −5..−30. ALL writing in the world ${TEXT_LANG[lang] || 'in Russian'} — never another language. Unknown things: "emoji" with "text": one emoji.
Return JSON {"cast": [...], "sets": [...]}.`;
}

/* ---------------- 2. beats, in order, a few lines at a time ---------------- */
export function beatsPrompt({ topic, lines, cast, sets, story, next, total }) {
  return `You are the director of a vertical animated cartoon short. You go through the script IN ORDER. Topic: ${topic}
CAST (fixed): ${cast.map((c) => `${c.id} = ${c.name || c.id}${c.role ? ` (${c.role})` : ''}`).join('; ')}
SETS (fixed): ${sets.map((s) => `${s.id} = ${s.name || s.id} [objects: ${(s.objects || []).filter((o) => o.id).map((o) => `${o.id}(${o.type})`).join(', ') || 'none named'}]`).join('; ')}
STORY SO FAR (already on screen): ${story || 'nothing yet — this is the opening, the first beat is the hook image'}
NOW DIRECT THESE LINES (out of ${total}):
${lines.map((l) => `${l.i + 1}. ${l.text}`).join('\n')}
${next ? `NEXT LINE (continuity only, do not direct it): ${next}` : 'This is the END of the video: the last beat lands the payoff on the last word.'}
For every line write 1–3 BEATS. A beat = what the viewer SEES from a given word on; "at" is the EXACT word of the line where it starts (copied as written); the first beat starts at the first word. Start a new beat when the line says something new to show (a new action, object, reaction, a jump in place or time).
RULES: show LITERALLY what the words say at that moment (if the line says "you hand the trophy to the guards", we see the hero giving the trophy to a guard); continuity with the story so far (same place unless the line moves on, same people, the action continues); objects named in the script are on screen when named; vary the size: close for feelings, wide for places and crowds, insert on an object when the line is about it; every beat has a fitting face and pose; at most 3 fx per chunk, only in big moments.
Beat: {"at": "word", "set": set id, "actors": [{"id": cast id, "x": −3..3, "z": −2..2, "y": n, "face": "${FACE_NAMES.join('|')}", "pose": "${POSES.join('|')}", "action": "${ACTIONS.join('|')}", "to": [x, z], "talk": true only if this character speaks these words}], "camera": {"size": "${SIZES.join('|')}", "target": actor id | "id1,id2" | object id, "angle": "${ANGLES.join('|')}", "move": "${MOVES.join('|')}", "side": −40..40, "roll": −6..6}, "fx": [${FX.join('|')}], "sfx": {"kind": "${SFX.join('|')}", "on": "exact word where the sound hits", "prompt": "short English description of the real sound"}}
Return JSON {"lines": [{"line": n, "beats": [...]}], "story": "the story so far, updated, in at most 3 short sentences"}.`;
}

/* ---------------- repair ---------------- */
const pick = (v, list, d) => (list.includes(v) ? v : d);
const num = (v, d, lo = -1e9, hi = 1e9) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d);
const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.trim()) ? v.trim() : d);
const str = (v, n = 80) => (v == null ? '' : String(v).slice(0, n));
const asList = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

function tidyLook(l = {}) {
  const out = {};
  for (const [k, v] of Object.entries(l && typeof l === 'object' ? l : {})) {
    if (/color|skin|hair$|top|bottom|beard|moustache|cape|scarf|ear/i.test(k) && k !== 'hairStyle') { const h = hex(v, null); if (h) out[k] = h; else if (v === null || v === false) out[k] = null; continue; }
    if (['glasses', 'sunglasses', 'medal', 'snout'].includes(k)) { out[k] = !!v; continue; }
    if (k === 'number') { out.number = num(v, 10, 0, 99); continue; }
    if (k === 'antenna') { out.antenna = num(v, 0, 0, 2); continue; }
    out[k] = typeof v === 'string' ? v.slice(0, 30) : v;
  }
  out.skin = out.skin || '#f5c9a0';
  return out;
}
function tidySfx(v) {
  if (typeof v === 'string') return { kind: pick(v, SFX, 'none'), on: '', prompt: '' };
  if (!v || typeof v !== 'object') return { kind: 'none', on: '', prompt: '' };
  return { kind: pick(v.kind, SFX, 'whoosh'), on: str(v.on, 40), prompt: str(v.prompt, 120) };
}
const NO_SFX = { kind: 'none', on: '', prompt: '' };

export function tidyCastSets(b) {
  b = b && typeof b === 'object' ? b : {};
  const cast = asList(b.cast).filter((c) => c && typeof c === 'object').slice(0, 7).map((c, i) => ({ id: str(c.id || c.name || `c${i}`, 24), name: str(c.name, 40), role: str(c.role, 80), look: tidyLook(c.look), scale: num(c.scale, 1, 0.5, 1.8) }));
  if (!cast.length) cast.push({ id: 'hero', name: 'Hero', role: '', look: { skin: '#f5c9a0', hair: '#3b2a20', outfit: 'hoodie', top: '#f08a3c' }, scale: 1 });
  const sets = asList(b.sets).filter((s) => s && typeof s === 'object').slice(0, 6).map((s, i) => ({
    id: str(s.id || `set${i}`, 24), name: str(s.name, 40),
    ground: pick(s.ground, GROUNDS, 'grass'), time: pick(s.time, TIMES, s.room ? 'interior' : 'day'),
    room: s.room && typeof s.room === 'object' ? { wall: hex(s.room.wall, '#e8d6b8'), floor: hex(s.room.floor, '#a8784a'), floorKind: pick(s.room.floorKind, ['planks', 'tiles', 'stone', 'wood'], 'planks'), outside: pick(s.room.outside, ['day', 'night'], 'day') } : null,
    objects: asList(s.objects).filter((o) => o && typeof o === 'object').slice(0, 30).map((o) => ({
      id: o.id ? str(o.id, 24) : undefined, type: str(o.type, 24) || 'crate', x: num(o.x, 0, -60, 60), z: num(o.z, -6, -80, 40), y: num(o.y, 0, -2, 30),
      rot: num(o.rot, 0, -360, 360), scale: num(o.scale, 1, 0.1, 6), w: o.w == null ? undefined : num(o.w, 2, 0.1, 60), h: o.h == null ? undefined : num(o.h, 2, 0.1, 60),
      color: hex(o.color, undefined), color2: hex(o.color2, undefined), text: o.text == null ? undefined : str(o.text, 60),
    })),
  }));
  if (!sets.length) sets.push({ id: 'place', name: 'place', ground: 'grass', time: 'day', room: null, objects: [{ type: 'house', x: -6, z: -10 }, { type: 'tree', x: 5, z: -7 }, { type: 'tree', x: -4, z: -14 }, { type: 'hill', x: 0, z: -30, w: 14 }] });
  return { cast, sets };
}

function tidyBeat(s, castIds, setIds, prev) {
  const actors = asList(s.actors).filter((a) => a && castIds.includes(String(a.id))).slice(0, 5).map((a) => ({
    id: String(a.id), x: num(a.x, 0, -12, 12), z: num(a.z, 0, -12, 12), y: num(a.y, 0, 0, 20),
    face: pick(a.face || a.expr, FACE_NAMES, 'neutral'), pose: pick(a.pose, POSES, 'hang'), action: pick(a.action, ACTIONS, 'idle'),
    to: Array.isArray(a.to) ? [num(a.to[0], 0, -14, 14), num(a.to[1], 0, -14, 14)] : undefined, talk: !!a.talk,
  }));
  const cam = s.camera && typeof s.camera === 'object' ? s.camera : {};
  return {
    at: str(s.at, 40), set: setIds.includes(String(s.set)) ? String(s.set) : prev?.set || setIds[0],
    actors: actors.length ? actors : (prev?.actors || []).map((a) => ({ ...a, action: 'idle', to: undefined, talk: false })),
    camera: { size: pick(cam.size, SIZES, 'medium'), target: str(cam.target || actors[0]?.id || '', 60), angle: pick(cam.angle, ANGLES, 'eye'), move: pick(cam.move, MOVES, 'push'), side: num(cam.side, 0, -60, 60), roll: num(cam.roll, 0, -10, 10) },
    fx: asList(s.fx).map(String).filter((f) => FX.includes(f)).slice(0, 3), sfx: tidySfx(s.sfx),
  };
}
// chunk: [{i, text}] -> beats per line ([[beat…]…]); a missing line continues the previous picture with a new camera
export function tidyBeats(raw, chunk, castIds, setIds, prevBeat) {
  const got = asList(raw?.lines).filter((x) => x && typeof x === 'object');
  const out = [];
  let prev = prevBeat;
  chunk.forEach((l, k) => {
    const entry = got.find((x) => +x.line === l.i + 1) || got[k];
    let beats = asList(entry?.beats).filter((b) => b && typeof b === 'object').slice(0, 3).map((b) => (prev = tidyBeat(b, castIds, setIds, prev)));
    if (!beats.length) {
      const base = prev || { set: setIds[0], actors: castIds[0] ? [{ id: castIds[0], x: 0, z: 0, y: 0, face: 'happy', pose: 'wave', action: 'idle', talk: false }] : [], camera: { size: 'medium', target: castIds[0] || '', angle: 'eye', move: 'push', side: 0, roll: 0 } };
      beats = [(prev = { ...base, at: '', fx: [], sfx: NO_SFX, camera: { ...base.camera, size: ['medium', 'close', 'wide'][k % 3], move: ['push', 'orbit', 'pull'][k % 3] } })];
    }
    beats[0].at = '';
    out.push(beats);
  });
  return { beats: out, story: str(raw?.story, 400) };
}

// one call with cast, sets and one shot per line (the tests and old callers)
export function tidyBible(b, lines) {
  const { cast, sets } = tidyCastSets(b);
  const castIds = cast.map((c) => c.id), setIds = sets.map((s) => s.id);
  const shots = asList(b?.shots).filter((s) => s && typeof s === 'object');
  const chunk = lines.map((l, i) => ({ i, text: l.text }));
  const raw = { lines: chunk.map((l, k) => { const s = shots.find((x) => +x.line === l.i + 1) || shots[k]; return s ? { line: l.i + 1, beats: [s] } : null; }).filter(Boolean) };
  const { beats } = tidyBeats(raw, chunk, castIds, setIds, null);
  return { cast, sets, shots: beats.map((bs, i) => ({ ...bs[0], line: i + 1 })) };
}
