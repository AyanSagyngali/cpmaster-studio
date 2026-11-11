// A living cover for every style, drawn with the same engines as the videos, so the cover never lies about the look.
// The 3D cover is rendered once into a short flip-book (one WebGL context, then freed), the others draw live.
import { drawCardShot } from './cards.js';
import { drawFigure, drawAnimal, ACTIONS } from './anim.js';

const TAU = Math.PI * 2;
let multFrames = null, multLoading = null;

// the 3D cartoon: a striker lifts the World Cup in a night stadium, filmed by a slow orbit (24 frames, looped)
async function multFlipbook(w, h) {
  if (multFrames) return multFrames;
  if (multLoading) return multLoading;
  multLoading = (async () => {
    const { World } = await import('./world3d.js');
    const world = new World(w * 2, h * 2);
    world.load({
      cast: [{ id: 'hero', look: { skin: '#c99067', hair: '#1e1714', hairStyle: 'spiky', outfit: 'jersey', top: '#1f5fbf', number: 10, prop: 'trophy' } }, { id: 'fan', look: { skin: '#f5c9a0', hair: '#c46a2b', hairStyle: 'long', outfit: 'tunic', top: '#f2c230' } }],
      sets: [{ id: 's', ground: 'field', time: 'night', objects: [{ type: 'stadium', w: 22 }, { type: 'field' }, { type: 'goal', z: -9 }, { type: 'flag', x: -3.5, z: -3, color: '#1f5fbf' }] }],
    });
    const frames = [];
    for (let i = 0; i < 24; i++) {
      const c = new OffscreenCanvas(w * 2, h * 2), x = c.getContext('2d'), t = i / 12;
      const shot = { set: 's', actors: [{ id: 'hero', x: 0, z: 0, face: 'laugh', pose: 'hold', action: 'hop' }, { id: 'fan', x: -1.6, z: -1.2, face: 'happy', pose: 'cheer', action: 'hop' }], camera: { size: 'medium', target: 'hero', angle: 'low', move: 'static', side: -20 + i * 1.6 } };
      world.paint(x, shot, t, 2, t, 0.3, null, w * 2, h * 2);
      frames.push(await createImageBitmap(c));
    }
    world.dispose();
    return (multFrames = frames);
  })();
  return multLoading;
}

// the What If look: dusk purple and navy, one amber light, a rim-lit silhouette, a glowing question
function drawWhatIf(ctx, t, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0f1230'); g.addColorStop(0.6, '#3b2f55'); g.addColorStop(1, '#120d1c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const lx = W * 0.62, ly = H * 0.36, gl = ctx.createRadialGradient(lx, ly, 0, lx, ly, W * 0.8);
  gl.addColorStop(0, `rgba(242,165,65,${0.55 + 0.1 * Math.sin(t * 2)})`); gl.addColorStop(1, 'rgba(242,165,65,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.12; ctx.fillStyle = '#f6c86a';
  for (let i = 0; i < 5; i++) { const a = 1.9 + i * 0.13 + Math.sin(t * 0.3 + i) * 0.02; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + Math.cos(a - 0.03) * W * 2, ly + Math.sin(a - 0.03) * W * 2); ctx.lineTo(lx + Math.cos(a + 0.03) * W * 2, ly + Math.sin(a + 0.03) * W * 2); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = '#0a0810'; ctx.fillRect(0, H * 0.84, W, H * 0.16);
  const pose = ACTIONS[['think', 'point', 'surprised'][Math.floor(t / 2) % 3]](t, 2);
  ctx.save(); ctx.shadowColor = '#f2a541'; ctx.shadowBlur = 18;
  drawFigure(ctx, { x: W * 0.38, y: H * 0.85, scale: W / 300, facing: 1, pose, silhouette: true }, t, 0);
  ctx.restore();
  ctx.save(); ctx.font = `900 ${W * 0.36}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#f2a541'; ctx.shadowBlur = 30 + 10 * Math.sin(t * 3); ctx.fillStyle = '#ffd38a';
  ctx.translate(W * 0.68, H * 0.3); ctx.rotate(Math.sin(t) * 0.06); ctx.fillText('?', 0, 0); ctx.restore();
  ctx.save(); ctx.font = `800 ${W * 0.1}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,230,190,.9)'; ctx.textAlign = 'center';
  ctx.fillText(['×10', '500 IQ', '∞'][Math.floor(t / 2) % 3], W * 0.7, H * 0.56); ctx.restore();
}

