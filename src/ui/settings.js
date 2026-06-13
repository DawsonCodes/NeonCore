// Settings sheet, modal dialogs, and the save-slot interface. Native
// <dialog> elements provide focus trapping, Escape handling, and aria-modal
// behavior for free.

import { APP_VERSION } from '../config/constants.js';
import { slotSummary } from '../systems/save.js';
import { escapeHTML, fmt, fmtTime } from '../utils/format.js';
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

// Paints the filled (cyan) portion of the volume track. The thumb itself is
// the native range thumb — exactly one, styled in CSS.
export function setVolumeFill(value) {
  el.volumeSlider.style.setProperty('--fill', `${value}%`);
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
export function showOfflineSummary(seconds, gain, capSeconds) {
  el.offlineSummary.textContent =
    `While you were away for ${fmtTime(seconds)}, the reactor generated ${fmt(gain)} energy.`;
  el.offlineCapNote.textContent =
    `Offline generation is capped at ${fmtTime(capSeconds)}.`;
  el.offlineCloseBtn.addEventListener('click', () => el.offlineDialog.close(), { once: true });
  el.offlineDialog.showModal();
}

// ---------------------------------------------------------------------------
// Save slots
// ---------------------------------------------------------------------------

function slotDate(timestamp) {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function slotCardHTML(slot, index) {
  if (!slot) {
    return `
      <article class="slot-card slot-empty">
        <div class="slot-head">
          <span class="slot-name-empty">Slot ${index + 1} — empty</span>
        </div>
        <div class="slot-actions">
          <button class="action-btn" type="button" data-slot-action="save" data-slot-index="${index}">Save here</button>
          <button class="action-btn" type="button" data-slot-action="import" data-slot-index="${index}">Import into slot</button>
        </div>
      </article>
    `;
  }

  const summary = slotSummary(slot);
  return `
    <article class="slot-card">
      <div class="slot-head">
        <input class="slot-name" type="text" value="${escapeHTML(summary.name)}" maxlength="40"
          data-slot-name="${index}" aria-label="Name for save slot ${index + 1}">
      </div>
      <p class="slot-summary">
        ${fmt(summary.score)} energy · best ${fmt(summary.bestScore)} ·
        ${fmt(summary.prestige)} singularit${summary.prestige === 1 ? 'y' : 'ies'} ·
        ${fmt(summary.horizons)} horizon${summary.horizons === 1 ? '' : 's'}
      </p>
      <p class="slot-meta">Created ${slotDate(summary.createdAt)} · Updated ${slotDate(summary.updatedAt)} · schema v${summary.schema}</p>
      <div class="slot-actions">
        <button class="action-btn" type="button" data-slot-action="save" data-slot-index="${index}">Overwrite</button>
        <button class="action-btn" type="button" data-slot-action="restore" data-slot-index="${index}">Restore</button>
        <button class="action-btn" type="button" data-slot-action="export" data-slot-index="${index}">Export</button>
        <button class="action-btn" type="button" data-slot-action="import" data-slot-index="${index}">Import</button>
        <button class="danger-btn slot-delete" type="button" data-slot-action="delete" data-slot-index="${index}">Delete</button>
      </div>
    </article>
  `;
}

// Renders the slot list inside the settings sheet.
export function renderSlots(slots) {
  el.slotList.innerHTML = slots.map((slot, index) => slotCardHTML(slot, index)).join('');
}
