// Main game loop. Runs on requestAnimationFrame, advances passive energy,
// and triggers autosaves on a fixed interval.

import { AUTOSAVE_INTERVAL_SECONDS } from '../config/constants.js';
import { tickPassive } from './actions.js';

export function startGameLoop(state, { onFrame, onAutoSave }) {
  let lastTick = performance.now();
  let autoSaveTimer = 0;

  function frame(now) {
    const dt = Math.min(1, Math.max(0, (now - lastTick) / 1000));
    lastTick = now;

    tickPassive(state, dt);
    autoSaveTimer += dt;

    if (autoSaveTimer >= AUTOSAVE_INTERVAL_SECONDS) {
      autoSaveTimer = 0;
      onAutoSave();
    }

    onFrame(dt);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
