// Bean-head cartoon characters drawn on a 2D canvas (our own drawing code). The 3D world shows each one as a
// standing card that always faces the camera, like paper puppets on a stage. Ink outlines, soft two-tone shading.
// drawBean(ctx, look, state): look = who they are (skin, hair, hat, outfit, prop), state = how they are now (face, arms, mouth).
// The card is 512 x 1024; the soles touch y = 1000.
const TAU = Math.PI * 2;
const INK = '#2b1b2e';
export const CARD_W = 512, CARD_H = 1024, SOLE = 1000;

function shade(hex, k) {                                                     // darker (k < 1) or lighter (k > 1) colour
  const n = parseInt(String(hex || '#999').replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
const ink = (ctx, w = 7) => { ctx.lineWidth = w; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); };
function fillShaded(ctx, path, color, x0, x1) {                              // light from the left: a soft dark side on the right
  ctx.fillStyle = color; path(); ctx.fill();
  ctx.save(); path(); ctx.clip();
  const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,10,50,.22)');
  ctx.fillStyle = g; ctx.fillRect(x0 - 50, 0, x1 - x0 + 100, CARD_H); ctx.restore();
}

/* ---------------- the face: the whole character lives here ---------------- */
// expressions: neutral happy laugh sad angry surprised scared smug sleep wink determined cry love
const FACES = {
  neutral: { eye: 'dot', brow: [0, 0], mouth: 'line' },
  happy: { eye: 'dot', brow: [-4, 4], mouth: 'smile' },
  laugh: { eye: 'happy', brow: [-6, 6], mouth: 'open' },
  sad: { eye: 'dot', brow: [8, -10], mouth: 'frown' },
  angry: { eye: 'dot', brow: [-12, 12], mouth: 'grit' },
  surprised: { eye: 'big', brow: [-10, 0], mouth: 'o' },
  scared: { eye: 'big', brow: [10, -12], mouth: 'wave' },
  smug: { eye: 'lid', brow: [-2, 8], mouth: 'smirk' },
  sleep: { eye: 'shut', brow: [0, 0], mouth: 'o-small' },
  wink: { eye: 'wink', brow: [-4, 4], mouth: 'smile' },
  determined: { eye: 'lid', brow: [-10, 10], mouth: 'line' },
  cry: { eye: 'shut', brow: [10, -12], mouth: 'frown', tears: true },
  love: { eye: 'heart', brow: [-4, 4], mouth: 'smile' },
};
export const FACE_NAMES = Object.keys(FACES);

function face(ctx, cx, cy, a, b, st, look) {
  const F = FACES[st.face] || FACES.neutral, ex = a * 0.36, ey = cy + b * 0.02, lookX = (st.lookX || 0) * 6;
  const blink = st.blink && F.eye !== 'shut';
  for (const s of [-1, 1]) {
    const x = cx + s * ex + lookX;
    const kind = blink ? 'shut' : F.eye === 'wink' ? (s > 0 ? 'shut' : 'dot') : F.eye;
    ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round';
    if (kind === 'dot') { ctx.beginPath(); ctx.ellipse(x, ey, 11, 15, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 3, ey - 5, 4, 0, TAU); ctx.fill(); }
    else if (kind === 'big') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, ey, 22, 26, 0, 0, TAU); ctx.fill(); ink(ctx, 6); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + lookX * 0.5, ey + 2, 9, 0, TAU); ctx.fill(); }
    else if (kind === 'lid') { ctx.beginPath(); ctx.ellipse(x, ey + 3, 11, 11, 0, 0, TAU); ctx.fill(); ctx.fillStyle = look.skin || '#f5c9a0'; ctx.fillRect(x - 16, ey - 16, 32, 15); ctx.beginPath(); ctx.moveTo(x - 15, ey - 1); ctx.lineTo(x + 15, ey - 1); ctx.stroke(); }
    else if (kind === 'shut') { ctx.beginPath(); ctx.moveTo(x - 14, ey); ctx.quadraticCurveTo(x, ey + 9, x + 14, ey); ctx.stroke(); }
    else if (kind === 'happy') { ctx.beginPath(); ctx.moveTo(x - 14, ey + 4); ctx.quadraticCurveTo(x, ey - 12, x + 14, ey + 4); ctx.stroke(); }
    else if (kind === 'heart') { ctx.fillStyle = '#e8435a'; ctx.beginPath(); ctx.moveTo(x, ey + 12); ctx.bezierCurveTo(x - 22, ey - 2, x - 10, ey - 20, x, ey - 8); ctx.bezierCurveTo(x + 10, ey - 20, x + 22, ey - 2, x, ey + 12); ctx.fill(); }
    // brows: [inner raise, outer raise]
    const [bi, bo] = F.brow, by = ey - 34;
    ctx.strokeStyle = look.brows || shade(look.hair || '#3b2a20', 0.8); ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(x - s * 18, by + bi * 0.6); ctx.lineTo(x + s * 18, by - bo * 0.6); ctx.stroke();
  }
  if (F.tears) { ctx.fillStyle = '#7cc4ff'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * ex, ey + 30 + ((st.t || 0) * 60) % 40, 6, 10, 0, 0, TAU); ctx.fill(); } }
  // the mouth opens with the voice when the character talks
  const my = cy + b * 0.42, open = Math.max(0, Math.min(1, st.mouth || 0));
  ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.fillStyle = '#7a2a33';
  const m = open > 0.15 && !['o', 'o-small', 'open'].includes(F.mouth) ? 'talk' : F.mouth;
  ctx.beginPath();
  if (m === 'smile') { ctx.moveTo(cx - 26, my - 6); ctx.quadraticCurveTo(cx, my + 18, cx + 26, my - 6); ctx.stroke(); }
  else if (m === 'frown') { ctx.moveTo(cx - 24, my + 8); ctx.quadraticCurveTo(cx, my - 12, cx + 24, my + 8); ctx.stroke(); }
  else if (m === 'line') { ctx.moveTo(cx - 20, my); ctx.lineTo(cx + 20, my); ctx.stroke(); }
  else if (m === 'smirk') { ctx.moveTo(cx - 20, my + 4); ctx.quadraticCurveTo(cx + 6, my + 6, cx + 26, my - 10); ctx.stroke(); }
  else if (m === 'grit') { ctx.fillStyle = '#fff'; ctx.rect(cx - 26, my - 9, 52, 18); ctx.fill(); ink(ctx, 6); ctx.beginPath(); for (const dx of [-9, 9]) { ctx.moveTo(cx + dx, my - 9); ctx.lineTo(cx + dx, my + 9); } ctx.moveTo(cx - 26, my); ctx.lineTo(cx + 26, my); ink(ctx, 4); }
  else if (m === 'wave') { ctx.moveTo(cx - 24, my); for (let i = 1; i <= 4; i++) ctx.lineTo(cx - 24 + i * 12, my + (i % 2 ? -7 : 7)); ctx.stroke(); }
  else if (m === 'o' || m === 'o-small') { const r = m === 'o' ? 14 + open * 6 : 7; ctx.ellipse(cx, my + 4, r * 0.8, r, 0, 0, TAU); ctx.fill(); ink(ctx, 6); }
  else { const h = m === 'open' ? 26 : 6 + open * 26; ctx.moveTo(cx - 26, my - 4); ctx.quadraticCurveTo(cx, my - 4 + h * 1.6, cx + 26, my - 4); ctx.closePath(); ctx.fill(); ink(ctx, 6); }
  if (['happy', 'laugh', 'love', 'wink'].includes(st.face)) { ctx.fillStyle = 'rgba(240,110,110,.35)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * a * 0.62, my - 10, 18, 10, 0, 0, TAU); ctx.fill(); } }
}

