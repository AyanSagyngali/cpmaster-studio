// Five living illustrated scenes, drawn entirely by code (no pictures, no paid video AI). They loop forever, so a scene
// fits under a line of any length. Each one paints the whole W x H rect: the caller either shows it full-frame
// (fairy tale / cinematic) or clips it into a rounded card (explainer reels). Sizes follow k = short side / 1080.
const TAU = Math.PI * 2;
function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
function lin(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; }
function glow(ctx, x, y, r, c, a = 1, op = 'lighter') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0));
  ctx.save(); ctx.globalCompositeOperation = op; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
function stars(ctx, W, t, n, maxY, k, seed) {
  const r = rng(seed); ctx.fillStyle = '#fff';
  for (let i = 0; i < n; i++) { const x = r() * W, y = r() * maxY, s = (1 + r() * 2.4) * k, sp = 0.6 + r() * 2; ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * sp + i)); ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function wavyLine(ctx, x0, x1, y, amp, len, ph, step) { ctx.beginPath(); for (let x = x0; x <= x1 + step; x += step) { const yy = y + Math.sin(x / len + ph) * amp; x === x0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } }
function moonPath(ctx, mx, y0, y1, t, k, n = 26) {
  for (let i = 0; i < n; i++) {
    const yy = y0 + 8 * k + (i * (y1 - y0)) / n, w = (30 + i * 9) * k * (0.55 + 0.45 * Math.abs(Math.sin(t * 2 + i * 1.7)));
    ctx.fillStyle = `rgba(245,238,205,${Math.max(0.05, 0.55 - i * 0.017)})`; ctx.fillRect(mx - w / 2 + Math.sin(t * 1.5 + i) * 10 * k, yy, w, 3 * k);
  }
}
function moon(ctx, x, y, r, k) {
  glow(ctx, x, y, r * 5, [180, 200, 255], 0.35);
  ctx.fillStyle = '#f5f1e1'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(200,195,170,.45)';
  for (const [dx, dy, rr] of [[-0.3, -0.2, 0.18], [0.25, 0.15, 0.14], [-0.05, 0.35, 0.1]]) { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, rr * r, 0, TAU); ctx.fill(); }
}
function cloud(ctx, x, y, s, col) { ctx.fillStyle = col; ctx.beginPath(); for (const [dx, dy, r] of [[0, 0, 60], [55, -20, 50], [105, 5, 45], [-50, 8, 42], [150, 15, 30]]) { ctx.moveTo(x + (dx + r) * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU); } ctx.fill(); }

