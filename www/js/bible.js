// The production bible of a 3D cartoon video (the way the best cartoon-short makers work): Gemini designs, ONCE,
// the cast (everyone who appears, built for this topic and era) and the sets (the places, built from the world kit),
// then writes one shot per voice-over line: who is where, what they do, how the camera films it, which effect and sound.
// tidyBible() repairs any answer, so the renderer never meets a missing id, a NaN or an unknown word.
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

export function biblePrompt({ topic, lines, lang, look, known }) {
  return `You are the director, set designer and casting director of a vertical animated short: a 3D cartoon world (toon light, ink outlines, painted textures) with flat bean-head cartoon characters, like the best cartoon story Shorts. ${look || ''}
TOPIC: ${topic}
VOICE-OVER (${lines.length} lines, each line becomes ONE shot, same order):
${lines.map((l, i) => `${i + 1}. ${l.text}${l.idea ? `  [idea: ${l.idea}]` : ''}`).join('\n')}
${known ? `ALREADY DESIGNED (reuse these ids, add new ones only if the story needs them): cast ${known.cast.join(', ')}; sets ${known.sets.join(', ')}.` : ''}
Design everything FOR THIS TOPIC AND ERA (a World Cup story gets a stadium, jerseys, a trophy; ancient Rome gets temples, armor, togas; space gets a rocket and spacesuits).
1) "cast": everyone who appears (1–5), designed ONCE for the whole video: {"id": short id, "name": str, "look": {"skin": "#hex", "hair": "#hex", "hairStyle": "short|spiky|long|bun|bald", "hat": "${HATS}", "hatColor": "#hex", "outfit": "${OUTFITS}", "top": "#hex", "bottom": "#hex", "number": n (jersey only), "cape": "#hex"|null, "beard": "#hex"|null, "moustache": "#hex"|null, "glasses": bool, "sunglasses": bool, "scarf": "#hex"|null, "medal": bool, "ears": "none|cat|dog|bear|rabbit|mouse|fox" (animals), "earColor": "#hex", "antenna": 0|1|2 (robots, aliens), "prop": "${PROPS}", "propText": str|null}, "scale": 0.7 for a child, 1 for an adult, 1.4 for a giant}.
2) "sets": the 1–4 places, each built ONCE: {"id": short id, "ground": "${GROUNDS.join('|')}", "time": "${TIMES.join('|')}", "room": null or {"wall": "#hex", "floor": "#hex", "floorKind": "planks|tiles|stone", "outside": "day|night"} for indoors, "objects": [{"id": optional, "type": one of ${KIT.join(', ')}, "x": n, "z": n, "y": n (0 = on the ground), "rot": degrees, "scale": n, "w": n, "h": n, "color": "#hex", "color2": "#hex", "text": "visible writing" (sign/board/screen/paper/emoji)}]}. 8–20 objects per set. The actors stand in x −3..3, z −2..2: keep that free; frame it with objects at |x| 4..12 and z −5..−30 (background) — a rich, believable place. Anything with writing a viewer must read (a newspaper headline, a scoreboard, a sign, a screen) is a sign/board/screen/paper with "text" ${lang === 'en' ? 'in English' : lang === 'kk' ? 'in Kazakh' : 'in Russian'}. Unknown things: use "emoji" with "text": one emoji.
3) "shots": exactly ${lines.length}, one per line: {"line": n, "set": id, "actors": [{"id", "x", "z", "y" (stand on a podium/stage/roof), "face": "${FACE_NAMES.join('|')}", "pose": "${POSES.join('|')}", "action": "${ACTIONS.join('|')}", "to": [x, z] (walk/run target), "talk": true only if this character speaks in this line}], "camera": {"size": "${SIZES.join('|')}", "target": actor id | "id1,id2" | object id, "angle": "${ANGLES.join('|')}", "move": "${MOVES.join('|')}", "side": −40..40, "roll": −6..6}, "fx": [${FX.join('|')}], "sfx": {"kind": "${SFX.join('|')}", "on": "the exact word of the line where the sound hits", "prompt": "a short English description of the real sound for a sound designer, e.g. 'a stadium crowd roars and cheers', 'a leather football hits the net', 'a heavy wooden door creaks open'"}}.
SHOT RULES: illustrate every line LITERALLY — what the words say is what we see; props carry the jokes; vary the sizes: hook (close/medium, low angle) → wide reveal → two-shot → insert on the key object with writing → reaction close-up → wide payoff; nobody just stands: a new face/pose every shot; a jump in place or time = another set; the twist line gets "sfx": "sting" + "move": "push" + a small roll; the last shot's payoff lands on the last word; light for beats: day = normal, golden = drama or decline, dusk/night = mystery or explanation; 1–3 fx in the big moments only.
Return JSON {"cast": [...], "sets": [...], "shots": [...]}.`;
}

/* ---------------- repair ---------------- */
const pick = (v, list, d) => (list.includes(v) ? v : d);
const num = (v, d, lo = -1e9, hi = 1e9) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d);
const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.trim()) ? v.trim() : d);
const str = (v, n = 80) => (v == null ? '' : String(v).slice(0, n));
const asList = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

function tidyLook(l = {}) {
  const out = {};
  for (const [k, v] of Object.entries(l || {})) {
    if (/color|skin|hair$|top|bottom|beard|moustache|cape|scarf|ear/i.test(k) && k !== 'hairStyle') { const h = hex(v, null); if (h) out[k] = h; else if (v === null || v === false) out[k] = null; continue; }
    if (['glasses', 'sunglasses', 'medal', 'snout'].includes(k)) { out[k] = !!v; continue; }
    if (k === 'number') { out.number = num(v, 10, 0, 99); continue; }
    if (k === 'antenna') { out.antenna = num(v, 0, 0, 2); continue; }
    out[k] = typeof v === 'string' ? v.slice(0, 30) : v;
  }
  out.skin = out.skin || '#f5c9a0';
  return out;
}

