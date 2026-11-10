// One animated scene. Gemini is the director: it draws the PLACE (two SVG layers for depth) and writes the choreography —
// who is there, what each figure does second by second, which animals and effects, how the camera moves.
// anim.js performs it. The figures and animals are never drawn by Gemini: they are our rigs, so they move.
import * as AI from './ai.js';
import { ACTION_NAMES } from './anim.js';

export const PALETTE = 'ochre #c9a24b, terracotta #c4683f, mustard #d6a032, olive #6d6a3f, sand #e6d3a8, deep brown #5a3d2b, sky #efe3c4, and ONE deep red accent #a8231f';
const HAT_BOX = '-60 -90 120 120', ITEM_BOX = '-40 -120 80 160';
const FX = 'arrows (a volley flying in arcs; dir 1 = to the right), dust, sparks (sword clash), smoke (rising column), fire (camp fire), torch, explosion (cannon, at a moment), coins (falling), birds (a flock crossing the sky), clouds (drifting, put y in the sky), flag (waving banner on a pole, needs "color"), water (waves along a river or sea, y = the water line)';

export function scenePrompt({ text, idea, seconds, W, H, hero, lessons = '', extra = '', palette }) {
  const args_palette = palette || PALETTE;
  const g0 = Math.round(H * 0.74), g1 = Math.round(H * 0.93), sec = Math.round(seconds * 10) / 10;
  return `You are the director and background artist of the Russian YouTube history channel «Историк». Stage ONE animated scene of ${sec} seconds for this moment of the voice-over:
«${text}»
Visual idea: ${idea}

Return ONE JSON object:
{"back": "<svg …>…</svg>", "front": "<svg …>…</svg>" | "",
 "actors": [{"role": "hero" | "other" | "crowd", "x": n, "y": n, "scale": n, "facing": 1 | -1, "talking": bool, "rider": animal index | null,
             "outfit": {"color": "#hex", "belt": "#hex" | null}, "hat": "svg elements", "item": "svg elements", "grip": "upright" | "along", "hand": "right" | "left",
             "steps": [{"at": seconds, "action": "…", "to_x": n | null, "mood": "neutral|happy|proud|sad|angry|scared", "facing": 1 | -1}]}],
 "animals": [{"kind": "horse" | "camel" | "ox", "x": n, "y": n, "scale": n, "facing": 1 | -1, "color": "#hex", "gait": "stand" | "walk" | "run" | "graze", "to_x": n | null}],
 "fx": [{"kind": "…", "x": n, "y": n, "scale": n, "at": seconds, "dur": seconds | null, "dir": 1 | -1, "color": "#hex", "n": count}],
 "camera": [{"at": seconds, "move": "wide" | "push" | "pull" | "pan_left" | "pan_right" | "focus" | "shake", "target": actor index, "zoom": 1.1..1.4}]}

THE PLACE — two SVG layers, viewBox="0 0 ${W} ${H}", flat 2D hand-drawn cartoon doodle: thick even black outlines (stroke="#1b1714", stroke-width 6–8, round caps and joins), flat solid fills, NO gradients, NO filters, NO text, NO <image>, NO <style>. Palette: ${args_palette}.
- "back": fills the WHOLE frame: sky, far hills or city silhouette, the main buildings / walls / tents / ships of the place, detailed and historically right for the era (no crosses on mosques, nothing modern). 60–140 elements.
- "front": a TRANSPARENT layer (no background rect) with only 1–3 foreground props at the left and right edges (bushes, rocks, barrels, a column, grass) that will slide faster than the rest; "" if nothing fits.
- NO people, NO human figures, NO faces, NO animals in the SVG: people and animals are animated on top by code. Keep the ground strip y=${g0}..${g1} flat and clear.

THE PEOPLE — 2–7 stick figures (the main one plus people who make the place feel lived-in: a guard, a trader, a child, a worker in the background at smaller scale), our rig (round white head, thin black body). x 0..${W}; y = their ground line ${g0}..${g1} (further = higher and smaller); scale 0.55..1.4 (1 = 232 px tall).
Choreography: "steps" is what the figure does over time, 2–4 steps, the first at 0 — nobody just stands still the whole shot; background people keep doing their own small business (work, drink, count, talk to each other). Actions: ${ACTION_NAMES.join(', ')}. walk, run, march and carry go to "to_x". Make it ALIVE: people react to each other and to what the voice says (a soldier salutes, then marches off; a merchant counts coins, then shrugs; a crowd cheers; two fighters exchange blows; someone falls — no blood). The main figure is in the middle third. Only the figure that speaks in this moment has "talking": true.
"hat": headwear for a head = circle radius 24 centred at (0,0), sitting on top, inside x -60..60 y -90..30, black outlines stroke-width 5, flat fills; "" = bare head. "item": what the hand holds, hand at (0,0), inside x -40..40 y -120..40; "" = empty hands. grip "upright" = spear/staff/banner/torch, "along" = sword/axe/hammer.
A figure with "rider": i sits on animals[i].

THE ANIMALS (optional) — drawn and moved by code: horse, camel, ox. Use them whenever the moment has cavalry, a caravan, a ploughman, a messenger. scale 0.6..1.2.

EFFECTS (at least ONE every shot — they make the scene alive): ${FX}. A battle gets arrows + sparks + dust + shake; a camp gets fire + smoke; a city gets flags + birds; a sea gets water.

CAMERA — 1–3 moves over the scene: start wide or push, then "focus" on the figure that matters (target = its index), "shake" only for battle or disaster.
${hero ? `\nTHE MAIN HERO is already designed (his clothes, headwear and item are added by code): give him "role": "hero", "hat": "", "item": "", "outfit": null; choose only his place, steps and mood. ${hero}` : ''}
${extra}${lessons ? `\nLESSONS FROM THE OWNER (follow strictly):\n${lessons}` : ''}`;
}

