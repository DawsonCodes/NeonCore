import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clickDecision, keydownDecision, KEYBOARD_CLICK_WINDOW_MS } from '../src/ui/input.js';

// Simulates the full reactor-input pipeline the way events.js wires it and
// returns how many activations a sequence of events produces.
function runSequence(events) {
  let activations = 0;
  let lastKeyboardActivationAt = -Infinity;

  for (const event of events) {
    if (event.kind === 'keydown') {
      const decision = keydownDecision(event, { coreFocused: event.coreFocused ?? false });
      if (decision === 'activate') {
        lastKeyboardActivationAt = event.timeStamp;
        activations++;
      }
    } else if (event.kind === 'click') {
      const decision = clickDecision(event, lastKeyboardActivationAt, event.timeStamp);
      if (decision === 'activate') activations++;
    }
  }
  return activations;
}

test('one pointer click grants exactly one activation', () => {
  assert.equal(runSequence([
    { kind: 'click', detail: 1, timeStamp: 100 }
  ]), 1);
});

test('one Space press grants exactly one activation', () => {
  assert.equal(runSequence([
    { kind: 'keydown', code: 'Space', repeat: false, timeStamp: 100 }
  ]), 1);
});

test('Space while the reactor is focused does not double through the native click echo', () => {
  // Browser would fire keydown then (without preventDefault) a synthetic
  // click with detail 0. The gate must count exactly one activation.
  assert.equal(runSequence([
    { kind: 'keydown', code: 'Space', repeat: false, coreFocused: true, timeStamp: 100 },
    { kind: 'click', detail: 0, timeStamp: 130 } // synthetic echo
  ]), 1);
});

test('Space plus a real pointer click at nearly the same time grants exactly two', () => {
  assert.equal(runSequence([
    { kind: 'keydown', code: 'Space', repeat: false, timeStamp: 100 },
    { kind: 'click', detail: 1, timeStamp: 105 }
  ]), 2);

  // Order reversed, still exactly two.
  assert.equal(runSequence([
    { kind: 'click', detail: 1, timeStamp: 100 },
    { kind: 'keydown', code: 'Space', repeat: false, timeStamp: 104 }
  ]), 2);
});

test('held Space key-repeat is blocked, not farmed', () => {
  const events = [{ kind: 'keydown', code: 'Space', repeat: false, timeStamp: 0 }];
  for (let i = 1; i <= 30; i++) {
    events.push({ kind: 'keydown', code: 'Space', repeat: true, timeStamp: i * 30 });
  }
  assert.equal(runSequence(events), 1);

  // Repeat events are still claimed (preventDefault) so the page never scrolls.
  assert.equal(keydownDecision({ code: 'Space', repeat: true }, {}), 'block');
});

test('Enter on the focused reactor activates once and blocks key-repeat', () => {
  assert.equal(keydownDecision({ key: 'Enter', repeat: false }, { coreFocused: true }), 'activate');
  assert.equal(keydownDecision({ key: 'Enter', repeat: true }, { coreFocused: true }), 'block');
  assert.equal(keydownDecision({ key: 'Enter', repeat: false }, { coreFocused: false }), 'ignore');
});

test('assistive-technology synthetic clicks still work when no keyboard activation is recent', () => {
  assert.equal(runSequence([
    { kind: 'click', detail: 0, timeStamp: 5000 }
  ]), 1);

  // ...but a synthetic click right after a keyboard activation is treated as
  // its echo and ignored.
  assert.equal(runSequence([
    { kind: 'keydown', code: 'Space', repeat: false, timeStamp: 5000 },
    { kind: 'click', detail: 0, timeStamp: 5000 + KEYBOARD_CLICK_WINDOW_MS - 1 }
  ]), 1);

  // Far enough apart, both count.
  assert.equal(runSequence([
    { kind: 'keydown', code: 'Space', repeat: false, timeStamp: 5000 },
    { kind: 'click', detail: 0, timeStamp: 5000 + KEYBOARD_CLICK_WINDOW_MS + 1 }
  ]), 2);
});

test('rapid alternating pointer and keyboard input counts each physical input once', () => {
  const events = [];
  for (let i = 0; i < 10; i++) {
    events.push({ kind: 'click', detail: 1, timeStamp: i * 50 });
    events.push({ kind: 'keydown', code: 'Space', repeat: false, timeStamp: i * 50 + 10 });
  }
  assert.equal(runSequence(events), 20);
});

test('pointer-typed click events activate even when detail is 0', () => {
  // Some mobile browsers report detail 0 for taps but include pointerType.
  assert.equal(runSequence([
    { kind: 'click', detail: 0, pointerType: 'touch', timeStamp: 100 }
  ]), 1);
});
