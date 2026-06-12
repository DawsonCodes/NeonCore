// Canonical reactor-input gate.
//
// The v0.2 build had two overlapping activation paths: a `click` listener on
// the reactor button and a global Space handler. When the button held focus,
// keyboard-synthesized click events (Space/Enter native button activation,
// including Enter's key-repeat) stacked on top of the global handler, so
// near-simultaneous Space + pointer input could grant far more than two
// activations.
//
// The rules below create exactly one pathway per physical input:
//   - A real pointer click activates once (click events with detail > 0 or a
//     pointerType).
//   - Space activates once per physical press via the global keydown handler
//     (key-repeat ignored); its default is always prevented so the native
//     button activation can never double it.
//   - Enter on the focused reactor activates once per physical press via
//     keydown (repeat ignored, default prevented to stop repeat farming).
//   - Synthetic clicks (detail === 0, no pointer type) are accepted only when
//     no keyboard activation happened recently — this keeps assistive
//     technologies working without re-introducing the double fire.
//
// The decision functions are pure so they can be unit tested.

export const KEYBOARD_CLICK_WINDOW_MS = 400;

// Decide whether a keydown event should trigger a reactor activation.
// Returns 'activate', 'block' (preventDefault, no activation), or 'ignore'.
export function keydownDecision(event, { coreFocused = false } = {}) {
  const isSpace = event.code === 'Space';
  const isEnter = event.key === 'Enter';

  if (isSpace) {
    // Always claim Space: prevents page scroll, native button activation,
    // and key-repeat farming in one place.
    return event.repeat ? 'block' : 'activate';
  }

  if (isEnter && coreFocused) {
    // Claim Enter only on the reactor itself so forms/buttons keep native
    // behavior elsewhere. Repeat is blocked to stop hold-to-farm.
    return event.repeat ? 'block' : 'activate';
  }

  return 'ignore';
}

// Decide whether a click event on the reactor should activate it.
// `lastKeyboardActivationAt` is the timestamp of the most recent keyboard
// activation; `now` is the click's timestamp on the same clock.
export function clickDecision(event, lastKeyboardActivationAt, now) {
  const isPointerClick = (event.detail ?? 0) > 0 || Boolean(event.pointerType);
  if (isPointerClick) return 'activate';

  // detail === 0: keyboard-synthesized or assistive-technology click.
  // If we just handled a keyboard activation, this is its native echo.
  if (now - lastKeyboardActivationAt < KEYBOARD_CLICK_WINDOW_MS) return 'ignore';
  return 'activate';
}
