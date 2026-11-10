// Infographic card styles (drawn by code, so they are crisp and fast on a weak phone):
//  paper  — warm cream paper with dots, floating white cards, one word at a time with an accent pill, a small pixel buddy
//  mascot — dark studio, a dark info card on top, a big felt gem-mascot below whose face reacts to every line
// Gemini only says WHAT is on each card (a fixed widget vocabulary); everything moves here.

export const THEMES = {
  paper: { bg: '#f7ede3', bg2: '#f0d9c6', dot: 'rgba(140,90,50,.13)', card: '#fffaf5', ink: '#2b2119', sub: '#8d7866', line: 'rgba(80,50,30,.10)', accent: '#e2703a', accentInk: '#fff', good: '#3f9a5b', bad: '#d2483a', wave: '#e2703a', shadow: 'rgba(120,70,30,.22)', chip: '#f3e4d6' },
  mascot: { bg: '#18191c', bg2: '#34312e', dot: 'rgba(255,255,255,.035)', card: '#25262a', ink: '#f4f4f5', sub: '#9b9ba5', line: 'rgba(255,255,255,.08)', accent: '#f26b3a', accentInk: '#fff', good: '#43c46e', bad: '#e2483c', wave: '#9a6bff', shadow: 'rgba(0,0,0,.5)', chip: '#33343a' },
};
const F = (w, px) => `${w} ${Math.round(px)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const EMO = (px) => `${Math.round(px)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;   // colour emoji, never a grey glyph
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (u) => 1 - Math.pow(1 - clamp(u), 3);
const back = (u) => { u = clamp(u); const c = 1.70158; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
const pop = (lt, at = 0, d = 0.45) => back((lt - at) / d);

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function wrap(ctx, text, maxW) {
  const out = []; let cur = '';
  for (const w of String(text || '').split(/\s+/)) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); return out;
}
// text that shrinks until it fits maxLines
function fitText(ctx, text, x, y, maxW, px, { weight = 800, color, align = 'center', maxLines = 2, lh = 1.15 } = {}) {
  let lines;
  for (; px > 12; px *= 0.9) { ctx.font = F(weight, px); lines = wrap(ctx, text, maxW); if (lines.length <= maxLines) break; }
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  const y0 = y - ((lines.length - 1) * px * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, y0 + i * px * lh));
  return lines.length * px * lh;
}

/* ---------------- background ---------------- */
function drawBg(ctx, th, W, H, t, kind) {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.8);
  g.addColorStop(0, th.bg); g.addColorStop(1, th.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const s = Math.round(Math.min(W, H) / 26), off = (t * 6) % s;          // a slowly drifting dot grid
  ctx.fillStyle = th.dot;
  for (let y = -s + off; y < H + s; y += s) for (let x = s / 2; x < W; x += s) { ctx.beginPath(); ctx.arc(x, y, s * 0.07, 0, 6.283); ctx.fill(); }
  if (kind === 'mascot') {                                                  // soft studio light and a thin header line
    const k = Math.min(W, H) / 720;
    ctx.fillStyle = th.sub; ctx.font = F(600, 20 * k); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('CPMaster // studio', 40 * k, 52 * k);
    ctx.fillStyle = th.accent; ctx.fillRect(40 * k, 72 * k, 120 * k, 3 * k);
    ctx.fillStyle = th.line; ctx.fillRect(160 * k, 72 * k, W - 200 * k, 2 * k);
  }
}

/* ---------------- the card box ---------------- */
function cardBox(ctx, th, x, y, w, h, s, k) {
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(s, s); ctx.translate(-(x + w / 2), -(y + h / 2));
  ctx.shadowColor = th.shadow; ctx.shadowBlur = 40 * k; ctx.shadowOffsetY = 16 * k;
  rr(ctx, x, y, w, h, 30 * k); ctx.fillStyle = th.card; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.lineWidth = 2 * k; ctx.strokeStyle = th.line; ctx.stroke();
}
const H_OF = { title: 0.62, number: 0.62, list: 0.9, compare: 0.82, step: 0.78, wave: 0.6, stamp: 0.66, grid: 0.82, bars: 0.86, quote: 0.62, cta: 0.7 };