/* ---------------- hats and hair ---------------- */
function hair(ctx, cx, top, a, b, look) {
  const c = look.hair || '#3b2a20', style = look.hairStyle || 'short';
  if (style === 'bald' || look.hat === 'helmet' || look.hat === 'hood') return;
  ctx.fillStyle = c;
  ctx.beginPath();
  if (style === 'long') { ctx.ellipse(cx, top + b * 0.55, a * 1.08, b * 0.95, 0, Math.PI, TAU); ctx.lineTo(cx + a * 1.08, top + b * 1.6); ctx.lineTo(cx + a * 0.7, top + b * 1.6); ctx.lineTo(cx + a * 0.75, top + b * 0.6); ctx.lineTo(cx - a * 0.75, top + b * 0.6); ctx.lineTo(cx - a * 0.7, top + b * 1.6); ctx.lineTo(cx - a * 1.08, top + b * 1.6); ctx.closePath(); }
  else if (style === 'spiky') { ctx.moveTo(cx - a, top + b * 0.5); for (let i = 0; i <= 8; i++) ctx.lineTo(cx - a + (i * 2 * a) / 8, top + (i % 2 ? -b * 0.12 : b * 0.18)); ctx.lineTo(cx + a, top + b * 0.5); ctx.quadraticCurveTo(cx, top + b * 0.2, cx - a, top + b * 0.5); }
  else if (style === 'bun') { ctx.ellipse(cx, top + b * 0.42, a * 1.02, b * 0.55, 0, Math.PI, TAU); ctx.moveTo(cx + 34, top - 10); ctx.arc(cx, top - 10, 34, 0, TAU); }
  else { ctx.ellipse(cx, top + b * 0.45, a * 1.03, b * 0.55, 0, Math.PI * 1.02, TAU * 0.99); ctx.quadraticCurveTo(cx + a * 0.2, top + b * 0.25, cx - a * 0.3, top + b * 0.42); }
  ctx.fill(); ink(ctx, 6);
}
function hat(ctx, cx, top, a, b, look) {
  const kind = look.hat, c = look.hatColor || '#c0392b';
  if (!kind || kind === 'none') return;
  ctx.fillStyle = c;
  if (kind === 'cap') { ctx.beginPath(); ctx.ellipse(cx, top + b * 0.35, a * 1.02, b * 0.42, 0, Math.PI, TAU); ctx.fill(); ink(ctx, 6); ctx.beginPath(); ctx.ellipse(cx + a * 0.55, top + b * 0.36, a * 0.7, 14, 0, 0, TAU); ctx.fillStyle = shade(c, 0.75); ctx.fill(); ink(ctx, 6); }
  else if (kind === 'tophat') { ctx.fillRect(cx - a * 0.62, top - b * 0.75, a * 1.24, b * 0.95); ctx.strokeRect(cx - a * 0.62, top - b * 0.75, a * 1.24, b * 0.95); ink(ctx, 6); ctx.beginPath(); ctx.ellipse(cx, top + b * 0.22, a * 1.05, 16, 0, 0, TAU); ctx.fill(); ink(ctx, 6); ctx.fillStyle = look.hatBand || '#8e2b2b'; ctx.fillRect(cx - a * 0.62, top + b * 0.02, a * 1.24, 18); }
  else if (kind === 'crown') { ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.moveTo(cx - a * 0.7, top + b * 0.2); for (let i = 0; i <= 4; i++) { ctx.lineTo(cx - a * 0.7 + i * a * 0.35, top - b * (i % 2 ? 0.05 : 0.35)); } ctx.lineTo(cx + a * 0.7, top + b * 0.2); ctx.closePath(); ctx.fill(); ink(ctx, 6); ctx.fillStyle = '#e84a5f'; ctx.beginPath(); ctx.arc(cx, top + b * 0.05, 10, 0, TAU); ctx.fill(); }
  else if (kind === 'helmet') {
    if (look.crest !== false) { ctx.fillStyle = look.crest || '#d2372f'; ctx.beginPath(); ctx.ellipse(cx, top - b * 0.02, a * 0.92, b * 0.34, 0, Math.PI, TAU); ctx.fill(); ink(ctx, 6); }
    ctx.fillStyle = look.hatColor || '#aeb6bf'; ctx.beginPath(); ctx.ellipse(cx, top + b * 0.55, a * 1.08, b * 0.72, 0, Math.PI, TAU); ctx.lineTo(cx + a * 1.08, top + b * 1.05); ctx.lineTo(cx + a * 0.8, top + b * 1.05); ctx.lineTo(cx + a * 0.8, top + b * 0.6); ctx.lineTo(cx - a * 0.8, top + b * 0.6); ctx.lineTo(cx - a * 0.8, top + b * 1.05); ctx.lineTo(cx - a * 1.08, top + b * 1.05); ctx.closePath(); ctx.fill(); ink(ctx, 6); ctx.fillStyle = '#d9a845'; ctx.fillRect(cx - a * 1.05, top + b * 0.52, a * 2.1, 14); }
  else if (kind === 'hood') { ctx.beginPath(); ctx.ellipse(cx, top + b * 0.75, a * 1.18, b * 1.08, 0, Math.PI * 0.92, Math.PI * 2.08); ctx.closePath(); ctx.fill(); ink(ctx, 6); }
  else if (kind === 'cowboy') { ctx.beginPath(); ctx.ellipse(cx, top + b * 0.25, a * 1.35, 20, 0, 0, TAU); ctx.fill(); ink(ctx, 6); ctx.beginPath(); ctx.ellipse(cx, top + b * 0.05, a * 0.68, b * 0.38, 0, Math.PI, TAU); ctx.fill(); ink(ctx, 6); }
  else if (kind === 'headband') { ctx.fillRect(cx - a * 0.98, top + b * 0.28, a * 1.96, 22); }
  else if (kind === 'beanie') { ctx.beginPath(); ctx.ellipse(cx, top + b * 0.4, a * 1.02, b * 0.62, 0, Math.PI, TAU); ctx.fill(); ink(ctx, 6); ctx.beginPath(); ctx.arc(cx, top - b * 0.25, 18, 0, TAU); ctx.fill(); ink(ctx, 5); }
  else if (kind === 'chef') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - 35, top - 10, 40, 0, TAU); ctx.arc(cx + 35, top - 10, 40, 0, TAU); ctx.arc(cx, top - 30, 45, 0, TAU); ctx.fill(); ctx.fillRect(cx - a * 0.7, top + 5, a * 1.4, b * 0.3); }
  else if (kind === 'astronaut') { ctx.fillStyle = 'rgba(190,225,255,.35)'; ctx.beginPath(); ctx.ellipse(cx, top + b * 0.95, a * 1.32, b * 1.25, 0, 0, TAU); ctx.fill(); ink(ctx, 7); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(cx - a * 0.6, top + b * 0.35, 18, 34, 0.5, 0, TAU); ctx.fill(); }
  else if (kind === 'wizard') { ctx.beginPath(); ctx.moveTo(cx - a * 0.95, top + b * 0.32); ctx.lineTo(cx + a * 0.2, top - b * 1.35); ctx.lineTo(cx + a * 0.95, top + b * 0.32); ctx.closePath(); ctx.fill(); ink(ctx, 6); ctx.beginPath(); ctx.ellipse(cx, top + b * 0.32, a * 1.3, 18, 0, 0, TAU); ctx.fill(); ink(ctx, 6); ctx.fillStyle = '#f6d55c'; for (const [dx, dy] of [[-20, -60], [15, -120], [-5, -10]]) { ctx.beginPath(); ctx.arc(cx + dx, top + dy, 8, 0, TAU); ctx.fill(); } }
  else if (kind === 'pirate') { ctx.fillStyle = '#1d1d22'; ctx.beginPath(); ctx.moveTo(cx - a * 1.25, top + b * 0.3); ctx.quadraticCurveTo(cx, top - b * 0.75, cx + a * 1.25, top + b * 0.3); ctx.quadraticCurveTo(cx, top + b * 0.05, cx - a * 1.25, top + b * 0.3); ctx.fill(); ink(ctx, 6); ctx.fillStyle = '#fff'; ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('☠', cx, top - b * 0.05); }
  else if (kind === 'graduate') { ctx.fillStyle = '#1d1d22'; ctx.beginPath(); ctx.moveTo(cx - a * 1.2, top + b * 0.05); ctx.lineTo(cx, top - b * 0.3); ctx.lineTo(cx + a * 1.2, top + b * 0.05); ctx.lineTo(cx, top + b * 0.4); ctx.closePath(); ctx.fill(); ink(ctx, 5); ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx, top + b * 0.05); ctx.lineTo(cx + a * 0.9, top + b * 0.55); ctx.stroke(); }
  else if (kind === 'police' || kind === 'pilot' || kind === 'captain') { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(cx, top + b * 0.2, a * 1.05, b * 0.42, 0, Math.PI, TAU); ctx.fill(); ink(ctx, 6); ctx.fillStyle = '#1d1d22'; ctx.beginPath(); ctx.ellipse(cx, top + b * 0.26, a * 1.0, 16, 0, 0, Math.PI); ctx.fill(); ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(cx, top + b * 0.02, 13, 0, TAU); ctx.fill(); }
  else if (kind === 'firefighter') { ctx.fillStyle = c || '#d2372f'; ctx.beginPath(); ctx.ellipse(cx, top + b * 0.32, a * 1.18, b * 0.62, 0, Math.PI, TAU); ctx.fill(); ink(ctx, 6); ctx.beginPath(); ctx.ellipse(cx, top + b * 0.32, a * 1.4, 16, 0, 0, TAU); ctx.fill(); ink(ctx, 6); }
  else if (kind === 'viking') { ctx.fillStyle = '#aeb6bf'; ctx.beginPath(); ctx.ellipse(cx, top + b * 0.4, a * 1.05, b * 0.6, 0, Math.PI, TAU); ctx.fill(); ink(ctx, 6); ctx.fillStyle = '#f4ecd8'; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s2 * a * 0.85, top + b * 0.15); ctx.quadraticCurveTo(cx + s2 * a * 1.6, top - b * 0.1, cx + s2 * a * 1.35, top - b * 0.7); ctx.quadraticCurveTo(cx + s2 * a * 1.2, top - b * 0.1, cx + s2 * a * 0.7, top + b * 0.02); ctx.fill(); ink(ctx, 5); } }
  else if (kind === 'headphones') { ctx.strokeStyle = c; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(cx, top + b * 0.95, a * 1.08, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); ctx.fillStyle = c; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s2 * a * 1.02, top + b * 1.0, 26, 40, 0, 0, TAU); ctx.fill(); ink(ctx, 5); } }
  else if (kind === 'hijab') { ctx.beginPath(); ctx.ellipse(cx, top + b * 0.95, a * 1.22, b * 1.18, 0, Math.PI * 0.88, Math.PI * 2.12); ctx.lineTo(cx + a * 1.1, top + b * 2.3); ctx.lineTo(cx - a * 1.1, top + b * 2.3); ctx.closePath(); ctx.fill(); ink(ctx, 6); }
  else if (kind === 'beret') { ctx.beginPath(); ctx.ellipse(cx - a * 0.15, top + b * 0.2, a * 1.05, b * 0.32, -0.12, 0, TAU); ctx.fill(); ink(ctx, 6); }
  else if (kind === 'santa') { ctx.beginPath(); ctx.moveTo(cx - a * 1.0, top + b * 0.3); ctx.quadraticCurveTo(cx + a * 0.3, top - b * 0.9, cx + a * 1.2, top + b * 0.1); ctx.lineTo(cx + a * 1.0, top + b * 0.3); ctx.closePath(); ctx.fill(); ink(ctx, 6); ctx.fillStyle = '#fff'; ctx.fillRect(cx - a * 1.05, top + b * 0.22, a * 2.1, 26); ctx.beginPath(); ctx.arc(cx + a * 1.2, top + b * 0.1, 20, 0, TAU); ctx.fill(); }
  else if (kind === 'turban') { ctx.beginPath(); ctx.ellipse(cx, top + b * 0.2, a * 1.05, b * 0.5, 0, Math.PI, TAU); ctx.fill(); ink(ctx, 6); ctx.strokeStyle = shade(c, 0.75); ctx.lineWidth = 6; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx, top + b * 0.5, a * (0.6 + i * 0.15), Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); } }
}

