// The animation engine v2. Gemini directs (who does what and when, which animals, which effects, how the camera moves);
// this file performs it: rigged stick figures with blended poses and follow-through, animals with gaits and riders,
// procedural effects (arrows, dust, sparks, smoke, fire, flags, birds, clouds…), a parallax camera.
// Pure Canvas 2D, no DOM: it runs on the page (previews) and in the render worker (the video).
// Look = the «Историк» formula of AE.LAH: round flat white head, dot eyes, one mouth line, thin black body, thick even outlines.

export const INK = '#1b1714';
export const SKIN = '#f6f1e7';
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;
const sin = (t, f, a = 1, ph = 0) => Math.sin((t * f + ph) * TAU) * a;
// smooth noise in -1..1 (a few sines with seeded phases): heads look around, weight shifts, never mechanical
const noise = (t, seed) => (Math.sin(t * 0.73 + seed * 1.7) + Math.sin(t * 1.31 + seed * 3.1) * 0.6 + Math.sin(t * 2.17 + seed * 5.3) * 0.3) / 1.9;
export function rng(seed) { let x = (seed * 9301 + 49297) % 233280; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); }

// lengths of a figure at scale 1 (px on a 720 px tall frame): ~232 px tall standing
const L = { headR: 24, neck: 6, torso: 78, upper: 42, fore: 40, thigh: 50, shin: 50 };

/* ======================= poses ======================= */
// lean (+ forward), head (tilt), look (-1..1 face turned), s/e = shoulder/elbow, h/k = hip/knee of the near (A) and far (B) limbs,
// angles from straight down, + = toward the facing side. dy = body bob, rot = whole body falls, mouth = forced open 0..1, eyes, kneel
const BASE = { lean: 0, head: 0, look: 0, sA: 0.12, eA: 0.15, sB: -0.12, eB: 0.15, hA: 0.04, kA: 0, hB: -0.04, kB: 0, dy: 0, rot: 0, mouth: 0, eyes: '', kneel: false };
const P = (o) => ({ ...BASE, ...o });
const NUM = ['lean', 'head', 'look', 'sA', 'eA', 'sB', 'eB', 'hA', 'kA', 'hB', 'kB', 'dy', 'rot', 'mouth'];

function gait(t, f, amp, knee, arm, bob, lean = 0.06) {
  const s = sin(t, f, amp);
  return { lean, dy: -Math.abs(sin(t, f * 2, bob)), hA: s, kA: Math.max(0, -s) * knee + 0.08, hB: -s, kB: Math.max(0, s) * knee + 0.08, sA: -s * arm, sB: s * arm, eA: 0.35 + Math.max(0, s) * 0.4, eB: 0.35 + Math.max(0, -s) * 0.4 };
}
const cyc = (t, period) => (t % period) / period;
const pulse = (u, a, b) => ease(u / a) * (1 - ease((u - b) / a));        // up over a, hold, down at b