function mark(ctx, th, x, y, r, good, u) {
  if (u <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(back(u), back(u));
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fillStyle = good ? th.good : th.bad; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.28; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  if (good) { ctx.moveTo(-r * 0.45, 0); ctx.lineTo(-r * 0.1, r * 0.35); ctx.lineTo(r * 0.5, -r * 0.35); }
  else { ctx.moveTo(-r * 0.38, -r * 0.38); ctx.lineTo(r * 0.38, r * 0.38); ctx.moveTo(r * 0.38, -r * 0.38); ctx.lineTo(-r * 0.38, r * 0.38); }
  ctx.stroke(); ctx.restore();
}
function chip(ctx, th, x, y, text, k, on) {
  ctx.font = F(800, 22 * k); const w = ctx.measureText(text).width + 34 * k, h = 40 * k;
  rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = on ? th.accent : th.chip; ctx.fill();
  ctx.fillStyle = on ? th.accentInk : th.sub; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
  return w;
}
function waveBars(ctx, th, x, y, w, h, t, amp, n = 38, color) {
  const bw = w / n;
  for (let i = 0; i < n; i++) {
    const v = 0.25 + 0.75 * Math.abs(Math.sin(i * 0.7 + t * 6) * Math.sin(i * 0.23 + t * 2.3)) * (0.45 + amp * 1.6);
    const bh = Math.max(4, h * clamp(v, 0.06, 1));
    rr(ctx, x + i * bw + bw * 0.18, y - bh / 2, bw * 0.64, bh, bw * 0.32); ctx.fillStyle = color || th.wave; ctx.fill();
  }
}
const num = (v) => { const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const fmt = (n, src) => { const dec = /[.,]\d/.test(String(src)) ? 1 : 0; return n.toLocaleString('ru-RU', { minimumFractionDigits: dec, maximumFractionDigits: dec }); };

// the widget inside a card. c = Gemini's card, box = inner area, lt = seconds since the card appeared
function widget(ctx, th, c, x, y, w, h, lt, amp, k) {
  const cx = x + w / 2;
  switch (c.kind) {
    case 'number': {
      const target = num(c.value), u = ease((lt - 0.2) / 1.1);
      const shown = target == null ? String(c.value ?? '') : fmt(target * u, c.value);
      if (c.label) fitText(ctx, c.label, cx, y + h * 0.18, w * 0.9, 30 * k, { weight: 700, color: th.sub, maxLines: 1 });
      if (c.icon) { ctx.font = EMO(56 * k); ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.fillText(c.icon, cx, y + h * 0.18 + (c.label ? 0 : 6 * k)); }
      fitText(ctx, `${c.prefix || ''}${shown}${c.suffix || ''}`, cx, y + h * 0.56, w * 0.94, 104 * k, { weight: 900, color: th.accent, maxLines: 1 });
      if (c.sub) fitText(ctx, c.sub, cx, y + h * 0.86, w * 0.9, 26 * k, { weight: 600, color: th.ink, maxLines: 1 });
      break;
    }
    case 'list': case 'compare': {
      const items = (c.kind === 'compare' ? [{ text: c.bad || c.left, mark: 'cross', icon: c.bad_icon }, { text: c.good || c.right, mark: 'check', icon: c.good_icon }] : c.items || []).slice(0, 4);
      if (c.title) fitText(ctx, c.title, cx, y + 26 * k, w * 0.9, 30 * k, { weight: 800, color: th.ink, maxLines: 1 });
      const top = y + (c.title ? 64 * k : 10 * k), rh = (y + h - top) / Math.max(items.length, 2);
      items.forEach((it, i) => {
        const at = 0.25 + i * 0.45, u = ease((lt - at) / 0.4), ry = top + rh * i + rh / 2;
        if (u <= 0) return;
        ctx.save(); ctx.globalAlpha = u; ctx.translate((1 - u) * 40 * k, 0);
        rr(ctx, x + 6 * k, ry - rh * 0.4, w - 12 * k, rh * 0.8, 18 * k);
        const done = it.mark && lt > at + 0.6;
        ctx.fillStyle = done ? (it.mark === 'check' ? th.good : th.bad) + '22' : th.chip; ctx.fill();
        let tx = x + 28 * k;
        if (it.icon) { ctx.font = EMO(34 * k); ctx.fillStyle = '#000'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(it.icon, tx, ry); tx += 50 * k; }
        fitText(ctx, it.text, tx, ry, w - (tx - x) - 80 * k, 30 * k, { weight: 700, color: th.ink, align: 'left', maxLines: 2 });
        ctx.restore();
        if (it.mark === 'check' || it.mark === 'cross') mark(ctx, th, x + w - 44 * k, ry, 20 * k, it.mark === 'check', (lt - at - 0.6) / 0.35);
      });
      break;
    }
    case 'step': {
      const of = Math.max(2, Math.min(6, +c.of || 4)), n = Math.max(1, Math.min(of, +c.n || 1));
      let chx = cx - (of - 1) * 34 * k;
      for (let i = 1; i <= of; i++) {
        if (i < n) mark(ctx, th, chx, y + 26 * k, 17 * k, true, 1);
        else if (i === n) { const cw = chip(ctx, th, chx + 40 * k, y + 26 * k, `${String(n).padStart(2, '0')} из ${String(of).padStart(2, '0')}`, k, true); chx += cw - 30 * k; }
        else chip(ctx, th, chx, y + 26 * k, String(i).padStart(2, '0'), k, false);
        chx += 68 * k;
      }
      const r = 58 * k, ry = y + h * 0.42, u = pop(lt, 0.15);
      ctx.save(); ctx.translate(cx, ry); ctx.scale(u, u);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.lineWidth = 7 * k; ctx.strokeStyle = th.good; ctx.stroke();
      ctx.font = EMO(58 * k); ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.icon || '⭐', 0, 3 * k); ctx.restore();
      fitText(ctx, c.title, cx, y + h * 0.72, w * 0.9, 56 * k, { weight: 900, color: th.ink, maxLines: 1 });
      if (c.stat) fitText(ctx, c.stat, cx, y + h * 0.9, w * 0.9, 38 * k, { weight: 800, color: '#f5b83d', maxLines: 1 });
      break;
    }
    case 'wave': {
      ctx.fillStyle = th.bad; ctx.beginPath(); ctx.arc(x + 30 * k, y + 30 * k, 8 * k, 0, 6.283); if (Math.floor(lt * 2) % 2 === 0) ctx.fill();
      const sec = Math.floor(lt);
      ctx.font = F(800, 24 * k); ctx.fillStyle = th.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(`${c.label || 'REC'} 00:${String(sec).padStart(2, '0')}`, x + 48 * k, y + 31 * k);
      waveBars(ctx, th, x + 20 * k, y + h * 0.5, w - 40 * k, h * 0.42, lt, amp);
      if (c.from || c.to) {
        const u = ease((lt - 0.8) / 0.4), yy = y + h * 0.86;
        ctx.globalAlpha = u; chip(ctx, th, cx - 80 * k, yy, c.from || '', k, false);
        ctx.fillStyle = th.sub; ctx.font = F(800, 30 * k); ctx.textAlign = 'center'; ctx.fillText('→', cx, yy);
        chip(ctx, th, cx + 80 * k, yy, c.to || '', k, lt > 1.6); ctx.globalAlpha = 1;
      }
      break;
    }
    case 'stamp': {
      ctx.globalAlpha = 0.55;
      fitText(ctx, c.text, cx, y + h * 0.42, w * 0.86, 40 * k, { weight: 800, color: th.ink, maxLines: 3 });
      ctx.globalAlpha = 1;
      const u = clamp((lt - 0.55) / 0.18);
      if (u > 0) {
        const s = 1.8 - 0.8 * u;
        ctx.save(); ctx.translate(cx + Math.sin(lt * 70) * 6 * k * (1 - clamp((lt - 0.73) / 0.25)), y + h * 0.45); ctx.rotate(-0.16); ctx.scale(s, s); ctx.globalAlpha = u;
        ctx.font = F(900, 58 * k); const tw = ctx.measureText(c.stamp || 'НЕТ').width + 40 * k;
        ctx.lineWidth = 7 * k; ctx.strokeStyle = th.bad; rr(ctx, -tw / 2, -46 * k, tw, 92 * k, 12 * k); ctx.stroke();
        ctx.fillStyle = th.bad; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.stamp || 'НЕТ', 0, 4 * k); ctx.restore();
      }
      break;
    }
    case 'grid': {
      const n = Math.max(1, Math.min(24, +c.count || 12)), cols = n > 12 ? 6 : n > 6 ? 4 : 3, rows = Math.ceil(n / cols), cell = Math.min((w - 40 * k) / cols, (h * 0.62) / rows);
      const gx = cx - (cols * cell) / 2, gy = y + 16 * k;
      for (let i = 0; i < n; i++) {
        const u = pop(lt, 0.1 + i * 0.06, 0.35); if (u <= 0) continue;
        const px = gx + (i % cols) * cell + cell / 2, py = gy + Math.floor(i / cols) * cell + cell / 2;
        ctx.save(); ctx.translate(px, py); ctx.scale(u, u); rr(ctx, -cell * 0.42, -cell * 0.42, cell * 0.84, cell * 0.84, cell * 0.18); ctx.fillStyle = th.chip; ctx.fill();
        ctx.font = EMO(cell * 0.5); ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.icon || '💰', 0, cell * 0.03); ctx.restore();
      }
      const ly = gy + rows * cell + (y + h - gy - rows * cell) / 2;
      ctx.globalAlpha = ease((lt - 0.2 - n * 0.06) / 0.4);
      ctx.font = F(800, 30 * k); const lw = ctx.measureText(c.label || '').width;
      ctx.fillStyle = th.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(c.label || '', cx - (lw + 20 * k + 200 * k) / 2, ly);
      fitText(ctx, String(c.value || ''), cx - (lw + 220 * k) / 2 + lw + 20 * k, ly, 260 * k, 46 * k, { weight: 900, color: th.accent, align: 'left', maxLines: 1 });
      ctx.globalAlpha = 1;
      break;
    }
    case 'bars': {
      const items = (c.items || []).slice(0, 5), max = Math.max(1, ...items.map((i) => num(i.value) || 0));
      if (c.title) fitText(ctx, c.title, cx, y + 24 * k, w * 0.9, 30 * k, { weight: 800, color: th.ink, maxLines: 1 });
      const top = y + (c.title ? 60 * k : 10 * k), rh = (y + h - top) / Math.max(items.length, 3);
      items.forEach((it, i) => {
        const ry = top + rh * i + rh / 2, v = (num(it.value) || 0) / max, u = ease((lt - 0.25 - i * 0.22) / 0.8), lw = w * 0.32;
        fitText(ctx, it.label, x + 18 * k, ry, lw - 24 * k, 26 * k, { weight: 700, color: th.ink, align: 'left', maxLines: 1 });
        const bw = (w - lw - 40 * k) * v * u;
        rr(ctx, x + lw, ry - rh * 0.28, Math.max(rh * 0.56, bw), rh * 0.56, rh * 0.28); ctx.fillStyle = i === 0 ? th.accent : th.chip; ctx.fill();
        if (u > 0.6) { ctx.globalAlpha = (u - 0.6) / 0.4; fitText(ctx, String(it.value), x + lw + Math.max(rh * 0.56, bw) - 10 * k, ry, 200 * k, 22 * k, { weight: 800, color: i === 0 ? th.accentInk : th.ink, align: 'right', maxLines: 1 }); ctx.globalAlpha = 1; }
      });
      break;
    }
    case 'quote': {
      const shown = String(c.text || '').slice(0, Math.floor(clamp((lt - 0.2) / 1.4) * String(c.text || '').length));
      if (c.who) { chip(ctx, th, x + 60 * k, y + 30 * k, c.who, k, true); }
      waveBars(ctx, th, x + 130 * k, y + 30 * k, w - 160 * k, 40 * k, lt, amp, 26);
      fitText(ctx, `«${shown}»`, cx, y + h * 0.62, w * 0.88, 40 * k, { weight: 800, color: th.ink, maxLines: 3 });
      break;
    }
    case 'cta': {
      fitText(ctx, c.title || 'Напиши в комментах', cx, y + h * 0.26, w * 0.9, 50 * k, { weight: 900, color: th.ink, maxLines: 1 });
      const u = pop(lt, 0.35, 0.5);
      ctx.save(); ctx.translate(cx, y + h * 0.6); ctx.scale(u, u); ctx.rotate(-0.03);
      ctx.font = F(900, 64 * k); const tw = ctx.measureText(`“${c.word || 'ДА'}”`).width + 70 * k;
      ctx.shadowColor = th.shadow; ctx.shadowBlur = 24 * k; ctx.shadowOffsetY = 10 * k;
      rr(ctx, -tw / 2, -50 * k, tw, 100 * k, 50 * k); ctx.fillStyle = th.accent; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.fillStyle = th.accentInk; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`“${c.word || 'ДА'}”`, 0, 4 * k); ctx.restore();
      if (c.sub) fitText(ctx, c.sub, cx, y + h * 0.9, w * 0.9, 26 * k, { weight: 600, color: th.sub, maxLines: 2 });
      break;
    }
    default: {                                                              // title
      const u = pop(lt, 0.1);
      if (c.icon) { ctx.save(); ctx.translate(cx, y + h * 0.3); ctx.scale(u, u); ctx.font = EMO(96 * k); ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.icon, 0, 0); ctx.restore(); }
      fitText(ctx, c.text || c.title || '', cx, y + h * (c.icon ? 0.64 : 0.45), w * 0.9, 64 * k, { weight: 900, color: th.ink, maxLines: 2 });
      if (c.sub) fitText(ctx, c.sub, cx, y + h * 0.88, w * 0.9, 34 * k, { weight: 800, color: th.accent, maxLines: 1 });
    }
  }
}

