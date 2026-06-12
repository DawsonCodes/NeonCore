// Notification queue logic, separated from the DOM so the dedupe,
// replacement, ordering, and timer rules can be unit tested in Node.
//
// The renderer is injected: { show(item), update(item), remove(item) }.
// Timers are injected too ({ schedule(fn, ms) -> handle, cancel(handle) })
// so tests can drive time deterministically.

export const PRIORITY = { low: 0, normal: 1, high: 2, critical: 3 };

export const DEFAULT_DURATIONS = { low: 2400, normal: 3800, high: 5200, critical: 6500 };

export class NotificationQueue {
  constructor({ maxVisible = 3, renderer, schedule, cancel, durations = DEFAULT_DURATIONS }) {
    this.maxVisible = maxVisible;
    this.renderer = renderer;
    this.schedule = schedule;
    this.cancel = cancel;
    this.durations = durations;
    this.visible = [];
    this.pending = [];
  }

  // Shows, updates, queues, or drops a notification. Returns the action
  // taken: 'shown' | 'updated' | 'queued' | 'dropped'.
  notify({ type = 'info', title = '', message, priority = 'normal', duration, dedupeKey } = {}) {
    const key = dedupeKey ?? `${type}:${title}:${message}`;
    const prio = PRIORITY[priority] ?? PRIORITY.normal;
    const ttl = duration ?? this.durations[priority] ?? this.durations.normal;

    // Dedupe against the visible stack: replace content in place (never
    // leave stale text up) and restart the dismissal timer.
    const visibleMatch = this.visible.find(item => item.key === key);
    if (visibleMatch) {
      Object.assign(visibleMatch, { type, title, message, priority: prio, duration: ttl });
      this.renderer.update(visibleMatch);
      this.restartTimer(visibleMatch);
      return 'updated';
    }

    // Dedupe against the pending queue the same way.
    const pendingMatch = this.pending.find(item => item.key === key);
    if (pendingMatch) {
      Object.assign(pendingMatch, { type, title, message, priority: prio, duration: ttl });
      this.sortPending();
      return 'queued';
    }

    const item = { key, type, title, message, priority: prio, duration: ttl };

    if (this.visible.length < this.maxVisible) {
      this.show(item);
      return 'shown';
    }

    // The stack is full. High-priority events evict the lowest-priority
    // visible toast so they are never buried; other important messages wait
    // in priority order; routine low-priority chatter is dropped.
    if (prio >= PRIORITY.high) {
      const victim = [...this.visible]
        .sort((a, b) => a.priority - b.priority)
        .find(candidate => candidate.priority < prio);
      if (victim) {
        this.evict(victim);
        this.show(item);
        return 'shown';
      }
    }
    if (prio > PRIORITY.low) {
      this.pending.push(item);
      this.sortPending();
      return 'queued';
    }
    return 'dropped';
  }

  // Removes a visible item without promoting the pending queue (used when a
  // higher-priority item takes its place).
  evict(item) {
    const index = this.visible.indexOf(item);
    if (index === -1) return;
    this.visible.splice(index, 1);
    if (item.timer !== undefined) this.cancel(item.timer);
    this.renderer.remove(item);
  }

  sortPending() {
    // Stable by insertion within the same priority.
    this.pending = this.pending
      .map((item, index) => ({ item, index }))
      .sort((a, b) => (b.item.priority - a.item.priority) || (a.index - b.index))
      .map(entry => entry.item);
  }

  show(item) {
    this.visible.push(item);
    this.renderer.show(item);
    this.restartTimer(item);
  }

  restartTimer(item) {
    if (item.timer !== undefined) this.cancel(item.timer);
    item.timer = this.schedule(() => this.dismiss(item.key), item.duration);
  }

  // Dismisses a visible notification by key and promotes the next pending
  // item, if any.
  dismiss(key) {
    const index = this.visible.findIndex(item => item.key === key);
    if (index === -1) return;
    const [item] = this.visible.splice(index, 1);
    if (item.timer !== undefined) this.cancel(item.timer);
    this.renderer.remove(item);

    const next = this.pending.shift();
    if (next && this.visible.length < this.maxVisible) this.show(next);
  }

  // Clears everything (used on reset so stale toasts never survive).
  clearAll() {
    for (const item of [...this.visible]) {
      if (item.timer !== undefined) this.cancel(item.timer);
      this.renderer.remove(item);
    }
    this.visible = [];
    this.pending = [];
  }
}