// the sound of a shot: {kind (a synth fallback), on (the word it lands on), prompt (what ElevenLabs should make)}
function tidySfx(v) {
  if (typeof v === 'string') return { kind: pick(v, SFX, 'none'), on: '', prompt: '' };
  if (!v || typeof v !== 'object') return { kind: 'none', on: '', prompt: '' };
  return { kind: pick(v.kind, SFX, 'whoosh'), on: str(v.on, 40), prompt: str(v.prompt, 120) };
}

export function tidyBible(b, lines, { minimal = false } = {}) {
  b = b && typeof b === 'object' ? b : {};
  const cast = asList(b.cast).filter((c) => c && typeof c === 'object').slice(0, 6).map((c, i) => ({ id: str(c.id || c.name || `c${i}`, 24), name: str(c.name, 40), look: tidyLook(c.look), scale: num(c.scale, 1, 0.5, 1.8) }));
  if (!cast.length && !minimal) cast.push({ id: 'hero', name: 'Hero', look: { skin: '#f5c9a0', hair: '#3b2a20', outfit: 'hoodie', top: '#f08a3c' }, scale: 1 });
  const sets = asList(b.sets).filter((s) => s && typeof s === 'object').slice(0, 6).map((s, i) => ({
    id: str(s.id || `set${i}`, 24),
    ground: pick(s.ground, GROUNDS, 'grass'), time: pick(s.time, TIMES, s.room ? 'interior' : 'day'),
    room: s.room && typeof s.room === 'object' ? { wall: hex(s.room.wall, '#e8d6b8'), floor: hex(s.room.floor, '#a8784a'), floorKind: pick(s.room.floorKind, ['planks', 'tiles', 'stone', 'wood'], 'planks'), outside: pick(s.room.outside, ['day', 'night'], 'day') } : null,
    objects: asList(s.objects).filter((o) => o && typeof o === 'object').slice(0, 30).map((o) => ({
      id: o.id ? str(o.id, 24) : undefined, type: str(o.type, 24) || 'crate', x: num(o.x, 0, -60, 60), z: num(o.z, -6, -80, 40), y: num(o.y, 0, -2, 30),
      rot: num(o.rot, 0, -360, 360), scale: num(o.scale, 1, 0.1, 6), w: o.w == null ? undefined : num(o.w, 2, 0.1, 60), h: o.h == null ? undefined : num(o.h, 2, 0.1, 60),
      color: hex(o.color, undefined), color2: hex(o.color2, undefined), text: o.text == null ? undefined : str(o.text, 60),
    })),
  }));
  if (!sets.length && !minimal) sets.push({ id: 'place', ground: 'grass', time: 'day', room: null, objects: [{ type: 'house', x: -6, z: -10 }, { type: 'tree', x: 5, z: -7 }, { type: 'tree', x: -4, z: -14 }, { type: 'hill', x: 0, z: -30, w: 14 }] });
  const castIds = cast.map((c) => c.id), setIds = sets.map((s) => s.id);
  const raw = asList(b.shots).filter((s) => s && typeof s === 'object');
  const shots = [];
  for (let i = 0; i < lines.length; i++) {
    const s = raw.find((x) => +x.line === i + 1) || raw[i] || null;
    const prev = shots[i - 1];
    if (!s) { shots.push(prev ? { ...prev, line: i + 1, fx: [], sfx: { kind: 'none', on: '', prompt: '' }, camera: { ...prev.camera, size: ['medium', 'close', 'wide'][i % 3], move: ['push', 'orbit', 'pull'][i % 3] } } : { set: setIds[0] || 'place', actors: castIds[0] ? [{ id: castIds[0], x: 0, z: 0, face: 'happy', pose: 'wave', action: 'idle' }] : [], camera: { size: 'medium', target: castIds[0], angle: 'eye', move: 'push', side: 0, roll: 0 }, fx: [], sfx: { kind: 'none', on: '', prompt: '' } }); continue; }
    const actors = asList(s.actors).filter((a) => a && castIds.includes(String(a.id))).slice(0, 5).map((a) => ({
      id: String(a.id), x: num(a.x, 0, -12, 12), z: num(a.z, 0, -12, 12), y: num(a.y, 0, 0, 20),
      face: pick(a.face || a.expr, FACE_NAMES, 'neutral'), pose: pick(a.pose, POSES, 'hang'), action: pick(a.action, ACTIONS, 'idle'),
      to: Array.isArray(a.to) ? [num(a.to[0], 0, -14, 14), num(a.to[1], 0, -14, 14)] : undefined, talk: !!a.talk,
    }));
    const cam = s.camera && typeof s.camera === 'object' ? s.camera : {};
    shots.push({
      line: i + 1, set: setIds.includes(String(s.set)) ? String(s.set) : prev?.set || setIds[0] || 'place', actors,
      camera: { size: pick(cam.size, SIZES, 'medium'), target: str(cam.target || actors[0]?.id || '', 60), angle: pick(cam.angle, ANGLES, 'eye'), move: pick(cam.move, MOVES, 'push'), side: num(cam.side, 0, -60, 60), roll: num(cam.roll, 0, -10, 10) },
      fx: asList(s.fx).map(String).filter((f) => FX.includes(f)).slice(0, 3), sfx: tidySfx(s.sfx),
    });
  }
  return { cast, sets, shots };
}