/* ---------------- props held in the hand ---------------- */
function prop(ctx, kind, hx, hy, look) {
  if (!kind || kind === 'none') return;
  ctx.save(); ctx.translate(hx, hy);
  const c = look.propColor;
  switch (kind) {
    case 'spear': ctx.fillStyle = '#7a4a2a'; ctx.fillRect(-5, -330, 10, 420); ctx.fillStyle = '#cfd5dc'; ctx.beginPath(); ctx.moveTo(-16, -330); ctx.lineTo(0, -390); ctx.lineTo(16, -330); ctx.closePath(); ctx.fill(); ink(ctx, 5); break;
    case 'sword': ctx.fillStyle = '#d8dee6'; ctx.fillRect(-7, -200, 14, 190); ctx.strokeRect(-7, -200, 14, 190); ctx.fillStyle = '#b8862b'; ctx.fillRect(-30, -14, 60, 12); break;
    case 'ball': ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -10, 40, 0, TAU); ctx.fill(); ink(ctx, 6); ctx.fillStyle = INK; for (const [dx, dy] of [[0, -10], [-24, -30], [22, -30], [-24, 12], [22, 12]]) { ctx.beginPath(); ctx.arc(dx, dy, 9, 0, TAU); ctx.fill(); } break;
    case 'trophy': ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.moveTo(-40, -120); ctx.lineTo(40, -120); ctx.quadraticCurveTo(38, -50, 0, -40); ctx.quadraticCurveTo(-38, -50, -40, -120); ctx.fill(); ink(ctx, 6); ctx.fillRect(-8, -42, 16, 30); ctx.fillRect(-30, -14, 60, 16); ctx.strokeRect(-30, -14, 60, 16); break;
    case 'phone': ctx.fillStyle = '#222'; ctx.fillRect(-24, -70, 48, 90); ctx.fillStyle = '#7fd3ff'; ctx.fillRect(-18, -62, 36, 72); break;
    case 'book': ctx.fillStyle = c || '#8e3b3b'; ctx.fillRect(-45, -60, 90, 70); ink(ctx, 6); ctx.fillStyle = '#f4ecd8'; ctx.fillRect(-40, -55, 80, 6); break;
    case 'cup': ctx.fillStyle = c || '#f0ebe0'; ctx.fillRect(-26, -60, 52, 60); ctx.strokeRect(-26, -60, 52, 60); ctx.beginPath(); ctx.arc(30, -32, 14, -1.3, 1.3); ink(ctx, 6); break;
    case 'flag': ctx.fillStyle = '#7a4a2a'; ctx.fillRect(-5, -300, 10, 330); ctx.fillStyle = c || '#d2372f'; ctx.beginPath(); ctx.moveTo(5, -300); ctx.quadraticCurveTo(70, -280, 130, -295); ctx.lineTo(130, -215); ctx.quadraticCurveTo(70, -200, 5, -220); ctx.closePath(); ctx.fill(); ink(ctx, 5); break;
    case 'money': ctx.fillStyle = '#b08850'; ctx.beginPath(); ctx.ellipse(0, -30, 46, 52, 0, 0, TAU); ctx.fill(); ink(ctx, 6); ctx.fillStyle = '#3d7a3a'; ctx.font = 'bold 50px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', 0, -12); break;
    case 'torch': ctx.fillStyle = '#7a4a2a'; ctx.fillRect(-7, -160, 14, 170); ctx.fillStyle = '#ffb03a'; ctx.beginPath(); ctx.moveTo(-26, -160); ctx.quadraticCurveTo(0, -240, 26, -160); ctx.closePath(); ctx.fill(); break;
    case 'laptop': ctx.fillStyle = '#c9ccd6'; ctx.fillRect(-60, -80, 120, 80); ink(ctx, 5); ctx.fillStyle = '#7fd3ff'; ctx.fillRect(-52, -72, 104, 64); break;
    case 'paper': case 'sign': ctx.fillStyle = '#f6efdc'; ctx.fillRect(-60, -110, 120, 100); ctx.strokeRect(-60, -110, 120, 100); ink(ctx, 5); if (look.propText) { ctx.fillStyle = INK; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(look.propText).slice(0, 10), 0, -52); } break;
    case 'bag': ctx.fillStyle = c || '#8a5a3b'; ctx.fillRect(-45, -50, 90, 70); ink(ctx, 6); break;
    case 'microphone': ctx.fillStyle = '#333'; ctx.fillRect(-7, -70, 14, 80); ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(0, -82, 20, 0, TAU); ctx.fill(); ink(ctx, 5); break;
    case 'wand': ctx.fillStyle = '#5a3b2a'; ctx.fillRect(-5, -150, 10, 160); ctx.fillStyle = '#f6d55c'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 28, a2 = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(Math.cos(a2) * r, -160 + Math.sin(a2) * r); } ctx.closePath(); ctx.fill(); ink(ctx, 4); break;
    case 'shield': ctx.fillStyle = c || '#b8322f'; ctx.beginPath(); ctx.moveTo(-70, -120); ctx.lineTo(70, -120); ctx.lineTo(70, 0); ctx.quadraticCurveTo(0, 90, -70, 0); ctx.closePath(); ctx.fill(); ink(ctx, 6); ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(0, -40, 18, 0, TAU); ctx.fill(); break;
    case 'hammer': ctx.fillStyle = '#7a4a2a'; ctx.fillRect(-6, -150, 12, 160); ctx.fillStyle = '#8a8f99'; ctx.fillRect(-45, -180, 90, 40); ink(ctx, 5); break;
    case 'umbrella': ctx.fillStyle = '#333'; ctx.fillRect(-4, -230, 8, 240); ctx.fillStyle = c || '#e8435a'; ctx.beginPath(); ctx.arc(0, -230, 120, Math.PI, TAU); ctx.closePath(); ctx.fill(); ink(ctx, 6); break;
    case 'gun': ctx.fillStyle = '#ff7a3a'; ctx.fillRect(-10, -40, 70, 26); ctx.fillRect(-10, -20, 20, 40); ink(ctx, 5); break;
    case 'camera': ctx.fillStyle = '#2b2b33'; ctx.fillRect(-50, -60, 100, 64); ctx.fillStyle = '#7fd3ff'; ctx.beginPath(); ctx.arc(0, -28, 22, 0, TAU); ctx.fill(); ink(ctx, 5); break;
    case 'guitar': ctx.fillStyle = '#c47a3a'; ctx.beginPath(); ctx.ellipse(0, 0, 50, 62, 0, 0, TAU); ctx.fill(); ink(ctx, 5); ctx.fillStyle = '#5a3b2a'; ctx.fillRect(-7, -190, 14, 150); break;
    default: if (look.propEmoji || /\p{Extended_Pictographic}/u.test(kind)) { ctx.font = '120px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(look.propEmoji || kind, 0, -40); } break;
  }
  ctx.restore();
}