/* ---------------- the mascots ---------------- */
// mood: happy | surprised | smug | think | laugh | sad | wink | angry
function face(ctx, mood, t, amp, r, look) {
  const blink = (t % 3.7) < 0.12 && mood !== 'wink';
  const ex = r * 0.32, ey = -r * 0.08, er = r * 0.17;
  for (const sx of [-1, 1]) {
    const x = sx * ex;
    if ((mood === 'wink' && sx === 1) || mood === 'laugh' || blink) {      // closed eye: a happy arc
      ctx.beginPath(); ctx.lineWidth = r * 0.06; ctx.strokeStyle = '#2a1d18'; ctx.lineCap = 'round';
      if (blink) { ctx.moveTo(x - er, ey); ctx.lineTo(x + er, ey); } else ctx.arc(x, ey + er * 0.4, er * 0.8, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke(); continue;
    }
    const big = mood === 'surprised' ? 1.25 : 1;
    ctx.beginPath(); ctx.ellipse(x, ey, er * big, er * 1.15 * big, 0, 0, 6.283); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = r * 0.035; ctx.strokeStyle = '#2a1d18'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x + look.x * er * 0.35, ey + look.y * er * 0.35, er * 0.55, 0, 6.283); ctx.fillStyle = '#2a1d18'; ctx.fill();
    ctx.beginPath(); ctx.arc(x + look.x * er * 0.35 - er * 0.18, ey + look.y * er * 0.35 - er * 0.2, er * 0.17, 0, 6.283); ctx.fillStyle = '#fff'; ctx.fill();
    // brows tell the mood
    const tilt = { angry: 0.45, sad: -0.4, smug: 0.25 * sx, think: sx > 0 ? -0.35 : 0.1, surprised: 0 }[mood] ?? 0;
    const by = ey - er * (mood === 'surprised' ? 2.0 : 1.55);
    ctx.save(); ctx.translate(x, by); ctx.rotate(tilt * sx); ctx.beginPath(); ctx.moveTo(-er * 0.9, 0); ctx.lineTo(er * 0.9, 0);
    ctx.lineWidth = r * 0.05; ctx.strokeStyle = '#2a1d18'; ctx.stroke(); ctx.restore();
  }
  // mouth opens with the voice
  const open = clamp(amp * 2.2) * r * 0.16, my = r * 0.26;
  ctx.beginPath(); ctx.lineWidth = r * 0.045; ctx.strokeStyle = '#2a1d18'; ctx.lineCap = 'round';
  if (mood === 'sad') { ctx.arc(0, my + r * 0.12, r * 0.14, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); }
  else if (mood === 'smug' || mood === 'think') { ctx.moveTo(-r * 0.12, my); ctx.quadraticCurveTo(r * 0.04, my + r * 0.05 + open * 0.4, r * 0.16, my - r * 0.04); ctx.stroke(); }
  else {
    ctx.moveTo(-r * 0.16, my); ctx.quadraticCurveTo(0, my + r * 0.16 + open, r * 0.16, my); ctx.closePath();
    ctx.fillStyle = '#5a2a22'; ctx.fill(); ctx.stroke();
  }
  if (mood === 'happy' || mood === 'laugh' || mood === 'wink') {        // blush
    ctx.fillStyle = 'rgba(240,120,120,.35)';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * r * 0.52, r * 0.16, r * 0.11, r * 0.06, 0, 0, 6.283); ctx.fill(); }
  }
}
// a felt gem with six facets
function gem(ctx, x, y, r, t, amp, mood, lt) {
  const hop = Math.abs(Math.sin(Math.min(lt, 0.5) * Math.PI * 2)) * (lt < 0.5 ? r * 0.12 : 0);
  const squash = 1 + Math.sin(t * 2.2) * 0.015 + amp * 0.05, tilt = Math.sin(t * 1.3) * 0.05 + (mood === 'think' ? 0.12 : 0);
  ctx.save(); ctx.translate(x, y - hop); ctx.rotate(tilt); ctx.scale(1 / squash, squash);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, r * 1.02 + hop, r * 0.8, r * 0.1, 0, 0, 6.283); ctx.fill();
  const P = Array.from({ length: 6 }, (_, i) => [Math.cos(-Math.PI / 2 + i * Math.PI / 3) * r, Math.sin(-Math.PI / 2 + i * Math.PI / 3) * r]);
  const cols = ['#b79ad6', '#e8a07a', '#e7dccb', '#6fa596', '#5f86b8', '#d7cbe6'];
  for (let i = 0; i < 6; i++) {
    const a = P[i], b = P[(i + 1) % 6];
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(...a); ctx.lineTo(...b); ctx.closePath(); ctx.fillStyle = cols[i]; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = r * 0.012; ctx.setLineDash([r * 0.03, r * 0.03]); ctx.stroke(); ctx.setLineDash([]);
  }
  // felt fibre texture: fixed short strokes
  ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = r * 0.01;
  for (let i = 0; i < 60; i++) { const a = i * 2.39996, d = r * 0.9 * Math.sqrt((i + 0.5) / 60); ctx.beginPath(); ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d); ctx.lineTo(Math.cos(a) * d + r * 0.05, Math.sin(a) * d + r * 0.02); ctx.stroke(); }
  // the face sits on a cream patch in the middle
  ctx.beginPath(); ctx.ellipse(0, r * 0.05, r * 0.62, r * 0.5, 0, 0, 6.283); ctx.fillStyle = '#efe6d8'; ctx.fill();
  face(ctx, mood, t, amp, r, { x: Math.sin(t * 0.7) * 0.4, y: -0.6 });
  ctx.restore();
}
// a small pixel buddy that hops along the card corner
function buddy(ctx, x, y, s, t, th) {
  const M = ['..XXXX..', '.XXXXXX.', 'XXoXXoXX', 'XXXXXXXX', '.XXXXXX.', 'X.X..X.X'];
  const hop = Math.abs(Math.sin(t * 3)) * s * 1.6;
  ctx.save(); ctx.translate(x, y - hop);
  M.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '.') return; ctx.fillStyle = ch === 'o' ? '#2b2119' : th.accent; ctx.fillRect((i - 4) * s, (j - 6) * s, s + 0.5, s + 0.5); }));
  ctx.restore();
}

