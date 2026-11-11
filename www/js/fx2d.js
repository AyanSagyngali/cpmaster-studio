// Drawn on top of every frame: Shorts captions (2–3 words, the spoken word in yellow and popping) and the effects of
// a 3D shot (confetti, sparkles, hearts, Zzz / ? / ! above a character's head, rain, snow, dust, money, a flash).
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const back = (u) => { u = clamp(u); const c = 1.70158; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const FONT = (px) => `900 ${Math.round(px)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const EMO = (px) => `${Math.round(px)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;

/* ---------------- Shorts captions ---------------- */
// words: [{j (line), t0, t1, w}]; the group is the 1–3 words around the spoken one, never across two lines
export function drawShortsCaption(ctx, words, wi, t, W, H) {
  // ONE word at a time, exactly while it is spoken: big, white with a black outline, popping in; long or number words in yellow
  const w = words[wi]; if (!w || t < w.t0 - 0.02 || t > w.t1 + 0.12) return;
  const k = Math.min(W, H) / 1080, y = H > W ? H * 0.68 : H * 0.84, word = String(w.w).replace(/[.,!?;:…]+$/, '').toUpperCase();
  if (!word) return;
  const u = back((t - w.t0) / 0.12), hot = /\d/.test(word) || word.length >= 8;
  ctx.save(); ctx.font = FONT(104 * k); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const s2 = Math.min(1, (W * 0.9) / Math.max(1, ctx.measureText(word).width)) * (0.82 + 0.18 * u);
  ctx.translate(W / 2, y); ctx.scale(s2, s2);
  ctx.lineWidth = 22 * k; ctx.strokeStyle = '#111'; ctx.strokeText(word, 0, 0);
  ctx.fillStyle = hot ? '#ffd23f' : '#ffffff'; ctx.fillText(word, 0, 0);
  ctx.restore();
}

/* ---------------- effects of a 3D shot ---------------- */
export function drawWorldFx(ctx, world, shot, lt, t, W, H) {
  const fx = shot.fx || []; if (!fx.length) return;
  const k = Math.min(W, H) / 1080, r = rng(shot.line * 97 + 3);
  const heads = (shot.actors || []).map((a) => world.headOf(a.id)).filter(Boolean).map((p) => world.project(p[0], p[1], p[2], W, H)).filter((p) => p[2]);
  ctx.save();
  for (const f of fx) {
    if (f === 'confetti' || f === 'money') {
      for (let i = 0; i < 70; i++) {
        const x0 = r() * W, sp = 0.6 + r(), y = ((r() * H * 0.6 + lt * 380 * sp * k) % (H + 80)) - 40, x = x0 + Math.sin(lt * 3 * sp + i) * 40 * k;
        ctx.save(); ctx.translate(x, y); ctx.rotate(lt * 5 * sp + i);
        if (f === 'money') { ctx.font = EMO(46 * k); ctx.fillText('💵', 0, 0); }
        else { ctx.fillStyle = ['#ff5a5f', '#ffd23f', '#3ec6ff', '#7bd389', '#c77dff'][i % 5]; ctx.fillRect(-9 * k, -5 * k, 18 * k, 10 * k * Math.abs(Math.sin(lt * 6 + i))); }
        ctx.restore();
      }
    } else if (f === 'sparkles' || f === 'stars') {
      for (let i = 0; i < 26; i++) { const a = Math.max(0, Math.sin(lt * (2 + r() * 2) + i)); const x = r() * W, y = r() * H * 0.8; ctx.globalAlpha = a; ctx.fillStyle = '#fff6c8'; const s = (6 + r() * 12) * k; ctx.beginPath(); ctx.moveTo(x, y - s * 2); ctx.lineTo(x + s * 0.4, y - s * 0.4); ctx.lineTo(x + s * 2, y); ctx.lineTo(x + s * 0.4, y + s * 0.4); ctx.lineTo(x, y + s * 2); ctx.lineTo(x - s * 0.4, y + s * 0.4); ctx.lineTo(x - s * 2, y); ctx.lineTo(x - s * 0.4, y - s * 0.4); ctx.closePath(); ctx.fill(); }
      ctx.globalAlpha = 1;
    } else if (f === 'rain') {
      ctx.strokeStyle = 'rgba(210,225,255,.55)'; ctx.lineWidth = 3 * k; for (let i = 0; i < 90; i++) { const x = r() * W, y = ((r() * H + lt * 1400 * k) % H); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8 * k, y + 34 * k); ctx.stroke(); }
    } else if (f === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 80; i++) { const x = r() * W + Math.sin(lt + i) * 20 * k, y = ((r() * H + lt * 90 * k * (0.5 + r())) % H); ctx.beginPath(); ctx.arc(x, y, (3 + r() * 4) * k, 0, TAU); ctx.fill(); }
    } else if (f === 'dust' || f === 'smoke') {
      for (let i = 0; i < 14; i++) { const ph = (lt * 0.6 + r()) % 1, x = W * (0.2 + r() * 0.6) + ph * 80 * k * (r() - 0.5), y = H * (f === 'smoke' ? 0.5 - ph * 0.4 : 0.8 - ph * 0.1); ctx.globalAlpha = 0.35 * Math.sin(ph * Math.PI); ctx.fillStyle = f === 'smoke' ? '#bfc4cc' : '#d8c3a0'; ctx.beginPath(); ctx.arc(x, y, (40 + ph * 90) * k, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    } else if (f === 'flash') {
      ctx.fillStyle = `rgba(255,255,255,${clamp(1 - lt / 0.35) * 0.9})`; ctx.fillRect(0, 0, W, H);
    } else for (const [hx, hy] of heads) {                                // things above a head
      if (f === 'zzz') { ctx.font = FONT(56 * k); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 8 * k; for (let i = 0; i < 3; i++) { const ph = (lt * 0.8 + i / 3) % 1; ctx.globalAlpha = Math.sin(ph * Math.PI); const x = hx + ph * 80 * k, y = hy - ph * 160 * k; ctx.strokeText('Z', x, y); ctx.fillText('Z', x, y); } ctx.globalAlpha = 1; }
      if (f === 'question' || f === 'exclaim') { const u = back(lt / 0.3), s = f === 'question' ? '?' : '!'; ctx.save(); ctx.translate(hx + 40 * k, hy - 60 * k + Math.sin(lt * 4) * 6 * k); ctx.scale(u, u); ctx.font = FONT(120 * k); ctx.textAlign = 'center'; ctx.lineWidth = 12 * k; ctx.strokeStyle = '#222'; ctx.strokeText(s, 0, 0); ctx.fillStyle = f === 'question' ? '#ffd23f' : '#ff5a5f'; ctx.fillText(s, 0, 0); ctx.restore(); }
      if (f === 'hearts') { ctx.font = EMO(54 * k); for (let i = 0; i < 4; i++) { const ph = (lt * 0.7 + i / 4) % 1; ctx.globalAlpha = Math.sin(ph * Math.PI); ctx.fillText('❤️', hx + (i - 1.5) * 50 * k + Math.sin(ph * 6) * 10 * k, hy - ph * 200 * k); } ctx.globalAlpha = 1; }
      if (f === 'tears') { ctx.fillStyle = '#7cc4ff'; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const ph = (lt * 1.5 + i / 3) % 1; ctx.beginPath(); ctx.ellipse(hx + s * 34 * k, hy + 150 * k + ph * 120 * k, 7 * k, 11 * k, 0, 0, TAU); ctx.fill(); } }
    }
  }
  ctx.restore();
}