/* 1 ---------------- koi pond, seen from above ---------------- */
function koi(ctx, x, y, ang, L, t, look, k) {
  const wig = Math.sin(t * 6) * 0.35;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  for (const pass of [0, 1]) {                                            // pass 0: the shadow on the bottom, pass 1: the fish
    ctx.save();
    if (!pass) { ctx.translate(16 * k, 24 * k); ctx.globalAlpha = 0.22; }
    const fill = (c) => (ctx.fillStyle = pass ? c : '#06263d');
    ctx.save(); ctx.translate(-0.55 * L, 0); ctx.rotate(wig * 0.6);
    fill('#fbf3e6'); ctx.beginPath(); ctx.ellipse(-0.15 * L, 0, 0.22 * L, 0.075 * L, 0, 0, TAU); ctx.fill();
    ctx.translate(-0.33 * L, 0); ctx.rotate(wig);
    fill(look.tail); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.2 * L, -0.22 * L, -0.3 * L, -0.15 * L); ctx.quadraticCurveTo(-0.17 * L, 0, -0.3 * L, 0.15 * L); ctx.quadraticCurveTo(-0.2 * L, 0.22 * L, 0, 0); ctx.fill();
    ctx.restore();
    fill('rgba(255,240,225,.85)');
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(-0.17 * L, s * 0.1 * L); ctx.rotate(s * (0.8 + Math.sin(t * 5) * 0.25)); ctx.beginPath(); ctx.ellipse(-0.06 * L, 0, 0.1 * L, 0.04 * L, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    fill('#fbf3e6'); ctx.beginPath(); ctx.ellipse(-0.3 * L, 0, 0.34 * L, 0.13 * L, 0, 0, TAU); ctx.fill();
    if (pass) {
      ctx.save(); ctx.clip(); ctx.fillStyle = look.spot;
      for (const [px, py, pr] of look.spots) { ctx.beginPath(); ctx.ellipse(px * L, py * L, pr * L, pr * 0.7 * L, 0.4, 0, TAU); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#1b1b1b'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(-0.07 * L, s * 0.065 * L, 0.018 * L, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }
  ctx.restore();
}
function pad(ctx, x, y, R, a, k) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = 'rgba(6,38,61,.28)'; ctx.beginPath(); ctx.moveTo(12 * k, 16 * k); ctx.arc(12 * k, 16 * k, R, 0.25, TAU - 0.25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2f8a3e'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, 0.25, TAU - 0.25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#56b65a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R * 0.8, 0.3, TAU - 0.3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(30,100,45,.55)'; ctx.lineWidth = 3 * k;
  for (let i = 1; i < 8; i++) { const b = 0.25 + (i * (TAU - 0.5)) / 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(b) * R * 0.9, Math.sin(b) * R * 0.9); ctx.stroke(); }
  ctx.restore();
}
function lotus(ctx, x, y, s, t) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(6,38,61,.25)'; ctx.beginPath(); ctx.ellipse(18 * s, 26 * s, 120 * s, 110 * s, 0, 0, TAU); ctx.fill();
  const b = 1 + Math.sin(t * 1.4) * 0.03; ctx.scale(s * b, s * b);
  const ring = (n, len, wid, col, off) => {
    for (let i = 0; i < n; i++) {
      ctx.save(); ctx.rotate(off + (i * TAU) / n + Math.sin(t * 0.8 + i) * 0.03);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(wid, -len * 0.5, 0, -len); ctx.quadraticCurveTo(-wid, -len * 0.5, 0, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(190,70,120,.35)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
  };
  ring(10, 120, 46, '#fac8db', 0); ring(8, 96, 38, '#f49cc1', 0.3); ring(6, 70, 30, '#ec79aa', 0.1);
  ctx.fillStyle = '#f6cf45'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d9a028'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(Math.cos(i) * 12, Math.sin(i * 1.3) * 12, 3.5, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function pond(ctx, t, W, H, k, seed) {
  ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, '#1b6898'], [0.5, '#2e8fc1'], [1, '#2479ad']]); ctx.fillRect(0, 0, W, H);
  glow(ctx, W * 0.5, H * 0.4, Math.max(W, H) * 0.6, [130, 215, 240], 0.32, 'source-over');
  // the moving caustic net on the bottom
  ctx.strokeStyle = 'rgba(195,242,255,.17)'; ctx.lineWidth = 4 * k; ctx.lineJoin = 'round';
  const st = 95 * k;
  for (let y = -st; y < H + st; y += st) { wavyLine(ctx, -20, W + 20, y, 16 * k, 60 * k, t * 1.3 + y, 28 * k); ctx.stroke(); }
  ctx.save(); ctx.translate(W, 0); ctx.rotate(Math.PI / 2);
  for (let y = -st; y < W + st; y += st) { wavyLine(ctx, -20, H + 20, y, 16 * k, 55 * k, -t * 1.1 + y, 28 * k); ctx.stroke(); }
  ctx.restore();
  const r = rng(seed);
  for (let i = 0; i < 4; i++) {                                            // koi swim along figure-eights
    const cx = W * (0.32 + r() * 0.36), cy = H * (0.32 + r() * 0.36), ax = W * (0.22 + r() * 0.12), ay = H * (0.16 + r() * 0.1), w = 0.16 + r() * 0.08, ph = r() * TAU, dir = r() < 0.5 ? 1 : -1;
    const u = t * w * dir + ph, x = cx + ax * Math.sin(u), y = cy + ay * Math.sin(2 * u + ph);
    const dx = ax * Math.cos(u) * dir, dy = 2 * ay * Math.cos(2 * u + ph) * dir;
    const look = { spot: i % 3 === 2 ? '#1d1d1d' : i % 2 ? '#f26b1d' : '#e4432b', tail: i % 2 ? '#f6a15b' : '#fbe9d6', spots: [[-0.12 + r() * 0.05, -0.05, 0.11], [-0.36, 0.04 - r() * 0.06, 0.1], [-0.52, -0.02, 0.07]] };
    koi(ctx, x, y, Math.atan2(dy, dx), (230 + r() * 80) * k, t * 1.1 + i, look, k);
  }
  for (let i = 0; i < 6; i++) pad(ctx, W * (0.12 + r() * 0.76), H * (0.1 + r() * 0.8), (70 + r() * 60) * k, r() * TAU + Math.sin(t * 0.2 + i) * 0.12, k);
  const lx = W * 0.56, ly = H * 0.47;
  pad(ctx, lx - 30 * k, ly + 40 * k, 150 * k, 2.4 + Math.sin(t * 0.15) * 0.05, k);
  for (let i = 0; i < 3; i++) {                                            // rings spreading from the flower
    const ph = ((t * 0.45 + i / 3) % 1);
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - ph)})`; ctx.lineWidth = 3 * k * (1 - ph) + 0.5;
    ctx.beginPath(); ctx.arc(lx, ly, (150 + ph * 330) * k, 0, TAU); ctx.stroke();
  }
  lotus(ctx, lx, ly, k, t);
  ctx.fillStyle = '#fff';                                                   // glints on the surface
  for (let i = 0; i < 14; i++) { const a = Math.max(0, Math.sin(t * (1 + r()) + i * 2)); const x = r() * W, y = r() * H; ctx.globalAlpha = a * 0.8; ctx.fillRect(x - 9 * k, y - 1.5 * k, 18 * k, 3 * k); ctx.fillRect(x - 1.5 * k, y - 9 * k, 3 * k, 18 * k); }
  ctx.globalAlpha = 1;
}

/* 2 ---------------- a lighthouse in the night sea ---------------- */
function lighthouse(ctx, t, W, H, k, seed) {
  const hz = H * 0.62;
  ctx.fillStyle = lin(ctx, 0, 0, 0, hz, [[0, '#091331'], [0.6, '#192c62'], [1, '#2f4b8e']]); ctx.fillRect(0, 0, W, hz + 2);
  stars(ctx, W, t, 90, hz * 0.8, k, seed);
  const mx = W * 0.78, my = H * 0.14; moon(ctx, mx, my, 58 * k, k);
  for (let i = 0; i < 3; i++) cloud(ctx, ((W * (0.1 + i * 0.4) + t * (10 + i * 4) * k) % (W + 400 * k)) - 200 * k, H * (0.08 + i * 0.09), k * (0.9 + i * 0.25), 'rgba(58,82,148,.55)');
  ctx.fillStyle = lin(ctx, 0, hz, 0, H, [[0, '#24427f'], [1, '#0a1736']]); ctx.fillRect(0, hz, W, H - hz);
  moonPath(ctx, mx, hz, H, t, k);
  for (let j = 0; j < 9; j++) { ctx.strokeStyle = `rgba(150,180,240,${0.12 + j * 0.02})`; ctx.lineWidth = (2 + j * 0.5) * k; wavyLine(ctx, 0, W, hz + 20 * k + j * j * 9 * k, (4 + j * 1.5) * k, (60 + j * 12) * k, t * (1 + j * 0.15) + j, 20 * k); ctx.stroke(); }
  // the boat
  const bx = W * 0.68 + Math.sin(t * 0.3) * 30 * k, by = hz + 150 * k + Math.sin(t * 1.6) * 8 * k;
  ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(t * 1.3) * 0.07);
  ctx.fillStyle = '#3a2a22'; ctx.beginPath(); ctx.moveTo(-90 * k, 0); ctx.lineTo(90 * k, 0); ctx.lineTo(65 * k, 34 * k); ctx.lineTo(-65 * k, 34 * k); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a3d2e'; ctx.fillRect(-4 * k, -150 * k, 8 * k, 150 * k);
  ctx.fillStyle = '#efe6d2'; ctx.beginPath(); ctx.moveTo(8 * k, -140 * k); ctx.lineTo(80 * k, -14 * k); ctx.lineTo(8 * k, -14 * k); ctx.closePath(); ctx.fill();
  ctx.restore();
  glow(ctx, bx - 60 * k, by - 10 * k, 40 * k, [255, 200, 120], 0.9);
  // the rocks and the tower
  const lx = W * 0.3, base = hz + 40 * k, th = H * 0.34, bw = 130 * k, tw = 86 * k, top = base - th;
  ctx.fillStyle = '#121a31'; ctx.beginPath();
  for (const [dx, dy] of [[-300, 90], [-210, -10], [-90, -32], [60, -26], [180, 6], [290, 90]]) ctx.lineTo(lx + dx * k, base + dy * k);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3 * k;            // foam on the rocks
  for (let i = 0; i < 5; i++) { const a = Math.abs(Math.sin(t * 1.2 + i)); ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(lx + (-260 + i * 120) * k, base + 80 * k, 30 * k * a, Math.PI, TAU); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.save(); ctx.beginPath(); ctx.moveTo(lx - bw / 2, base); ctx.lineTo(lx - tw / 2, top); ctx.lineTo(lx + tw / 2, top); ctx.lineTo(lx + bw / 2, base); ctx.closePath();
  ctx.fillStyle = '#e9e6dc'; ctx.fill(); ctx.clip();
  ctx.fillStyle = '#c8372d'; for (let i = 0; i < 7; i += 2) ctx.fillRect(lx - bw, top + (i * th) / 7, bw * 2, th / 7);
  ctx.fillStyle = 'rgba(10,15,45,.32)'; ctx.fillRect(lx, top, bw, th);
  ctx.restore();
  ctx.fillStyle = '#26283a'; ctx.fillRect(lx - tw / 2 - 18 * k, top - 14 * k, tw + 36 * k, 14 * k);
  ctx.fillStyle = '#ffe6a0'; ctx.fillRect(lx - tw * 0.36, top - 70 * k, tw * 0.72, 56 * k);
  ctx.fillStyle = '#26283a'; for (const dx of [-0.12, 0.12]) ctx.fillRect(lx + dx * tw - 2 * k, top - 70 * k, 4 * k, 56 * k);
  ctx.fillStyle = '#c8372d'; ctx.beginPath(); ctx.arc(lx, top - 70 * k, tw * 0.42, Math.PI, TAU); ctx.fill();
  // the turning beam: it sweeps across, and flares when it points at us
  const lampX = lx, lampY = top - 42 * k, c = Math.cos(t * 0.9), len = W * 1.3 * Math.abs(c), dx = Math.sign(c) || 1;
  if (len > 10) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const ex = lampX + dx * len, ey = lampY + 30 * k;
    ctx.fillStyle = lin(ctx, lampX, lampY, ex, ey, [[0, 'rgba(255,240,190,.55)'], [1, 'rgba(255,240,190,0)']]);
    ctx.beginPath(); ctx.moveTo(lampX, lampY - 10 * k); ctx.lineTo(ex, ey - 130 * k * Math.abs(c)); ctx.lineTo(ex, ey + 150 * k * Math.abs(c)); ctx.lineTo(lampX, lampY + 10 * k); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  glow(ctx, lampX, lampY, (110 + 240 * (1 - Math.abs(c))) * k, [255, 228, 160], 0.85);
  ctx.fillStyle = '#081129';                                                 // dark waves in front
  for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.moveTo(0, H); wavyLine(ctx, 0, W, H - (60 - j * 30) * k, 14 * k, 90 * k, t * (1.4 + j * 0.3) + j * 2, 24 * k); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.globalAlpha = 0.6 + j * 0.3; ctx.fill(); }
  ctx.globalAlpha = 1;
}

/* 3 ---------------- under the sea (a children's book) ---------------- */
function whale(ctx, x, y, s, face, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * face, s); ctx.rotate(Math.sin(t * 0.6) * 0.04);
  ctx.save(); ctx.translate(-240, -10); ctx.rotate(Math.sin(t * 1.6) * 0.35);
  ctx.fillStyle = '#3c6ec3'; ctx.beginPath(); ctx.moveTo(0, -20); ctx.quadraticCurveTo(-80, -30, -150, -100); ctx.quadraticCurveTo(-115, -10, -165, 45); ctx.quadraticCurveTo(-80, 25, 0, 25); ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.moveTo(-260, 0); ctx.bezierCurveTo(-200, -150, 150, -190, 300, -40); ctx.bezierCurveTo(335, 40, 250, 130, 60, 130); ctx.bezierCurveTo(-120, 130, -230, 60, -260, 0);
  ctx.fillStyle = '#4a80d6'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#bcd6f7'; ctx.beginPath(); ctx.ellipse(70, 128, 260, 72, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(80,125,195,.55)'; ctx.lineWidth = 6;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-110, 78 + i * 13); ctx.quadraticCurveTo(80, 92 + i * 13, 250, 70 + i * 11); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(0, -105, 170, 28, -0.08, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(40, 95); ctx.rotate(0.5 + Math.sin(t * 1.8) * 0.4); ctx.fillStyle = '#3c6ec3'; ctx.beginPath(); ctx.ellipse(-50, 0, 75, 26, 0, 0, TAU); ctx.fill(); ctx.restore();
  const blink = t % 4 < 0.15;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(195, -18, 21, blink ? 3 : 21, 0, 0, TAU); ctx.fill();
  if (!blink) { ctx.fillStyle = '#16233f'; ctx.beginPath(); ctx.arc(200, -16, 12, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(205, -21, 4, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#16233f'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(250, 22, 34, 0.5, 1.6); ctx.stroke();
  ctx.fillStyle = 'rgba(255,140,170,.5)'; ctx.beginPath(); ctx.ellipse(215, 22, 18, 10, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function jelly(ctx, x, y, s, t, c) {
  const p = Math.sin(t * 2.2), sq = 1 + p * 0.08;
  glow(ctx, x, y, 150 * s, c, 0.35);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = rgba(c, 0.75); ctx.lineWidth = 5; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const tx = -40 + i * 20; ctx.beginPath(); ctx.moveTo(tx, 8); for (let j = 1; j <= 6; j++) ctx.lineTo(tx + (Math.sin(t * 3 + j * 0.8 + i) * 10 * j) / 3, 8 + j * 22 * (1.05 - p * 0.06)); ctx.stroke(); }
  ctx.fillStyle = rgba(c, 0.9); ctx.beginPath(); ctx.moveTo(-62 * sq, 10);
  ctx.bezierCurveTo(-62 * sq, -78 / sq, 62 * sq, -78 / sq, 62 * sq, 10);
  for (let i = 4; i >= 0; i--) ctx.quadraticCurveTo((-62 + (i + 0.5) * 24.8) * sq, 22, (-62 + i * 24.8) * sq, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-20, -32, 18, 9, -0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1840'; for (const ex of [-16, 16]) { ctx.beginPath(); ctx.arc(ex, -6, 5, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#2a1840'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 9, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.restore();
}
function underwater(ctx, t, W, H, k, seed) {
  ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, '#62d3ef'], [0.45, '#2193ca'], [1, '#0b3f7a']]); ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const x0 = W * (0.05 + i * 0.18) + Math.sin(t * 0.3 + i) * 30 * k;
    ctx.fillStyle = lin(ctx, 0, 0, 0, H * 0.8, [[0, 'rgba(255,255,255,.16)'], [1, 'rgba(255,255,255,0)']]);
    ctx.beginPath(); ctx.moveTo(x0 - 30 * k, 0); ctx.lineTo(x0 + 30 * k, 0); ctx.lineTo(x0 + 170 * k, H * 0.8); ctx.lineTo(x0 + 50 * k, H * 0.8); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  const r = rng(seed);
  for (let i = 0; i < 7; i++) {                                              // a school of small yellow fish
    const x = ((t * 90 * k + i * 70 * k + r() * 40 * k) % (W + 400 * k)) - 200 * k, y = H * 0.24 + Math.sin(i * 1.7) * 60 * k + Math.sin(t * 2 + i) * 10 * k;
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(x, y, 26 * k, 13 * k, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 20 * k, y); ctx.lineTo(x - 42 * k, y - 13 * k + Math.sin(t * 9 + i) * 4 * k); ctx.lineTo(x - 42 * k, y + 13 * k); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1d2a44'; ctx.beginPath(); ctx.arc(x + 13 * k, y - 3 * k, 3 * k, 0, TAU); ctx.fill();
  }
  const u = t * 0.22, face = Math.max(-1, Math.min(1, Math.cos(u) * 4));
  whale(ctx, W * 0.5 + Math.sin(u) * W * 0.2, H * 0.42 + Math.sin(t * 0.5) * 25 * k, k * (W < H ? 0.95 : 0.8), face, t);
  ctx.fillStyle = '#ecca8e'; ctx.beginPath(); ctx.moveTo(0, H);                // sand and plants
  for (let x = 0; x <= W + 40 * k; x += 40 * k) ctx.lineTo(x, H * 0.9 + Math.sin(x / (160 * k) + 1) * 22 * k);
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(180,140,80,.35)'; for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(r() * W, H * (0.93 + r() * 0.07), 3 * k, 0, TAU); ctx.fill(); }
  ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const x = W * ((i + 0.5) / 10) + (r() - 0.5) * 50 * k, h = (180 + r() * 220) * k, base = H * 0.93, sw = Math.sin(t * 1.2 + i) * 40 * k;
    ctx.strokeStyle = ['#2f9e5b', '#4dbb6b', '#23804a'][i % 3]; ctx.lineWidth = 18 * k;
    ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + sw, base - h / 2, x + sw * 1.6, base - h); ctx.stroke();
  }
  for (let i = 0; i < 6; i++) { ctx.fillStyle = ['#ff8fb1', '#ff6f61', '#ffb347'][i % 3]; const x = W * (0.08 + i * 0.17), y = H * 0.93; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(x + (j - 1.5) * 16 * k, y - (j % 2) * 18 * k - 10 * k, 16 * k, 0, TAU); ctx.fill(); } }
  const cols = [[255, 140, 200], [180, 140, 255], [120, 230, 255], [255, 190, 120]];
  for (let i = 0; i < 4; i++) jelly(ctx, W * (0.14 + 0.24 * i) + Math.sin(t * 0.4 + i) * 30 * k, H * (0.62 + 0.1 * Math.sin(i * 2.1)) + Math.sin(t * 0.9 + i) * 40 * k, k * (0.75 + (i % 2) * 0.2), t + i, cols[i]);
  ctx.lineWidth = 3 * k;
  for (let i = 0; i < 26; i++) {                                             // bubbles rising
    const x0 = r() * W, sp = 0.5 + r(), rad = (5 + r() * 11) * k, y = H - ((t * sp * 70 * k + r() * H) % (H * 1.1)), x = x0 + Math.sin(t * 2 + i) * 12 * k;
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x - rad * 0.35, y - rad * 0.35, rad * 0.25, 0, TAU); ctx.fill();
  }
}

/* 4 ---------------- a harbour at night ---------------- */
function boat(ctx, x, y, s, t, ph, col) {
  ctx.save(); ctx.translate(x, y + Math.sin(t * 1.4 + ph) * 6 * s); ctx.rotate(Math.sin(t * 1.1 + ph) * 0.05);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-110 * s, 0); ctx.lineTo(110 * s, 0); ctx.lineTo(80 * s, 40 * s); ctx.lineTo(-80 * s, 40 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8e1d0'; ctx.fillRect(-40 * s, -40 * s, 70 * s, 40 * s);
  ctx.fillStyle = '#ffd27a'; ctx.fillRect(-28 * s, -30 * s, 16 * s, 14 * s); ctx.fillRect(2 * s, -30 * s, 16 * s, 14 * s);
  ctx.fillStyle = '#3a2a22'; ctx.fillRect(50 * s, -170 * s, 6 * s, 170 * s);
  ctx.strokeStyle = 'rgba(230,220,200,.6)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(53 * s, -170 * s); ctx.lineTo(-100 * s, 0); ctx.moveTo(53 * s, -170 * s); ctx.lineTo(105 * s, 0); ctx.stroke();
  ctx.restore();
}
function harbor(ctx, t, W, H, k, seed) {
  const hz = H * 0.52;
  ctx.fillStyle = lin(ctx, 0, 0, 0, hz, [[0, '#0a1130'], [1, '#2c3c7a']]); ctx.fillRect(0, 0, W, hz + 2);
  stars(ctx, W, t, 70, hz * 0.6, k, seed + 3);
  const mx = W * 0.28, my = H * 0.14; moon(ctx, mx, my, 52 * k, k);
  ctx.fillStyle = '#1a2452'; ctx.beginPath(); ctx.moveTo(0, hz); for (let x = 0; x <= W + 30 * k; x += 30 * k) ctx.lineTo(x, hz - 70 * k - Math.sin(x / (220 * k)) * 40 * k); ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
  const r = rng(seed + 5), lit = [];
  for (let x = -20 * k; x < W;) {                                            // the little town on the shore
    const w = (70 + r() * 90) * k, h = (80 + r() * 150) * k, tone = r();
    ctx.fillStyle = tone > 0.5 ? '#26346a' : '#202d5c'; ctx.fillRect(x, hz - h, w, h);
    ctx.fillStyle = '#18214a'; ctx.beginPath(); ctx.moveTo(x - 6 * k, hz - h); ctx.lineTo(x + w / 2, hz - h - 40 * k); ctx.lineTo(x + w + 6 * k, hz - h); ctx.closePath(); ctx.fill();
    for (let wy = hz - h + 22 * k; wy < hz - 30 * k; wy += 44 * k) for (let wx = x + 14 * k; wx < x + w - 24 * k; wx += 34 * k) {
      const z = r(); if (z < 0.45) continue;
      const on = Math.sin(t * 0.35 + z * 40) > -0.7;
      if (!on) continue;
      ctx.fillStyle = `rgba(255,${200 + ((z * 40) | 0)},120,${0.75 + 0.25 * Math.sin(t * 3 + z * 9)})`; ctx.fillRect(wx, wy, 14 * k, 18 * k); lit.push(wx + 7 * k);
    }
    x += w + 6 * k;
  }
  ctx.fillStyle = '#10183a'; ctx.fillRect(0, hz, W, 14 * k);
  ctx.fillStyle = lin(ctx, 0, hz, 0, H, [[0, '#1c2d63'], [1, '#070e28']]); ctx.fillRect(0, hz + 14 * k, W, H - hz);
  for (const wx of lit) for (let j = 0; j < 4; j++) { ctx.fillStyle = `rgba(255,210,120,${0.22 - j * 0.04})`; ctx.fillRect(wx - 6 * k + Math.sin(t * 2 + j + wx) * 4 * k, hz + 22 * k + j * 22 * k, 12 * k, 10 * k); }
  moonPath(ctx, mx, hz + 10 * k, H, t, k, 22);
  ctx.strokeStyle = 'rgba(140,170,240,.18)'; ctx.lineWidth = 2 * k;
  for (let j = 0; j < 7; j++) { wavyLine(ctx, 0, W, hz + 40 * k + j * j * 12 * k, (3 + j) * k, (70 + j * 10) * k, t * (1 + j * 0.2) + j, 22 * k); ctx.stroke(); }
  boat(ctx, W * 0.2, H * 0.72, k, t, 0, '#7a3b2e'); boat(ctx, W * 0.46, H * 0.84, k * 1.15, t, 2, '#2f5d62');
  // the pier with a garland of lights
  const py = H * 0.78;
  ctx.fillStyle = '#2a1e1a'; for (let x = W * 0.62; x < W; x += 60 * k) ctx.fillRect(x, py, 12 * k, H - py);
  ctx.fillStyle = '#4a3328'; ctx.beginPath(); ctx.moveTo(W * 0.6, py); ctx.lineTo(W, py - 40 * k); ctx.lineTo(W, py - 10 * k); ctx.lineTo(W * 0.6, py + 26 * k); ctx.closePath(); ctx.fill();
  const p1 = [W * 0.64, py - 240 * k], p2 = [W * 0.97, py - 280 * k];
  ctx.fillStyle = '#1b1b24'; ctx.fillRect(p1[0] - 4 * k, p1[1], 8 * k, 250 * k); ctx.fillRect(p2[0] - 4 * k, p2[1], 8 * k, 260 * k);
  for (const p of [p1, p2]) { ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(p[0], p[1], 11 * k, 0, TAU); ctx.fill(); glow(ctx, p[0], p[1], 120 * k, [255, 210, 140], 0.7 + 0.1 * Math.sin(t * 9)); }
  const bulbs = ['#ffd27a', '#ff8f6a', '#9ee6ff', '#ffe9a8', '#c7a6ff'];
  ctx.strokeStyle = 'rgba(30,30,40,.9)'; ctx.lineWidth = 2 * k; ctx.beginPath();
  for (let i = 0; i <= 20; i++) { const u = i / 20, x = p1[0] + (p2[0] - p1[0]) * u, y = p1[1] + (p2[1] - p1[1]) * u + Math.sin(u * Math.PI) * 70 * k; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
  for (let i = 1; i < 12; i++) {
    const u = i / 12, x = p1[0] + (p2[0] - p1[0]) * u, y = p1[1] + (p2[1] - p1[1]) * u + Math.sin(u * Math.PI) * 70 * k + 8 * k, on = 0.6 + 0.4 * Math.sin(t * 3 + i * 1.3);
    ctx.globalAlpha = on; ctx.fillStyle = bulbs[i % bulbs.length]; ctx.beginPath(); ctx.arc(x, y, 7 * k, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    glow(ctx, x, y, 34 * k, [255, 220, 160], 0.45 * on);
  }
}

/* 5 ---------------- a guy at his desk at night (storytelling) ---------------- */
function desk(ctx, t, W, H, k, seed) {
  if (H > W) k *= 1.25;                                                      // a vertical frame shows the guy bigger
  const cx = W * 0.5;
  ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, '#2a2340'], [1, '#4b3552']]); ctx.fillRect(0, 0, W, H);
  // the window with the night city
  const wx = W * 0.08, wy = H * 0.12, ww = W * 0.42, wh = H * 0.3;
  ctx.fillStyle = '#17132a'; ctx.fillRect(wx - 16 * k, wy - 16 * k, ww + 32 * k, wh + 32 * k);
  ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
  ctx.fillStyle = lin(ctx, 0, wy, 0, wy + wh, [[0, '#172760'], [1, '#3b5296']]); ctx.fillRect(wx, wy, ww, wh);
  stars(ctx, wx + ww, t, 30, wy + wh * 0.5, k, seed + 9);
  ctx.fillStyle = '#f5f1e1'; ctx.beginPath(); ctx.arc(wx + ww * 0.75, wy + wh * 0.25, 30 * k, 0, TAU); ctx.fill();
  ctx.fillStyle = '#20356f'; ctx.beginPath(); ctx.arc(wx + ww * 0.75 + 14 * k, wy + wh * 0.25 - 8 * k, 28 * k, 0, TAU); ctx.fill();
  const r = rng(seed + 11);
  for (let x = wx; x < wx + ww;) { const bw = (40 + r() * 50) * k, bh = (60 + r() * 120) * k; ctx.fillStyle = '#141c3c'; ctx.fillRect(x, wy + wh - bh, bw, bh); ctx.fillStyle = '#ffd27a'; for (let i = 0; i < 4; i++) if (r() > 0.4) ctx.fillRect(x + r() * (bw - 10 * k), wy + wh - bh + r() * (bh - 12 * k), 7 * k, 9 * k); x += bw + 4 * k; }
  ctx.restore();
  ctx.fillStyle = '#17132a'; ctx.fillRect(wx + ww / 2 - 6 * k, wy, 12 * k, wh); ctx.fillRect(wx, wy + wh / 2 - 6 * k, ww, 12 * k);
  ctx.fillStyle = '#2e2440'; ctx.fillRect(W * 0.62, H * 0.2, W * 0.32, 14 * k);  // a shelf with books and a plant
  for (let i = 0; i < 6; i++) { ctx.fillStyle = ['#c8573d', '#e3b13c', '#4d7fc4', '#6aa56a', '#b06ab3', '#e07a3a'][i]; ctx.fillRect(W * 0.64 + i * 34 * k, H * 0.2 - (70 + (i % 3) * 14) * k, 28 * k, (70 + (i % 3) * 14) * k); }
  ctx.fillStyle = '#3f9a5b'; for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(W * 0.9, H * 0.2 - 40 * k); ctx.rotate(-1.2 + i * 0.6 + Math.sin(t + i) * 0.05); ctx.beginPath(); ctx.ellipse(0, -40 * k, 14 * k, 40 * k, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  ctx.fillStyle = '#c8573d'; ctx.fillRect(W * 0.9 - 22 * k, H * 0.2 - 44 * k, 44 * k, 44 * k);
  const lampX = cx + 280 * k, deskY = H * (H > W ? 0.66 : 0.7), bulb = [lampX - 90 * k, deskY - 300 * k];
  glow(ctx, bulb[0], bulb[1] + 120 * k, 560 * k, [255, 170, 90], 0.32 * (0.96 + 0.04 * Math.sin(t * 13)));
  // the guy: orange hoodie, glasses, typing
  const sy = deskY - 190 * k, bob = Math.sin(t * 1.8) * 4 * k, look = Math.sin(t * 0.5) > 0.6 ? 1 : 0;
  ctx.fillStyle = '#f08a3c'; ctx.beginPath(); ctx.moveTo(cx - 200 * k, deskY); ctx.quadraticCurveTo(cx - 205 * k, sy, cx - 120 * k, sy - 10 * k); ctx.lineTo(cx + 120 * k, sy - 10 * k); ctx.quadraticCurveTo(cx + 205 * k, sy, cx + 200 * k, deskY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(120,40,10,.22)'; ctx.fillRect(cx + 40 * k, sy, 170 * k, deskY - sy);
  ctx.fillStyle = '#e0752a'; ctx.beginPath(); ctx.ellipse(cx, sy - 6 * k, 100 * k, 34 * k, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#fbe6d0'; ctx.lineWidth = 5 * k; for (const dx of [-26, 26]) { ctx.beginPath(); ctx.moveTo(cx + dx * k, sy + 10 * k); ctx.lineTo(cx + dx * k + Math.sin(t * 2 + dx) * 3 * k, sy + 80 * k); ctx.stroke(); }
  ctx.fillStyle = '#e9b48f'; ctx.fillRect(cx - 30 * k, sy - 60 * k + bob, 60 * k, 50 * k);
  const hx = cx, hy = sy - 150 * k + bob;
  ctx.fillStyle = '#f3c9a3'; ctx.beginPath(); ctx.ellipse(hx, hy, 100 * k, 115 * k, 0, 0, TAU); ctx.fill();
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + s * 98 * k, hy + 10 * k, 18 * k, 26 * k, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#3b2a22'; ctx.beginPath(); ctx.moveTo(hx - 108 * k, hy - 10 * k);
  for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI, rr = (i % 2 ? 128 : 112) * k; ctx.lineTo(hx + Math.cos(a) * rr, hy - 30 * k + Math.sin(a) * rr * 0.85); }
  ctx.lineTo(hx + 108 * k, hy - 10 * k); ctx.quadraticCurveTo(hx, hy - 70 * k, hx - 108 * k, hy - 10 * k); ctx.fill();
  const blink = t % 3.6 < 0.13, ey = hy + 12 * k + (look ? -4 : 6) * k;
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#2a1d18'; if (blink) ctx.fillRect(hx + s * 40 * k - 10 * k, ey, 20 * k, 3 * k); else { ctx.beginPath(); ctx.arc(hx + s * 40 * k, ey, 7 * k, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#1d1d24'; ctx.lineWidth = 7 * k; ctx.beginPath(); ctx.arc(hx + s * 40 * k, hy + 14 * k, 34 * k, 0, TAU); ctx.stroke();
    ctx.lineWidth = 6 * k; ctx.beginPath(); ctx.moveTo(hx + s * 22 * k, hy - 36 * k); ctx.lineTo(hx + s * 58 * k, hy - 40 * k - look * 6 * k); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(hx - 6 * k, hy + 14 * k); ctx.lineTo(hx + 6 * k, hy + 14 * k); ctx.stroke();
  ctx.strokeStyle = '#7a3b2e'; ctx.lineWidth = 5 * k; ctx.beginPath(); ctx.arc(hx, hy + 60 * k, 20 * k, 0.4, Math.PI - 0.4); ctx.stroke();
  ctx.fillStyle = 'rgba(240,120,110,.3)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + s * 62 * k, hy + 54 * k, 16 * k, 9 * k, 0, 0, TAU); ctx.fill(); }
  glow(ctx, hx, hy + 40 * k, 160 * k, [150, 200, 255], 0.18, 'screen');       // the screen lights his face
  // the desk
  ctx.fillStyle = '#8b5a3a'; ctx.fillRect(0, deskY, W, 40 * k);
  ctx.fillStyle = lin(ctx, 0, deskY + 40 * k, 0, H, [[0, '#6b4129'], [1, '#3e2418']]); ctx.fillRect(0, deskY + 40 * k, W, H - deskY);
  ctx.strokeStyle = 'rgba(30,15,8,.45)'; ctx.lineWidth = 5 * k;                  // drawers with brass knobs
  for (const dx of [-1, 1]) for (let j = 0; j < 3; j++) {
    const x = cx + dx * 280 * k - 170 * k, y = deskY + 80 * k + j * 150 * k;
    if (y + 120 * k > H) break;
    ctx.strokeRect(x, y, 340 * k, 120 * k); ctx.fillStyle = '#d9a650'; ctx.beginPath(); ctx.arc(x + 170 * k, y + 60 * k, 12 * k, 0, TAU); ctx.fill();
  }
  for (const s of [-1, 1]) {                                                  // hands typing
    const hy2 = deskY - 6 * k + Math.max(0, Math.sin(t * 14 + s)) * -8 * k;
    ctx.fillStyle = '#f08a3c'; ctx.beginPath(); ctx.ellipse(cx + s * 150 * k, deskY - 18 * k, 70 * k, 26 * k, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f3c9a3'; ctx.beginPath(); ctx.ellipse(cx + s * 100 * k, hy2, 26 * k, 18 * k, 0, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#c9ccd6'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - 170 * k, deskY - 210 * k, 340 * k, 205 * k, 14 * k) : ctx.rect(cx - 170 * k, deskY - 210 * k, 340 * k, 205 * k); ctx.fill();
  ctx.fillStyle = '#a7abb8'; ctx.fillRect(cx - 200 * k, deskY - 8 * k, 400 * k, 12 * k);
  ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 1.5); ctx.beginPath(); ctx.arc(cx, deskY - 108 * k, 20 * k, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  // coffee with steam
  const mx = cx - 380 * k, my = deskY;
  ctx.fillStyle = '#e8e2d6'; ctx.fillRect(mx - 40 * k, my - 90 * k, 80 * k, 90 * k);
  ctx.strokeStyle = '#e8e2d6'; ctx.lineWidth = 12 * k; ctx.beginPath(); ctx.arc(mx + 46 * k, my - 46 * k, 22 * k, -1.2, 1.2); ctx.stroke();
  ctx.fillStyle = '#5a3424'; ctx.beginPath(); ctx.ellipse(mx, my - 90 * k, 40 * k, 9 * k, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = 6 * k; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.5 + i / 3) % 1; ctx.strokeStyle = `rgba(255,255,255,${0.45 * Math.sin(ph * Math.PI)})`;
    ctx.beginPath(); for (let j = 0; j <= 8; j++) { const yy = my - 100 * k - ph * 120 * k - j * 12 * k, xx = mx + (i - 1) * 18 * k + Math.sin(j * 0.8 + t * 3 + i) * 10 * k; j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke();
  }
  // the glowing box: its lid lifts and light spills out
  const bx = cx - 255 * k, op = Math.max(0, Math.min(1, Math.sin(((t % 7) / 7) * Math.PI) * 1.6));
  if (op > 0.05) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = op * 0.3; ctx.fillStyle = '#ffd77a';
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.28; ctx.beginPath(); ctx.moveTo(bx - 30 * k, deskY - 90 * k); ctx.lineTo(bx + 30 * k, deskY - 90 * k); ctx.lineTo(bx + Math.cos(a + 0.06) * 210 * k, deskY - 90 * k + Math.sin(a + 0.06) * 210 * k); ctx.lineTo(bx + Math.cos(a - 0.06) * 210 * k, deskY - 90 * k + Math.sin(a - 0.06) * 210 * k); ctx.closePath(); ctx.fill(); }
    ctx.restore(); glow(ctx, bx, deskY - 100 * k, 200 * k, [255, 210, 110], 0.8 * op);
    ctx.fillStyle = '#fff6c8'; for (let i = 0; i < 8; i++) { const ph = (t * 0.7 + i / 8) % 1; ctx.globalAlpha = op * (1 - ph); ctx.beginPath(); ctx.arc(bx + Math.sin(i * 2.3 + t) * 60 * k, deskY - 100 * k - ph * 220 * k, 4 * k, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#c98a4b'; ctx.fillRect(bx - 60 * k, deskY - 90 * k, 120 * k, 90 * k);
  ctx.fillStyle = '#a86b33'; ctx.fillRect(bx - 8 * k, deskY - 90 * k, 16 * k, 90 * k);
  ctx.save(); ctx.translate(bx - 66 * k, deskY - 90 * k); ctx.rotate(-op * 0.6); ctx.fillStyle = '#d99a58'; ctx.fillRect(0, -20 * k, 132 * k, 22 * k); ctx.restore();
  // the lamp
  ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 12 * k; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(lampX + 40 * k, deskY); ctx.lineTo(lampX + 60 * k, deskY - 190 * k); ctx.lineTo(bulb[0] + 30 * k, bulb[1] - 30 * k); ctx.stroke();
  ctx.fillStyle = '#2b2b33'; ctx.fillRect(lampX, deskY - 14 * k, 90 * k, 14 * k);
  ctx.save(); ctx.translate(bulb[0], bulb[1]); ctx.rotate(-0.5); ctx.fillStyle = '#e3703a'; ctx.beginPath(); ctx.moveTo(-50 * k, 30 * k); ctx.lineTo(50 * k, 30 * k); ctx.lineTo(24 * k, -36 * k); ctx.lineTo(-24 * k, -36 * k); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = lin(ctx, 0, bulb[1], 0, deskY, [[0, 'rgba(255,214,140,.32)'], [1, 'rgba(255,214,140,.05)']]);
  ctx.beginPath(); ctx.moveTo(bulb[0] - 30 * k, bulb[1] + 30 * k); ctx.lineTo(bulb[0] + 30 * k, bulb[1] + 30 * k); ctx.lineTo(bulb[0] + 120 * k, deskY); ctx.lineTo(bulb[0] - 260 * k, deskY); ctx.closePath(); ctx.fill(); ctx.restore();
  glow(ctx, bulb[0], bulb[1] + 30 * k, 90 * k, [255, 230, 170], 0.9);
  ctx.fillStyle = '#fff1cf';                                                   // dust in the lamp light
  for (let i = 0; i < 24; i++) { const ph = (t * 0.08 + r()) % 1; ctx.globalAlpha = 0.5 * Math.sin(ph * Math.PI); ctx.beginPath(); ctx.arc(bulb[0] - 200 * k + r() * 300 * k + Math.sin(t + i) * 12 * k, bulb[1] + 40 * k + ph * 240 * k, 2.4 * k, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
}

export const ILLUS = { pond, lighthouse, underwater, harbor, desk };
export const ILLUS_NAMES = Object.keys(ILLUS);
// what each scene is good for (the AI reads this to pick one)
export const ILLUS_ABOUT = {
  pond: 'koi pond seen from above: calm, nature, zen, Japan, focus, patience, money/luck (koi), meditation',
  lighthouse: 'lighthouse in the night sea with a turning beam: guidance, hope, loneliness, sea, journeys, bedtime',
  underwater: 'children-book underwater world with a friendly whale, glowing jellyfish, bubbles: kids, ocean, wonder, science for kids',
  harbor: 'night harbour with moon path, boats and a garland of lights: cosy evening, travel, city at night, endings, bedtime',
  desk: 'a guy in an orange hoodie typing at a desk at night with a lamp, coffee and a glowing box: work, startups, coding, AI, a story about a person, a surprise',
};
export function drawIllus(ctx, name, t, W, H, seed = 1) {
  const k = Math.min(W, H) / 1080;
  ctx.save(); (ILLUS[name] || pond)(ctx, t, W, H, k, seed); ctx.restore();
}