// the place alone, for the stronger model (the choreography goes to the fast model in parallel)
export function placePrompt({ text, idea, W, H, lessons = '', palette, look }) {
  const args_palette = palette || PALETTE;
  const g0 = Math.round(H * 0.74), g1 = Math.round(H * 0.93);
  return `You are the background artist of the Russian YouTube history channel «Историк» (flat 2D hand-drawn cartoon doodle, like a good picture book).
Draw the PLACE for this moment of the voice-over: «${text}»
Visual idea: ${idea}
Return ONE JSON object {"back": "<svg …>…</svg>", "front": "<svg …>…</svg>" | ""}.
"back": viewBox="0 0 ${W} ${H}", fills the WHOLE frame. Layers: sky (pale, at most ONE sun or moon, a few clouds), far background (hills, mountains or a city skyline), the middle ground with the MAIN subject of the place drawn large and recognisable with real historical detail (e.g. Vienna: massive stone bastions with crenellations, a gate, Gothic spires behind; Istanbul: domes and slim minarets; a steppe camp: felt yurts with smoke holes; a port: wooden ships with masts and sails), then the ground. DETAIL is what makes it beautiful: windows, doors, roof tiles, flags, lanterns, crates, plants, cracks, stones, carpets, pots — every surface gets small believable details and texture strokes, and the place reads clearly at a glance (one main subject, big shapes first, small details second). The ground strip y=${g0}..${g1} is flat, open and clear (figures stand there). Side props in the foreground (rocks, barrels, carts, plants) only at the far left and right.
"front": a TRANSPARENT layer (no background rect) with 1–3 foreground props at the very left and right edges that overlap the frame border (bushes, a column, a rock, tall grass); "" if nothing fits.
Style: thick even black outlines (stroke="#1b1714", stroke-width 6–8, stroke-linecap="round", stroke-linejoin="round"), flat solid fills, simple hatching strokes for texture (bricks, stones, wood planks, sand ripples), NO gradients, NO filters, NO text, NO <image>, NO <style>. Palette: ${args_palette}.${look ? ' ' + look : ''} 120–220 elements. NO people, NO human figures, NO animals (they are animated on top).${lessons ? `\nLESSONS FROM THE OWNER (follow strictly):\n${lessons}` : ''}`;
}

/* ---------------- SVG -> bitmaps (page side) ---------------- */
function clean(svg) {
  return String(svg || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<image[^>]*>/gi, '').replace(/\son\w+="[^"]*"/gi, '').replace(/(?:xlink:)?href="(?!#)[^"]*"/gi, '');
}
const asText = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? v.map(asText).join('') : v && typeof v === 'object' ? Object.values(v).map(asText).join('') : '');

async function svgBitmap(svg, w, h) {
  let s = clean(asText(svg)).trim();
  if (!/^<svg[\s>]/i.test(s)) return null;
  if (!/xmlns=/.test(s)) s = s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  s = s.replace(/^<svg([^>]*?)\swidth="[^"]*"/i, '<svg$1').replace(/^<svg([^>]*?)\sheight="[^"]*"/i, '<svg$1')
       .replace(/^<svg/i, `<svg width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"`);
  const url = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
    return await createImageBitmap(img, { resizeWidth: w, resizeHeight: h });
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}
const part = (frag, box, w, h) => {
  const s = asText(frag).replace(/^<svg[^>]*>|<\/svg>$/gi, '').trim();
  return s ? svgBitmap(`<svg viewBox="${box}">${s}</svg>`, w, h) : null;
};
const num = (v, d) => (Number.isFinite(+v) ? +v : d);

