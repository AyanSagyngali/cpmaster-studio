// The rules that keep characters correct in every frame (run: npm test)
import test from 'node:test';
import assert from 'node:assert/strict';
import { legGeometry, LEG } from '../www/js/bean.js';
import { tidyBible } from '../www/js/bible.js';

test('both legs always have the same length, whatever the walk phase', () => {
  for (let i = 0; i <= 100; i++) {
    const step = i / 100;
    const lens = [-1, 1].map((s) => { const { hip, foot } = legGeometry(step, s); return Math.hypot(foot[0] - hip[0], foot[1] - hip[1]); });
    assert.ok(Math.abs(lens[0] - lens[1]) < 1e-9, `step ${step}: ${lens}`);
    assert.ok(Math.abs(lens[0] - LEG) < 1e-9);
  }
});

test('feet stay below the hips (no leg bends up)', () => {
  for (let i = 0; i <= 100; i++) for (const s of [-1, 1]) { const { hip, foot } = legGeometry(i / 100, s); assert.ok(foot[1] > hip[1]); }
});

test('any Gemini answer becomes a complete, valid plan', () => {
  const lines = [{ text: 'a' }, { text: 'b' }, { text: 'c' }];
  for (const junk of [null, 'oops', [], { shots: 'x' }, { cast: [{ id: 7, look: 'red' }], sets: [{ objects: 'house' }], shots: [{ line: 2, actors: [{ id: 'nobody' }], camera: 'close' }] }]) {
    const b = tidyBible(junk, lines);
    assert.equal(b.shots.length, lines.length);
    assert.ok(b.cast.length >= 1 && b.sets.length >= 1);
    for (const s of b.shots) {
      assert.ok(b.sets.some((x) => x.id === s.set), 'shot uses a set that exists');
      for (const a of s.actors) assert.ok(b.cast.some((c) => c.id === a.id), 'actor exists');
      assert.ok(Number.isFinite(s.camera.side) && Number.isFinite(s.camera.roll));
    }
  }
});

test('colours and numbers from Gemini are cleaned', () => {
  const b = tidyBible({ cast: [{ id: 'h', look: { skin: 'pink', top: '#ff0000', number: 'ten' } }], sets: [{ id: 's', objects: [{ type: 'house', x: 'far', color: 'blue' }] }], shots: [{ set: 's', actors: [{ id: 'h', x: 999 }] }] }, [{ text: 'x' }]);
  assert.equal(b.cast[0].look.skin, '#f5c9a0');
  assert.equal(b.cast[0].look.top, '#ff0000');
  assert.equal(b.sets[0].objects[0].x, 0);
  assert.equal(b.sets[0].objects[0].color, undefined);
  assert.equal(b.shots[0].actors[0].x, 12);
});