/* ---------------- arms: where the hands are ---------------- */
// poses: hang wave point up cheer hip cross hold reach thumb facepalm shrug
function hands(pose, s, sh, t) {
  const L = 150, wave = Math.sin(t * 9) * 0.35;
  const at = (ang, len = L) => [sh[0] + s * Math.sin(ang) * len, sh[1] + Math.cos(ang) * len];
  switch (pose) {
    case 'wave': return s > 0 ? [at(Math.PI * 0.85 + wave, L * 0.95), 'up'] : [at(0.18), 'down'];
    case 'point': return s > 0 ? [at(Math.PI * 0.55), 'side'] : [at(0.16), 'down'];
    case 'up': case 'cheer': return [at(Math.PI * 0.86 + (pose === 'cheer' ? Math.sin(t * 7 + s) * 0.15 : 0)), 'up'];
    case 'hip': return [[sh[0] + s * 70, sh[1] + 110], 'hip'];
    case 'cross': return [[sh[0] - s * 60, sh[1] + 70], 'cross'];
    case 'hold': return [[sh[0] - s * 35, sh[1] + 120], 'front'];
    case 'reach': return s > 0 ? [at(Math.PI * 0.62, L * 1.05), 'side'] : [at(0.2), 'down'];
    case 'thumb': return s > 0 ? [[sh[0] + 60, sh[1] + 40], 'thumb'] : [at(0.16), 'down'];
    case 'facepalm': return s > 0 ? [[sh[0] - 70, sh[1] - 120], 'face'] : [at(0.16), 'down'];
    case 'shrug': return [[sh[0] + s * 120, sh[1] - 10], 'shrug'];
    default: return [at(0.16 + Math.sin(t * 1.3 + s) * 0.03), 'down'];
  }
}

