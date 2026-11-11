// The 3D cartoon world, rendered by the phone's graphics chip (three.js / WebGL) inside the montage thread.
// Gemini never draws pixels here: it writes a "production bible" (cast, sets, shots) and this file builds it:
//  - sets: ground + sky + light for the time of day + objects from a big kit (houses, stadiums, ships, rooms…)
//  - cast: bean-head characters (bean.js) as standing cards that always face the camera, with faces that talk and blink
//  - shots: who stands where, what they do, how the camera moves (wide / medium / close / insert, push, orbit, crane…)
// Toon shading with two light steps, ink outlines (inverted hulls), fog = horizon, painted canvas textures.
import * as T from '../vendor/three.mjs';
import { drawBean, CARD_W, CARD_H } from './bean.js';

const TAU = Math.PI * 2;
const INK = 0x2b1b2e;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (u) => { u = clamp(u); return u * u * u * (u * (u * 6 - 15) + 10); };
const lerp = (a, b, u) => a + (b - a) * u;
function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const hashStr = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const col = (c, d) => { try { return new T.Color(c || d); } catch { return new T.Color(d); } };

/* ---------------- materials ---------------- */
let GRAD = null, INKMAT = null;
const matCache = new Map();
function gradient() {
  if (GRAD) return GRAD;
  GRAD = new T.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, T.RedFormat);
  GRAD.minFilter = GRAD.magFilter = T.NearestFilter; GRAD.needsUpdate = true; return GRAD;
}
function toon(color, map = null, extra = {}) {
  const key = `${color}|${map?.uuid || ''}|${JSON.stringify(extra)}`;
  if (!matCache.has(key)) matCache.set(key, new T.MeshToonMaterial({ color: col(color, '#bbbbbb'), map, gradientMap: gradient(), ...extra }));
  return matCache.get(key);
}
function inkMat() { return INKMAT || (INKMAT = new T.MeshBasicMaterial({ color: INK, side: T.BackSide })); }

