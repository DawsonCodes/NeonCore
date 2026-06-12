// DOM layer of the notification system. Queue/dedupe/timer behavior lives
// in notification-core.js; this file renders toasts, mirrors important
// events into the Core Log, and handles the subtle autosave chip.

import { el } from './dom.js';
import { escapeHTML } from '../utils/format.js';
import { NotificationQueue, PRIORITY } from './notification-core.js';

const MAX_LOG_ENTRIES = 10;

const TYPE_META = {
  info: { icon: 'ℹ', label: 'Info' },
  success: { icon: '✓', label: 'Success' },
  warning: { icon: '⚠', label: 'Warning' },
  error: { icon: '✕', label: 'Error' },
  save: { icon: '◇', label: 'Save' },
  offline: { icon: '⏾', label: 'Offline gain' },
  achievement: { icon: '★', label: 'Achievement' },
  milestone: { icon: '◆', label: 'Milestone' },
  singularity: { icon: '◉', label: 'Singularity' },
  horizon: { icon: '⌾', label: 'Event Horizon' },
  surge: { icon: '⚡', label: 'Neon Surge' },
  unlock: { icon: '▲', label: 'Unlocked' }
};

function meta(type) {
  return TYPE_META[type] || TYPE_META.info;
}

function toastBodyHTML(item) {
  return `
    <span class="toast-icon" aria-hidden="true">${meta(item.type).icon}</span>
    <div class="toast-body">
      ${item.title ? `<strong class="toast-title">${escapeHTML(item.title)}</strong>` : ''}
      <span class="toast-message">${escapeHTML(item.message)}</span>
    </div>
    <button class="toast-close" type="button" aria-label="Dismiss notification">✕</button>
  `;
}

function applyToastClass(node, item) {
  node.className = `toast toast-${item.type}`;
  if (item.priority >= PRIORITY.high) {
    node.setAttribute('role', 'alert');
  } else {
    node.removeAttribute('role');
  }
}

const queue = new NotificationQueue({
  maxVisible: 3,
  schedule: (fn, ms) => setTimeout(fn, ms),
  cancel: handle => clearTimeout(handle),
  renderer: {
    show(item) {
      const node = document.createElement('div');
      applyToastClass(node, item);
      node.innerHTML = toastBodyHTML(item);
      node.querySelector('.toast-close').addEventListener('click', () => queue.dismiss(item.key));
      item.node = node;
      el.notificationStack.appendChild(node);
    },
    update(item) {
      // Replace stale content in place and pulse so the change is visible.
      applyToastClass(item.node, item);
      item.node.innerHTML = toastBodyHTML(item);
      item.node.querySelector('.toast-close').addEventListener('click', () => queue.dismiss(item.key));
      item.node.classList.remove('toast-bump');
      void item.node.offsetWidth;
      item.node.classList.add('toast-bump');
    },
    remove(item) {
      const node = item.node;
      if (!node) return;
      node.classList.add('toast-out');
      setTimeout(() => node.remove(), 220);
    }
  }
});

// Shows a notification. Mirrors normal/high-priority messages into the
// Core Log unless `log: false` is passed.
export function notify({ log, ...options } = {}) {
  const action = queue.notify(options);
  const prio = PRIORITY[options.priority] ?? PRIORITY.normal;

  // Avoid duplicate log entries when a deduped toast merely refreshed.
  const shouldLog = log ?? prio >= PRIORITY.normal;
  if (shouldLog && action !== 'updated') {
    addLog(options.title ? `${options.title}: ${options.message}` : options.message, options.type);
  }
}

export function clearNotifications() {
  queue.clearAll();
}

// Subtle pulse on the header chip for routine autosaves — no toast spam.
let saveChipTimer;
export function flashSaveChip() {
  el.saveChip.classList.add('show');
  clearTimeout(saveChipTimer);
  saveChipTimer = setTimeout(() => el.saveChip.classList.remove('show'), 1100);
}

// Core Log: a persistent recent-event history players can revisit.
export function addLog(message, type = 'info') {
  const item = document.createElement('li');
  item.className = `log-${type}`;
  const time = new Date();
  const stamp = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
  item.innerHTML = `<time class="log-time">${stamp}</time><span class="log-text">${escapeHTML(message)}</span>`;
  el.eventLog.prepend(item);

  while (el.eventLog.children.length > MAX_LOG_ENTRIES) {
    el.eventLog.lastElementChild.remove();
  }
}

export function clearLog() {
  el.eventLog.innerHTML = '';
}