/* ---------------- one card shot ---------------- */
// it: {card, mood, theme}, lt: seconds into the shot
export function drawCardShot(ctx, it, lt, dur, W, H, amp, t) {
  const th = THEMES[it.theme] || THEMES.paper, k = Math.min(W, H) / 720, vertical = H >= W;
  drawBg(ctx, th, W, H, t, it.theme);
  const c = it.card || { kind: 'title', text: '' };
  const cw = vertical ? W * 0.88 : W * 0.52, ch = cw * (H_OF[c.kind] || 0.66) * (vertical ? 1.08 : 0.9);
  const cx = vertical ? (W - cw) / 2 : W * 0.08;
  const cy = (vertical ? (it.theme === 'mascot' ? H * 0.11 : H * 0.17) : (H - ch) / 2) + Math.sin(t * 1.6) * 5 * k;
  const s = pop(lt, 0, 0.5) * (lt > dur - 0.2 ? 1 - 0.06 * (lt - dur + 0.2) / 0.2 : 1);
  cardBox(ctx, th, cx, cy, cw, ch, s, k);
  widget(ctx, th, c, cx + 26 * k, cy + 22 * k, cw - 52 * k, ch - 44 * k, lt, amp, k);
  ctx.restore();
  if (it.theme === 'mascot') {
    const r = vertical ? W * 0.26 : H * 0.3;
    gem(ctx, vertical ? W * 0.5 : W * 0.77, vertical ? H * 0.74 : H * 0.55, r, t, amp, it.mood || 'happy', lt);
  } else buddy(ctx, cx + cw - 30 * k, cy - 4 * k, 6 * k, t, th);
}

// one word of the voice at a time; key words sit on an accent pill (paper style)
export function drawCardWord(ctx, word, W, H, age, theme, hot) {
  const th = THEMES[theme] || THEMES.paper, k = Math.min(W, H) / 720, u = back(age / 0.18);
  const y = H >= W ? H * 0.74 : H * 0.86;
  ctx.save(); ctx.translate(W / 2, y); ctx.scale(u, u);
  ctx.font = F(900, 58 * k); const tw = ctx.measureText(word).width;
  if (hot) { rr(ctx, -tw / 2 - 18 * k, -40 * k, tw + 36 * k, 80 * k, 16 * k); ctx.fillStyle = th.accent; ctx.fill(); }
  ctx.fillStyle = hot ? th.accentInk : th.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(word, 0, 3 * k);
  ctx.restore();
}

export const CARD_KINDS = 'title, number, list, compare, step, wave, stamp, grid, bars, quote, cta';
