// Formatting and sanitization helpers shared by the UI and the save system.
// These are pure functions so they can be unit tested in Node.

// Formats large numbers so the display stays readable.
export function fmt(num) {
  if (!Number.isFinite(num)) return '0';
  const n = Math.max(0, num);
  const units = [
    { value: 1e15, suffix: 'Qa' },
    { value: 1e12, suffix: 'T' },
    { value: 1e9, suffix: 'B' },
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'K' }
  ];

  for (const unit of units) {
    if (n >= unit.value) return `${trimNumber(n / unit.value)}${unit.suffix}`;
  }
  return Math.floor(n).toString();
}

function trimNumber(num) {
  return num >= 100 ? num.toFixed(0) : num >= 10 ? num.toFixed(1) : num.toFixed(2);
}

// Converts seconds into a readable time display.
export function fmtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Keeps loaded numbers safe and inside an allowed range.
export function clampNumber(value, min = 0, max = Number.POSITIVE_INFINITY) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, num));
}

// Escapes text before placing it into HTML to avoid unsafe injection.
export function escapeHTML(text) {
  return String(text).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  })[char]);
}
