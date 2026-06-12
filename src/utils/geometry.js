// Coordinate helpers for visual effects. Pure functions so the positioning
// rules (and their regression fixes) can be unit tested in Node.

// Clamps a value into [min, max].
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Computes where a click effect should appear, in coordinates relative to
// the effect container. Rules:
//   - Only real, finite pointer coordinates that land inside (or within
//     `slack` of) the container are trusted.
//   - Keyboard activations, synthetic clicks (0,0), and any stale or
//     out-of-range coordinates fall back to the container center.
//   - The result is always clamped inside the container with a margin, so
//     effects can never render in unrelated areas of the page.
export function effectPosition(point, rect, { slack = 24, margin = 12 } = {}) {
  const center = { x: rect.width / 2, y: rect.height / 2 };

  const x = point?.clientX;
  const y = point?.clientY;
  const valid =
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    !(x === 0 && y === 0) && // synthetic keyboard clicks report (0,0)
    x >= rect.left - slack &&
    x <= rect.right + slack &&
    y >= rect.top - slack &&
    y <= rect.bottom + slack;

  if (!valid) return center;

  return {
    x: clamp(x - rect.left, margin, rect.width - margin),
    y: clamp(y - rect.top, margin, rect.height - margin)
  };
}