// the Historian look: warm parchment, a doodle rider with a banner crossing the steppe, a fortress far away
function drawIstorik(ctx, t, W, H) {
  ctx.fillStyle = '#efe2c2'; ctx.fillRect(0, 0, W, H);
  const sun = ctx.createRadialGradient(W * 0.75, H * 0.22, 0, W * 0.75, H * 0.22, W * 0.5); sun.addColorStop(0, 'rgba(246,190,90,.8)'); sun.addColorStop(1, 'rgba(246,190,90,0)'); ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#d7a33c'; ctx.beginPath(); ctx.arc(W * 0.75, H * 0.22, W * 0.09, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#1b1714'; ctx.lineWidth = 3; ctx.fillStyle = '#c9a26a';
  ctx.beginPath(); ctx.moveTo(0, H * 0.62); ctx.quadraticCurveTo(W * 0.3, H * 0.52, W * 0.55, H * 0.6); ctx.quadraticCurveTo(W * 0.8, H * 0.66, W, H * 0.57); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b98a52'; for (const [x, w2, h2] of [[0.12, 0.08, 0.12], [0.22, 0.05, 0.18], [0.29, 0.08, 0.1]]) { ctx.fillRect(W * x, H * (0.58 - h2), W * w2, H * h2); ctx.strokeRect(W * x, H * (0.58 - h2), W * w2, H * h2); }
  // a rider with a banner gallops in from one edge and out at the other
  const x = ((t * 55) % (W + 320)) - 160;
  const seat = drawAnimal(ctx, { kind: 'horse', color: '#8a5a3b', scale: W / 420 }, { x, y: H * 0.9, facing: 1, gait: 'run' }, t);
  const rs = W / 420;
  drawFigure(ctx, { x: seat[0], y: seat[1], scale: rs, facing: 1, pose: ACTIONS.ride(t), seat: true, outfit: { color: '#a8231f', belt: '#5a3d2b' } }, t, 0);
  ctx.strokeStyle = '#1b1714'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(seat[0] - 6 * rs, seat[1] - 230 * rs); ctx.lineTo(seat[0] - 6 * rs, seat[1] - 40 * rs); ctx.stroke();
  ctx.fillStyle = '#a8231f'; ctx.beginPath(); ctx.moveTo(seat[0] - 6 * rs, seat[1] - 230 * rs);
  for (let i = 0; i <= 6; i++) ctx.lineTo(seat[0] - 6 * rs - i * 14 * rs, seat[1] - 230 * rs + Math.sin(t * 9 + i * 0.8) * 5 * rs);
  for (let i = 6; i >= 0; i--) ctx.lineTo(seat[0] - 6 * rs - i * 14 * rs, seat[1] - 180 * rs + Math.sin(t * 9 + i * 0.8) * 5 * rs);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

const CARD_DEMO = {
  paper: [{ kind: 'chart', title: 'Подписчики', points: [1, 2, 2, 4, 7, 12], value: '9211' }, { kind: 'emojis', items: [{ icon: '💡', label: 'идея' }, { icon: '⌨️', label: 'код' }, { icon: '🎬', label: 'видео' }] }, { kind: 'number', label: 'Траты', value: '0', suffix: ' ₽', sub: 'всё на телефоне' }],
  mascot: [{ kind: 'step', n: 1, of: 4, icon: '🎙️', title: 'Голос', stat: '★ 46 195' }, { kind: 'list', items: [{ icon: '✅', text: 'Бесплатно', mark: 'check' }, { icon: '📱', text: 'На телефоне', mark: 'check' }, { icon: '💸', text: 'Подписка', mark: 'cross' }] }, { kind: 'number', label: 'За год', value: '23880', suffix: ' ₽' }],
};

// start a live cover on a canvas; returns stop()
export function cover(canvas, style) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height; let raf = 0, alive = true; const t0 = performance.now();
  const loop = (fn) => { const f = (now) => { if (!alive) return; fn(Math.max(0, (now - t0) / 1000)); raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); };
  if (style === 'mult') {
    ctx.fillStyle = '#0b1430'; ctx.fillRect(0, 0, W, H);
    multFlipbook(W, H).then((fr) => loop((t) => ctx.drawImage(fr[Math.floor(t * 12) % fr.length], 0, 0, W, H))).catch(() => loop((t) => drawWhatIf(ctx, t, W, H)));
  } else if (style === 'razgon') loop((t) => drawWhatIf(ctx, t, W, H));
  else if (style === 'istorik') loop((t) => drawIstorik(ctx, t, W, H));
  else if (style === 'paper' || style === 'mascot') {
    const demo = CARD_DEMO[style];
    loop((t) => { const i = Math.floor(t / 3) % demo.length; ctx.setTransform(W / 720, 0, 0, H / 900, 0, 0); drawCardShot(ctx, { theme: style, card: demo[i], mood: ['surprised', 'happy', 'smug'][i] }, t % 3, 3, 720, 900, 0.25 + 0.25 * Math.sin(t * 9), t); ctx.setTransform(1, 0, 0, 1, 0, 0); });
  } else {                                                                   // Auto: the looks in turn behind a turning die
    loop((t) => {
      const k = Math.floor(t / 2.5) % 3;
      if (k === 0) drawWhatIf(ctx, t, W, H); else if (k === 1) drawIstorik(ctx, t, W, H); else { ctx.setTransform(W / 720, 0, 0, H / 900, 0, 0); drawCardShot(ctx, { theme: 'paper', card: CARD_DEMO.paper[0] }, t % 2.5, 2.5, 720, 900, 0.2, t); ctx.setTransform(1, 0, 0, 1, 0, 0); }
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, H * 0.42); ctx.rotate(t * 1.4); ctx.font = `${W * 0.34}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎲', 0, 0); ctx.restore();
    });
  }
  return () => { alive = false; cancelAnimationFrame(raf); };
}