// spec (Gemini JSON) -> a scene anim.js can draw
export async function materialize(spec, W, H, heroParts = null) {
  const [back, front] = await Promise.all([svgBitmap(spec.back || spec.bg, Math.round(W * 1.06), Math.round(H * 1.06)), spec.front ? svgBitmap(spec.front, Math.round(W * 1.1), Math.round(H * 1.1)) : null]);
  const animals = (spec.animals || []).slice(0, 4).map((an) => ({ kind: an.kind, x: num(an.x, W / 2), y: num(an.y, H * 0.86), scale: Math.max(0.3, Math.min(1.6, num(an.scale, 1))), facing: an.facing < 0 ? -1 : 1, color: an.color, gait: an.gait || 'stand', to_x: an.to_x == null ? null : num(an.to_x, null) }));
  const actors = await Promise.all((spec.actors || []).slice(0, 7).map(async (a, i) => {
    const isHero = a.role === 'hero' && heroParts;
    const steps = (Array.isArray(a.steps) ? a.steps : []).slice(0, 5).map((s) => ({ at: num(s.at, 0), action: s.action, to_x: s.to_x == null ? null : num(s.to_x, null), mood: s.mood, facing: s.facing }));
    return {
      x: num(a.x, W / 2), y: num(a.y, H * 0.85), scale: Math.max(0.3, Math.min(3, num(a.scale, 1))), facing: a.facing < 0 ? -1 : 1,
      action: a.action || steps[0]?.action || 'idle', to_x: a.to_x == null ? null : num(a.to_x, null), mood: a.mood || steps[0]?.mood, steps, talking: !!a.talking, phase: i * 0.37,
      rider: a.rider == null || !animals[a.rider] ? null : a.rider,
      outfit: isHero ? heroParts.outfit : a.outfit, grip: isHero ? heroParts.grip : a.grip, hand: isHero ? heroParts.hand : a.hand,
      hat: isHero ? heroParts.hat : await part(a.hat, HAT_BOX, 240, 240),
      item: isHero ? heroParts.item : await part(a.item, ITEM_BOX, 160, 320),
    };
  }));
  const fx = (spec.fx || []).slice(0, 8).map((f) => ({ ...f, x: num(f.x, W / 2), y: num(f.y, H / 2), scale: num(f.scale, 1) }));
  return { back, front, actors, animals, fx, camera: spec.camera, weather: spec.weather, seed: (Math.random() * 1000) | 0, w: W, ok: !!back };
}

export async function heroParts(spec) {
  return { outfit: spec.outfit, grip: spec.grip, hand: spec.hand, hat: await part(spec.hat, HAT_BOX, 240, 240), item: await part(spec.item, ITEM_BOX, 160, 320) };
}

// the place: the stronger model draws it; if it is slow (busy), the fast model starts too and the first good answer wins
async function place(args, { signal, onWait }) {
  const strong = AI.json(placePrompt(args), { fast: false, think: 'minimal', temperature: 0.9, signal, onWait }).catch(() => null);
  const fallback = new Promise((ok) => setTimeout(ok, 30000)).then(() => AI.json(placePrompt(args), { fast: true, temperature: 0.9, signal, onWait })).catch(() => null);
  const first = await Promise.race([strong, fallback.then((r) => r || strong)]);
  return first || (await strong) || (await fallback);
}

// a scene: the place and the choreography are asked in parallel, then turned into bitmaps
export async function makeScene(args, { signal, onWait, heroParts: hp } = {}) {
  for (let a = 0; a < 2; a++) {
    const [bg, stage] = await Promise.all([
      place(args, { signal, onWait }),
      AI.json(scenePrompt({ ...args, extra: (args.extra || '') + '\nThe PLACE is drawn by another artist: return "back": "" and "front": "".' }), { fast: true, temperature: 0.9, signal, onWait }),
    ]);
    const spec = { ...stage, back: bg?.back || stage.back, front: bg?.front || '' };
    const sc = await materialize(spec, args.W, args.H, hp);
    if (sc.ok) return { spec, scene: sc };
  }
  throw new Error('Gemini дважды нарисовал фон, который не открывается');
}