/* ---------------- painted textures (flat colour with dark seams, like a painted set) ---------------- */
const texCache = new Map();
export function paint(kind, base = '#888888', text = '', aspect = 1) {
  const A = Math.max(0.25, Math.min(4, +aspect || 1)), key = `${kind}|${base}|${text}|${A.toFixed(2)}`;
  if (texCache.has(key)) return texCache.get(key);
  // writing gets a canvas of the sign's own shape, so letters are never stretched or cut
  const S = 256, LW = kind === 'label' ? Math.round(S * Math.max(1, A)) : S, LH = kind === 'label' ? Math.round(S / Math.min(1, A)) : S;
  const c = new OffscreenCanvas(LW, LH), g = c.getContext('2d'), r = rng(hashStr(key));
  const b = col(base, '#888888'), hex = `#${b.getHexString()}`;
  const tint = (k) => { const x = b.clone(); x.offsetHSL(0, 0, k); return `#${x.getHexString()}`; };
  g.fillStyle = hex; g.fillRect(0, 0, S, S);
  if (kind === 'grass' || kind === 'field') {
    if (kind === 'field') { g.fillStyle = tint(0.04); g.fillRect(0, 0, S, S / 2); }
    for (let i = 0; i < 900; i++) { g.strokeStyle = r() < 0.5 ? tint(-0.07) : tint(0.06); g.lineWidth = 1.5; const x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 5); g.stroke(); }
  } else if (kind === 'sand' || kind === 'dirt' || kind === 'snow' || kind === 'moon') {
    for (let i = 0; i < 700; i++) { g.fillStyle = r() < 0.5 ? tint(-0.05) : tint(0.05); g.beginPath(); g.arc(r() * S, r() * S, 0.6 + r() * (kind === 'moon' ? 9 : 2.2), 0, TAU); g.fill(); }
  } else if (kind === 'wood' || kind === 'planks') {
    const n = 6; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? tint(0.03) : tint(-0.02); g.fillRect(0, i * S / n, S, S / n); g.fillStyle = tint(-0.2); g.fillRect(0, i * S / n, S, 3); for (let k = 0; k < 6; k++) { g.strokeStyle = tint(-0.08); g.lineWidth = 1; g.beginPath(); const y = i * S / n + 6 + r() * (S / n - 10); g.moveTo(0, y); g.bezierCurveTo(S * 0.3, y + 3, S * 0.6, y - 3, S, y); g.stroke(); } g.fillRect((r() * S) | 0, i * S / n, 3, S / n); }
  } else if (kind === 'stone' || kind === 'cobble') {
    for (let y = 0; y < S; y += 32) for (let x = (y / 32) % 2 ? -20 : 0; x < S; x += 42) { g.fillStyle = tint((r() - 0.5) * 0.1); g.beginPath(); g.roundRect ? g.roundRect(x + 2, y + 2, 38, 28, 8) : g.rect(x + 2, y + 2, 38, 28); g.fill(); g.strokeStyle = tint(-0.22); g.lineWidth = 2.5; g.stroke(); }
  } else if (kind === 'brick') {
    for (let y = 0; y < S; y += 22) for (let x = (y / 22) % 2 ? -24 : 0; x < S; x += 48) { g.fillStyle = tint((r() - 0.5) * 0.08); g.fillRect(x + 2, y + 2, 44, 18); }
  } else if (kind === 'roof') {
    for (let y = 0; y < S; y += 26) for (let x = (y / 26) % 2 ? -16 : 0; x < S; x += 32) { g.fillStyle = tint((r() - 0.5) * 0.08); g.beginPath(); g.arc(x + 16, y + 6, 16, 0, Math.PI); g.fill(); g.strokeStyle = tint(-0.25); g.lineWidth = 2; g.stroke(); }
  } else if (kind === 'tiles' || kind === 'floor') {
    for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 64) { g.fillStyle = (x + y) / 64 % 2 ? tint(0.05) : tint(-0.04); g.fillRect(x, y, 64, 64); g.strokeStyle = tint(-0.2); g.strokeRect(x, y, 64, 64); }
  } else if (kind === 'road') {
    for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? tint(-0.04) : tint(0.04); g.fillRect(r() * S, r() * S, 2, 2); }
  } else if (kind === 'water') {
    g.strokeStyle = tint(0.18); g.lineWidth = 3; for (let i = 0; i < 14; i++) { const y = r() * S, x = r() * S; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 20, y - 6, x + 40, y); g.stroke(); }
  } else if (kind === 'plaster') {
    for (let i = 0; i < 40; i++) { g.fillStyle = tint((r() - 0.5) * 0.06); g.beginPath(); g.arc(r() * S, r() * S, 10 + r() * 30, 0, TAU); g.fill(); }
  } else if (kind === 'windows') {                                         // a city facade
    for (let y = 10; y < S; y += 42) for (let x = 12; x < S; x += 40) { g.fillStyle = r() < 0.45 ? '#ffd27a' : tint(-0.25); g.fillRect(x, y, 24, 28); }
  } else if (kind === 'crowd') {
    g.fillStyle = '#2a2d38'; g.fillRect(0, 0, S, S);
    for (let row = 0; row < 4; row++) for (let i = 0; i < 9; i++) {
      const x = 14 + i * 28 + (row % 2) * 14, y = 40 + row * 62, sk = ['#f5c9a0', '#c99067', '#8d5a3b', '#ecd0b6'][(r() * 4) | 0];
      g.fillStyle = `hsl(${[210, 0, 45, 120, 280][(r() * 5) | 0]},65%,${45 + r() * 15}%)`; g.beginPath(); g.ellipse(x, y + 18, 11, 16, 0, 0, TAU); g.fill();
      g.fillStyle = sk; g.beginPath(); g.ellipse(x, y - 4, 9, 11, 0, 0, TAU); g.fill();
      if (r() < 0.35) { g.strokeStyle = sk; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 9, y + 10); g.lineTo(x - 15, y - 14); g.stroke(); }
    }
  } else if (kind === 'stars') {
    g.fillStyle = '#05060f'; g.fillRect(0, 0, S, S); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`; g.fillRect(r() * S, r() * S, 1.5, 1.5); }
  } else if (kind === 'label') {                                           // writing on a sign, a screen, a newspaper
    g.fillStyle = hex; g.fillRect(0, 0, LW, LH); g.fillStyle = col(base, '#888').getHSL({}).l > 0.5 ? '#2b1b2e' : '#ffffff';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const { fs, lines } = fitText(g, text, LW - 28, LH - 24);
    g.font = `bold ${fs}px sans-serif`;
    lines.forEach((l, i) => g.fillText(l, LW / 2, LH / 2 + (i - (lines.length - 1) / 2) * fs * 1.15));
  }
  const tx = new T.CanvasTexture(c); tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 2;
  texCache.set(key, tx); return tx;
}

// the biggest font at which the words, wrapped, fit the box (no line wider than the box, no line cut off)
export function fitText(g, text, w, h) {
  const words = String(text).split(/\s+/).filter(Boolean);
  for (let fs = 110; fs > 8; fs -= 2) {
    g.font = `bold ${fs}px sans-serif`;
    const lines = []; let cur = '';
    for (const wd of words) { const t2 = cur ? cur + ' ' + wd : wd; if (g.measureText(t2).width > w && cur) { lines.push(cur); cur = wd; } else cur = t2; }
    if (cur) lines.push(cur);
    if (lines.length * fs * 1.15 <= h && lines.every((l) => g.measureText(l).width <= w)) return { fs, lines };
  }
  return { fs: 8, lines: [words.join(' ')] };
}

// small things keep their real size whatever size the plan asks for (a football is never as big as a man)
const REAL = { ball: { w: 0.11 }, trophy: { w: 0.42 } };
export const realSize = (o) => (REAL[o.type] ? { ...o, ...REAL[o.type], scale: 1, h: undefined } : o);

/* ---------------- building blocks ---------------- */
function add(parent, geo, color, x = 0, y = 0, z = 0, o = {}) {
  const m = new T.Mesh(geo, o.mat || toon(color, o.map || null, o.emissive ? { emissive: col(o.emissive, '#000'), emissiveIntensity: o.glow ?? 1 } : {}));
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
  m.castShadow = o.shadow !== false; m.receiveShadow = true;
  if (o.ink !== false) {
    geo.computeBoundingBox(); const s = new T.Vector3(); geo.boundingBox.getSize(s);
    const w = o.inkW ?? 0.035, h = new T.Mesh(geo, inkMat());
    h.scale.set(1 + (2 * w) / Math.max(s.x, 0.04), 1 + (2 * w) / Math.max(s.y, 0.04), 1 + (2 * w) / Math.max(s.z, 0.04));
    h.castShadow = false; h.receiveShadow = false; m.add(h);
  }
  parent.add(m); return m;
}
const box = (w, h, d) => new T.BoxGeometry(w, h, d);
const cyl = (r1, r2, h, n = 16) => new T.CylinderGeometry(r1, r2, h, n);
const cone = (r, h, n = 16) => new T.ConeGeometry(r, h, n);
const ball = (r, d = 1) => new T.IcosahedronGeometry(r, d);
function gable(w, h, d) {                                                   // a triangular roof, centred on its base
  const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g;
}
function label(parent, text, w, h, x, y, z, o = {}) {
  const tx = paint('label', o.color || '#f6efdc', text, w / h);
  return add(parent, new T.PlaneGeometry(w, h), '#ffffff', x, y, z, { map: tx, ink: false, ry: o.ry || 0, shadow: false, mat: new T.MeshBasicMaterial({ map: tx }) });
}

/* ---------------- the kit: anything a story needs ---------------- */
// every builder gets the object spec (o) and a group to fill; sizes are in metres; a person is ~1.7 m
const ticks = [];                                                           // things that move by themselves (water, flags, fire)
const KIT = {
  house(g, o) {
    const w = o.w || 4, d = o.d || 4, h = o.h || 3, wall = o.color || '#efe2c6', roof = o.color2 || '#c6582f';
    add(g, box(w, h, d), wall, 0, h / 2, 0, { map: paint('plaster', wall) });
    add(g, gable(w + 0.5, h * 0.55, d + 0.5), roof, 0, h, 0, { map: paint('roof', roof) });
    add(g, box(0.9, 1.7, 0.12), '#6b4129', 0, 0.85, d / 2 + 0.03);
    for (const sx of [-1, 1]) add(g, box(0.8, 0.8, 0.1), o.lit ? '#ffd27a' : '#7fb3d9', sx * w * 0.28, h * 0.62, d / 2 + 0.03, o.lit ? { emissive: '#ffb84a', glow: 0.8 } : {});
    add(g, box(0.5, 1.2, 0.5), '#8a6a5a', w * 0.28, h + h * 0.4, 0, { map: paint('brick', '#9a6a5a') });
  },
  hut(g, o) { const r = o.w || 2; add(g, cyl(r, r, 2.2, 10), o.color || '#c8a56a', 0, 1.1, 0, { map: paint('wood', o.color || '#c8a56a') }); add(g, cone(r * 1.35, 2, 10), o.color2 || '#a8823e', 0, 3.2, 0); add(g, box(0.8, 1.5, 0.1), '#4a2f1e', 0, 0.75, r); },
  tower(g, o) { const h = o.h || 8, r = o.w || 1.4; add(g, cyl(r, r * 1.1, h, 14), o.color || '#c9c2b0', 0, h / 2, 0, { map: paint('stone', o.color || '#c9c2b0') }); add(g, cone(r * 1.35, r * 2, 14), o.color2 || '#b8322f', 0, h + r, 0); add(g, box(0.5, 0.9, 0.1), '#1e1a24', 0, h * 0.7, r + 0.02); },
  castle(g, o) {
    const s = o.w || 10, c1 = o.color || '#c9c2b0';
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const t = new T.Group(); KIT.tower(t, { h: 9, w: 1.6, color: c1, color2: o.color2 }); t.position.set(x * s / 2, 0, z * s / 2); g.add(t); }
    for (const [x, z, ry] of [[0, -s / 2, 0], [0, s / 2, 0], [-s / 2, 0, Math.PI / 2], [s / 2, 0, Math.PI / 2]]) { const wl = new T.Group(); KIT.wall(wl, { len: s, h: 6, color: c1 }); wl.position.set(x, 0, z); wl.rotation.y = ry; g.add(wl); }
    add(g, box(2.4, 3.4, 0.4), '#3a2414', 0, 1.7, s / 2 + 0.3, { map: paint('wood', '#5a3b2a') });
  },
  wall(g, o) { const L = o.len || o.w || 8, h = o.h || 3; add(g, box(L, h, 0.8), o.color || '#c9c2b0', 0, h / 2, 0, { map: paint('stone', o.color || '#c9c2b0') }); for (let x = -L / 2 + 0.4; x < L / 2; x += 1.2) add(g, box(0.6, 0.6, 0.8), o.color || '#c9c2b0', x, h + 0.3, 0, { map: paint('stone', o.color || '#c9c2b0') }); },
  fence(g, o) { const L = o.len || o.w || 6; for (let x = -L / 2; x <= L / 2 + 0.01; x += 1.5) add(g, box(0.12, 1.1, 0.12), o.color || '#8a5a3b', x, 0.55, 0); for (const y of [0.4, 0.85]) add(g, box(L, 0.1, 0.06), o.color || '#8a5a3b', 0, y, 0); },
  bridge(g, o) {
    const L = o.len || 10, h = o.h || 1.4, wd = o.w || 2.4, c = o.color || '#a8784a';
    add(g, box(L, 0.22, wd), c, 0, h, 0, { map: paint('planks', c) });
    for (const z of [-wd / 2, wd / 2]) { add(g, box(L, 0.08, 0.08), c, 0, h + 0.95, z); for (let x = -L / 2; x <= L / 2 + 0.01; x += 1.6) { add(g, box(0.12, 0.95, 0.12), c, x, h + 0.5, z); add(g, cyl(0.12, 0.14, h + 1.5, 8), shadeHex(c, -0.15), x, (h - 1.5) / 2, z); } }
  },
  tree(g, o) { const h = o.h || 3; add(g, cyl(0.16, 0.24, h * 0.55, 8), '#7a4a2a', 0, h * 0.27, 0); const c = o.color || '#4f9a3f'; for (const [x, y, z, r] of [[0, 0.78, 0, 0.42], [0.32, 0.62, 0.1, 0.3], [-0.3, 0.64, -0.08, 0.3]]) add(g, ball(h * r, 0), c, x * h, y * h, z * h, { inkW: 0.05 }); },
  pine(g, o) { const h = o.h || 4; add(g, cyl(0.12, 0.18, h * 0.3, 8), '#6a3f22', 0, h * 0.15, 0); for (let i = 0; i < 3; i++) add(g, cone(h * (0.32 - i * 0.07), h * 0.38, 9), o.color || '#2f6f4a', 0, h * (0.36 + i * 0.2), 0); },
  palm(g, o) { const h = o.h || 5; for (let i = 0; i < 6; i++) add(g, cyl(0.16, 0.2, h / 6, 8), '#9a7448', Math.sin(i * 0.3) * 0.3 * i / 2, h / 12 + (i * h) / 6, 0, { rz: -0.08 * i }); for (let i = 0; i < 6; i++) add(g, new T.SphereGeometry(1.4, 8, 4), o.color || '#3f9a4a', 0.9 + Math.cos((i * TAU) / 6) * 1.2, h + 0.1, Math.sin((i * TAU) / 6) * 1.2, { ry: (i * TAU) / 6 }).scale.set(1, 0.18, 0.4); },
  bush(g, o) { const r = o.w || 0.8; add(g, ball(r, 0), o.color || '#4a8f3a', 0, r * 0.7, 0); add(g, ball(r * 0.7, 0), o.color || '#4a8f3a', r * 0.8, r * 0.5, 0.2); },
  flowers(g, o) { const r = rng(7); for (let i = 0; i < 18; i++) { const x = (r() - 0.5) * (o.w || 3), z = (r() - 0.5) * (o.w || 3); add(g, cyl(0.02, 0.02, 0.4, 4), '#3f7f3a', x, 0.2, z, { ink: false }); add(g, ball(0.09, 0), ['#e8435a', '#f6d55c', '#ffffff', '#b06ab3'][i % 4], x, 0.42, z, { ink: false }); } },
  hill(g, o) { const r = o.w || 8; const m = add(g, new T.SphereGeometry(r, 24, 12, 0, TAU, 0, Math.PI / 2), o.color || '#6db04f', 0, 0, 0, { map: paint('grass', o.color || '#6db04f'), inkW: 0.08 }); m.scale.y = (o.h || r * 0.35) / r; },
  mountain(g, o) { const h = o.h || 12, r = o.w || 9; add(g, cone(r, h, 9), o.color || '#7d7a8a', 0, h / 2, 0, { map: paint('stone', o.color || '#7d7a8a'), inkW: 0.1 }); add(g, cone(r * 0.32, h * 0.32, 9), '#f4f6fb', 0, h * 0.84, 0, { inkW: 0.06 }); },
  rock(g, o) { const r = o.w || 0.8; add(g, new T.DodecahedronGeometry(r, 0), o.color || '#8a8a92', 0, r * 0.6, 0).scale.y = 0.7; },
  water(g, o) {
    const w = o.w || 30, d = o.d || 30, tx = paint('water', o.color || '#3c8fd0').clone(); tx.needsUpdate = true; tx.repeat.set(w / 6, d / 6);
    add(g, new T.PlaneGeometry(w, d), o.color || '#3c8fd0', 0, 0.03, 0, { rx: -Math.PI / 2, map: tx, ink: false, shadow: false });
    ticks.push((t) => { tx.offset.set(t * 0.03, t * 0.015); });
  },
  boat(g, o) {
    const c = o.color || '#8a4a2a', L = o.len || 4;
    add(g, box(L, 0.7, 1.4), c, 0, 0.35, 0, { map: paint('planks', c) }); add(g, cone(0.75, 1.2, 4), c, L / 2 + 0.5, 0.35, 0, { rz: -Math.PI / 2, ry: Math.PI / 4 });
    if (o.sail !== false) { add(g, cyl(0.06, 0.06, 3.6, 6), '#5a3b2a', 0, 2.2, 0); add(g, new T.PlaneGeometry(1.8, 2.6), o.color2 || '#f4ecd8', 0.95, 2.4, 0, { ink: false, mat: new T.MeshToonMaterial({ color: col(o.color2, '#f4ecd8'), gradientMap: gradient(), side: T.DoubleSide }) }); }
    ticks.push((t) => { g.rotation.z = Math.sin(t * 1.3) * 0.04; g.position.y = (o.y || 0) + Math.sin(t * 1.7) * 0.06; });
  },
  ship(g, o) { const s = o.scale || 1; KIT.boat(g, { ...o, len: 9 }); for (const x of [-2.5, 2.5]) { add(g, cyl(0.1, 0.1, 6, 6), '#5a3b2a', x, 3.5, 0); add(g, new T.PlaneGeometry(3, 3.6), '#f4ecd8', x, 4, 0, { ink: false, mat: new T.MeshToonMaterial({ color: '#f4ecd8', gradientMap: gradient(), side: T.DoubleSide }) }); } void s; },
  table(g, o) { const w = o.w || 1.8; add(g, box(w, 0.1, w * 0.6), o.color || '#9a6a3a', 0, 0.8, 0, { map: paint('wood', o.color || '#9a6a3a') }); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(g, box(0.08, 0.8, 0.08), o.color || '#9a6a3a', x * (w / 2 - 0.1), 0.4, z * (w * 0.3 - 0.1)); },
  desk(g, o) { KIT.table(g, { ...o, w: o.w || 2 }); add(g, box(0.9, 0.55, 0.06), '#2b2b33', 0, 1.15, -0.25); add(g, new T.PlaneGeometry(0.8, 0.46), '#7fd3ff', 0, 1.15, -0.21, { ink: false, mat: new T.MeshBasicMaterial({ map: paint('label', '#1d2a44', o.text || '', 0.8 / 0.46) }) }); },
  chair(g, o) { add(g, box(0.5, 0.08, 0.5), o.color || '#8a5a3b', 0, 0.48, 0); add(g, box(0.5, 0.6, 0.06), o.color || '#8a5a3b', 0, 0.8, -0.22); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(g, box(0.05, 0.48, 0.05), o.color || '#8a5a3b', x * 0.2, 0.24, z * 0.2); },
  bed(g, o) { add(g, box(1.6, 0.4, 2.2), o.color || '#7a4a2a', 0, 0.3, 0); add(g, box(1.5, 0.15, 2.1), o.color2 || '#e8e2f2', 0, 0.55, 0); add(g, box(0.9, 0.18, 0.4), '#ffffff', 0, 0.7, -0.8); },
  throne(g, o) { add(g, box(1.2, 0.5, 1), o.color || '#b8322f', 0, 0.25, 0); add(g, box(1.2, 2.2, 0.25), o.color2 || '#d9a845', 0, 1.1, -0.5); },
  crate(g, o) { const s = o.w || 0.9; add(g, box(s, s, s), o.color || '#b88a4a', 0, s / 2, 0, { map: paint('planks', o.color || '#b88a4a') }); },
  barrel(g, o) { add(g, cyl(0.4, 0.45, 1, 12), o.color || '#9a6a3a', 0, 0.5, 0, { map: paint('planks', o.color || '#9a6a3a') }); },
  lamp(g, o) { add(g, cyl(0.06, 0.08, 3.2, 8), '#2b2b33', 0, 1.6, 0); add(g, ball(0.25, 1), '#fff2c4', 0, 3.3, 0, { emissive: '#ffd27a', glow: 1.2, ink: false }); const L = new T.PointLight(0xffd27a, 4, 9, 2); L.position.set(0, 3.2, 0); g.add(L); },
  sign(g, o) { add(g, box(0.1, 1.6, 0.1), '#6b4129', 0, 0.8, 0); add(g, box(1.8, 1, 0.08), o.color || '#c9a06a', 0, 1.7, 0, { map: paint('planks', o.color || '#c9a06a') }); if (o.text) label(g, o.text, 1.6, 0.85, 0, 1.7, 0.05, { color: o.color || '#e9d7a8' }); },
  board(g, o) { add(g, box(o.w || 3, o.h || 2, 0.1), '#2b2b33', 0, (o.h || 2) / 2 + 0.8, 0); label(g, o.text || '', (o.w || 3) - 0.2, (o.h || 2) - 0.2, 0, (o.h || 2) / 2 + 0.8, 0.06, { color: o.color || '#2d4a3a' }); add(g, box(0.1, 0.8, 0.1), '#2b2b33', 0, 0.4, 0); },
  screen(g, o) { const w = o.w || 3, h = o.h || 1.8; add(g, box(w + 0.2, h + 0.2, 0.15), '#1d1d24', 0, h / 2 + 1, 0); label(g, o.text || '', w, h, 0, h / 2 + 1, 0.09, { color: o.color || '#1d3a6a' }); },
  paper(g, o) { label(g, o.text || '', o.w || 1.2, (o.w || 1.2) * 1.3, 0, 0.02, 0, { color: o.color || '#f2ead6' }).rotation.x = -Math.PI / 2; },
  column(g, o) { const h = o.h || 4; add(g, cyl(0.35, 0.4, h, 14), o.color || '#e8e2d2', 0, h / 2, 0); add(g, box(1, 0.3, 1), o.color || '#e8e2d2', 0, h + 0.15, 0); add(g, box(1, 0.3, 1), o.color || '#e8e2d2', 0, 0.15, 0); },
  temple(g, o) { const w = o.w || 8, c = o.color || '#ece4d2'; add(g, box(w, 0.8, w * 0.6), c, 0, 0.4, 0); for (let i = 0; i < 6; i++) { const t2 = new T.Group(); KIT.column(t2, { h: 4, color: c }); t2.position.set(-w / 2 + 0.7 + (i * (w - 1.4)) / 5, 0.8, w * 0.25); g.add(t2); } add(g, box(w, 0.6, w * 0.6), c, 0, 5.3, 0); add(g, gable(w + 0.2, 1.4, w * 0.6), c, 0, 5.6, 0); },
  pyramid(g, o) { const s = o.w || 12; add(g, cone(s * 0.72, s * 0.65, 4), o.color || '#e2c27a', 0, s * 0.325, 0, { ry: Math.PI / 4, map: paint('stone', o.color || '#e2c27a'), inkW: 0.1 }); },
  tent(g, o) { add(g, cone(o.w || 2, 2.6, 6), o.color || '#e8d6b0', 0, 1.3, 0, { map: paint('plaster', o.color || '#e8d6b0') }); },
  car(g, o) { const c = o.color || '#d2372f'; add(g, box(3.8, 0.8, 1.7), c, 0, 0.7, 0); add(g, box(2, 0.7, 1.5), c, -0.2, 1.4, 0); add(g, box(1.9, 0.5, 1.52), '#9fd3e8', -0.2, 1.42, 0, { ink: false }); for (const [x, z] of [[-1.2, -0.85], [1.2, -0.85], [-1.2, 0.85], [1.2, 0.85]]) add(g, cyl(0.38, 0.38, 0.3, 14), '#1d1d24', x, 0.38, z, { rx: Math.PI / 2 }); },
  bus(g, o) { add(g, box(8, 2.6, 2.4), o.color || '#f2c230', 0, 1.7, 0); add(g, box(7.6, 0.8, 2.42), '#9fd3e8', 0, 2.2, 0, { ink: false }); for (const x of [-2.8, 2.8]) for (const z of [-1.1, 1.1]) add(g, cyl(0.5, 0.5, 0.3, 14), '#1d1d24', x, 0.5, z, { rx: Math.PI / 2 }); },
  building(g, o) { const w = o.w || 6, h = o.h || 14, d = o.d || 6; add(g, box(w, h, d), o.color || '#7a8aa8', 0, h / 2, 0, { map: (() => { const t2 = paint('windows', o.color || '#7a8aa8').clone(); t2.needsUpdate = true; t2.repeat.set(w / 4, h / 4); return t2; })() }); add(g, box(w + 0.3, 0.4, d + 0.3), shadeHex(o.color || '#7a8aa8', -0.2), 0, h + 0.2, 0); },
  skyscraper(g, o) { KIT.building(g, { ...o, h: o.h || 34, w: o.w || 7, d: o.d || 7 }); },
  stadium(g, o) {
    const R = o.w || 22, c = o.color || '#c9ced6';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, sg = new T.Group(); sg.position.set(Math.cos(a) * R, 0, Math.sin(a) * R * 0.75); sg.lookAt(0, 0, 0);
      for (let k = 0; k < 4; k++) add(sg, box(9, 1.2, 1.6), k % 2 ? c : shadeHex(c, -0.1), 0, 0.6 + k * 1.2, -k * 1.5, { map: paint('crowd', '#3a3f4a'), inkW: 0.05 });
      g.add(sg);
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const fl = new T.Group(); KIT.floodlight(fl, {}); fl.position.set(sx * R * 0.85, 0, sz * R * 0.6); fl.lookAt(0, 0, 0); g.add(fl); }
  },
  goal(g, o) { const w = o.w || 7.3; for (const x of [-w / 2, w / 2]) add(g, cyl(0.07, 0.07, 2.44, 8), '#ffffff', x, 1.22, 0); add(g, cyl(0.07, 0.07, w, 8), '#ffffff', 0, 2.44, 0, { rz: Math.PI / 2 }); add(g, new T.PlaneGeometry(w, 2.44), '#ffffff', 0, 1.22, -1.2, { ink: false, mat: new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: T.DoubleSide }) }); },
  ball(g, o) { const r = o.w || 0.22; add(g, ball(r, 1), o.color || '#ffffff', 0, r, 0, { inkW: 0.012 }); },
  trophy(g, o) { const s = o.w || 1; add(g, cyl(0.25 * s, 0.32 * s, 0.25 * s, 12), '#5a3b2a', 0, 0.12 * s, 0); add(g, cyl(0.05 * s, 0.05 * s, 0.35 * s, 8), '#f2c230', 0, 0.42 * s, 0); add(g, cyl(0.32 * s, 0.12 * s, 0.45 * s, 16), '#f2c230', 0, 0.8 * s, 0, { emissive: '#7a5a10', glow: 0.4 }); },
  podium(g, o) { for (const [x, h, n] of [[0, 1.2, '1'], [-1.6, 0.8, '2'], [1.6, 0.5, '3']]) { add(g, box(1.5, h, 1.5), o.color || '#e8e2f2', x, h / 2, 0); label(g, n, 0.8, 0.5, x, h * 0.55, 0.76, { color: o.color || '#e8e2f2' }); } },
  bookshelf(g, o) { add(g, box(2, 2.4, 0.5), '#7a4a2a', 0, 1.2, 0); const r = rng(3); for (let y = 0; y < 3; y++) for (let i = 0; i < 9; i++) add(g, box(0.16, 0.5, 0.35), ['#c8573d', '#e3b13c', '#4d7fc4', '#6aa56a', '#b06ab3'][(i + y) % 5], -0.85 + i * 0.21, 0.5 + y * 0.75 + r() * 0.02, 0.05, { ink: false }); },
  computer(g, o) { KIT.desk(g, o); },
  cannon(g, o) { add(g, cyl(0.25, 0.35, 2.4, 12), '#3a3a42', 0, 0.9, 0, { rx: -Math.PI / 2 + 0.3 }); for (const z of [-0.4, 0.4]) add(g, cyl(0.5, 0.5, 0.15, 14), '#6b4129', 0, 0.5, z, { rx: Math.PI / 2 }); },
  flag(g, o) { add(g, cyl(0.05, 0.05, o.h || 5, 6), '#d8dde6', 0, (o.h || 5) / 2, 0); const f = add(g, new T.PlaneGeometry(1.8, 1.1, 8, 1), o.color || '#d2372f', 0.95, (o.h || 5) - 0.6, 0, { ink: false, mat: new T.MeshToonMaterial({ color: col(o.color, '#d2372f'), gradientMap: gradient(), side: T.DoubleSide }) }); const pos = f.geometry.attributes.position, base = pos.array.slice(); ticks.push((t) => { for (let i = 0; i < pos.count; i++) { const x = base[i * 3]; pos.array[i * 3 + 2] = Math.sin(t * 5 + x * 3) * 0.12 * (x + 0.9); } pos.needsUpdate = true; }); },
  campfire(g, o) { for (let i = 0; i < 4; i++) add(g, cyl(0.08, 0.08, 1, 6), '#6b4129', 0, 0.12, 0, { rz: Math.PI / 2, ry: (i * Math.PI) / 4 }); const fl = add(g, cone(0.35, 0.9, 7), '#ffb03a', 0, 0.55, 0, { emissive: '#ff8a20', glow: 1.5, ink: false }); const L = new T.PointLight(0xff9a40, 6, 8, 2); L.position.set(0, 1, 0); g.add(L); ticks.push((t) => { const k = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.7); fl.scale.set(k, 0.8 + 0.3 * k, k); L.intensity = 5 * k; }); },
  statue(g, o) { add(g, box(1.2, 1, 1.2), '#bfb8a8', 0, 0.5, 0); add(g, cyl(0.35, 0.45, 1.6, 10), o.color || '#9aa3a8', 0, 1.8, 0); add(g, ball(0.45, 1), o.color || '#9aa3a8', 0, 2.95, 0); },
  gate(g, o) { const w = o.w || 4; for (const x of [-w / 2, w / 2]) add(g, box(0.8, 4, 0.8), o.color || '#c9c2b0', x, 2, 0, { map: paint('stone', o.color || '#c9c2b0') }); add(g, box(w + 0.8, 0.8, 0.8), o.color || '#c9c2b0', 0, 4.4, 0, { map: paint('stone', o.color || '#c9c2b0') }); },
  well(g) { add(g, cyl(0.8, 0.8, 0.8, 14), '#c9c2b0', 0, 0.4, 0, { map: paint('stone', '#c9c2b0') }); for (const x of [-0.7, 0.7]) add(g, box(0.1, 1.6, 0.1), '#6b4129', x, 1.2, 0); add(g, gable(1.8, 0.6, 1), '#b8322f', 0, 2, 0); },
  cart(g, o) { add(g, box(2.2, 0.6, 1.2), o.color || '#9a6a3a', 0, 0.9, 0, { map: paint('planks', o.color || '#9a6a3a') }); for (const z of [-0.7, 0.7]) add(g, cyl(0.55, 0.55, 0.1, 12), '#6b4129', 0, 0.55, z, { rx: Math.PI / 2 }); },
  rocket(g, o) { add(g, cyl(0.8, 0.8, 7, 16), o.color || '#f4f4f4', 0, 4.5, 0); add(g, cone(0.8, 2, 16), '#d2372f', 0, 9, 0); for (let i = 0; i < 3; i++) add(g, box(0.1, 1.6, 1.2), '#d2372f', Math.cos((i * TAU) / 3) * 0.9, 1.6, Math.sin((i * TAU) / 3) * 0.9, { ry: (-i * TAU) / 3 }); add(g, ball(0.35, 1), '#7fd3ff', 0, 6.5, 0.75, { ink: false }); },
  plane(g, o) { add(g, cyl(0.5, 0.4, 7, 12), o.color || '#f4f4f4', 0, 2, 0, { rz: Math.PI / 2 }); add(g, box(1.6, 0.12, 8), o.color || '#f4f4f4', 0.3, 2, 0); add(g, box(0.8, 1.4, 0.12), o.color2 || '#d2372f', -3.2, 2.7, 0); },
  cloud(g, o) { for (const [x, y, r] of [[0, 0, 1.4], [1.3, -0.2, 1.1], [-1.3, -0.25, 1], [0.5, 0.6, 1]]) add(g, ball(r * (o.w || 1), 1), '#ffffff', x * (o.w || 1), (o.y == null ? 12 : 0) + y, 0, { inkW: 0.06 }); const x0 = o.x || 0; ticks.push((t) => { g.position.x = x0 + Math.sin(t * 0.05) * 3; }); },
  stairs(g, o) { for (let i = 0; i < (o.n || 6); i++) add(g, box(o.w || 3, 0.25, 0.4), o.color || '#c9c2b0', 0, 0.125 + i * 0.25, -i * 0.4); },
  road(g, o) { const L = o.len || 40, w = o.w || 6; const t2 = paint('road', o.color || '#555a63').clone(); t2.needsUpdate = true; t2.repeat.set(w / 4, L / 4); add(g, new T.PlaneGeometry(w, L), '#555a63', 0, 0.02, 0, { rx: -Math.PI / 2, map: t2, ink: false, shadow: false }); for (let z = -L / 2; z < L / 2; z += 4) add(g, new T.PlaneGeometry(0.2, 2), '#f4f4f4', 0, 0.03, z, { rx: -Math.PI / 2, ink: false, shadow: false }); },
  field(g, o) { const t2 = paint('field', o.color || '#4f9a3f').clone(); t2.needsUpdate = true; t2.repeat.set(1, 8); add(g, new T.PlaneGeometry(o.w || 30, o.d || 46), '#4f9a3f', 0, 0.02, 0, { rx: -Math.PI / 2, map: t2, ink: false, shadow: false }); for (const z of [0]) add(g, new T.RingGeometry(4, 4.15, 48), '#ffffff', 0, 0.03, z, { rx: -Math.PI / 2, ink: false, shadow: false }); add(g, new T.PlaneGeometry(o.w || 30, 0.15), '#ffffff', 0, 0.03, 0, { rx: -Math.PI / 2, ink: false, shadow: false }); },
  crowd(g, o) { const n = o.n || 10, r = rng(11), w = o.w || 8; for (let i = 0; i < n; i++) g.userData.extras = [...(g.userData.extras || []), { x: (r() - 0.5) * w, z: (r() - 0.5) * (o.d || 2), look: randomLook(r), face: ['happy', 'laugh', 'surprised'][i % 3], pose: ['cheer', 'up', 'hang'][i % 3] }]; },
  bench(g, o) { const w = o.w || 2.4; add(g, box(w, 0.1, 0.5), o.color || '#9a6a3a', 0, 0.48, 0, { map: paint('planks', o.color || '#9a6a3a') }); for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) add(g, box(0.1, 0.48, 0.45), '#5a3b2a', x, 0.24, 0); },
  sofa(g, o) { const c = o.color || '#6a5acd'; add(g, box(2.4, 0.5, 0.9), c, 0, 0.35, 0); add(g, box(2.4, 0.8, 0.25), c, 0, 0.8, -0.35); for (const x of [-1.15, 1.15]) add(g, box(0.25, 0.6, 0.9), c, x, 0.55, 0); },
  door(g, o) { add(g, box(1.2, 2.3, 0.15), o.color || '#7a4a2a', 0, 1.15, 0, { map: paint('planks', o.color || '#7a4a2a') }); add(g, ball(0.06, 0), '#f2c230', 0.42, 1.1, 0.1, { ink: false }); },
  plant(g, o) { add(g, cyl(0.3, 0.22, 0.5, 10), o.color2 || '#c8573d', 0, 0.25, 0); for (let i = 0; i < 6; i++) add(g, new T.SphereGeometry(0.35, 8, 6), o.color || '#3f9a5b', Math.cos(i) * 0.15, 0.75 + (i % 3) * 0.12, Math.sin(i) * 0.15, { ink: false }).scale.set(0.45, 1, 0.45); },
  tv(g, o) { KIT.screen(g, { ...o, w: o.w || 2.2, h: o.h || 1.3 }); },
  laptop(g, o) { add(g, box(0.6, 0.03, 0.4), '#a7abb8', 0, (o.h || 0.8) + 0.02, 0); add(g, box(0.6, 0.4, 0.03), '#c9ccd6', 0, (o.h || 0.8) + 0.22, -0.2); add(g, new T.PlaneGeometry(0.54, 0.34), '#7fd3ff', 0, (o.h || 0.8) + 0.22, -0.18, { ink: false, mat: new T.MeshBasicMaterial({ map: paint('label', '#1d2a44', o.text || '', 0.54 / 0.34) }) }); },
  window(g, o) { add(g, box(o.w || 2.4, o.h || 1.6, 0.2), '#5a3b2a', 0, 2, 0); add(g, new T.PlaneGeometry((o.w || 2.4) - 0.3, (o.h || 1.6) - 0.3), '#bfe4fa', 0, 2, 0.12, { ink: false, mat: new T.MeshBasicMaterial({ color: col(o.color, '#bfe4fa') }) }); },
  floodlight(g, o) { add(g, cyl(0.2, 0.28, o.h || 18, 8), '#d8dde6', 0, (o.h || 18) / 2, 0); add(g, box(3.4, 1.6, 0.4), '#ffffff', 0, (o.h || 18) + 0.8, 0, { emissive: '#ffffff', glow: 1.6 }); const L = new T.PointLight(0xf4f8ff, 60, 70, 1.6); L.position.set(0, (o.h || 18), 2); g.add(L); },
  lockers(g, o) { const n = o.n || 5, c = o.color || '#4f7fb8'; for (let i = 0; i < n; i++) { add(g, box(0.6, 2, 0.5), c, (i - (n - 1) / 2) * 0.62, 1, 0); add(g, box(0.3, 0.06, 0.02), '#dfe6f0', (i - (n - 1) / 2) * 0.62, 1.6, 0.26, { ink: false }); } },
  ceilinglamp(g, o) { add(g, cyl(0.02, 0.02, 1, 4), '#2b2b33', 0, (o.h || 4) - 0.5, 0, { ink: false }); add(g, cone(0.4, 0.3, 14), o.color || '#e3703a', 0, (o.h || 4) - 1.1, 0); add(g, ball(0.14, 1), '#fff2c4', 0, (o.h || 4) - 1.25, 0, { emissive: '#ffd27a', glow: 1.4, ink: false }); },
  emoji(g, o) { const S = 256, c = new OffscreenCanvas(S, S), x = c.getContext('2d'); x.font = '200px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(o.text || o.emoji || '⭐', S / 2, S / 2 + 10); const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; const s = o.w || 1.2; const m = new T.Mesh(new T.PlaneGeometry(s, s), new T.MeshBasicMaterial({ map: tx, transparent: true, alphaTest: 0.1 })); m.position.y = s / 2 + (o.h || 0); m.userData.billboard = true; g.add(m); },
};
// any unknown object becomes a tidy painted block with its name, never an error
function unknown(g, o) { add(g, box(o.w || 1.5, o.h || 1.5, o.d || 1.5), o.color || '#b8a07a', 0, (o.h || 1.5) / 2, 0); if (o.text || o.type) label(g, o.text || o.type, (o.w || 1.5) * 0.9, (o.h || 1.5) * 0.5, 0, (o.h || 1.5) * 0.6, (o.d || 1.5) / 2 + 0.02, { color: o.color || '#e9d7a8' }); }
export const KIT_NAMES = Object.keys(KIT);
function shadeHex(c, k) { const x = col(c, '#888888'); x.offsetHSL(0, 0, k); return `#${x.getHexString()}`; }

const SKINS = ['#f5c9a0', '#ecd0b6', '#c99067', '#8d5a3b', '#f3d6bb'], HAIRS = ['#3b2a20', '#1e1714', '#c46a2b', '#e3c27a', '#5a3b2a', '#9a9aa3'];
function randomLook(r) { return { skin: SKINS[(r() * SKINS.length) | 0], hair: HAIRS[(r() * HAIRS.length) | 0], top: `hsl(${(r() * 360) | 0},55%,55%)`, hairStyle: ['short', 'spiky', 'long', 'bun'][(r() * 4) | 0] }; }

/* ---------------- light and sky for the time of day ---------------- */
const TIMES = {
  day: { top: '#5fa8e8', hor: '#d6ecf8', hemi: ['#d9edff', '#7a6a50', 1.15], sun: ['#fff3dc', 2.2, [6, 11, 7]], tint: '#ffffff' },
  golden: { top: '#f19a5e', hor: '#ffe0a8', hemi: ['#ffd9a8', '#6a4a3a', 0.95], sun: ['#ffb26b', 2.6, [9, 4, 5]], tint: '#ffe7cc' },
  dusk: { top: '#3a2f6e', hor: '#ee8f7a', hemi: ['#9a8ae0', '#3a2a4a', 0.85], sun: ['#ff9a7a', 1.4, [-8, 3, 4]], tint: '#ecd2e6' },
  night: { top: '#081230', hor: '#2b3f7a', hemi: ['#6a7cc0', '#1c1c34', 1.0], sun: ['#b8ccff', 1.2, [-5, 9, 4]], tint: '#c3cdf0' },
  interior: { top: '#3b2a3a', hor: '#5a4048', hemi: ['#fff0dd', '#6a5040', 1.0], sun: ['#ffe2b8', 1.3, [3, 7, 6]], tint: '#fff0e0' },
  storm: { top: '#3a4250', hor: '#8a95a5', hemi: ['#b8c0cc', '#3a3a40', 0.9], sun: ['#dfe6f0', 0.9, [4, 10, 3]], tint: '#dfe4ec' },
  space: { top: '#02030a', hor: '#0b1030', hemi: ['#8090c0', '#101018', 0.6], sun: ['#ffffff', 2.4, [8, 6, 5]], tint: '#e6ecff' },
};
export const TIME_NAMES = Object.keys(TIMES);
function skyTexture(L) {
  const c = new OffscreenCanvas(4, 256), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, L.top); gr.addColorStop(0.62, L.hor); gr.addColorStop(1, L.hor); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
function starSky(L) {                                                         // a starry night: a big canvas, so stars stay sharp
  const c = new OffscreenCanvas(512, 1024), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 1024), r = rng(5);
  gr.addColorStop(0, L.top); gr.addColorStop(0.62, L.hor); gr.addColorStop(1, L.hor); g.fillStyle = gr; g.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 260; i++) { const y = Math.pow(r(), 1.6) * 600; g.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.65})`; g.beginPath(); g.arc(r() * 512, y, 0.6 + r() * 1.4, 0, TAU); g.fill(); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

/* ---------------- characters as cards ---------------- */
const CW = 384, CH = 768;                                                    // the texture size (drawn at 0.75 of the design canvas)
class Actor {
  constructor(spec, seed) {
    this.spec = spec; this.look = spec.look || {}; this.seed = seed;
    this.canvas = new OffscreenCanvas(CW, CH); this.ctx = this.canvas.getContext('2d');
    this.tex = new T.CanvasTexture(this.canvas); this.tex.colorSpace = T.SRGBColorSpace;
    this.mat = new T.MeshBasicMaterial({ map: this.tex, alphaTest: 0.5, side: T.DoubleSide });
    const geo = new T.PlaneGeometry(1.05, 2.1); geo.translate(0, 1.05 - 2.1 * (CARD_H - 1000) / CARD_H, 0);
    this.mesh = new T.Mesh(geo, this.mat);
    this.shadow = new T.Mesh(new T.CircleGeometry(0.42, 20), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.012;
    this.group = new T.Group(); this.group.add(this.mesh, this.shadow);
    this.key = '';
  }
  draw(state) {
    const key = `${state.face}|${state.pose}|${Math.round((state.mouth || 0) * 4)}|${state.blink ? 1 : 0}|${Math.round((state.step || 0) * 8) % 8}|${Math.round((state.t || 0) * 6) % 12}`;
    if (key === this.key) return; this.key = key;
    this.ctx.setTransform(CW / CARD_W, 0, 0, CH / CARD_H, 0, 0);
    drawBean(this.ctx, this.look, state);
    this.tex.needsUpdate = true;
  }
}

/* ---------------- one shot: the director's rules in code ---------------- */
// shot: {set, actors: [{id, x, z, y, face, pose, action, to: [x, z], talk}], camera: {size, target, angle, move, side, roll}, fx}
const SIZE = { wide: 8.5, medium: 4.2, two: 5.2, close: 2.2, insert: 1.4, extreme: 1.1 };
const STAND_ON = new Set(['podium', 'stairs', 'stage', 'platform', 'throne', 'well']);
const STRIDE = { walk: 0.72, run: 1.35 };

// blocking: where everyone really stands, worked out once per shot — nobody inside a wall, nobody inside another person,
// and anyone standing over a podium / stairs / stage stands ON it
function blocking(shot, solids) {
  if (shot._blk) return shot._blk;
  const people = (shot.actors || []).map((a) => ({ a, x: +a.x || 0, z: +a.z || 0, y: +a.y || 0, to: Array.isArray(a.to) ? [+a.to[0] || 0, +a.to[1] || 0] : null }));
  const free = (p) => {
    for (const s of solids) {
      if (p.x < s.minX - 0.35 || p.x > s.maxX + 0.35 || p.z < s.minZ - 0.35 || p.z > s.maxZ + 0.35) continue;
      if (STAND_ON.has(s.type) && s.top < 2.6) { if (p.x >= s.minX && p.x <= s.maxX && p.z >= s.minZ && p.z <= s.maxZ) p.y = Math.max(p.y, s.top); continue; }
      if (s.top < 0.35) continue;                                           // tiny things (a ball, a paper) do not block
      const out = [[s.minX - 0.45 - p.x, 0], [s.maxX + 0.45 - p.x, 0], [0, s.minZ - 0.45 - p.z], [0, s.maxZ + 0.45 - p.z]].sort((u, v) => Math.hypot(...u) - Math.hypot(...v))[0];
      p.x += out[0]; p.z += out[1];
    }
  };
  for (const p of people) free(p);
  for (let it = 0; it < 6; it++) for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {   // personal space
    const P = people[i], Q = people[j], dx = Q.x - P.x, dz = Q.z - P.z, d = Math.hypot(dx, dz);
    if (d >= 0.95 || Math.abs(P.y - Q.y) > 0.5) continue;
    const push = (0.95 - d) / 2 + 0.01, nx = d > 1e-3 ? dx / d : 1, nz = d > 1e-3 ? dz / d : 0;
    P.x -= nx * push; P.z -= nz * push; Q.x += nx * push; Q.z += nz * push;
  }
  for (const p of people) { free(p); if (p.to) { const q = { x: p.to[0], z: p.to[1], y: p.y }; free(q); p.to = [q.x, q.z]; } }
  return (shot._blk = people);
}

// motion of one person: steps follow the distance walked (feet never slide), jumps crouch first and land with a squash
function actorAt(b, lt, dur, seed) {
  const a = b.a, act = a.action || 'idle', moving = b.to && (act === 'walk' || act === 'run');
  const len = moving ? Math.hypot(b.to[0] - b.x, b.to[1] - b.z) : 0;
  const T2 = moving ? Math.min(dur * 0.9, len / (act === 'run' ? 3.2 : 1.3)) : 1, u = moving ? clamp(lt / Math.max(0.3, T2)) : 0, ue = moving ? smooth(u) : 0;
  const x = moving ? lerp(b.x, b.to[0], ue) : b.x, z = moving ? lerp(b.z, b.to[1], ue) : b.z;
  let y = b.y, roll = 0, bob = Math.sin(lt * 2.2 + seed) * 4, sy = 1 + Math.sin(lt * 2.2 + seed) * 0.008;   // breathing
  const step = moving && u < 1 ? ((ue * len) / STRIDE[act]) % 1 : 0;
  switch (act) {
    case 'hop': case 'cheer': { const ph = (lt * 2.1 + seed * 0.1) % 1, air = Math.sin(ph * Math.PI); y += air * 0.32; sy = ph < 0.08 || ph > 0.92 ? 0.9 : 1 + air * 0.05; break; }
    case 'jump': {
      if (lt < 0.25) sy = 1 - smooth(lt / 0.25) * 0.14;                                   // anticipation: crouch
      else if (lt < 1.05) { const k = (lt - 0.25) / 0.8; y += Math.sin(k * Math.PI) * 1.1; sy = 1.06; }
      else if (lt < 1.25) sy = 1 - Math.sin(((lt - 1.05) / 0.2) * Math.PI) * 0.12;          // landing
      break;
    }
    case 'dance': roll = Math.sin(lt * 5) * 0.14; y += Math.abs(Math.sin(lt * 5)) * 0.12; break;
    case 'fall': roll = smooth(lt / 0.55) * 1.45 * (seed % 2 ? 1 : -1); if (lt > 0.55) sy = 1 - Math.max(0, Math.sin(((lt - 0.55) / 0.2) * Math.PI)) * 0.08; break;
    case 'shake': case 'scared': roll = Math.sin(lt * 40) * 0.03; break;
    case 'nod': bob = Math.sin(lt * 8) * 10; break;
    case 'run': y += Math.abs(Math.sin(step * Math.PI * 2)) * 0.07; break;
    case 'walk': y += Math.abs(Math.sin(step * Math.PI * 2)) * 0.035; break;
    default:
  }
  const mv = moving ? [b.to[0] - b.x, b.to[1] - b.z] : null;
  return { x, y, z, roll, bob, step, sy, mv };
}

export class World {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.canvas = new OffscreenCanvas(W, H);
    this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1); this.renderer.setSize(W, H, false);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFShadowMap;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(H > W ? 50 : 38, W / H, 0.1, 400);
    this.hemi = new T.HemisphereLight(0xffffff, 0x444444, 1); this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight(0xffffff, 2); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024); Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 0.5, far: 60 }); this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun, this.sun.target);
    this.sets = new Map(); this.cast = new Map(); this.current = null; this.extras = [];
  }
  /* the bible: {cast: [{id, look}], sets: [{id, ground, time, room, objects}]} */
  load(bible) {
    (bible.cast || []).forEach((c, i) => this.cast.set(String(c.id), new Actor(c, i * 7 + 3)));
    for (const s of bible.sets || []) this.sets.set(String(s.id), s);
  }
  buildSet(spec) {
    if (spec._group) return spec._group;
    const g = new T.Group(), first = ticks.length;
    const time = TIMES[spec.time] ? spec.time : spec.room ? 'interior' : 'day';
    const r = rng(hashStr(spec.id || 'set'));
    if (spec.room) {
      const w = spec.room.w || 12, d = spec.room.d || 10, h = spec.room.h || 4.2, wall = spec.room.wall || '#e8d6b8', floor = spec.room.floor || '#a8784a';
      spec._room = { w, d, h };
      const ft = paint(spec.room.floorKind || 'planks', floor).clone(); ft.needsUpdate = true; ft.repeat.set(w / 3, d / 3);
      add(g, new T.PlaneGeometry(w, d), floor, 0, 0, 0, { rx: -Math.PI / 2, map: ft, ink: false, shadow: false });
      const wt = paint(spec.room.wallKind || 'plaster', wall).clone(); wt.needsUpdate = true; wt.repeat.set(w / 4, h / 4);
      add(g, box(w, h, 0.2), wall, 0, h / 2, -d / 2, { map: wt, ink: false });
      for (const sd of [-1, 1]) add(g, box(0.2, h, d), shadeHex(wall, -0.06), sd * w / 2, h / 2, 0, { map: wt, ink: false });
      // dressing: skirting boards, a cornice, a rug, framed pictures, a window with daylight falling in
      const trim = shadeHex(wall, -0.32);
      add(g, box(w, 0.18, 0.06), trim, 0, 0.09, -d / 2 + 0.13, { ink: false }); for (const sd of [-1, 1]) add(g, box(0.06, 0.18, d), trim, sd * (w / 2 - 0.13), 0.09, 0, { ink: false });
      add(g, box(w, 0.14, 0.12), shadeHex(wall, 0.08), 0, h - 0.07, -d / 2 + 0.16, { ink: false });
      add(g, new T.CircleGeometry(2.2, 40), spec.room.rug || ['#8e3b3b', '#3f6a8f', '#6a5acd', '#a8784a'][(r() * 4) | 0], 0.3, 0.012, 0.2, { rx: -Math.PI / 2, ink: false, shadow: false }).scale.set(1.3, 1, 1);
      for (const px of [w * 0.12, w * 0.34]) { add(g, box(1.1, 0.8, 0.06), '#5a3b2a', px, h * 0.6, -d / 2 + 0.14); add(g, new T.PlaneGeometry(0.9, 0.6), `hsl(${(r() * 360) | 0},40%,60%)`, px, h * 0.6, -d / 2 + 0.18, { ink: false, shadow: false }); }
      if (spec.room.window !== false) {
        const out = spec.room.outside === 'night' ? '#1d3a7a' : '#bfe4fa';
        add(g, box(2.6, 1.8, 0.25), '#5a3b2a', -w * 0.25, h * 0.6, -d / 2 + 0.05); add(g, new T.PlaneGeometry(2.3, 1.5), out, -w * 0.25, h * 0.6, -d / 2 + 0.2, { ink: false, mat: new T.MeshBasicMaterial({ color: col(out, '#bfe4fa') }) });
        add(g, box(0.08, 1.5, 0.08), '#5a3b2a', -w * 0.25, h * 0.6, -d / 2 + 0.22, { ink: false }); add(g, box(2.3, 0.08, 0.08), '#5a3b2a', -w * 0.25, h * 0.6, -d / 2 + 0.22, { ink: false });
        if (spec.room.outside !== 'night') { const shaft = new T.Mesh(new T.PlaneGeometry(2.4, 5), new T.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0.09, depthWrite: false, side: T.DoubleSide })); shaft.position.set(-w * 0.25 + 0.6, h * 0.35, -d / 2 + 1.9); shaft.rotation.set(-1.05, 0.25, 0); g.add(shaft); }
      }
      const key = new T.PointLight(0xffe2b8, 9, 14, 2); key.position.set(1.5, h - 0.4, 1); g.add(key);
    } else {
      const kind = spec.ground || 'grass', base = { grass: '#6db04f', sand: '#e6c88a', snow: '#f2f5fa', dirt: '#a07850', stone: '#a8a294', road: '#666b74', water: '#3c8fd0', field: '#4f9a3f', moon: '#9a9aa6', wood: '#a8784a', tiles: '#d8d2c4' }[kind] || '#6db04f';
      const gt = paint(kind === 'field' ? 'grass' : kind, spec.groundColor || base).clone(); gt.needsUpdate = true; gt.repeat.set(30, 30);
      add(g, new T.PlaneGeometry(160, 160), spec.groundColor || base, 0, 0, 0, { rx: -Math.PI / 2, map: gt, ink: false, shadow: false });
      if (time !== 'space' && spec.horizon !== false) {                     // soft hills far away give depth
        for (let i = 0; i < 9; i++) { const a2 = (i / 9) * TAU + r() * 0.3, d = 55 + r() * 15; const hg = new T.Group(); KIT.hill(hg, { w: 14 + r() * 12, h: 5 + r() * 6, color: shadeHex(base, -0.05 + r() * 0.1) }); hg.position.set(Math.cos(a2) * d, 0, Math.sin(a2) * d); g.add(hg); }
      }
      // life on the ground: tufts, flowers, pebbles around the stage (never on it), so no shot shows a bare floor
      if (['grass', 'dirt', 'sand', 'snow', 'stone', 'moon'].includes(kind)) {
        const tuft = kind === 'grass' ? '#4f9a3f' : kind === 'snow' ? '#dfe7f2' : kind === 'sand' ? '#c9a86a' : '#7d7568';
        for (let i = 0; i < 70; i++) {
          const a2 = r() * TAU, d = 3.6 + Math.pow(r(), 0.7) * 22, x = Math.cos(a2) * d, z = Math.sin(a2) * d * 0.8 - 2;
          if (Math.abs(x) < 3.4 && z > -2.6 && z < 2.6) continue;
          const pick = r();
          if (pick < 0.55) add(g, cone(0.12 + r() * 0.1, 0.35 + r() * 0.3, 5), shadeHex(tuft, (r() - 0.5) * 0.1), x, 0.18, z, { ink: false });
          else if (pick < 0.75 && kind === 'grass') { add(g, cyl(0.015, 0.015, 0.35, 4), '#3f7f3a', x, 0.17, z, { ink: false, shadow: false }); add(g, ball(0.08, 0), ['#e8435a', '#f6d55c', '#ffffff', '#b06ab3'][i % 4], x, 0.37, z, { ink: false, shadow: false }); }
          else add(g, new T.DodecahedronGeometry(0.12 + r() * 0.2, 0), shadeHex('#8a8a92', (r() - 0.5) * 0.15), x, 0.08, z, { inkW: 0.015 });
        }
      }
      // the sky has life too: clouds by day, a moon by night, a low sun at the golden hour
      if (time === 'day' || time === 'golden' || time === 'storm') for (let i = 0; i < 5; i++) { const cg = new T.Group(); KIT.cloud(cg, { w: 2 + r() * 1.5, y: 0 }); cg.position.set(-60 + i * 30 + r() * 10, 26 + r() * 10, -70 - r() * 30); g.add(cg); }
      if (time === 'night') { add(g, ball(4, 2), '#f5f1e1', 30, 42, -110, { emissive: '#f5f1e1', glow: 0.9, ink: false, shadow: false }); }
      if (time === 'golden' || time === 'dusk') { add(g, ball(7, 2), time === 'golden' ? '#ffd08a' : '#ff9a7a', -45, 10, -120, { emissive: time === 'golden' ? '#ffb060' : '#ff7a5a', glow: 1.2, ink: false, shadow: false }); }
    }
    for (const o0 of spec.objects || []) {
      const o = realSize(o0), og = new T.Group(); og.userData.spec = o;
      (KIT[o.type] || unknown)(og, o);
      og.position.set(+o.x || 0, +o.y || 0, +o.z || 0); og.rotation.y = ((+o.rot || 0) * Math.PI) / 180; og.scale.setScalar(+o.scale || 1);
      g.add(og);
      for (const e of og.userData.extras || []) { const a = new Actor({ look: e.look }, hashStr(JSON.stringify(e.look))); a.draw({ face: e.face, pose: e.pose, t: 0 }); a.group.position.set(og.position.x + e.x, 0, og.position.z + e.z); a.group.userData.billboard = true; g.add(a.group); }
    }
    // the solid footprint of every object: people walk around them, the camera never films from inside them
    g.updateMatrixWorld(true);
    spec._solids = g.children.filter((c) => c.userData.spec && !['field', 'road', 'water', 'paper', 'cloud', 'crowd', 'flowers'].includes(c.userData.spec.type)).map((c) => {
      const bb = new T.Box3().setFromObject(c); return { type: c.userData.spec.type, id: c.userData.spec.id, minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z, top: bb.max.y, box: bb };
    }).filter((s2) => Number.isFinite(s2.minX) && s2.maxX - s2.minX < 40);
    spec._ticks = ticks.splice(first); spec._time = time; spec._group = g; spec._sky = time === 'night' || time === 'space' ? starSky(TIMES[time]) : skyTexture(TIMES[time]);
    return g;
  }
  use(setId) {
    const spec = this.sets.get(String(setId)) || [...this.sets.values()][0];
    if (!spec) return null;
    if (this.current === spec) return spec;
    if (this.current?._group) this.scene.remove(this.current._group);
    this.scene.add(this.buildSet(spec)); this.current = spec;
    const L = TIMES[spec._time];
    this.scene.background = spec._sky;
    this.scene.fog = spec._time === 'space' ? null : new T.Fog(col(L.hor, '#ccc'), spec.room ? 30 : 28, spec.room ? 60 : 120);
    this.hemi.color.set(L.hemi[0]); this.hemi.groundColor.set(L.hemi[1]); this.hemi.intensity = L.hemi[2];
    this.sun.color.set(L.sun[0]); this.sun.intensity = L.sun[1]; this.sun.position.set(...L.sun[2]);
    for (const a of this.cast.values()) a.mat.color.set(L.tint);
    return spec;
  }
  // what the camera looks at: an actor, several actors, or an object that EXISTS in this set (else the main person)
  where(target, shot, people, lt, dur) {
    if (Array.isArray(target)) return new T.Vector3(+target[0] || 0, +target[1] || 1, +target[2] || 0);
    const ids = String(target || '').split(/[,+&]/).map((x) => x.trim()).filter(Boolean), pts = [];
    for (const id of ids) {
      const b = people.find((x) => String(x.a.id) === id);
      if (b) { const p = actorAt(b, lt, dur, 1); pts.push(new T.Vector3(p.x, 1.25 * (+b.a.scale || 1) + p.y, p.z)); continue; }
      const s2 = (this.current?._solids || []).find((x) => String(x.id) === id || x.type === id) || this.current?._group?.children.filter((c) => c.userData.spec && (String(c.userData.spec.id) === id || c.userData.spec.type === id)).map((c) => ({ box: new T.Box3().setFromObject(c) }))[0];
      if (s2) { const bb = s2.box, c = bb.getCenter(new T.Vector3()), sz = bb.getSize(new T.Vector3()); c.y = Math.min(c.y, bb.min.y + Math.max(1.0, sz.y * 0.6)); c.size = Math.min(30, Math.max(sz.x, sz.z * 0.6, sz.y * 1.2)); pts.push(c); }
    }
    if (!pts.length) {                                                      // a missing target never gives an empty frame
      const main = people.find((x) => x.a.talk) || people[0];
      if (main) { const p = actorAt(main, lt, dur, 1); const v = new T.Vector3(p.x, 1.25 + p.y, p.z); v.fallback = true; return v; }
      return new T.Vector3(0, 1.2, -2);
    }
    const c = pts.reduce((sum, q) => sum.add(q), new T.Vector3()).divideScalar(pts.length);
    if (pts.length > 1) c.spread = Math.max(...pts.map((q) => q.distanceTo(c)));
    else if (pts[0].size) c.size = pts[0].size;
    return c;
  }
  render(shot, lt, dur, t, amp, prevShot) {
    const spec = this.use(shot.set);
    if (!spec) return;
    for (const f of spec._ticks || []) f(t);
    const people = blocking(shot, spec._solids || []);
    const cam = shot.camera || {}, u = smooth(lt / Math.max(0.5, dur));
    // the camera first (the actors turn to it)
    const tgt = this.where(cam.target, shot, people, lt, dur);
    let size = cam.size; if (tgt.fallback && (size === 'insert' || size === 'extreme')) size = 'close';
    let dist = SIZE[size] || SIZE.medium;
    if (tgt.spread) dist *= 1 + tgt.spread * 0.35;
    if (tgt.size) dist = Math.max(dist, tgt.size * (this.H > this.W ? 1.9 : 1.15));        // a thing is filmed whole
    let az = ((+cam.side || 0) * Math.PI) / 180, h = { eye: 0.1, low: -0.75, high: dist * 0.55, top: dist * 1.3 }[cam.angle] ?? 0.15;
    switch (cam.move) {
      case 'push': dist *= lerp(1.3, 1.0, u); break;
      case 'pull': dist *= lerp(0.85, 1.25, u); break;
      case 'orbit': az += lerp(-0.45, 0.45, u); break;
      case 'pan': az += lerp(-0.2, 0.2, u); break;
      case 'crane': h += lerp(dist * 0.9, 0, u); break;
      case 'drop': h += lerp(0, dist * 0.7, u); break;
      default: dist *= lerp(1.03, 0.97, u); az += Math.sin(t * 0.3) * 0.02;   // even a still shot breathes
    }
    // wide and two-shots keep EVERY person of the shot in the frame
    const right = new T.Vector3(Math.cos(az), 0, -Math.sin(az));
    if (people.length > 1 && (size === 'wide' || size === 'two' || size === 'medium' && String(cam.target || '').includes(','))) {
      const xs = people.map((b) => { const p = actorAt(b, lt, dur, 1); return (p.x - tgt.x) * right.x + (p.z - tgt.z) * right.z; });
      const half = Math.max(...xs.map(Math.abs)) + 0.75, hfov = 2 * Math.atan(Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect);
      dist = Math.max(dist, half / Math.tan(hfov / 2));
    }
    const pos = new T.Vector3(tgt.x + Math.sin(az) * dist, Math.max(0.3, tgt.y + h), tgt.z + Math.cos(az) * dist);
    // never film from inside a wall or an object: stop in front of the first thing between the camera and the subject
    if (spec._room) { const R = spec._room; pos.x = clamp(pos.x, -R.w / 2 + 0.5, R.w / 2 - 0.5); pos.z = Math.max(pos.z, -R.d / 2 + 0.6); pos.y = Math.min(pos.y, R.h - 0.3); }
    const dir = pos.clone().sub(tgt), L2 = dir.length(); dir.normalize();
    let block = L2;
    for (const s2 of spec._solids || []) { if (s2.box.containsPoint(tgt)) continue; const hit = new T.Ray(tgt, dir).intersectBox(s2.box, new T.Vector3()); if (hit) { const d2 = hit.distanceTo(tgt); if (d2 > 0.6 && d2 < block) block = d2; } }
    if (block < L2) pos.copy(tgt).addScaledVector(dir, Math.max(0.8, block - 0.35));
    // continuity: a shot in the same set glides in from where the last one ended
    if (prevShot && prevShot.set === shot.set && lt < 0.45 && prevShot._end) { const k = smooth(lt / 0.45); pos.lerp(prevShot._end.pos, 1 - k); tgt.lerp(prevShot._end.tgt, 1 - k); }
    this.camera.position.copy(pos); this.camera.lookAt(tgt);
    const shake = cam.shake || (shot.fx || []).includes('shake') ? Math.max(0, 1 - lt / 0.6) * 0.05 : 0;
    this.camera.rotation.z += ((+cam.roll || 0) * Math.PI) / 180 * u + Math.sin(t * 47) * shake;
    if (shake) this.camera.position.y += Math.sin(t * 61) * shake;
    shot._end = { pos: pos.clone(), tgt: tgt.clone() };
    const camRight = new T.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    // the actors: placed, moving the right way on screen, listening to whoever speaks
    const present = new Set(), talker = people.find((b) => b.a.talk);
    const talkerP = talker ? actorAt(talker, lt, dur, 1) : null;
    people.forEach((b, i) => {
      const a = b.a, actor = this.cast.get(String(a.id)); if (!actor) return;
      present.add(actor);
      if (actor.group.parent !== this.scene) this.scene.add(actor.group);
      const p = actorAt(b, lt, dur, actor.seed + i), s3 = +a.scale || +actor.spec.scale || 1;
      actor.group.position.set(p.x, p.y, p.z); actor.group.scale.setScalar(s3);
      const facing = p.mv ? (p.mv[0] * camRight.x + p.mv[1] * camRight.z >= 0 ? 1 : -1) : a.face === 'left' ? -1 : 1;
      actor.mesh.rotation.z = p.roll; actor.mesh.scale.set(facing, p.sy, 1); actor.mesh.position.y = p.bob * 0.002;
      let lookX = a.look === 'left' ? -1 : a.look === 'right' ? 1 : 0;
      if (talker && talker !== b && talkerP) lookX = Math.sign((talkerP.x - p.x) * camRight.x + (talkerP.z - p.z) * camRight.z) * facing;
      const blink = ((t + actor.seed * 0.7) % 3.6) < 0.12;
      actor.draw({ face: a.face || a.expr || 'neutral', pose: a.pose || 'hang', mouth: a.talk ? amp * 2.4 : 0, blink, step: p.step, t, lookX });
      actor.shadow.scale.setScalar(1 - Math.min(0.6, (p.y - b.y) * 0.6));
      actor.shadow.position.y = 0.012 - (p.y - b.y) / s3;
      actor.mesh.rotation.y = Math.atan2(pos.x - p.x, pos.z - p.z);          // cards face the camera
    });
    for (const a of this.cast.values()) if (!present.has(a) && a.group.parent) this.scene.remove(a.group);
    spec._group.traverse((o) => { if (o.userData.billboard) { const wp = o.getWorldPosition(new T.Vector3()); o.rotation.y = Math.atan2(pos.x - wp.x, pos.z - wp.z); } });
    this.sun.target.position.copy(tgt); this.sun.position.copy(tgt).add(new T.Vector3(...TIMES[spec._time].sun[2]));
    this.renderer.render(this.scene, this.camera);
  }
  // the finished frame on a 2D canvas: on close and medium shots the world is softly out of focus behind the sharp cast,
  // bright things glow a little, the edges darken (like the reference cartoons)
  paint(ctx, shot, lt, dur, t, amp, prev, W, H) {
    const size = shot.camera?.size || 'medium', blur = { close: 5, extreme: 6, insert: 0, medium: 3, two: 2.5 }[size] || 0;
    this.render(shot, lt, dur, t, amp, prev);
    const spec = this.current;
    if (!blur || !spec) ctx.drawImage(this.canvas, 0, 0, W, H);
    else {
      const actors = [...this.cast.values()].filter((a) => a.group.parent === this.scene);
      for (const a of actors) a.group.visible = false;
      this.renderer.render(this.scene, this.camera);
      this.soft(ctx, this.canvas, W, H, blur);                               // the world, out of focus
      for (const a of actors) a.group.visible = true;
      const bg = this.scene.background; this.scene.background = null; spec._group.visible = false;
      this.renderer.setClearColor(0x000000, 0); this.renderer.render(this.scene, this.camera);
      ctx.drawImage(this.canvas, 0, 0, W, H);                                  // the cast, sharp
      this.scene.background = bg; spec._group.visible = true;
    }
    // glow: a soft copy of the frame laid over itself
    const s = this._g || (this._g = new OffscreenCanvas(Math.round(W / 8), Math.round(H / 8))), gx = s.getContext('2d');
    gx.drawImage(ctx.canvas, 0, 0, s.width, s.height);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = spec?._time === 'night' ? 0.22 : 0.14; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(s, 0, 0, W, H); ctx.restore();
    const v = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(20,10,30,${spec?._time === 'night' ? 0.5 : 0.32})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  // a cheap, smooth blur that works on every phone: shrink, then stretch back
  soft(ctx, src, W, H, k) {
    const w = Math.max(8, Math.round(W / (k * 2))), h = Math.max(8, Math.round(H / (k * 2)));
    const a = this._b1?.width === w ? this._b1 : (this._b1 = new OffscreenCanvas(w, h)), ax = a.getContext('2d');
    ax.imageSmoothingQuality = 'high'; ax.clearRect(0, 0, w, h); ax.drawImage(src, 0, 0, w, h);
    ctx.save(); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(a, 0, 0, W, H); ctx.restore();
  }
  dispose() { try { this.renderer.dispose(); this.renderer.forceContextLoss(); } catch { /* already gone */ } }
  // screen position of a point in the last frame (for effects drawn on top: Zzz, "!", hearts)
  project(x, y, z, W, H) { const v = new T.Vector3(x, y, z).project(this.camera); return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H, v.z < 1]; }
  headOf(id) { const a = this.cast.get(String(id)); if (!a || !a.group.parent) return null; const p = a.group.position, s = a.group.scale.y; return [p.x, p.y + 2.05 * s, p.z]; }
}
