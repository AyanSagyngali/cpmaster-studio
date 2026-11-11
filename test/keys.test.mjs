// Smart key handling (run: npm test). Google counts Gemini limits per key AND per model; ElevenLabs balances are per key.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../www/js/keys.js';
import * as AI from '../www/js/ai.js';
import * as EL from '../www/js/eleven.js';

const A = AI.MODELS.text[0], B = AI.MODELS.text[1];
const gkey = (n) => ({ key: `AIza${String(n).padStart(35, '0')}`, kind: 'gemini', ok: true, cool: 0 });
const ekey = (n, left) => ({ key: `sk_${String(n).repeat(48).slice(0, 48)}`, kind: 'eleven', ok: true, cool: 0, left, total: 10000 });
const reply = (status, body) => ({ ok: status === 200, status, json: async () => body, arrayBuffer: async () => new ArrayBuffer(4) });
const said = (text) => reply(200, { candidates: [{ content: { parts: [{ text }] } }] });
const q429 = (quotaId, value, retry = '7s') => reply(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: `Quota exceeded for metric: generate_content_free_tier_requests, limit: ${value}. Please retry in ${parseInt(retry)}s.`,
  details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId, quotaValue: String(value) }] },
    { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: retry }] } });
const DAY = 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', MIN = 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier';
const model = (url) => url.match(/models\/([^:]+):/)[1];
const keyOf = (url) => decodeURIComponent(url.match(/key=([^&]+)/)[1]);

test('Google 429: the daily limit is read from error.details, not from the text', () => {
  const d = AI.quotaInfo({ message: 'Quota exceeded … Please retry in 7.5s.', details: [{ violations: [{ quotaId: DAY, quotaValue: '20' }] }, { retryDelay: '7s' }] });
  assert.equal(d.day, true); assert.equal(d.perDay, 20); assert.equal(d.retry, 7000); assert.equal(d.zero, false);
  const m = AI.quotaInfo({ details: [{ violations: [{ quotaId: MIN, quotaValue: '10' }] }, { retryDelay: '31s' }] });
  assert.equal(m.day, false); assert.equal(m.perMinute, 10); assert.equal(m.retry, 31000);
  assert.equal(AI.quotaInfo({ details: [{ violations: [{ quotaId: DAY, quotaValue: '0' }] }] }).zero, true);
});

test('daily limit on the best model: the SAME key goes on with the next model at once, and the model is not asked again today', async () => {
  const k = gkey(1); K.usePool([k]);
  const asked = [];
  globalThis.fetch = async (url) => { asked.push(model(url)); return model(url) === A ? q429(DAY, 20) : said('{"ok":1}'); };
  const notes = [];
  assert.deepEqual(await AI.json('x', { onWait: (m) => notes.push(m) }), { ok: 1 });
  assert.deepEqual(asked, [A, B]);
  assert.equal(K.limitOf(k, A).kind, 'day');
  assert.equal(k.quota[A].day, 20, 'the real daily number Google gave is remembered');
  assert.ok(notes.some((n) => n.includes(B)), 'the owner is told which model took over');
  asked.length = 0;
  await AI.json('x');
  assert.deepEqual(asked, [B], 'no request wasted on the exhausted model');
});

test('minute limit on one key: the next key answers at once with the same (best) model', async () => {
  const k1 = gkey(2), k2 = gkey(3); K.usePool([k1, k2]);
  const asked = [];
  globalThis.fetch = async (url) => { asked.push([keyOf(url), model(url)]); return keyOf(url) === k1.key ? q429(MIN, 10, '30s') : said('{"ok":2}'); };
  const t0 = Date.now();
  assert.deepEqual(await AI.json('x'), { ok: 2 });
  assert.ok(Date.now() - t0 < 1000, 'no waiting while another key is free');
  assert.ok(asked.every(([, m]) => m === A), 'the best model stays');
  assert.equal(new Set(asked.map(([kk]) => kk)).size, 2);
  assert.equal(K.limitOf(k1, A).kind, 'minute');
  assert.equal(K.limitOf(k1, B), null, 'a limit on one model does not block the other models of the key');
});

test('every key and model used up for the day: an honest error at once, no endless waiting', async () => {
  const keys = [gkey(4), gkey(5)]; K.usePool(keys);
  let n = 0;
  globalThis.fetch = async () => { n++; return q429(DAY, 20); };
  const t0 = Date.now();
  await assert.rejects(AI.json('x'), /Дневной лимит Gemini кончился на всех ключах/);
  assert.ok(Date.now() - t0 < 1500);
  assert.ok(n <= AI.MODELS.text.length * keys.length, 'each key+model asked at most once');
});

