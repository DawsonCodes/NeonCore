// Neon Core bootstrap: loads the save, wires every system together, and
// starts the game loop.

import { PRESTIGE_REQ } from './config/constants.js';
import { achievementDefs } from './config/achievements.js';
import { milestoneDefs } from './config/milestones.js';
import { upgradeDefs } from './config/upgrades.js';
import { addEnergy, createInitialState } from './core/state.js';
import { isSurgeActive } from './core/calc.js';
import * as actions from './core/actions.js';
import { startGameLoop } from './core/loop.js';
import {
  backupCurrentSave,
  buildExportPayload,
  clearAllSaves,
  computeOfflineGain,
  loadFromStorage,
  saveToStorage,
  validateImport
} from './systems/save.js';
import { initAudio, sound } from './systems/audio.js';
import { el } from './ui/dom.js';
import {
  applyTheme,
  renderAchievements,
  renderUpgrades,
  updateAchievements,
  updateDisplay
} from './ui/render.js';
import {
  applyMotionPreference,
  flashUpgradeCard,
  initEffects,
  playSingularity,
  pulseCore,
  setSurgeVisual,
  spawnFloatNumber,
  spawnParticles
} from './ui/effects.js';
import { addLog, clearLog, flashSaveChip, notify } from './ui/notifications.js';
import { initEvents } from './ui/events.js';
import { initSettings, showConfirm, showOfflineSummary } from './ui/settings.js';
import { fmt } from './utils/format.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = createInitialState();
const loaded = loadFromStorage(localStorage);
if (loaded) Object.assign(state, loaded.state);

let surgeWasActive = false;

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function persist({ flash = false } = {}) {
  try {
    saveToStorage(localStorage, state);
    if (flash) flashSaveChip();
  } catch (error) {
    console.warn('Save failed:', error);
    notify({ type: 'error', message: 'Save failed. Browser storage may be blocked.', priority: 'high' });
  }
}

// ---------------------------------------------------------------------------
// Progression checks
// ---------------------------------------------------------------------------

function checkAchievements() {
  let foundNew = false;

  for (const achievement of achievementDefs) {
    if (!state.unlockedAchievements.includes(achievement.id) && achievement.check(state)) {
      state.unlockedAchievements.push(achievement.id);
      notify({
        type: 'achievement',
        title: 'Achievement unlocked',
        message: achievement.name,
        priority: 'high'
      });
      foundNew = true;
    }
  }

  if (foundNew) {
    sound.milestone();
    updateAchievements(state);
  }
}

function checkMilestones() {
  for (const milestone of milestoneDefs) {
    if (state.bestScore >= milestone.threshold && !state.reachedMilestones.includes(milestone.threshold)) {
      state.reachedMilestones.push(milestone.threshold);
      notify({ type: 'milestone', title: 'Milestone', message: milestone.text, priority: 'high' });
      sound.milestone();
    }
  }
}

// ---------------------------------------------------------------------------
// Game controller — every player-triggered action goes through here.
// ---------------------------------------------------------------------------

