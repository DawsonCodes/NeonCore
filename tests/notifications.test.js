import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NotificationQueue } from '../src/ui/notification-core.js';

// Deterministic harness: fake timers plus a renderer that records calls.
function harness(options = {}) {
  let now = 0;
  let nextHandle = 1;
  const timers = new Map();
  const log = [];

  const queue = new NotificationQueue({
    maxVisible: options.maxVisible ?? 3,
    schedule: (fn, ms) => {
      const handle = nextHandle++;
      timers.set(handle, { fn, at: now + ms });
      return handle;
    },
    cancel: handle => timers.delete(handle),
    renderer: {
      show: item => log.push(['show', item.key, item.message]),
      update: item => log.push(['update', item.key, item.message]),
      remove: item => log.push(['remove', item.key])
    }
  });

  const advance = ms => {
    now += ms;
    for (const [handle, timer] of [...timers]) {
      if (timer.at <= now) {
        timers.delete(handle);
        timer.fn();
      }
    }
  };

  return { queue, advance, log, timers, visible: () => queue.visible.map(i => i.message) };
}

test('buy-mode style toggles replace the visible toast content', () => {
  const { queue, log, visible } = harness();

  assert.equal(queue.notify({ message: 'Buy mode: Buy Max', dedupeKey: 'buy-mode', priority: 'low' }), 'shown');
  assert.equal(queue.notify({ message: 'Buy mode: Buy 1', dedupeKey: 'buy-mode', priority: 'low' }), 'updated');
  assert.equal(queue.notify({ message: 'Buy mode: Buy Max', dedupeKey: 'buy-mode', priority: 'low' }), 'updated');

  // Exactly one toast, always showing the latest state — never a stale one.
  assert.deepEqual(visible(), ['Buy mode: Buy Max']);
  assert.deepEqual(log.filter(([op]) => op === 'show').length, 1);
  assert.deepEqual(log.at(-1), ['update', 'buy-mode', 'Buy mode: Buy Max']);
});

test('the dismissal timer restarts when deduped content is replaced', () => {
  const { queue, advance, visible } = harness();

  queue.notify({ message: 'A', dedupeKey: 'k', duration: 1000 });
  advance(800);
  queue.notify({ message: 'B', dedupeKey: 'k', duration: 1000 });
  advance(800); // 1600ms after first show — old timer would have fired
  assert.deepEqual(visible(), ['B'], 'replacement is still visible');
  advance(300); // crosses the restarted timer
  assert.deepEqual(visible(), [], 'replacement dismisses on its own timer');
});

test('notifications auto-dismiss and clean up their timers', () => {
  const { queue, advance, timers, visible } = harness();
  queue.notify({ message: 'hello', duration: 500 });
  assert.equal(timers.size, 1);
  advance(500);
  assert.deepEqual(visible(), []);
  assert.equal(timers.size, 0, 'no dangling timers');
});

test('manual dismissal removes the toast and promotes the next pending item', () => {
  const { queue, visible } = harness({ maxVisible: 1 });
  queue.notify({ message: 'first', dedupeKey: 'a' });
  queue.notify({ message: 'second', dedupeKey: 'b' });
  assert.deepEqual(visible(), ['first']);
  queue.dismiss('a');
  assert.deepEqual(visible(), ['second']);
});

test('pending items are shown in priority order, stable within a priority', () => {
  const { queue, advance, visible } = harness({ maxVisible: 1 });
  queue.notify({ message: 'visible', priority: 'high', duration: 100 });
  queue.notify({ message: 'normal-1', priority: 'normal', duration: 100 });
  queue.notify({ message: 'high', priority: 'high', duration: 100 });
  queue.notify({ message: 'normal-2', priority: 'normal', duration: 100 });

  advance(100);
  assert.deepEqual(visible(), ['high'], 'high priority jumps the queue');
  advance(100);
  assert.deepEqual(visible(), ['normal-1'], 'stable order within priority');
  advance(100);
  assert.deepEqual(visible(), ['normal-2']);
});

test('low-priority chatter is dropped when the stack is full, never queued over events', () => {
  const { queue, visible } = harness({ maxVisible: 2 });
  queue.notify({ message: 'a', priority: 'high' });
  queue.notify({ message: 'b', priority: 'high' });
  assert.equal(queue.notify({ message: 'routine', priority: 'low' }), 'dropped');
  assert.equal(queue.notify({ message: 'important', priority: 'high' }), 'queued');
  assert.deepEqual(visible(), ['a', 'b']);
  queue.dismiss(queue.visible[0].key);
  assert.deepEqual(visible(), ['b', 'important'], 'queued event shows; dropped chatter never does');
});

test('deduped pending items update in place instead of duplicating', () => {
  const { queue, advance, visible } = harness({ maxVisible: 1 });
  queue.notify({ message: 'busy', duration: 100 });
  assert.equal(queue.notify({ message: 'state 1', dedupeKey: 's', priority: 'normal', duration: 100 }), 'queued');
  assert.equal(queue.notify({ message: 'state 2', dedupeKey: 's', priority: 'normal', duration: 100 }), 'queued');
  assert.equal(queue.pending.length, 1, 'no duplicate pending entries');
  advance(100);
  assert.deepEqual(visible(), ['state 2'], 'latest content wins');
});

test('clearAll removes every toast and pending item and cancels timers', () => {
  const { queue, timers, visible } = harness({ maxVisible: 2 });
  queue.notify({ message: 'a' });
  queue.notify({ message: 'b' });
  queue.notify({ message: 'c', priority: 'high' });
  queue.clearAll();
  assert.deepEqual(visible(), []);
  assert.equal(queue.pending.length, 0);
  assert.equal(timers.size, 0);
});

test('high-priority events evict routine toasts instead of queueing behind them', () => {
  const { queue, visible } = harness({ maxVisible: 2 });
  queue.notify({ message: 'routine 1', priority: 'low' });
  queue.notify({ message: 'routine 2', priority: 'normal' });
  assert.equal(queue.notify({ message: 'ACHIEVEMENT', priority: 'high' }), 'shown');
  assert.deepEqual(visible(), ['routine 2', 'ACHIEVEMENT'], 'lowest-priority toast was evicted');

  // The remaining normal toast can still be evicted by the next high event…
  assert.equal(queue.notify({ message: 'ANOTHER', priority: 'high' }), 'shown');
  assert.deepEqual(visible(), ['ACHIEVEMENT', 'ANOTHER']);

  // …but a high-priority item never evicts another high-priority item.
  assert.equal(queue.notify({ message: 'THIRD', priority: 'high' }), 'queued');
  assert.deepEqual(visible(), ['ACHIEVEMENT', 'ANOTHER']);
});

test('critical errors break through a stack full of high-priority toasts', () => {
  const { queue, visible } = harness({ maxVisible: 3 });
  queue.notify({ message: 'ach 1', priority: 'high' });
  queue.notify({ message: 'ach 2', priority: 'high' });
  queue.notify({ message: 'ach 3', priority: 'high' });
  assert.equal(queue.notify({ message: 'IMPORT FAILED', priority: 'critical' }), 'shown');
  assert.ok(visible().includes('IMPORT FAILED'), 'error is immediately visible');
  assert.equal(visible().length, 3);
});
