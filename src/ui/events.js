// Event binding: connects buttons, navigation, keyboard shortcuts, and
// lifecycle saves to the game controller created in main.js.
//
// Reactor input goes through the canonical gate in input.js so one physical
// input always equals exactly one activation (see that file for the v0.2
// multiplication bug analysis).

import { unlockAudio } from '../systems/audio.js';
import { el } from './dom.js';
import { clickDecision, keydownDecision } from './input.js';
import { openSettings, setVolumeFill } from './settings.js';

export function initEvents(game) {
  let lastKeyboardActivationAt = -Infinity;

  // --- Reactor: pointer path ---
  el.core.addEventListener('click', event => {
    const decision = clickDecision(event, lastKeyboardActivationAt, event.timeStamp);
    if (decision === 'activate') game.click(event);
  });

  // --- Reactor + shortcuts: keyboard path ---
  document.addEventListener('keydown', event => {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    const dialogOpen = Boolean(document.querySelector('dialog[open]'));
    if (typing || dialogOpen) return;

    const decision = keydownDecision(event, { coreFocused: document.activeElement === el.core });
    if (decision === 'activate') {
      event.preventDefault();
      lastKeyboardActivationAt = event.timeStamp;
      game.click();
      return;
    }
    if (decision === 'block') {
      event.preventDefault();
      return;
    }

    if (event.repeat) return;
    if (event.key.toLowerCase() === 'b') game.toggleBuyMode();
    if (event.key.toLowerCase() === 's') game.saveNow();
  });

  // Browsers require a user gesture before audio may start.
  const unlock = () => unlockAudio();
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });

  // --- Upgrades (event delegation on the grid) ---
  el.upgradeGrid.addEventListener('click', event => {
    const btn = event.target.closest('[data-buy]');
    if (btn) game.buy(btn.dataset.buy);
  });
  el.buyOneBtn.addEventListener('click', () => game.setBuyMode('one'));
  el.buyMaxBtn.addEventListener('click', () => game.setBuyMode('max'));

  // --- Shop category tabs (delegation; tabs are re-rendered on change) ---
  el.shopTabs.addEventListener('click', event => {
    const tab = event.target.closest('[data-category]');
    if (tab) game.selectShopCategory(tab.dataset.category);
  });
  el.shopTabs.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const tabs = [...el.shopTabs.querySelectorAll('[data-category]')];
    const index = tabs.indexOf(document.activeElement);
    if (index === -1) return;
    event.preventDefault();
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    game.selectShopCategory(next.dataset.category);
    el.shopTabs.querySelector(`[data-category="${next.dataset.category}"]`)?.focus();
  });

  // --- Surge + prestige layers ---
  el.surgeBtn.addEventListener('click', () => game.surge());
  el.prestigeBtn.addEventListener('click', () => game.singularity());
  el.horizonBtn.addEventListener('click', () => game.horizon());
  el.horizonShop.addEventListener('click', event => {
    const btn = event.target.closest('[data-horizon-buy]');
    if (btn) game.buyHorizonUpgrade(btn.dataset.horizonBuy);
  });

  // --- Achievements + stats collapse ---
  el.achievementToggle.addEventListener('click', () => game.toggleAchievements());
  el.statsToggle.addEventListener('click', () => game.toggleStats());

  // --- Header ---
  el.themeBtn.addEventListener('click', () => game.toggleTheme());
  el.settingsBtn.addEventListener('click', openSettings);

  // --- Mobile navigation ---
  for (const btn of el.navButtons) {
    btn.addEventListener('click', () => game.selectTab(btn.dataset.nav));
  }
  el.navSettingsBtn.addEventListener('click', openSettings);

  // --- Settings controls ---
  for (const radio of el.themeRadios) {
    radio.addEventListener('change', () => {
      if (radio.checked) game.setTheme(radio.value);
    });
  }
  el.soundToggle.addEventListener('change', () => game.setMuted(!el.soundToggle.checked));
  el.volumeSlider.addEventListener('input', () => {
    game.setVolume(el.volumeSlider.value / 100);
    setVolumeFill(el.volumeSlider.value);
  });
  el.motionToggle.addEventListener('change', () => game.setReducedMotion(el.motionToggle.checked));
  el.saveNowBtn.addEventListener('click', () => game.saveNow());
  el.exportBtn.addEventListener('click', () => game.exportSave());
  el.importBtn.addEventListener('click', () => game.requestImport(null));
  el.importFile.addEventListener('change', () => {
    game.importSaveFile(el.importFile.files[0]);
    el.importFile.value = '';
  });
  el.resetBtn.addEventListener('click', () => game.reset());

  // --- Save slots (delegation; cards are rendered dynamically) ---
  el.slotList.addEventListener('click', event => {
    const btn = event.target.closest('[data-slot-action]');
    if (!btn) return;
    const index = Number(btn.dataset.slotIndex);
    game.slotAction(btn.dataset.slotAction, index);
  });
  el.slotList.addEventListener('change', event => {
    const input = event.target.closest('[data-slot-name]');
    if (input) game.slotAction('rename', Number(input.dataset.slotName), input.value);
  });

  // --- Persist progress whenever the page is hidden or closed ---
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.saveQuiet();
  });
  window.addEventListener('pagehide', () => game.saveQuiet());
  window.addEventListener('beforeunload', () => game.saveQuiet());
}
