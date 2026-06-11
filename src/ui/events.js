// Event binding: connects buttons, navigation, keyboard shortcuts, and
// lifecycle saves to the game controller created in main.js.

import { el } from './dom.js';
import { openSettings } from './settings.js';

export function initEvents(game) {
  // Reactor
  el.core.addEventListener('click', event => game.click(event));

  // Upgrades (event delegation on the grid)
  el.upgradeGrid.addEventListener('click', event => {
    const btn = event.target.closest('[data-buy]');
    if (btn) game.buy(btn.dataset.buy);
  });
  el.buyOneBtn.addEventListener('click', () => game.setBuyMode('one'));
  el.buyMaxBtn.addEventListener('click', () => game.setBuyMode('max'));

  // Surge + Singularity
  el.surgeBtn.addEventListener('click', () => game.surge());
  el.prestigeBtn.addEventListener('click', () => game.singularity());

  // Header
  el.themeBtn.addEventListener('click', () => game.toggleTheme());
  el.settingsBtn.addEventListener('click', openSettings);

  // Mobile navigation
  for (const btn of el.navButtons) {
    btn.addEventListener('click', () => game.selectTab(btn.dataset.nav));
  }
  el.navSettingsBtn.addEventListener('click', openSettings);

  // Settings controls
  for (const radio of el.themeRadios) {
    radio.addEventListener('change', () => {
      if (radio.checked) game.setTheme(radio.value);
    });
  }
  el.soundToggle.addEventListener('change', () => game.setMuted(!el.soundToggle.checked));
  el.motionToggle.addEventListener('change', () => game.setReducedMotion(el.motionToggle.checked));
  el.saveNowBtn.addEventListener('click', () => game.saveNow());
  el.exportBtn.addEventListener('click', () => game.exportSave());
  el.importBtn.addEventListener('click', () => el.importFile.click());
  el.importFile.addEventListener('change', () => {
    game.importSaveFile(el.importFile.files[0]);
    el.importFile.value = '';
  });
  el.resetBtn.addEventListener('click', () => game.reset());

  // Keyboard shortcuts
  document.addEventListener('keydown', event => {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    const dialogOpen = Boolean(document.querySelector('dialog[open]'));
    if (typing || dialogOpen) return;

    // Holding a key fires repeated keydown events; this prevents holding
    // Space from rapidly farming energy.
    if (event.repeat) {
      if (event.code === 'Space') event.preventDefault();
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      game.click();
    }
    if (event.key.toLowerCase() === 'b') game.toggleBuyMode();
    if (event.key.toLowerCase() === 's') game.saveNow();
  });

  // Persist progress whenever the page is hidden or closed.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.saveQuiet();
  });
  window.addEventListener('pagehide', () => game.saveQuiet());
  window.addEventListener('beforeunload', () => game.saveQuiet());
}