export const ACTIONS = {
  idle: (t, n) => P({ dy: sin(t, 0.25, 1.5), lean: noise(t * 0.4, n) * 0.04, head: noise(t * 0.5, n + 2) * 0.08, look: noise(t * 0.35, n + 4) * 0.8, sA: 0.12 + sin(t, 0.25, 0.04), sB: -0.12 - sin(t, 0.25, 0.04), hA: 0.04 + noise(t * 0.3, n) * 0.05 }),
  talk: (t, n) => {
    const g = Math.max(0, noise(t * 1.4, n));                    // gestures come and go, never on a fixed beat
    const g2 = Math.max(0, noise(t * 1.1, n + 9));
    return P({ dy: sin(t, 0.3, 1.2), lean: 0.04 + g * 0.06, head: noise(t * 0.8, n + 1) * 0.1, look: noise(t * 0.4, n + 3) * 0.6, sA: 0.25 + g * 1.15, eA: 0.35 + g * 1.0, sB: -0.1 + g2 * 0.7, eB: 0.2 + g2 * 0.9 });
  },
  walk: (t) => P(gait(t, 0.95, 0.5, 1.1, 0.75, 4)),
  run: (t) => P(gait(t, 1.6, 0.85, 1.6, 1.1, 8, 0.28)),
  march: (t) => P({ ...gait(t, 1.0, 0.45, 0.3, 1.1, 3, 0), head: -0.04 }),
  carry: (t) => P({ ...gait(t, 0.85, 0.35, 0.9, 0, 3, 0.12), sA: 1.15, eA: 0.9, sB: 1.05, eB: 0.9 }),
  wave: (t) => P({ dy: sin(t, 0.3, 1.2), sA: 2.55, eA: 0.35 + sin(t, 1.7, 0.45), sB: -0.1, look: 0.4, mouth: 0 }),
  point: (t) => P({ lean: 0.06, sA: 1.5 + sin(t, 0.4, 0.04), eA: 0.04, sB: -0.15, head: 0.06, look: 0.6 }),
  cheer: (t) => {                                                   // a real jump: crouch, take off, fly on a parabola, land soft
    const u = cyc(t, 1.1), air = u > 0.25 && u < 0.75 ? (u - 0.25) / 0.5 : -1;
    const h = air >= 0 ? 4 * air * (1 - air) : 0, crouch = air < 0 ? Math.sin((u < 0.25 ? u / 0.25 : (u - 0.75) / 0.25) * Math.PI) : 0;
    return P({ dy: -h * 26 + crouch * 6, sA: 2.75 + h * 0.2, sB: -2.75 - h * 0.2, eA: 0.3, eB: -0.3, hA: crouch * 0.5, kA: crouch * 0.9, hB: crouch * 0.45, kB: crouch * 0.9, mouth: 0.6 });
  },
  clap: (t) => { const c = Math.abs(sin(t, 2.4)); return P({ dy: sin(t, 0.6, 1.5), sA: 1.15, eA: 0.9 - c * 0.5, sB: 1.15, eB: 0.4 + c * 0.5, mouth: 0.3 }); },
  salute: (t) => P({ sA: 2.25, eA: 2.15, sB: -0.05, eB: 0.05, head: -0.04, dy: sin(t, 0.25, 0.6) }),
  bow: (t) => { const b = pulse(cyc(t, 3) * 3, 0.7, 1.9); return P({ lean: b * 0.95, head: b * 0.3, sA: 0.2 + b * 0.55, sB: -0.2 + b * 0.55 }); },
  nod: (t, n) => P({ head: Math.max(0, sin(t, 1.8, 0.18)), dy: sin(t, 0.3, 1), look: 0.3, sA: 0.15, sB: -0.1, mouth: 0 }),
  shake_head: (t) => P({ look: sin(t, 1.6, 0.9), head: sin(t, 1.6, 0.05), dy: sin(t, 0.3, 1), sA: 0.15, sB: -0.15 }),
  shrug: (t) => { const u = pulse(cyc(t, 2.4) * 2.4, 0.3, 1.4); return P({ head: 0.12 * u, sA: 0.3 + 0.5 * u, eA: -0.2 - 1.3 * u, sB: -0.3 - 0.5 * u, eB: 0.2 + 1.3 * u, dy: -4 * u }); },
  think: (t, n) => P({ dy: sin(t, 0.2, 1), head: 0.14 + noise(t * 0.3, n) * 0.05, look: 0.5, sA: 0.55, eA: 2.55, sB: 0.4, eB: 1.65 }),
  surprised: (t) => { const u = ease(t / 0.25); return P({ lean: -0.18 * u, sA: 2.1 * u, eA: 0.8, sB: -2.1 * u, eB: -0.8, dy: -10 * pulse(t, 0.12, 0.3), mouth: 0.9, eyes: 'wide' }); },
  laugh: (t) => P({ lean: -0.14, head: -0.15, dy: sin(t, 6, 2.5), sA: 0.6, eA: 1.6, sB: 0.5, eB: 1.6, mouth: 0.4 + Math.abs(sin(t, 6, 0.5)) }),
  sad: (t) => P({ lean: 0.24, head: 0.38, dy: sin(t, 0.2, 1), sA: 0.05, sB: -0.05, eA: 0.05, eB: 0.05 }),
  pray: (t) => P({ dy: sin(t, 0.25, 1), lean: 0.12, head: 0.25 + sin(t, 0.3, 0.05), hA: 1.45, kA: 1.45, hB: -0.1, kB: 1.55, kneel: true, sA: 1.0, eA: 1.25, sB: 1.0, eB: 1.25, eyes: 'closed' }),
  kneel: (t) => P({ dy: sin(t, 0.25, 1), lean: 0.08, hA: 1.45, kA: 1.45, hB: -0.1, kB: 1.55, kneel: true, sA: 0.3, eA: 0.6, sB: -0.1 }),
  beg: (t) => P({ dy: sin(t, 0.4, 1.5), lean: 0.18, head: -0.15, hA: 1.45, kA: 1.45, hB: -0.1, kB: 1.55, kneel: true, sA: 1.45 + sin(t, 0.8, 0.12), eA: 0.2, sB: 1.3, eB: 0.3, mouth: 0.25 }),
  sit: (t, n) => P({ dy: sin(t, 0.25, 1), hA: 1.5, kA: 1.5, hB: 1.45, kB: 1.45, sA: 0.5, eA: 0.9, sB: 0.4, eB: 0.9, look: noise(t * 0.3, n) * 0.6 }),
  write: (t) => P({ hA: 1.5, kA: 1.5, hB: 1.45, kB: 1.45, lean: 0.25, head: 0.35, sA: 0.9, eA: 0.9 + sin(t, 3, 0.12), sB: 0.6, eB: 1.2 }),
  drink: (t) => { const u = pulse(cyc(t, 3.2) * 3.2, 0.5, 1.8); return P({ sA: 0.8 + u * 1.5, eA: 1.6 + u * 0.8, head: -0.25 * u, lean: -0.05 * u, sB: -0.1 }); },
  count: (t) => P({ lean: 0.18, head: 0.32, sA: 0.75, eA: 1.1 + Math.abs(sin(t, 2.2, 0.25)), sB: 0.7, eB: 1.2 }),
  work: (t) => { const s = cyc(t, 1.1), d = s < 0.45 ? ease(s / 0.45) : 1 - ease((s - 0.45) / 0.55); return P({ lean: 0.2 + d * 0.45, sA: 2.25 - d * 2.05, eA: 0.2, sB: 2.05 - d * 1.95, eB: 0.2, hA: 0.22, kA: 0.3, hB: -0.15, kB: 0.25 }); },
  fight: (t) => { const s = cyc(t, 0.8), hit = s < 0.22 ? ease(s / 0.22) : 1 - ease((s - 0.22) / 0.78); return P({ lean: 0.12 + hit * 0.16, sA: 2.5 - hit * 2.35, eA: 0.65 - hit * 0.55, sB: 0.7, eB: 1.25, hA: 0.38, kA: 0.28 + hit * 0.1, hB: -0.38, kB: 0.12, dy: hit * 3, mouth: hit * 0.4 }); },
  threaten: (t) => P({ lean: 0.12, sA: 2.35, eA: 0.9 + sin(t, 4, 0.18), sB: -0.2, eB: 0.4, mouth: 0.35 + Math.abs(sin(t, 4, 0.3)) }),
  fall: (t) => {                                                    // gravity: the fall accelerates, a small bounce on the ground
    const u = clamp(t / 0.55), g = u * u, bounce = t > 0.55 ? Math.max(0, Math.sin((t - 0.55) / 0.22 * Math.PI)) * Math.exp(-(t - 0.55) * 6) : 0;
    return P({ rot: -1.48 * g + bounce * 0.12, sA: 2.2 * g, eA: 0.4, sB: -2.0 * g, eB: -0.4, hA: 0.3 * g, kA: 0.3, hB: -0.2, mouth: 0.6 * (1 - g), eyes: t > 0.8 ? 'closed' : 'wide' });
  },
  sleep: (t) => P({ rot: -1.5, dy: sin(t, 0.2, 1), sA: 0.1, sB: -0.1, eyes: 'closed' }),
  dance: (t) => { const s = sin(t, 1.3); return P({ dy: -Math.abs(sin(t, 2.6, 8)), hA: Math.max(0, s) * 0.9, kA: Math.max(0, s) * 1.2, hB: Math.max(0, -s) * -0.2, kB: Math.max(0, -s) * 1.2, sA: 2.2 + s * 0.4, eA: 0.6, sB: -2.2 + s * 0.4, eB: -0.6, lean: s * 0.08, mouth: 0.5 }); },
  ride: (t) => P({ hA: 1.25, kA: 1.85, hB: 1.2, kB: 1.8, sA: 0.95, eA: 0.55, sB: 0.85, eB: 0.6, lean: 0.08 }),
};
export const ACTION_NAMES = Object.keys(ACTIONS).filter((a) => a !== 'ride');
// px per second at scale 1 = what the stride covers (4 x leg x sin(swing) x steps per second): the feet do not slide
const MOVING = { walk: 4 * 50 * Math.sin(0.5) * 0.95, run: 4 * 50 * Math.sin(0.85) * 1.6, march: 4 * 50 * Math.sin(0.45) * 1.0, carry: 4 * 50 * Math.sin(0.35) * 0.85 };

function mix(a, b, k) {
  if (k >= 1) return b; if (k <= 0) return a;
  const o = { ...b };
  for (const p of NUM) o[p] = lerp(a[p], b[p], k);
  o.kneel = k < 0.5 ? a.kneel : b.kneel;
  o.eyes = k < 0.5 ? a.eyes : b.eyes;
  return o;
}

/* ======================= a figure's timeline ======================= */
// a: {x, y, scale, facing, action, to_x, mood, steps: [{at, action, to_x, mood, facing}]} -> fn(t) giving where it is and its pose
export function compileActor(a, dur) {
  const steps = (Array.isArray(a.steps) && a.steps.length ? a.steps : [{ at: 0, action: a.action, to_x: a.to_x, mood: a.mood }])
    .map((s) => ({ ...s, at: clamp(+s.at || 0, 0, dur) })).sort((p, q) => p.at - q.at);
  steps[0].at = 0;
  const seed = a.seed ?? (a.x * 0.013);
  // walk the steps once: every moving step goes from where the previous one stopped to its to_x, at the speed of its gait
  let x = a.x, facing = a.facing < 0 ? -1 : 1;
  const segs = steps.map((s, i) => {
    const end = i + 1 < steps.length ? steps[i + 1].at : dur;
    const act = ACTIONS[s.action] ? s.action : 'idle';
    const seg = { at: s.at, end, act, mood: s.mood || a.mood, x0: x, x1: x, facing: s.facing ? (s.facing < 0 ? -1 : 1) : facing, travel: 0 };
    if (MOVING[act] && s.to_x != null && Math.abs(s.to_x - x) > 2) {
      seg.x1 = +s.to_x;
      seg.facing = seg.x1 > x ? 1 : -1;
      seg.travel = Math.min(end - s.at, Math.abs(seg.x1 - x) / ((a.speed?.[act] || MOVING[act]) * (a.scale || 1)));
      seg.x1 = x + (seg.x1 - x) * Math.min(1, seg.travel * (a.speed?.[act] || MOVING[act]) * (a.scale || 1) / Math.abs(seg.x1 - x));   // no faster than the legs go
    }
    x = seg.x1; facing = seg.facing;
    return seg;
  });
  const fn = (t) => {
    let i = segs.length - 1;
    while (i > 0 && segs[i].at > t) i--;
    const s = segs[i], lt = t - s.at;
    const arrived = s.travel > 0 && lt >= s.travel;
    const act = arrived ? 'idle' : s.act;
    const xNow = s.travel > 0 ? lerp(s.x0, s.x1, clamp(lt / s.travel)) : s.x0;
    let pose = ACTIONS[act](t, seed);
    if (arrived) pose = mix(ACTIONS[s.act](t, seed), pose, ease((lt - s.travel) / 0.35));
    if (i > 0 && lt < 0.35) { const p = segs[i - 1]; pose = mix(ACTIONS[p.act](t, seed), pose, ease(lt / 0.35)); }      // blend into the new step
    // follow-through: arms and head lag a little behind the body
    const lag = ACTIONS[act](t - 0.09, seed);
    for (const p of ['sA', 'eA', 'sB', 'eB', 'head']) pose[p] = pose[p] * 0.75 + lag[p] * 0.25;
    return { x: xNow, facing: s.facing, pose, mood: s.mood, moving: s.travel > 0 && !arrived, act };
  };
  return fn;
}

