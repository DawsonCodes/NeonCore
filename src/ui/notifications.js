// Unified notification manager: a single queue handles toasts for every
// event category, prevents duplicate spam, keeps important messages from
// being buried by routine ones, and mirrors entries into the Core Log.

import { el } from './dom.js';
import { escapeHTML } from '../utils/format.js';

const MAX_VISIBLE = 3;
const MAX_LOG_ENTRIES = 8;

const PRIORITY = { low: 0, normal: 1, high: 2 };

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
  surge: { icon: '⚡', label: 'Neon Surge' }
};

const DEFAULT_DURATION = { low: 2400, normal: 3800, high: 5200 };

const visible = [];
const pending = [];

function meta(type) {
  return TYPE_META[type] || TYPE_META.info;
}

// Shows a notification. Options:
//   type: one of TYPE_META keys
//   title: optional bold heading (defaults to the type label for high priority)
//   message: body text
//   priority: 'low' | 'normal' | 'high'
//   duration: ms before auto-dismiss
//   dedupeKey: matching visible toasts are refreshed instead of duplicated
//   log: also append to the Core Log (default true except low priority)
export function notify({
  type = 'info',
  title = '',
  message,
  priority = 'normal',
  duration,
  dedupeKey,
  log
} = {}) {
  const key = dedupeKey ?? `${type}:${title}:${message}`;

  const existing = visible.find(item => item.key === key);
  if (existing) {
    restartTimer(existing);
    bumpToast(existing.node);
  } else {
    const item = {
      key,
      type,
      title,
      message,
      priority: PRIORITY[priority] ?? 1,
      duration: duration ?? DEFAULT_DURATION[priority] ?? DEFAULT_DURATION.normal
    };
    if (visible.length < MAX_VISIBLE) {
      show(item);
    } else if (item.priority >= PRIORITY.normal) {
      // Important messages wait in line instead of being dropped; while the
      // stack is full, low-priority messages are skipped entirely.
      pending.push(item);
      pending.sort((a, b) => b.priority - a.priority);
    }
  }

  if (log ?? (PRIORITY[priority] ?? 1) >= PRIORITY.normal) {
    addLog(title ? `${title}: ${message}` : message, type);
  }
}

function show(item) {
  const node = document.createElement('div');
  node.className = `toast toast-${item.type}`;
  if (item.priority >= PRIORITY.high) node.setAttribute('role', 'alert');
  node.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${meta(item.type).icon}</span>
    <div class="toast-body">
      ${item.title ? `<strong class="toast-title">${escapeHTML(item.title)}</strong>` : ''}
      <span class="toast-message">${escapeHTML(item.message)}</span>
    </div>
    <button class="toast-close" type="button" aria-label="Dismiss notification">✕</button>
  `;
  node.querySelector('.toast-close').addEventListener('click', () => dismiss(item));

  item.node = node;
  visible.push(item);
  el.notificationStack.appendChild(node);
  restartTimer(item);
}

function restartTimer(item) {
  clearTimeout(item.timer);
  item.timer = setTimeout(() => dismiss(item), item.duration);
}

function bumpToast(node) {
  node.classList.remove('toast-bump');
  void node.offsetWidth;
  node.classList.add('toast-bump');
}

function dismiss(item) {
  clearTimeout(item.timer);
  const index = visible.indexOf(item);
  if (index >= 0) visible.splice(index, 1);

  item.node.classList.add('toast-out');
  setTimeout(() => {
    item.node.remove();
    const next = pending.shift();
    if (next && visible.length < MAX_VISIBLE) show(next);
  }, 220);
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