const game = {
  click(event) {
    const { gain, critical } = actions.coreClick(state);
    pulseCore(critical);
    spawnFloatNumber(gain, event, critical);
    spawnParticles(event, critical);
    sound.click(critical);
    checkMilestones();
    checkAchievements();
    updateDisplay(state);
  },

  buy(id) {
    const { bought, spent } = actions.purchaseUpgrade(state, id);

    if (bought === 0) {
      notify({ type: 'warning', message: 'Not enough energy yet.', priority: 'low', log: false });
      sound.deny();
      return;
    }

    const def = upgradeDefs.find(item => item.id === id);
    sound.buy();
    flashUpgradeCard(id);
    addLog(`Bought ${bought} ${def.short} upgrade${bought === 1 ? '' : 's'} for ${fmt(spent)} energy.`, 'success');
    checkAchievements();
    updateDisplay(state);
    persist();
  },

  setBuyMode(mode) {
    if (state.buyMode === mode) return;
    state.buyMode = mode;
    notify({
      type: 'info',
      message: `Buy mode: ${mode === 'one' ? 'Buy 1' : 'Buy Max'}`,
      priority: 'low',
      log: false,
      dedupeKey: 'buy-mode'
    });
    updateDisplay(state);
    persist();
  },

  toggleBuyMode() {
    game.setBuyMode(state.buyMode === 'one' ? 'max' : 'one');
  },

  surge() {
    if (!actions.activateSurge(state)) return;
    notify({
      type: 'surge',
      title: 'Neon Surge',
      message: 'Output doubled for 20 seconds.',
      priority: 'high'
    });
    sound.milestone();
    setSurgeVisual(true);
    checkAchievements();
    updateDisplay(state);
    persist();
  },

  async singularity() {
    if (state.score < PRESTIGE_REQ) return;

    const ok = await showConfirm({
      title: 'Collapse the core?',
      message: 'This resets your energy and upgrades, but adds a permanent +10% global multiplier. Achievements stay unlocked.',
      confirmLabel: 'Collapse the core'
    });
    if (!ok || !actions.performSingularity(state)) return;

    playSingularity(state.prestige);
    notify({
      type: 'singularity',
      title: `Singularity ${fmt(state.prestige)}`,
      message: 'The core has collapsed. Permanent bonus increased.',
      priority: 'high'
    });
    sound.milestone();
    setSurgeVisual(false);
    checkAchievements();
    updateDisplay(state);
    persist();
  },

  saveNow() {
    persist({ flash: true });
    notify({ type: 'save', message: 'Game saved.', priority: 'low', log: false, dedupeKey: 'manual-save' });
  },

  saveQuiet() {
    persist();
  },

  exportSave() {
    persist();
    const payload = buildExportPayload(state);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `neon-core-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify({ type: 'success', message: 'Save exported.', priority: 'normal' });
  },

  async importSaveFile(file) {
    if (!file) return;

    let text;
    try {
      text = await file.text();
    } catch {
      notify({ type: 'error', message: 'The file could not be read.', priority: 'high' });
      return;
    }

    const result = validateImport(text);
    if (!result.ok) {
      // Current progress is untouched when an import fails validation.
      notify({ type: 'error', title: 'Import failed', message: result.error, priority: 'high' });
      sound.deny();
      return;
    }

    backupCurrentSave(localStorage);
    Object.assign(state, result.state);
    applyTheme(state);
    applyMotionPreference();
    setSurgeVisual(isSurgeActive(state));
    updateAchievements(state);
    updateDisplay(state);
    persist({ flash: true });
    notify({ type: 'success', title: 'Import complete', message: 'Save imported successfully.', priority: 'high' });
  },

  async reset() {
    const ok = await showConfirm({
      title: 'Reset all progress?',
      message: 'This wipes energy, upgrades, achievements, milestones, stats, and singularities. It cannot be undone.',
      confirmLabel: 'Reset everything'
    });
    if (!ok) return;

    clearAllSaves(localStorage);
    actions.resetState(state);
    clearLog();
    setSurgeVisual(false);
    updateAchievements(state);
    updateDisplay(state);
    persist();
    notify({ type: 'success', message: 'Everything reset to zero. Core online.', priority: 'normal' });
  },

  setTheme(theme) {
    if (state.theme === theme) return;
    state.theme = theme;
    applyTheme(state);
    persist();
  },

  toggleTheme() {
    game.setTheme(state.theme === 'dark' ? 'light' : 'dark');
  },

  setMuted(muted) {
    state.muted = muted;
    persist();
  },

  setReducedMotion(reduced) {
    state.reducedMotion = reduced;
    applyMotionPreference();
    persist();
  },

  selectTab(name) {
    for (const panel of el.tabPanels) {
      panel.classList.toggle('is-active', panel.dataset.tab === name);
    }
    for (const btn of el.navButtons) {
      const active = btn.dataset.nav === name;
      btn.classList.toggle('is-active', active);
      if (active) {
        btn.setAttribute('aria-current', 'true');
      } else {
        btn.removeAttribute('aria-current');
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
};

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function applyOfflineProgress() {
  if (!loaded || !loaded.savedAt) return;

  const { seconds, gain } = computeOfflineGain(state, loaded.savedAt);
  if (gain <= 0) return;

  addEnergy(state, gain);

  notify({ type: 'offline', title: 'Offline gain', message: `+${fmt(gain)} energy while away.`, priority: 'normal' });
  showOfflineSummary(seconds, gain);
}

function init() {
  initAudio(() => state.muted);
  initEffects(() => state);
  initSettings();

  renderUpgrades();
  renderAchievements();
  applyTheme(state);
  applyMotionPreference();
  setSurgeVisual(isSurgeActive(state));

  applyOfflineProgress();
  initEvents(game);

  addLog(loaded ? 'Save loaded. Core online.' : 'Core online. Begin charging.');
  checkAchievements();
  updateAchievements(state);
  updateDisplay(state);

  startGameLoop(state, {
    onFrame() {
      const active = isSurgeActive(state);
      if (surgeWasActive && !active) {
        setSurgeVisual(false);
        notify({ type: 'surge', message: 'Neon Surge ended.', priority: 'low', dedupeKey: 'surge-end' });
      } else if (active && !surgeWasActive) {
        setSurgeVisual(true);
      }
      surgeWasActive = active;

      checkMilestones();
      checkAchievements();
      updateDisplay(state);
    },
    onAutoSave() {
      persist({ flash: true });
    }
  });
}

init();