/* ======================= drawing a figure ======================= */
const limb = (x, y, a, len, f) => [x + Math.sin(a) * len * f, y + Math.cos(a) * len];
function line(ctx, pts, w) {
  ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

// st: {x, y (ground), scale, facing, pose, mood, talking, outfit, hat, item, grip, hand, silhouette}; amp: voice loudness 0..1
export function drawFigure(ctx, st, t, amp = 0) {
  const s = st.scale || 1, f = st.facing < 0 ? -1 : 1, pose = st.pose, dark = st.silhouette;
  const lw = Math.max(2.5, 6.5 * s);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = dark ? '#000' : INK;
  if (pose.rot) { ctx.translate(st.x, st.y); ctx.rotate(pose.rot * f); ctx.translate(-st.x, -st.y); }
  const legs = [[pose.hA, pose.kA], [pose.hB, pose.kB]].map(([h, k]) => {
    const kn = limb(0, 0, h, L.thigh * s, f), ft = limb(kn[0], kn[1], h - k, L.shin * s, f);
    return { kn, ft };
  });
  const low = st.seat ? 0 : pose.kneel ? Math.max(legs[0].kn[1], legs[1].ft[1]) : Math.max(legs[0].ft[1], legs[1].ft[1]);
  const hx = st.x, hy = st.y - low + pose.dy * s;
  const up = [Math.sin(pose.lean) * f, -Math.cos(pose.lean)];
  const neck = [hx + up[0] * L.torso * s, hy + up[1] * L.torso * s];
  const sh = [hx + up[0] * (L.torso - 6) * s, hy + up[1] * (L.torso - 6) * s];
  const headA = pose.lean + pose.head;
  const hc = [neck[0] + Math.sin(headA) * f * (L.neck + L.headR) * s, neck[1] - Math.cos(headA) * (L.neck + L.headR) * s];
  const arm = (sa, ea) => { const el = limb(sh[0], sh[1], sa + pose.lean * 0.5, L.upper * s, f); return [sh, el, limb(el[0], el[1], sa + ea + pose.lean * 0.5, L.fore * s, f)]; };
  const armA = arm(pose.sA, pose.eA), armB = arm(pose.sB, pose.eB);
  const legPts = (g) => [[hx, hy], [hx + g.kn[0], hy + g.kn[1]], [hx + g.ft[0], hy + g.ft[1]]];
  const holds = st.hand === 'left' ? 'B' : 'A';
  const drawItem = (pts) => {
    if (!st.item) return;
    const [el, hand] = [pts[1], pts[2]];
    ctx.save(); ctx.translate(hand[0], hand[1]);
    if (st.grip !== 'upright') ctx.rotate(Math.atan2(hand[1] - el[1], hand[0] - el[0]) + Math.PI / 2);
    if (f < 0) ctx.scale(-1, 1);
    ctx.drawImage(st.item, -40 * s, -120 * s, 80 * s, 160 * s);     // the item SVG box: x -40..40, y -120..40 around the hand
    ctx.restore();
  };

  line(ctx, armB, lw); if (holds === 'B') drawItem(armB);
  line(ctx, legPts(legs[1]), lw);
  if (st.outfit && !dark) {
    const px = [-up[1], up[0]], w1 = 15 * s, w2 = 21 * s, w3 = 25 * s;
    const hem = [hx - up[0] * 22 * s, hy - up[1] * 22 * s];
    ctx.fillStyle = st.outfit.color || '#6d6a3f';
    ctx.beginPath();
    ctx.moveTo(sh[0] + px[0] * w1, sh[1] + px[1] * w1); ctx.lineTo(hx + px[0] * w2, hy + px[1] * w2);
    ctx.lineTo(hem[0] + px[0] * w3, hem[1] + px[1] * w3); ctx.lineTo(hem[0] - px[0] * w3, hem[1] - px[1] * w3);
    ctx.lineTo(hx - px[0] * w2, hy - px[1] * w2); ctx.lineTo(sh[0] - px[0] * w1, sh[1] - px[1] * w1);
    ctx.closePath(); ctx.fill(); ctx.lineWidth = lw * 0.8; ctx.stroke();
    if (st.outfit.belt) {
      ctx.strokeStyle = st.outfit.belt;
      line(ctx, [[hx + px[0] * w2 * 0.92, hy + px[1] * w2 * 0.92 - 4 * s], [hx - px[0] * w2 * 0.92, hy - px[1] * w2 * 0.92 - 4 * s]], 8 * s);
      ctx.strokeStyle = INK;
    }
  } else line(ctx, [[hx, hy], neck], lw);
  line(ctx, legPts(legs[0]), lw);
  line(ctx, [neck, [hc[0] - Math.sin(headA) * f * L.headR * s, hc[1] + Math.cos(headA) * L.headR * s]], lw);

  ctx.save();
  ctx.translate(hc[0], hc[1]); ctx.rotate(headA * f);
  ctx.beginPath(); ctx.arc(0, 0, L.headR * s, 0, TAU);
  ctx.fillStyle = dark ? '#000' : SKIN; ctx.fill(); ctx.lineWidth = lw * 0.9; ctx.stroke();
  const ex = (4 + pose.look * 5) * f * s;
  if (dark) {
    ctx.fillStyle = '#d0201c';
    for (const d of [-8, 8]) { ctx.beginPath(); ctx.arc(ex + d * s, -2 * s, 3.4 * s, 0, TAU); ctx.fill(); }
  } else {
    const blink = (t + (st.phase || 0)) % 3.7 < 0.12 || pose.eyes === 'closed';
    ctx.fillStyle = INK;
    for (const d of [-8, 8]) {
      if (blink) line(ctx, [[ex + d * s - 3 * s, -3 * s], [ex + d * s + 3 * s, -3 * s]], 2.2 * s);
      else { ctx.beginPath(); ctx.arc(ex + d * s, -3 * s, (pose.eyes === 'wide' ? 4.4 : 3.2) * s, 0, TAU); ctx.fill(); }
    }
    const mood = st.mood || 'neutral';
    if (mood === 'angry') { line(ctx, [[ex - 13 * s, -13 * s], [ex - 3 * s, -8 * s]], 2.6 * s); line(ctx, [[ex + 13 * s, -13 * s], [ex + 3 * s, -8 * s]], 2.6 * s); }
    if (mood === 'sad' || mood === 'scared') { line(ctx, [[ex - 13 * s, -9 * s], [ex - 3 * s, -12 * s]], 2.4 * s); line(ctx, [[ex + 13 * s, -9 * s], [ex + 3 * s, -12 * s]], 2.4 * s); }
    const open = Math.max(pose.mouth, st.talking ? amp : 0);
    ctx.lineWidth = 2.6 * s; ctx.beginPath();
    if (open > 0.08) { ctx.ellipse(ex, 9 * s, 6 * s, (1.5 + open * 6) * s, 0, 0, TAU); ctx.fillStyle = INK; ctx.fill(); }
    else if (mood === 'happy' || mood === 'proud') ctx.arc(ex, 3 * s, 8 * s, 0.2 * Math.PI, 0.8 * Math.PI);
    else if (mood === 'sad') ctx.arc(ex, 15 * s, 7 * s, 1.2 * Math.PI, 1.8 * Math.PI);
    else if (mood === 'scared') ctx.arc(ex, 10 * s, 3.5 * s, 0, TAU);
    else { ctx.moveTo(ex - 6 * s, 9 * s); ctx.lineTo(ex + 6 * s, 9 * s); }
    ctx.stroke();
  }
  if (st.hat && !dark) { if (f < 0) ctx.scale(-1, 1); ctx.drawImage(st.hat, -60 * s, -90 * s, 120 * s, 120 * s); }   // hat box: x -60..60, y -90..30
  ctx.restore();
  ctx.strokeStyle = dark ? '#000' : INK;
  line(ctx, armA, lw); if (holds === 'A') drawItem(armA);
  ctx.restore();
}

/* ======================= animals ======================= */
const ANIMALS = {
  horse: { color: '#8a5a36', leg: 34, body: [62, 28], neck: [34, -52], head: [24, 11], hump: 0, horns: 0 },
  camel: { color: '#d2ac6c', leg: 46, body: [60, 27], neck: [40, -30], head: [22, 10], hump: 2, horns: 0 },
  ox: { color: '#6b4a32', leg: 26, body: [64, 32], neck: [22, -12], head: [20, 14], hump: 0, horns: 1 },
};
const GAIT = { stand: [0, 0, 0], graze: [0, 0, 0], walk: [0.85, 0.34, 3], run: [1.9, 0.7, 9] };

// an: {kind, x, y (ground), scale, facing, color, gait, steps?} ; returns the saddle point for a rider
export function drawAnimal(ctx, an, st, t) {
  // ×1.9: at the same scale as a person (232 px tall) a horse is longer than a man is tall and the rider sits naturally
  const A = ANIMALS[an.kind] || ANIMALS.horse, s = (an.scale || 1) * 1.9, f = st.facing < 0 ? -1 : 1;
  const g = GAIT[st.gait] || GAIT.stand;
  const lw = Math.max(2.5, 6 * s), legL = A.leg * s;
  const bob = -Math.abs(sin(t, g[0] * 2, g[2])) * s;
  const by = st.y - (legL * 2 + 8 * s) - A.body[1] * s * 0.6 + bob, bx = st.x;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.fillStyle = an.color || A.color;
  const legAt = (dx, ph, far) => {
    const sw = sin(t, g[0], g[1], ph), lift = Math.max(0, sin(t, g[0], 1, ph + 0.25)) * g[1];
    const top = [bx + dx * f * s, by + A.body[1] * s * 0.6];
    const knee = limb(top[0], top[1], sw, legL, f), hoof = limb(knee[0], knee[1], sw - lift * 1.6 * (dx > 0 ? -1 : 1), legL, f);
    ctx.globalAlpha = far ? 0.85 : 1; line(ctx, [top, knee, hoof], lw * 1.25); ctx.globalAlpha = 1;
  };
  legAt(-40, 0.5, true); legAt(42, 0, true);                               // far legs (diagonal pairs)
  // tail
  ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(bx - 58 * f * s, by - 8 * s);
  ctx.quadraticCurveTo(bx - (78 + sin(t, 0.8, 6)) * f * s, by + 10 * s, bx - (70 + sin(t, 0.8, 10)) * f * s, by + 38 * s); ctx.stroke();
  // body (+ humps)
  ctx.beginPath(); ctx.ellipse(bx, by, A.body[0] * s, A.body[1] * s, 0, 0, TAU); ctx.fill(); ctx.lineWidth = lw; ctx.stroke();
  for (let i = 0; i < A.hump; i++) {
    const hx = bx + (i === 0 ? -14 : 18) * f * s;
    ctx.beginPath(); ctx.ellipse(hx, by - A.body[1] * s * 0.95, 20 * s, 22 * s, 0, Math.PI, TAU); ctx.fill(); ctx.stroke();
  }
  // neck and head (grazing lowers the head)
  const graze = st.gait === 'graze' ? 1 : 0;
  const nb = [bx + 50 * f * s, by - 8 * s];
  const nt = [nb[0] + (A.neck[0] + graze * 10) * f * s, nb[1] + (A.neck[1] + graze * 110) * s + sin(t, g[0] * 2, 3 * s)];
  ctx.lineWidth = 16 * s; ctx.strokeStyle = INK; line(ctx, [nb, nt], 20 * s);
  ctx.strokeStyle = an.color || A.color; line(ctx, [nb, nt], 12 * s); ctx.strokeStyle = INK;
  ctx.save(); ctx.translate(nt[0], nt[1]); ctx.rotate((0.35 + graze * 0.9) * f);
  ctx.beginPath(); ctx.ellipse(A.head[0] * 0.6 * f * s, 0, A.head[0] * s, A.head[1] * s, 0, 0, TAU); ctx.fill(); ctx.lineWidth = lw; ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(A.head[0] * 0.5 * f * s, -A.head[1] * 0.35 * s, 2.6 * s, 0, TAU); ctx.fill();
  if (A.horns) { line(ctx, [[0, -A.head[1] * s], [-6 * f * s, -A.head[1] * 2.2 * s], [6 * f * s, -A.head[1] * 2.6 * s]], lw * 0.8); }
  else { line(ctx, [[-4 * f * s, -A.head[1] * s * 0.8], [-2 * f * s, -A.head[1] * s * 1.9]], lw * 0.7); }      // ear
  ctx.restore();
  if (an.kind === 'horse') {                                              // mane
    ctx.lineWidth = lw * 0.6;
    for (let i = 0; i < 4; i++) { const k = (i + 1) / 5, mx = lerp(nb[0], nt[0], k), my = lerp(nb[1], nt[1], k); line(ctx, [[mx, my], [mx - (10 + sin(t, 1, 3, i * 0.2)) * f * s, my + 4 * s]], lw * 0.6); }
  }
  ctx.fillStyle = an.color || A.color;
  legAt(-46, 0, false); legAt(36, 0.5, false);                            // near legs
  ctx.restore();
  return [bx - 4 * f * s, by - A.body[1] * s * (A.hump ? 1.55 : 0.95)];
}

/* ======================= effects ======================= */
// fx: {kind, x, y, scale, at, dur, dir, color, n}
export function drawFx(ctx, fx, t, W, H, seed) {
  const at = +fx.at || 0, dur = fx.dur == null ? 999 : +fx.dur, lt = t - at;
  if (lt < 0 || lt > dur) return;
  const s = fx.scale || 1, x = +fx.x, y = +fx.y, dir = fx.dir < 0 ? -1 : 1, r = rng(seed + (x | 0));
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (fx.kind) {
    case 'arrows': {                                                       // volleys flying in arcs
      ctx.strokeStyle = INK; ctx.lineWidth = 3 * s;
      for (let i = 0; i < (fx.n || 9); i++) {
        const u = ((lt * 0.8 + r()) % 1), sx = x + r() * 120 * s, sy = y - r() * 60 * s, dx = dir * (420 + r() * 200) * s;
        const px = sx + dx * u, py = sy - Math.sin(u * Math.PI) * 220 * s;
        const ang = Math.atan2(-Math.cos(u * Math.PI) * 220 * s * Math.PI, dx);
        ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
        line(ctx, [[-26 * s, 0], [18 * s, 0]], 3 * s);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(24 * s, 0); ctx.lineTo(14 * s, -5 * s); ctx.lineTo(14 * s, 5 * s); ctx.fill();
        line(ctx, [[-26 * s, 0], [-32 * s, -6 * s]], 2 * s); line(ctx, [[-26 * s, 0], [-32 * s, 6 * s]], 2 * s);
        ctx.restore();
      }
      break;
    }
    case 'dust': {
      for (let i = 0; i < 7; i++) {
        const u = ((lt * 0.9 + i / 7) % 1), px = x + (r() - 0.5) * 140 * s + u * 30 * s * dir, py = y - u * 40 * s;
        ctx.fillStyle = `rgba(185,155,105,${0.45 * (1 - u)})`; ctx.beginPath(); ctx.arc(px, py, (10 + u * 34) * s, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'sparks': {
      const u = (lt % 0.8) / 0.8;
      if (u < 0.45) for (let i = 0; i < 12; i++) {
        const a = r() * TAU, d = (10 + u * 70 * (0.6 + r())) * s;
        ctx.strokeStyle = i % 3 ? '#ffd27a' : '#fff4c8'; ctx.lineWidth = 3 * s;
        line(ctx, [[x + Math.cos(a) * d * 0.6, y + Math.sin(a) * d * 0.6], [x + Math.cos(a) * d, y + Math.sin(a) * d]], 3 * s);
      }
      break;
    }
    case 'smoke': {
      for (let i = 0; i < 9; i++) {
        const u = ((lt * 0.25 + i / 9) % 1), px = x + Math.sin(u * 5 + i) * 20 * s + u * 60 * s, py = y - u * 320 * s;
        ctx.fillStyle = `rgba(90,86,80,${0.5 * (1 - u)})`; ctx.strokeStyle = `rgba(27,23,20,${0.6 * (1 - u)})`; ctx.lineWidth = 3 * s;
        ctx.beginPath(); ctx.arc(px, py, (18 + u * 46) * s, 0, TAU); ctx.fill(); ctx.stroke();
      }
      break;
    }
    case 'fire': case 'torch': {
      if (fx.kind === 'torch') { ctx.strokeStyle = INK; line(ctx, [[x, y], [x, y - 120 * s]], 9 * s); ctx.strokeStyle = '#5a3d2b'; line(ctx, [[x, y], [x, y - 120 * s]], 5 * s); }
      const fy = fx.kind === 'torch' ? y - 125 * s : y, k = fx.kind === 'torch' ? 0.5 : 1;
      if (fx.kind === 'fire') { ctx.strokeStyle = INK; ctx.lineWidth = 8 * s; for (const d of [-1, 1]) line(ctx, [[x - 40 * d * s, y + 4 * s], [x + 40 * d * s, y - 8 * s]], 9 * s); }
      [['#a8231f', 1], ['#e0762f', 0.75], ['#f4c542', 0.45]].forEach(([c, sc]) => {
        ctx.fillStyle = c; ctx.beginPath();
        const h = (95 + sin(lt, 3.1, 14) + sin(lt, 5.3, 8)) * s * sc * k, w = 42 * s * sc * k;
        ctx.moveTo(x - w, fy);
        ctx.quadraticCurveTo(x - w * 0.9, fy - h * 0.55, x + sin(lt, 2.3, 10 * s), fy - h);
        ctx.quadraticCurveTo(x + w * 0.9, fy - h * 0.5, x + w, fy);
        ctx.closePath(); ctx.fill();
      });
      ctx.strokeStyle = INK; ctx.lineWidth = 3 * s; ctx.stroke();
      break;
    }
    case 'explosion': {
      const u = clamp(lt / 0.9);
      ctx.fillStyle = `rgba(255,236,170,${1 - u})`; ctx.beginPath(); ctx.arc(x, y, (30 + u * 180) * s, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(224,118,47,${0.9 * (1 - u)})`; ctx.beginPath(); ctx.arc(x, y, (20 + u * 120) * s, 0, TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 4 * s;
      for (let i = 0; i < 10; i++) { const a = r() * TAU, d = u * (120 + r() * 140) * s; ctx.fillStyle = INK; ctx.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d + u * u * 60 * s, 8 * s, 8 * s); }
      break;
    }
    case 'coins': {
      for (let i = 0; i < (fx.n || 14); i++) {
        const u = ((lt * 0.7 + r()) % 1), px = x + (r() - 0.5) * 220 * s, py = y - 260 * s + u * 300 * s;
        ctx.save(); ctx.translate(px, py); ctx.scale(Math.abs(Math.cos(lt * 6 + i)) + 0.15, 1);
        ctx.fillStyle = '#e2b13c'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5 * s;
        ctx.beginPath(); ctx.arc(0, 0, 9 * s, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      break;
    }
    case 'birds': {
      ctx.strokeStyle = INK; ctx.lineWidth = 3 * s;
      for (let i = 0; i < (fx.n || 6); i++) {
        const px = ((x + lt * 70 * dir * s + i * 60 * s + r() * 40) % (W + 200)) - 100, py = y + (r() - 0.5) * 90 * s + Math.sin(lt * 1.5 + i) * 10;
        const flap = Math.sin(lt * 9 + i) * 7 * s;
        ctx.beginPath(); ctx.moveTo(px - 14 * s, py - flap); ctx.quadraticCurveTo(px - 6 * s, py - 6 * s, px, py); ctx.quadraticCurveTo(px + 6 * s, py - 6 * s, px + 14 * s, py - flap); ctx.stroke();
      }
      break;
    }
    case 'clouds': {
      for (let i = 0; i < (fx.n || 3); i++) {
        const cw = (140 + r() * 120) * s, px = ((r() * W + lt * (12 + r() * 10)) % (W + cw * 2)) - cw, py = y + r() * 120 * s;
        ctx.fillStyle = '#fbf6ea'; ctx.strokeStyle = INK; ctx.lineWidth = 4 * s;
        ctx.beginPath();
        ctx.ellipse(px, py, cw * 0.5, cw * 0.18, 0, 0, TAU); ctx.ellipse(px - cw * 0.18, py - cw * 0.12, cw * 0.22, cw * 0.16, 0, 0, TAU); ctx.ellipse(px + cw * 0.15, py - cw * 0.15, cw * 0.26, cw * 0.2, 0, 0, TAU);
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(px, py, cw * 0.48, cw * 0.16, 0, 0, TAU); ctx.ellipse(px - cw * 0.18, py - cw * 0.12, cw * 0.2, cw * 0.14, 0, 0, TAU); ctx.ellipse(px + cw * 0.15, py - cw * 0.15, cw * 0.24, cw * 0.18, 0, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'flag': {
      const ph = 120 * s, fw = 110 * s, fh = 64 * s;
      ctx.strokeStyle = INK; line(ctx, [[x, y], [x, y - ph - 30 * s]], 8 * s);
      ctx.fillStyle = fx.color || '#a8231f'; ctx.lineWidth = 4 * s; ctx.beginPath();
      const top = y - ph - 26 * s;
      ctx.moveTo(x, top);
      for (let i = 1; i <= 8; i++) { const k = i / 8; ctx.lineTo(x + fw * k * dir, top + Math.sin(lt * 5 - k * 4) * 9 * s * k); }
      for (let i = 8; i >= 0; i--) { const k = i / 8; ctx.lineTo(x + fw * k * dir, top + fh + Math.sin(lt * 5 - k * 4 - 0.4) * 9 * s * k); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'water': {
      ctx.strokeStyle = 'rgba(27,23,20,.55)'; ctx.lineWidth = 3 * s;
      for (let row = 0; row < 4; row++) for (let i = 0; i < 9; i++) {
        const px = ((i * 150 + row * 70 + lt * 40) % (W + 150)) - 75, py = y + row * 24 * s;
        ctx.beginPath(); ctx.arc(px, py, 14 * s, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
      }
      break;
    }
    default:
  }
  ctx.restore();
}

/* ======================= the camera ======================= */
// keys: [{at, move: wide|push|pull|pan_left|pan_right|focus|shake, target (actor index), zoom}] -> {z, cx, cy, shake}
function camAt(keys, t, dur, W, H, targets) {
  const list = (Array.isArray(keys) && keys.length ? keys : [{ at: 0, move: typeof keys === 'string' ? keys : 'push' }]).map((k) => ({ ...k, at: +k.at || 0 })).sort((a, b) => a.at - b.at);
  let i = list.length - 1;
  while (i > 0 && list[i].at > t) i--;
  const k = list[i], end = i + 1 < list.length ? list[i + 1].at : dur, u = ease((t - k.at) / Math.max(0.5, end - k.at));
  const state = (key, uu) => {
    const z1 = clamp(+key.zoom || 1.18, 1, 1.6);
    switch (key.move) {
      case 'push': return { z: lerp(1.02, 1.12, uu), cx: W / 2, cy: H / 2 };
      case 'pull': return { z: lerp(1.14, 1.02, uu), cx: W / 2, cy: H / 2 };
      case 'pan_left': return { z: 1.1, cx: lerp(W * 0.56, W * 0.44, uu), cy: H / 2 };
      case 'pan_right': return { z: 1.1, cx: lerp(W * 0.44, W * 0.56, uu), cy: H / 2 };
      case 'focus': { const tg = targets[key.target | 0] || [W / 2, H / 2]; return { z: lerp(1.05, z1, uu), cx: lerp(W / 2, tg[0], uu), cy: lerp(H / 2, tg[1], uu) }; }
      case 'shake': return { z: 1.08, cx: W / 2, cy: H / 2, shake: 1 };
      default: return { z: 1.03, cx: W / 2, cy: H / 2 };
    }
  };
  const cur = state(k, u);
  if (i > 0 && t - k.at < 0.6) {                                           // glide from the previous move
    const p = list[i - 1], prev = state(p, 1), b = ease((t - k.at) / 0.6);
    return { z: lerp(prev.z, cur.z, b), cx: lerp(prev.cx, cur.cx, b), cy: lerp(prev.cy, cur.cy, b), shake: cur.shake };
  }
  return cur;
}

/* ======================= a whole scene ======================= */
// sc: {back, front (bitmaps), actors, animals, fx, camera, weather, seed, w}; compiled once by prepareScene
export function prepareScene(sc, dur) {
  if (sc._dur === dur) return sc;
  sc._dur = dur;
  sc._actors = (sc.actors || []).map((a, i) => ({ a, fn: compileActor({ ...a, seed: i * 2.3 + 1 }, dur) }));
  sc._animals = (sc.animals || []).map((an) => ({ an, fn: compileActor({ ...an, action: an.gait === 'run' ? 'run' : an.gait === 'walk' ? 'walk' : 'idle', steps: (an.steps || []).map((s) => ({ ...s, action: s.gait === 'run' ? 'run' : s.gait === 'walk' ? 'walk' : 'idle' })), scale: (an.scale || 1) * 1.6 }, dur) }));
  return sc;
}

// the What If look (same as its cover): black silhouettes outlined by the warm key light
function person(ctx, sc, st, t, amp, k) {
  if (!sc.silhouette) return drawFigure(ctx, st, t, amp);
  ctx.save(); ctx.shadowColor = sc.rim || '#f2a541'; ctx.shadowBlur = 16 * k;
  drawFigure(ctx, { ...st, silhouette: true }, t, amp);
  ctx.restore();
}

export function drawScene(ctx, sc, t, dur, W, H, amp = 0) {
  prepareScene(sc, dur);
  // Gemini places everything in the real frame (W x H); only the figure size follows the short side (scale 1 = 232 px at 720)
  const k = Math.min(W, H) / 720, kx = 1;
  // where everyone is now (the camera can follow them)
  const animals = sc._animals.map(({ an, fn }) => { const s = fn(t); const gaitNow = s.moving ? (s.act === 'run' ? 'run' : 'walk') : (an.gait === 'graze' ? 'graze' : 'stand'); return { an: { ...an, scale: (an.scale || 1) * k }, st: { x: s.x * kx, y: an.y, facing: s.facing, gait: gaitNow } }; });
  const actors = sc._actors.map(({ a, fn }) => { const s = fn(t); return { ...a, x: s.x * kx, y: a.y, scale: (a.scale || 1) * k, facing: s.facing, pose: s.pose, mood: s.mood, moving: s.moving, act: s.act }; });
  const targets = actors.map((a) => [a.x, a.y - 200 * a.scale]);
  const cam = camAt(sc.camera, t, dur, W, H, targets);
  const shake = cam.shake ? [Math.sin(t * 37) * 5 + Math.sin(t * 23) * 3, Math.cos(t * 31) * 4] : [0, 0];
  const view = (depth) => {                                                // parallax: far layers move less, near layers more
    const z = 1 + (cam.z - 1) * depth, cx = W / 2 + (cam.cx - W / 2) * depth, cy = H / 2 + (cam.cy - H / 2) * depth;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(W / 2 + shake[0] * depth, H / 2 + shake[1] * depth); ctx.scale(z, z); ctx.translate(-cx, -cy);
  };
  ctx.save();
  view(0.55);
  if (sc.back) ctx.drawImage(sc.back, -W * 0.03, -H * 0.03, W * 1.06, H * 1.06); else { ctx.fillStyle = '#e9dcc0'; ctx.fillRect(0, 0, W, H); }
  const fx = sc.fx || [];
  fx.filter((f) => f.kind === 'clouds' || f.kind === 'birds').forEach((f, i) => drawFx(ctx, { ...f, x: f.x * kx, y: f.y, scale: (f.scale || 1) * k }, t, W, H, (sc.seed || 1) + i));
  view(1);
  fx.filter((f) => f.kind === 'water' || f.kind === 'flag' || f.kind === 'fire' || f.kind === 'torch' || f.kind === 'smoke').forEach((f, i) => drawFx(ctx, { ...f, x: f.x * kx, y: f.y, scale: (f.scale || 1) * k }, t, W, H, (sc.seed || 1) + 10 + i));
  // animals and people, further first; riders sit in the saddle and bob with it
  const items = [...animals.map((x) => ({ y: x.st.y, an: x })), ...actors.filter((a) => a.rider == null).map((a) => ({ y: a.y, a }))].sort((p, q) => p.y - q.y);
  for (const it of items) {
    if (it.an) {
      const seat = drawAnimal(ctx, it.an.an, it.an.st, t);
      const idx = animals.indexOf(it.an);
      for (const r of actors.filter((a) => a.rider === idx)) person(ctx, sc, { ...r, x: seat[0], y: seat[1], facing: it.an.st.facing, pose: ACTIONS.ride(t), seat: true }, t, amp, k);
    } else {
      person(ctx, sc, it.a, t, amp, k);
      if (it.a.moving && it.a.act === 'run') drawFx(ctx, { kind: 'dust', x: it.a.x - 30 * it.a.facing * it.a.scale, y: it.a.y, scale: it.a.scale * 0.7, dir: -it.a.facing }, t, W, H, 7);
    }
  }
  fx.filter((f) => ['arrows', 'dust', 'sparks', 'explosion', 'coins'].includes(f.kind)).forEach((f, i) => drawFx(ctx, { ...f, x: f.x * kx, y: f.y, scale: (f.scale || 1) * k }, t, W, H, (sc.seed || 1) + 20 + i));
  view(1);
  for (const a of sc.ambient || []) drawAmbient(ctx, a, t, W, H, sc.light, (sc.seed || 1) + 40);
  if (sc.front) { view(1.3); ctx.drawImage(sc.front, -W * 0.05, -H * 0.05, W * 1.1, H * 1.1); }
  ctx.restore();
  if (sc.weather && sc.weather !== 'none') drawWeather(ctx, sc.weather, t, W, H, sc.seed || 1);
  drawLight(ctx, sc.light, t, W, H);
}

/* ======================= light and air: what makes a code-drawn scene feel like a film ======================= */
// light: {time: day|golden|dusk|night|interior, x, y (the source: sun, window, lamp, fire), color, kind}
const LIGHT = {
  day: { tint: ['#fff3d6', '#ffe9c4'], tintA: 0.22, glow: '#fff4cc', glowA: 0.35, rays: 0.05, vig: 0.28 },
  golden: { tint: ['#ffc070', '#ff8a4c'], tintA: 0.34, glow: '#ffd27a', glowA: 0.5, rays: 0.09, vig: 0.36 },
  dusk: { tint: ['#7b63e0', '#ff8f6a'], tintA: 0.34, glow: '#ffb38a', glowA: 0.35, rays: 0.04, vig: 0.42 },
  night: { tint: ['#2b3a7a', '#1a2550'], tintA: 0.42, glow: '#cfe0ff', glowA: 0.3, rays: 0.03, vig: 0.55, dark: 0.28 },
  interior: { tint: ['#ffd9a0', '#c98a5a'], tintA: 0.3, glow: '#ffe2a8', glowA: 0.45, rays: 0.12, vig: 0.45 },
};
let grain = null;
function grainTile() {
  if (grain) return grain;
  const c = new OffscreenCanvas(128, 128), g = c.getContext('2d'), d = g.createImageData(128, 128), r = rng(7);
  for (let i = 0; i < d.data.length; i += 4) { const v = (r() * 255) | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); return (grain = c);
}
export function drawLight(ctx, light, t, W, H) {
  if (!light) return;
  const L = LIGHT[light.time] || LIGHT.day, lx = Number.isFinite(+light.x) ? +light.x : W * 0.75, ly = Number.isFinite(+light.y) ? +light.y : H * 0.18, R = Math.max(W, H);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (L.dark) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(40,50,110,${L.dark})`; ctx.fillRect(0, 0, W, H); }
  // colour grade: one soft-light pass from top to bottom
  ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = L.tintA;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, L.tint[0]); g.addColorStop(1, L.tint[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // the glow of the source, breathing a little (a fire or a lamp flickers)
  const flick = /fire|lamp|torch|candle/i.test(light.kind || '') ? 0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.3) : 1 + 0.04 * Math.sin(t * 1.2);
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = Math.min(1, L.glowA * flick);
  const gl = ctx.createRadialGradient(lx, ly, 0, lx, ly, R * 0.55); gl.addColorStop(0, light.color || L.glow); gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  // soft rays from the source, slowly turning
  if (L.rays) {
    ctx.globalAlpha = L.rays; ctx.fillStyle = light.color || L.glow;
    const base = Math.atan2(H * 0.75 - ly, W * 0.45 - lx);
    for (let i = 0; i < 6; i++) {
      const a = base + (i - 2.5) * 0.16 + Math.sin(t * 0.25 + i) * 0.03, w = 0.035 + (i % 3) * 0.015;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + Math.cos(a - w) * R * 1.5, ly + Math.sin(a - w) * R * 1.5); ctx.lineTo(lx + Math.cos(a + w) * R * 1.5, ly + Math.sin(a + w) * R * 1.5); ctx.closePath(); ctx.fill();
    }
  }
  // vignette and film grain
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, R * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(10,6,20,${L.vig})`);
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = 'overlay';
  const f = Math.floor(t * 24);
  ctx.translate(-((f * 37) % 128), -((f * 53) % 128)); ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat'); ctx.fillRect(0, 0, W + 128, H + 128);
  ctx.restore();
}

// air that moves: motes, fireflies, leaves, petals, fog, ripples, stars
export function drawAmbient(ctx, kind, t, W, H, light, seed) {
  const r = rng(seed + kind.length * 13), k = Math.min(W, H) / 720, lx = +light?.x || W * 0.7, ly = +light?.y || H * 0.2;
  ctx.save();
  if (kind === 'motes') {                                                   // dust glittering in the light
    for (let i = 0; i < 40; i++) {
      const x0 = lx + (r() - 0.5) * W * 0.9, y0 = ly + r() * H * 0.7, sp = 0.3 + r(), rad = (1.2 + r() * 2) * k;
      const x = x0 + Math.sin(t * 0.4 * sp + i) * 30 * k, y = y0 + Math.cos(t * 0.3 * sp + i * 2) * 20 * k - t * 6 * sp * k;
      ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * sp + i)); ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(x, ((y % H) + H) % H, rad, 0, TAU); ctx.fill();
    }
  } else if (kind === 'fireflies') {
    for (let i = 0; i < 18; i++) {
      const rx = r(), ry = r(), rs = r();
      const x = rx * W + Math.sin(t * 0.7 + i * 3) * 40 * k, y = H * (0.45 + ry * 0.5) + Math.cos(t * 0.9 + i) * 25 * k, on = Math.max(0, Math.sin(t * (1.5 + rs) + i * 1.7));
      if (!on) continue;
      ctx.globalAlpha = on * 0.35; ctx.fillStyle = '#d9ff7a'; ctx.beginPath(); ctx.arc(x, y, 9 * k, 0, TAU); ctx.fill();
      ctx.globalAlpha = on; ctx.fillStyle = '#f6ffc2'; ctx.beginPath(); ctx.arc(x, y, 2.6 * k, 0, TAU); ctx.fill();
    }
  } else if (kind === 'leaves' || kind === 'petals') {
    const cols = kind === 'petals' ? ['#f7b6c8', '#fbd3df', '#f49ab2'] : ['#d9822b', '#b5562a', '#e3b13c', '#7f9a3a'];
    for (let i = 0; i < 16; i++) {
      const sp = 0.5 + r(), x0 = r() * W, y0 = r() * H;
      const y = ((y0 + t * 70 * sp * k) % (H + 40)) - 20, x = x0 + Math.sin(t * 1.3 * sp + i) * 50 * k - t * 20 * k;
      ctx.save(); ctx.translate(((x % W) + W) % W, y); ctx.rotate(t * 2 * sp + i); ctx.scale(1, Math.abs(Math.sin(t * 3 * sp + i)) * 0.8 + 0.2);
      ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.ellipse(0, 0, 9 * k, 5 * k, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
  } else if (kind === 'fog') {                                              // soft bands drifting low
    for (let i = 0; i < 4; i++) {
      const x = ((r() * W + t * (14 + i * 6) * k) % (W * 1.6)) - W * 0.3, y = H * (0.62 + i * 0.08), rw = W * (0.5 + r() * 0.4);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rw); g.addColorStop(0, 'rgba(235,235,245,.30)'); g.addColorStop(1, 'rgba(235,235,245,0)');
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.22); ctx.translate(-x, -y); ctx.fillStyle = g; ctx.fillRect(x - rw, y - rw, rw * 2, rw * 2); ctx.restore();
    }
  } else if (kind === 'ripples') {                                          // rings spreading on water
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 6; i++) {
      const per = 2.4 + r() * 1.6, off = r() * per, x = r() * W, y = H * (0.7 + r() * 0.25), ph = ((t + off) % per) / per;
      ctx.globalAlpha = (1 - ph) * 0.8; ctx.lineWidth = 2.5 * k * (1 - ph) + 0.5;
      for (const m of [1, 0.6]) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, ph * 90 * k * m), Math.max(0.1, ph * 26 * k * m), 0, 0, TAU); ctx.stroke(); }
    }
  } else if (kind === 'stars') {
    for (let i = 0; i < 60; i++) { const x = r() * W, y = r() * H * 0.45, sp = 0.8 + r() * 2; ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * sp + i)); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 2 * k, 2 * k); }
  }
  ctx.restore();
}

function drawWeather(ctx, kind, t, W, H, seed) {
  const r = rng(seed), n = kind === 'rain' ? 70 : 45;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x0 = r() * W, y0 = r() * H, sp = 0.5 + r();
    if (kind === 'snow') { ctx.fillStyle = 'rgba(255,255,255,.85)'; const y = (y0 + t * 60 * sp) % H, x = x0 + Math.sin(t + i) * 12; ctx.beginPath(); ctx.arc(x, y, 2.5 + sp * 1.5, 0, TAU); ctx.fill(); }
    else if (kind === 'rain') { ctx.strokeStyle = 'rgba(220,228,240,.55)'; ctx.lineWidth = 2; const y = (y0 + t * 700 * sp) % H; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 - 6, y + 22); ctx.stroke(); }
    else if (kind === 'embers') { ctx.fillStyle = `rgba(255,${120 + (i % 5) * 20},40,.8)`; const y = H - ((H - y0 + t * 50 * sp) % H), x = x0 + Math.sin(t * 2 + i) * 10; ctx.fillRect(x, y, 3, 3); }
    else { ctx.fillStyle = 'rgba(190,160,110,.3)'; const x = (x0 + t * 40 * sp) % W, y = y0 + Math.sin(t + i) * 8; ctx.beginPath(); ctx.arc(x, y, 3 + sp * 2, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

/* ======================= transitions between scenes ======================= */
// draw the cut between scene A (ending) and B (starting); u = 0..1 through the transition
export function drawTransition(ctx, kind, drawA, drawB, u, W, H) {
  if (kind === 'whip') {
    const e = ease(u), off = W * e;
    ctx.save(); ctx.translate(-off, 0); drawA(); ctx.restore();
    ctx.save(); ctx.translate(W - off, 0); drawB(); ctx.restore();
    ctx.fillStyle = `rgba(255,255,255,${Math.sin(u * Math.PI) * 0.25})`; ctx.fillRect(0, 0, W, H);
  } else if (kind === 'flash') {
    (u < 0.5 ? drawA : drawB)();
    ctx.fillStyle = `rgba(255,252,240,${1 - Math.abs(u - 0.5) * 2})`; ctx.fillRect(0, 0, W, H);
  } else {
    drawA(); ctx.save(); ctx.globalAlpha = ease(u); drawB(); ctx.restore();
  }
}

/* ======================= the rank pyramid (format «Ранги») ======================= */
const ROWS = [[1, 2, 3, 4], [5, 6, 7], [8, 9], [10]];
export function cardRect(level, W, H) {
  const gap = H * 0.025, h = (H * 0.9 - 3 * gap) / 4, w = h * 16 / 9;
  const row = ROWS.findIndex((r) => r.includes(level)), cnt = ROWS[row].length, col = ROWS[row].indexOf(level);
  return [(W - (cnt * w + (cnt - 1) * gap)) / 2 + col * (w + gap), H * 0.95 - h - row * (h + gap), w, h];
}
export function drawPyramid(ctx, cards, W, H, target, k, passed = 0, vertical = false) {
  const PW = 1280, PH = 720;
  const [x, y, w, h] = cardRect(target, PW, PH);
  const z0 = vertical ? W / PW : Math.min(W / PW, H / PH), z1 = W / w;
  const z = z0 * Math.pow(z1 / z0, ease(k));
  const m = (z - z0) / Math.max(1e-6, z1 - z0);
  const cx = lerp(PW / 2, x + w / 2, m), cy = lerp(PH / 2, y + h / 2, m);
  ctx.save();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-cx, -cy);
  for (let n = 1; n <= 10; n++) {
    const [cx_, cy_, cw, ch] = cardRect(n, PW, PH);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(cx_ + 4, cy_ + 4, cw, ch);
    if (cards[n]) ctx.drawImage(cards[n], cx_, cy_, cw, ch); else { ctx.fillStyle = '#ddd'; ctx.fillRect(cx_, cy_, cw, ch); }
    if (n < passed) { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(cx_, cy_, cw, ch); }
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#1e1a16'; ctx.strokeRect(cx_, cy_, cw, ch);
    ctx.font = `800 ${Math.round(ch * 0.13)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = Math.max(2, ch * 0.03); ctx.strokeStyle = '#141414'; ctx.fillStyle = '#fff';
    ctx.strokeText(`Уровень ${n}`, cx_ + cw / 2, cy_ + ch * 0.9); ctx.fillText(`Уровень ${n}`, cx_ + cw / 2, cy_ + ch * 0.9);
  }
  ctx.restore();
}
export function drawCollage(ctx, imgs, W, H, t) {
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const spots = [[0.05, 0.08, -4], [0.52, 0.06, 3], [0.28, 0.46, -2]];
  const w = W * 0.42, h = w * 9 / 16;
  imgs.slice(0, 3).forEach((im, i) => {
    const [fx, fy, rot] = spots[i];
    ctx.save();
    ctx.translate(W * fx + w / 2 + Math.sin(t * 0.4 + i) * 6, H * fy + h / 2 + Math.cos(t * 0.3 + i) * 5);
    ctx.rotate((rot + Math.sin(t * 0.25 + i) * 0.6) * Math.PI / 180);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(-w / 2 + 10, -h / 2 + 12, w + 16, h + 16);
    ctx.fillStyle = '#fff'; ctx.fillRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16);
    ctx.drawImage(im, -w / 2, -h / 2, w, h);
    ctx.lineWidth = 2; ctx.strokeStyle = '#3c3732'; ctx.strokeRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16);
    ctx.restore();
  });
}

/* ======================= text on the picture ======================= */
export function drawWord(ctx, word, W, H, age = 1) {
  if (!word) return;
  const pop = 1 + 0.18 * (1 - ease(age / 0.12));                           // each word lands with a small pop
  let fs = Math.round(W * 0.115);
  ctx.save();
  ctx.font = `900 ${fs}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = word.toUpperCase();
  while (ctx.measureText(w).width > W * 0.88 && fs > 20) { fs -= 4; ctx.font = `900 ${fs}px sans-serif`; }
  ctx.translate(W / 2, H * 0.7); ctx.scale(pop, pop);
  ctx.lineJoin = 'round'; ctx.lineWidth = fs * 0.2; ctx.strokeStyle = '#000'; ctx.strokeText(w, 0, 0);
  ctx.fillStyle = '#fff'; ctx.fillText(w, 0, 0);
  ctx.restore();
}
export function drawPlate(ctx, text, W, H, age) {
  const k = ease(Math.min(1, age / 0.35)), fs = Math.round(H * 0.06);
  ctx.save();
  ctx.font = `800 ${fs}px sans-serif`;
  const tw = ctx.measureText(text).width, pad = fs * 0.5;
  const x = W * 0.05 - (1 - k) * (tw + 2 * pad), y = H * 0.08;
  ctx.globalAlpha = k;
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, tw + 2 * pad, fs * 1.6);
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeRect(x, y, tw + 2 * pad, fs * 1.6);
  ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.fillText(text, x + pad, y + fs * 0.82);
  ctx.restore();
}
export function drawTitle(ctx, lines, W, H, age) {
  const k = ease(Math.min(1, age / 0.3));
  ctx.save();
  ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((tx, i) => {
    const fs = Math.round(W * (i === 0 ? 0.085 : 0.06));
    ctx.font = `900 ${fs}px sans-serif`; ctx.lineJoin = 'round'; ctx.lineWidth = fs * 0.18; ctx.strokeStyle = '#000';
    const y = H * 0.18 + i * fs * 1.3 - (1 - k) * 20;
    ctx.strokeText(tx, W / 2, y); ctx.fillStyle = '#fff'; ctx.fillText(tx, W / 2, y);
  });
  ctx.restore();
}
