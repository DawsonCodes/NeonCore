import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clamp, effectPosition } from '../src/utils/geometry.js';

// Reactor stage rect used by all cases: 400x300 at page offset (100, 200).
const rect = { left: 100, top: 200, right: 500, bottom: 500, width: 400, height: 300 };
const center = { x: 200, y: 150 };

test('clamp keeps values inside the range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
});

test('pointer coordinates inside the stage map to stage-relative space', () => {
  const pos = effectPosition({ clientX: 300, clientY: 350 }, rect);
  assert.deepEqual(pos, { x: 200, y: 150 });
});

test('keyboard activations (no event) fall back to the stage center', () => {
  assert.deepEqual(effectPosition(undefined, rect), center);
  assert.deepEqual(effectPosition(null, rect), center);
});

test('keyboard events without coordinates fall back to the stage center', () => {
  assert.deepEqual(effectPosition({ key: 'Enter' }, rect), center);
  assert.deepEqual(effectPosition({ clientX: NaN, clientY: NaN }, rect), center);
  assert.deepEqual(effectPosition({ clientX: Infinity, clientY: 10 }, rect), center);
});

test('synthetic (0,0) keyboard clicks fall back to the stage center', () => {
  // This was the v0.2 bug: keyboard-synthesized clicks report (0,0), which
  // passed the old isFinite check and placed effects far from the reactor.
  assert.deepEqual(effectPosition({ clientX: 0, clientY: 0 }, rect), center);
});

test('coordinates far outside the stage fall back to the stage center', () => {
  assert.deepEqual(effectPosition({ clientX: 1200, clientY: 40 }, rect), center, 'upper-right page corner');
  assert.deepEqual(effectPosition({ clientX: 50, clientY: 900 }, rect), center);
});

test('coordinates slightly outside the stage clamp to the stage edge', () => {
  // Within the slack band: trusted but clamped inside with a margin.
  const pos = effectPosition({ clientX: 510, clientY: 505 }, rect, { slack: 24, margin: 12 });
  assert.deepEqual(pos, { x: 388, y: 288 });

  const pos2 = effectPosition({ clientX: 90, clientY: 195 }, rect, { slack: 24, margin: 12 });
  assert.deepEqual(pos2, { x: 12, y: 12 });
});

test('results always stay inside the stage regardless of input', () => {
  for (const point of [
    { clientX: -9999, clientY: -9999 },
    { clientX: 99999, clientY: 99999 },
    { clientX: 499, clientY: 499 },
    { clientX: 101, clientY: 201 },
    undefined
  ]) {
    const pos = effectPosition(point, rect);
    assert.ok(pos.x >= 0 && pos.x <= rect.width, `x in bounds for ${JSON.stringify(point)}`);
    assert.ok(pos.y >= 0 && pos.y <= rect.height, `y in bounds for ${JSON.stringify(point)}`);
  }
});
