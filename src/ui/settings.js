// Settings sheet and modal dialogs. Native <dialog> elements provide focus
// trapping, Escape handling, and aria-modal behavior for free.

import { APP_VERSION } from '../config/constants.js';
import { fmt, fmtTime } from '../utils/format.js';
import { el } from './dom.js';

export function initSettings() {
  el.appVersionText.textContent = APP_VERSION;
  el.versionBadge.textContent = APP_VERSION;

  // Close on backdrop click for every dialog.
  for (const dialog of [el.settingsDialog, el.confirmDialog, el.offlineDialog]) {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  }

  el.settingsCloseBtn.addEventListener('click', () => el.settingsDialog.close());
}

export function openSettings() {
  if (!el.settingsDialog.open) el.settingsDialog.showModal();
}

export function closeSettings() {
  if (el.settingsDialog.open) el.settingsDialog.close();
}

// Accessible replacement for window.confirm. Resolves true only when the
// player explicitly presses the confirm button.
export function showConfirm({ title = 'Confirm', message, confirmLabel = 'Confirm' }) {
  return new Promise(resolve => {
    el.confirmTitle.textContent = title;
    el.confirmMessage.textContent = message;
    el.confirmAcceptBtn.textContent = confirmLabel;

    const done = result => {
      el.confirmAcceptBtn.removeEventListener('click', onAccept);
      el.confirmDialog.removeEventListener('close', onClose);
      if (el.confirmDialog.open) el.confirmDialog.close();
      resolve(result);
    };
    const onAccept = () => done(true);
    const onClose = () => done(false);

    el.confirmAcceptBtn.addEventListener('click', onAccept);
    el.confirmCancelBtn.addEventListener('click', () => done(false), { once: true });
    el.confirmDialog.addEventListener('close', onClose);

    el.confirmDialog.showModal();
    el.confirmCancelBtn.focus();
  });
}

// Polished summary shown when a returning player receives offline earnings.
export function showOfflineSummary(seconds, gain) {
  el.offlineSummary.textContent =
    `While you were away for ${fmtTime(seconds)}, the reactor generated ${fmt(gain)} energy.`;
  el.offlineCloseBtn.addEventListener('click', () => el.offlineDialog.close(), { once: true });
  el.offlineDialog.showModal();
}