/* ---------------- legs: one rule for every frame ---------------- */
// hip -> foot is always LEG long; a walk only changes the angle (forward/back swing), so both legs stay equal
export const HIP_Y = 795, LEG = SOLE - 22 - HIP_Y;
export function legGeometry(step, s) {
  const hip = [CARD_W / 2 + s * 40, HIP_Y];
  const ang = s * 0.04 + s * Math.sin(step * TAU) * 0.24;
  return { hip, foot: [hip[0] + Math.sin(ang) * LEG, hip[1] + Math.cos(ang) * LEG] };
}

/* ---------------- the whole character ---------------- */
// look: {skin, hair, hairStyle, brows, hat, hatColor, top (shirt colour), bottom, outfit: tunic|suit|dress|armor|jersey|robe|apron, number, cape, beard, moustache, prop, propColor, propText, stout}
// state: {face, pose, mouth 0..1, blink, lookX -1..1, step 0..1 (walk phase), t}
export function drawBean(ctx, look = {}, st = {}) {
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  const t = st.t || 0, skin = look.skin || '#f5c9a0', top = look.top || '#4f7fb8', bottom = look.bottom || shade(top, 0.6);
  const cx = CARD_W / 2, stout = look.stout ? 1.18 : 1;
  // fixed proportions: the body never stretches (an idle bob moves the whole card in 3D, never one part)
  const a = 132, b = 146, hc = 330;                                         // the bean head: half-width a, half-height b
  const neckY = hc + b * 0.92, shY = neckY + 26, hipY = 805, bw = 108 * stout;
  // legs: two segments of the SAME length that only rotate, so one leg can never be shorter than the other
  ctx.strokeStyle = INK; ctx.lineWidth = 20; ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    const { hip, foot } = legGeometry(st.step || 0, s);
    ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(foot[0], foot[1]); ctx.stroke();
    ctx.fillStyle = look.shoes || '#3a2a22'; ctx.beginPath(); ctx.ellipse(foot[0] + s * 10, foot[1] + 8, 34, 16, 0, 0, TAU); ctx.fill(); ink(ctx, 5);
  }
  // cape behind the body
  if (look.cape) { ctx.fillStyle = look.cape; ctx.beginPath(); ctx.moveTo(cx - bw * 0.9, shY); ctx.lineTo(cx + bw * 0.9, shY); ctx.lineTo(cx + bw * 1.25, hipY + 120 + Math.sin(t * 3) * 6); ctx.lineTo(cx - bw * 1.25, hipY + 120 - Math.sin(t * 3) * 6); ctx.closePath(); ctx.fill(); ink(ctx, 6); }
  // the body
  const outfit = look.outfit || 'tunic';
  const body = () => { ctx.beginPath(); ctx.moveTo(cx - bw * 0.82, shY); ctx.quadraticCurveTo(cx, shY - 18, cx + bw * 0.82, shY); ctx.lineTo(cx + bw * (outfit === 'dress' || outfit === 'robe' ? 1.35 : 1.02), hipY + (outfit === 'dress' || outfit === 'robe' ? 140 : 20)); ctx.lineTo(cx - bw * (outfit === 'dress' || outfit === 'robe' ? 1.35 : 1.02), hipY + (outfit === 'dress' || outfit === 'robe' ? 140 : 20)); ctx.closePath(); };
  if (outfit !== 'dress' && outfit !== 'robe') { ctx.fillStyle = bottom; ctx.beginPath(); ctx.moveTo(cx - bw, hipY - 10); ctx.lineTo(cx + bw, hipY - 10); ctx.lineTo(cx + bw * 0.85, hipY + 70); ctx.lineTo(cx - bw * 0.85, hipY + 70); ctx.closePath(); ctx.fill(); ink(ctx, 6); }
  fillShaded(ctx, body, outfit === 'armor' ? '#aeb6bf' : top, cx - bw, cx + bw); body(); ink(ctx, 7);
  ctx.save(); body(); ctx.clip();
  if (outfit === 'suit') { ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.moveTo(cx - 34, shY - 10); ctx.lineTo(cx + 34, shY - 10); ctx.lineTo(cx, shY + 150); ctx.closePath(); ctx.fill(); ctx.fillStyle = look.tie || '#c0392b'; ctx.beginPath(); ctx.moveTo(cx - 12, shY + 6); ctx.lineTo(cx + 12, shY + 6); ctx.lineTo(cx + 16, shY + 120); ctx.lineTo(cx, shY + 140); ctx.lineTo(cx - 16, shY + 120); ctx.closePath(); ctx.fill(); }
  if (outfit === 'armor') { ctx.strokeStyle = 'rgba(40,40,60,.45)'; ctx.lineWidth = 5; for (let y = shY + 40; y < hipY; y += 42) { ctx.beginPath(); ctx.moveTo(cx - bw, y); ctx.quadraticCurveTo(cx, y + 14, cx + bw, y); ctx.stroke(); } }
  if (outfit === 'jersey') { ctx.fillStyle = look.stripe || '#ffffff'; ctx.fillRect(cx - bw, shY + 60, bw * 2, 26); ctx.fillStyle = look.numberColor || '#fff'; ctx.font = 'bold 110px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(look.number ?? 10), cx, shY + 175); }
  if (outfit === 'space') { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(cx - 40, shY + 60, 80, 60); ctx.fillStyle = '#e8435a'; ctx.fillRect(cx - 30, shY + 72, 18, 14); ctx.fillStyle = '#4f7fb8'; ctx.fillRect(cx + 4, shY + 72, 24, 14); }
  if (outfit === 'labcoat') { ctx.fillStyle = '#f7f7f4'; ctx.fillRect(cx - bw * 1.1, shY - 20, bw * 0.75, hipY - shY + 120); ctx.fillRect(cx + bw * 0.35, shY - 20, bw * 0.75, hipY - shY + 120); }
  if (outfit === 'uniform') { ctx.fillStyle = '#f2c230'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx, shY + 50 + i * 55, 8, 0, TAU); ctx.fill(); } ctx.fillRect(cx - bw, shY + 4, 40, 14); ctx.fillRect(cx + bw - 40, shY + 4, 40, 14); }
  if (outfit === 'hoodie') { ctx.fillStyle = shade(top, 0.82); ctx.fillRect(cx - bw * 0.55, hipY - 130, bw * 1.1, 80); ctx.strokeStyle = '#f4f4f4'; ctx.lineWidth = 5; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s2 * 22, shY + 6); ctx.lineTo(cx + s2 * 22, shY + 90); ctx.stroke(); } }
  if (outfit === 'overalls') { ctx.fillStyle = look.bottom || '#3f6aa8'; ctx.fillRect(cx - bw * 0.6, shY + 90, bw * 1.2, hipY - shY - 80); ctx.fillRect(cx - bw * 0.62, shY - 10, 18, 110); ctx.fillRect(cx + bw * 0.62 - 18, shY - 10, 18, 110); }
  if (outfit === 'kimono') { ctx.strokeStyle = shade(top, 0.6); ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(cx - 60, shY - 6); ctx.lineTo(cx + 40, hipY - 30); ctx.stroke(); ctx.fillStyle = look.belt || '#d2372f'; ctx.fillRect(cx - bw, hipY - 120, bw * 2, 40); }
  if (outfit === 'robot') { ctx.fillStyle = '#7fd3ff'; ctx.fillRect(cx - 50, shY + 60, 100, 70); ctx.fillStyle = '#f2c230'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx - 30 + i * 30, shY + 170, 10, 0, TAU); ctx.fill(); } }
  if (outfit === 'apron') { ctx.fillStyle = '#efe6d2'; ctx.fillRect(cx - bw * 0.6, shY + 70, bw * 1.2, hipY - shY); }
  ctx.restore();
  if (look.belt !== false && outfit !== 'dress' && outfit !== 'robe' && outfit !== 'suit') { ctx.fillStyle = look.belt || '#5a3b2a'; ctx.fillRect(cx - bw * 1.02, hipY - 20, bw * 2.04, 22); }
  // arms and hands
  const shL = [cx - bw * 0.78, shY + 16], shR = [cx + bw * 0.78, shY + 16];
  let propHand = null;
  for (const [s, sh] of [[-1, shL], [1, shR]]) {
    const [hand] = hands(st.pose, s, sh, t);
    ctx.strokeStyle = top; ctx.lineWidth = 30; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(sh[0] + 4 * s, sh[1] + 10); ctx.lineTo(hand[0], hand[1]); ctx.globalAlpha = 0.18; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hand[0], hand[1], 22, 0, TAU); ctx.fill(); ink(ctx, 6);
    if (s > 0 || st.pose === 'hold') propHand = propHand || hand;
  }
  // the head
  ctx.fillStyle = skin;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * a * 0.98, hc + 10, 22, 30, 0, 0, TAU); ctx.fill(); ink(ctx, 6); }
  const head = () => { ctx.beginPath(); ctx.ellipse(cx, hc, a, b, 0, 0, TAU); };
  fillShaded(ctx, head, skin, cx - a, cx + a); head(); ink(ctx, 8);
  hair(ctx, cx, hc - b, a, b, look);
  face(ctx, cx, hc, a, b, st, look);
  if (look.beard) { ctx.fillStyle = look.beard; ctx.beginPath(); ctx.moveTo(cx - a * 0.75, hc + b * 0.25); ctx.quadraticCurveTo(cx, hc + b * 1.55, cx + a * 0.75, hc + b * 0.25); ctx.quadraticCurveTo(cx, hc + b * 0.75, cx - a * 0.75, hc + b * 0.25); ctx.fill(); ink(ctx, 6); }
  if (look.moustache) { ctx.fillStyle = look.moustache; ctx.beginPath(); ctx.ellipse(cx - 22, hc + b * 0.3, 26, 11, 0.2, 0, TAU); ctx.ellipse(cx + 22, hc + b * 0.3, 26, 11, -0.2, 0, TAU); ctx.fill(); }
  // animal ears and snout turn the bean into a cute animal; a robot gets antennae and a screen face
  if (look.ears && look.ears !== 'none') {
    const ec = look.earColor || look.skin || skin;
    for (const s2 of [-1, 1]) {
      ctx.fillStyle = ec; ctx.beginPath();
      if (look.ears === 'cat' || look.ears === 'fox') { ctx.moveTo(cx + s2 * a * 0.35, hc - b * 0.85); ctx.lineTo(cx + s2 * a * 0.95, hc - b * 1.35); ctx.lineTo(cx + s2 * a * 0.92, hc - b * 0.55); }
      else if (look.ears === 'rabbit') ctx.ellipse(cx + s2 * a * 0.45, hc - b * 1.45, 30, 95, s2 * 0.15, 0, TAU);
      else if (look.ears === 'dog') ctx.ellipse(cx + s2 * a * 1.02, hc - b * 0.15, 36, 78, s2 * -0.25, 0, TAU);
      else ctx.ellipse(cx + s2 * a * 0.78, hc - b * 0.82, 44, 44, 0, 0, TAU);
      ctx.closePath(); ctx.fill(); ink(ctx, 6);
    }
    if (look.snout !== false) { ctx.fillStyle = look.snoutColor || '#f6e6d6'; ctx.beginPath(); ctx.ellipse(cx, hc + b * 0.33, a * 0.36, b * 0.22, 0, 0, TAU); ctx.fill(); ink(ctx, 5); ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(cx, hc + b * 0.22, 16, 11, 0, 0, TAU); ctx.fill(); }
    if (look.ears === 'cat') { ctx.strokeStyle = INK; ctx.lineWidth = 3; for (const s2 of [-1, 1]) for (const dy of [-6, 8]) { ctx.beginPath(); ctx.moveTo(cx + s2 * a * 0.3, hc + b * 0.3 + dy); ctx.lineTo(cx + s2 * a * 0.85, hc + b * 0.25 + dy * 2); ctx.stroke(); } }
  }
  if (look.antenna) { ctx.strokeStyle = INK; ctx.lineWidth = 6; for (const s2 of (look.antenna === 2 ? [-1, 1] : [0])) { ctx.beginPath(); ctx.moveTo(cx + s2 * 40, hc - b); ctx.lineTo(cx + s2 * 60, hc - b - 80); ctx.stroke(); ctx.fillStyle = look.antennaColor || '#e8435a'; ctx.beginPath(); ctx.arc(cx + s2 * 60, hc - b - 86, 14, 0, TAU); ctx.fill(); } }
  if (look.sunglasses) { ctx.fillStyle = '#16161c'; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s2 * a * 0.36, hc + 4, 34, 24, 0, 0, TAU); ctx.fill(); } ctx.fillRect(cx - 20, hc - 2, 40, 7); }
  if (look.scarf) { ctx.fillStyle = look.scarf; ctx.fillRect(cx - bw * 0.85, neckY - 6, bw * 1.7, 38); ctx.fillRect(cx + 30, neckY + 20, 34, 110); }
  if (look.medal) { ctx.strokeStyle = '#3f6aa8'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(cx - 40, neckY + 10); ctx.lineTo(cx, neckY + 110); ctx.lineTo(cx + 40, neckY + 10); ctx.stroke(); ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(cx, neckY + 120, 26, 0, TAU); ctx.fill(); ink(ctx, 5); }
  if (look.bowtie) { ctx.fillStyle = look.bowtie; ctx.beginPath(); ctx.moveTo(cx, neckY + 18); ctx.lineTo(cx - 34, neckY); ctx.lineTo(cx - 34, neckY + 36); ctx.closePath(); ctx.moveTo(cx, neckY + 18); ctx.lineTo(cx + 34, neckY); ctx.lineTo(cx + 34, neckY + 36); ctx.closePath(); ctx.fill(); }
  if (look.mask) { ctx.fillStyle = look.mask === true ? '#9fd3e8' : look.mask; ctx.beginPath(); ctx.ellipse(cx, hc + b * 0.42, a * 0.62, b * 0.3, 0, 0, TAU); ctx.fill(); ink(ctx, 5); }
  if (look.glasses) { ctx.strokeStyle = INK; ctx.lineWidth = 6; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * a * 0.36, hc + 4, 28, 0, TAU); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(cx - 14, hc); ctx.lineTo(cx + 14, hc); ctx.stroke(); }
  hat(ctx, cx, hc - b, a, b, look);
  if (propHand) prop(ctx, look.prop, propHand[0], propHand[1], look);
}