test('a learned daily quota stops requests BEFORE Google refuses', async () => {
  const k = gkey(6); K.usePool([k]);
  K.learn(k, A, { day: 3 });
  for (let i = 0; i < 3; i++) K.used(k, A);
  const asked = [];
  globalThis.fetch = async (url) => { asked.push(model(url)); return said('{"ok":3}'); };
  await AI.json('x');
  assert.deepEqual(asked, [B]);
});

test('keys screen state: a key with one model resting still works; all models resting = limit', () => {
  const k = gkey(7), models = [A, B];
  assert.equal(K.geminiState(k, models).state, 'ok');
  K.limit(k, A, 'day', Date.now() + 3600e3);
  const s = K.geminiState(k, models);
  assert.equal(s.state, 'ok'); assert.equal(s.limited.length, 1);
  K.limit(k, B, 'minute', Date.now() + 20000);
  assert.equal(K.geminiState(k, models).state, 'minute');
});

test('ElevenLabs: the smallest balance that fits is spent first, a key out of characters gives way at once', async () => {
  const big = ekey(1, 9000), small = ekey(2, 1000), crumbs = ekey(3, 300); K.usePool([big, small, crumbs]);
  const used = [];
  globalThis.fetch = async (url, o) => { used.push(o.headers['xi-api-key']); return reply(200, { audio_base64: btoa('mp3'), alignment: {} }); };
  await EL.speak('а'.repeat(700), EL.DEFAULT_VOICE);
  assert.deepEqual(used, [small.key], 'best fit: the 1000 key, the 9000 key stays whole for long videos');
  assert.equal(small.left, 300);
  used.length = 0;
  big.left = 5000; small.left = 4600;
  globalThis.fetch = async (url, o) => { used.push(o.headers['xi-api-key']); return o.headers['xi-api-key'] === small.key ? reply(401, { detail: { status: 'quota_exceeded' } }) : reply(200, { audio_base64: btoa('mp3'), alignment: {} }); };
  await EL.speak('а'.repeat(4500), EL.DEFAULT_VOICE);
  assert.deepEqual(used, [small.key, big.key]);
  assert.equal(small.left, 0, 'quota_exceeded = empty, not a broken key');
  assert.notEqual(small.ok, false);
});

test('ElevenLabs: "enough" counts only keys that can hold a whole piece of the voice', () => {
  K.usePool([ekey(4, 400), ekey(5, 400), ekey(6, 400)]);
  assert.equal(EL.enough(1000), false, '3 crumbs of 400 can not voice 700-character pieces');
  K.usePool([ekey(7, 800), ekey(8, 800)]);
  assert.equal(EL.enough(1400), true);
});

test('a key Google refuses as a whole ("API requests … for a region") rests longer each time and does not slow the others', async () => {
  const bad = gkey(9), good = gkey(10); K.usePool([bad, good]);
  const region = reply(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: "Quota exceeded for quota metric 'API requests' and limit 'Request limit per minute for a region' of service 'generativelanguage.googleapis.com'",
    details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'RATE_LIMIT_EXCEEDED', metadata: { quota_metric: 'generativelanguage.googleapis.com/api_requests', quota_limit: 'ApiRequestsPerMinutePerProjectPerRegion' } }] } });
  const asked = [];
  globalThis.fetch = async (url) => { asked.push(keyOf(url)); return keyOf(url) === bad.key ? region : said('{"ok":4}'); };
  bad.last = 0; good.last = 1;                                   // the bad key would be asked first
  assert.deepEqual(await AI.json('x'), { ok: 4 });
  assert.deepEqual(asked, [bad.key, good.key]);
  const first = bad.cool - Date.now();
  assert.ok(first > 20000 && first <= 30000, 'first rest about 30 s');
  assert.equal(K.geminiState(bad, [A, B]).state, 'rest');
  assert.equal(K.limitOf(bad, A), null, 'not mistaken for a model limit');
  bad.cool = 0; asked.length = 0; bad.last = 0; good.last = Date.now();
  await AI.json('x');
  assert.ok(bad.cool - Date.now() > 50000, 'second refusal: the key rests twice as long');
});
