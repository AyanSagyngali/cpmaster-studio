// The montage, in a background thread so the screen never freezes: every frame is drawn on an OffscreenCanvas,
// encoded by the phone's hardware H.264 encoder (WebCodecs) and muxed with the AAC/Opus sound into an MP4.
import { Muxer, ArrayBufferTarget } from '../vendor/mp4-muxer.mjs';
import { drawScene, drawTransition, drawPyramid, drawCollage, drawWord, drawPlate, drawTitle } from './anim.js';

let stop = false;
self.onmessage = async (e) => {
  if (e.data.type === 'stop') { stop = true; return; }
  if (e.data.type !== 'render') return;
  stop = false;
  try { await render(e.data.job); } catch (err) { self.postMessage({ type: 'error', message: String(err?.message || err) }); }
};

async function pickVideo(W, H, fps, bitrate) {
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42001f', 'avc1.42e01f']) {
    for (const hardwareAcceleration of ['prefer-hardware', 'no-preference']) {
      const cfg = { codec, width: W, height: H, bitrate, framerate: fps, hardwareAcceleration, latencyMode: 'quality', avc: { format: 'avc' } };
      try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch { /* next */ }
    }
  }
  throw new Error('Телефон не умеет кодировать H.264 в браузере (нужен свежий Android System WebView)');
}
async function pickAudio(rate) {
  for (const c of [{ codec: 'mp4a.40.2', name: 'aac' }, { codec: 'opus', name: 'opus' }]) {
    const cfg = { codec: c.codec, sampleRate: rate, numberOfChannels: 1, bitrate: 128000 };
    try { if ((await AudioEncoder.isConfigSupported(cfg)).supported) return [cfg, c.name]; } catch { /* next */ }
  }
  return [null, null];
}

// job: {W, H, fps, duration, timeline: [{kind, t0, t1, scene|level|cards|imgs, trans, title}], words: [{t0, t1, w}], plates, audio: Float32Array, rate, env: Float32Array}
async function render(job) {
  const { W, H, fps } = job;
  const total = Math.ceil(job.duration * fps);
  const canvas = new OffscreenCanvas(W, H), ctx = canvas.getContext('2d', { alpha: false });
  const vcfg = await pickVideo(W, H, fps, job.bitrate || (W * H > 1e6 ? 3_000_000 : 2_200_000));
  const [acfg, aname] = await pickAudio(job.rate);
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, fastStart: 'in-memory', video: { codec: 'avc', width: W, height: H, frameRate: fps }, ...(acfg ? { audio: { codec: aname, numberOfChannels: 1, sampleRate: job.rate } } : {}) });
  let failed = null;
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { failed = e; } });
  venc.configure(vcfg);

  // the sound first (fast): 1024-sample frames
  if (acfg) {
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { failed = e; } });
    aenc.configure(acfg);
    const a = job.audio, step = 1024 * 8;
    for (let i = 0; i < a.length; i += step) {
      const part = a.subarray(i, Math.min(a.length, i + step));
      const ad = new AudioData({ format: 'f32', sampleRate: job.rate, numberOfFrames: part.length, numberOfChannels: 1, timestamp: Math.round(i / job.rate * 1e6), data: part.slice() });
      aenc.encode(ad); ad.close();
    }
    await aenc.flush();
  }

  const tl = job.timeline;
  let si = 0, wi = 0;
  const t0 = performance.now();
  for (let f = 0; f < total; f++) {
    if (stop) throw new Error('Остановлено');
    if (failed) throw failed;
    const t = f / fps;
    while (si < tl.length - 1 && t >= tl[si].t1) si++;
    const amp = job.env[Math.min(job.env.length - 1, Math.floor(t * 50))] || 0;
    drawItem(ctx, tl[si], t, amp, W, H);
    const next = tl[si + 1], tr = tl[si].trans || 'cut', TD = 0.35;
    if (next && tr !== 'cut' && t > tl[si].t1 - TD) {
      const u = (t - (tl[si].t1 - TD)) / TD;
      drawTransition(ctx, tr, () => drawItem(ctx, tl[si], t, amp, W, H), () => drawItem(ctx, next, next.t0, amp, W, H), u, W, H);
    }
    // words of the Shorts, one at a time; plates (years, numbers) in long videos
    if (job.words?.length) {
      while (wi < job.words.length - 1 && t >= job.words[wi].t1) wi++;
      const w = job.words[wi];
      if (w && t >= w.t0 && t < w.t1 + 0.15) drawWord(ctx, w.w, W, H, t - w.t0);
    }
    for (const p of job.plates || []) if (t >= p.t0 && t < p.t1) drawPlate(ctx, p.text, W, H, t - p.t0);

    const frame = new VideoFrame(canvas, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / fps) });
    venc.encode(frame, { keyFrame: f % (fps * 2) === 0 });
    frame.close();
    while (venc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2));
    if (f % 12 === 0) {
      const el = (performance.now() - t0) / 1000;
      const msg = { type: 'progress', frame: f, total, fps: f / Math.max(0.01, el), eta: (total - f) / Math.max(0.1, f / Math.max(0.01, el)) };
      if (f % 72 === 0) { msg.preview = await createImageBitmap(canvas, { resizeWidth: Math.round(W / 4), resizeHeight: Math.round(H / 4) }); self.postMessage(msg, [msg.preview]); }
      else self.postMessage(msg);
    }
  }
  await venc.flush();
  muxer.finalize();
  const buf = target.buffer;
  self.postMessage({ type: 'done', buffer: buf, frames: total }, [buf]);
}

function drawItem(ctx, it, t, amp, W, H) {
  const lt = t - it.t0, dur = it.t1 - it.t0;
  if (it.kind === 'scene') drawScene(ctx, it.scene, lt, dur, W, H, amp);
  else if (it.kind === 'pyramid') {                               // hold, fly into the card, then the live card itself
    const k = Math.max(0, Math.min(1, (lt - 0.5) / 1.2));
    if (lt < 1.7 || !it.scene) drawPyramid(ctx, it.cards, W, H, it.level, k, it.level, H > W);
    else drawScene(ctx, it.scene, lt - 1.7, Math.max(1, dur - 1.7), W, H, amp);
  } else if (it.kind === 'collage') drawCollage(ctx, it.imgs, W, H, lt);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  if (it.title) drawTitle(ctx, it.title, W, H, lt);
}
