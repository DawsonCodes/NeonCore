// Neon Core bootstrap: loads the save, wires every system together, and
// starts the game loop.

import { SURGE_MAX } from './config/constants.js';
import { achievementDefs } from './config/achievements.js';
import { milestoneDefs } from './config/milestones.js';
import { upgradeDefs, upgradeById } from './config/upgrades.js';
import { horizonUpgradeById } from './config/horizon.js';
import { addEnergy, createInitialState } from './core/state.js';
import * as calc from './core/calc.js';
import * as actions from './core/actions.js';
import { startGameLoop } from './core/loop.js';
import {
  backupCurrentSave,
  buildExportPayload,
  clearActiveSave,
  computeOfflineGain,
  deleteSlot,
  loadFromStorage,
  loadSlots,
  readSlot,
  renameSlot,
  saveToStorage,
  validateImport,
  writeSlot
} from './systems/save.js';
import { initAudio, sound } from './systems/audio.js';
import { el } from './ui/dom.js';
import {
  achievementsExpanded,
  applyTheme,
  markUpgradesSeen,
  renderAchievements,
  setAchievementsExpanded,
  setStatsExpanded,
  statsExpanded,
  syncUpgradeStructure,
  updateAchievements,
  updateDisplay
} from './ui/render.js';
import { categoryUnlockedIds, selectCategory } from './ui/shop-state.js';
import {
  applyMotionPreference,
  flashUpgradeCard,
  initEffects,
  playHorizon,
  playSingularity,
  pulseCore,
  setSurgeReadyVisual,
  setSurgeVisual,
  spawnFloatNumber,
  spawnParticles
} from './ui/effects.js';
import { addLog, clearLog, clearNotifications, flashSaveChip, notify } from './ui/notifications.js';
import { initEvents } from './ui/events.js';
import { initSettings, renderSlots, setVolumeFill, showConfirm, showOfflineSummary } from './ui/settings.js';
import { fmt } from './utils/format.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = createInitialState();
const loaded = loadFromStorage(localStorage);
if (loaded) Object.assign(state, loaded.state);

const sessionStartAt = Date.now();
let surgeWasActive = false;
let surgeWasReady = false;
let pendingImportSlot = null; // null = import into active game

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function persist({ flash = false } = {}) {
  try {
    saveToStorage(localStorage, state);
    if (flash) flashSaveChip();
  } catch (error) {
    console.warn('Save failed:', error);
    notify({ type: 'error', message: 'Save failed. Browser storage may be blocked.', priority: 'critical' });
  }
}

function refreshSlots() {
  renderSlots(loadSlots(localStorage));
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
    sound.achievement();
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

// Rebuilds the upgrade list when something newly unlocks and announces it.
function checkUpgradeUnlocks({ silent = false } = {}) {
  const fresh = syncUpgradeStructure(state);
  if (fresh.length === 0) return;

  if (!silent) {
    for (const id of fresh) {
      const def = upgradeById(id);
      notify({
        type: 'unlock',
        title: 'New upgrade available',
        message: def.name,
        priority: 'normal',
        dedupeKey: `unlock:${id}`
      });
    }
    sound.unlock();
  } else {
    markUpgradesSeen(state, fresh);
  }
}

// ---------------------------------------------------------------------------
// Game controller — every player-triggered action goes through here.
// ---------------------------------------------------------------------------

const game = {
  click(event) {
    const { gain, critical, extended } = actions.coreClick(state);
    pulseCore(critical);
    spawnFloatNumber(gain, event, critical);
    spawnParticles(event, critical);
    sound.click(critical);
    if (!calc.isSurgeActive(state) && state.surgeCharge < SURGE_MAX) {
      sound.surgeCharge(state.surgeCharge / SURGE_MAX);
    }
    if (extended) {
      el.surgeChargeShell.classList.remove('extended');
      void el.surgeChargeShell.offsetWidth;
      el.surgeChargeShell.classList.add('extended');
    }
    checkMilestones();
    checkAchievements();
    updateDisplay(state, sessionStartAt);
  },

  buy(id) {
    const { bought, spent } = actions.purchaseUpgrade(state, id);

    if (bought === 0) {
      notify({ type: 'warning', message: 'Not enough energy yet.', priority: 'low', log: false, dedupeKey: 'no-energy' });
      sound.deny();
      return;
    }

    const def = upgradeById(id);
    sound.buy();
    flashUpgradeCard(id);
    addLog(`Bought ${bought} ${def.short} upgrade${bought === 1 ? '' : 's'} for ${fmt(spent)} energy.`, 'success');
    checkUpgradeUnlocks();
    checkAchievements();
    updateDisplay(state, sessionStartAt);
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
    updateDisplay(state, sessionStartAt);
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
      message: `Output multiplied for ${(calc.surgeDuration(state) / 1000).toFixed(0)} seconds. Keep clicking!`,
      priority: 'high',
      dedupeKey: 'surge-state'
    });
    sound.surgeActivate();
    setSurgeVisual(true);
    setSurgeReadyVisual(false);
    checkAchievements();
    updateDisplay(state, sessionStartAt);
    persist();
  },

  async singularity() {
    if (!calc.canPrestige(state)) return;

    const ok = await showConfirm({
      title: 'Collapse the core?',
      message: 'This resets your energy and upgrades, but adds a permanent +25% global multiplier. Achievements, stats, and Event Horizon progress stay.',
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
    sound.singularity();
    setSurgeVisual(false);
    checkUpgradeUnlocks();
    checkAchievements();
    updateDisplay(state, sessionStartAt);
    persist();
  },

  async horizon() {
    if (!calc.canHorizon(state)) return;
    const gain = calc.horizonShardGain(state);

    const ok = await showConfirm({
      title: 'Cross the Event Horizon?',
      message: `This resets energy, upgrades, AND your ${fmt(state.prestige)} Singularities. In return you gain ${fmt(gain)} permanent Horizon Shard${gain === 1 ? '' : 's'} to spend on Shard upgrades. Achievements and stats stay.`,
      confirmLabel: 'Cross the Horizon'
    });
    if (!ok) return;

    const result = actions.performHorizon(state);
    if (!result) return;

    playHorizon(result.gained);
    notify({
      type: 'horizon',
      title: 'Event Horizon crossed',
      message: `+${fmt(result.gained)} Horizon Shard${result.gained === 1 ? '' : 's'}. Spend them on permanent upgrades.`,
      priority: 'high'
    });
    sound.horizon();
    setSurgeVisual(false);
    checkUpgradeUnlocks();
    checkAchievements();
    updateDisplay(state, sessionStartAt);
    persist();
  },

  buyHorizonUpgrade(id) {
    const result = actions.purchaseHorizonUpgrade(state, id);
    if (!result) {
      sound.deny();
      return;
    }
    const def = horizonUpgradeById(id);
    sound.buy();
    notify({
      type: 'horizon',
      message: `${def.name} rank ${result.rank} acquired.`,
      priority: 'normal',
      dedupeKey: `horizon:${id}`
    });
    checkAchievements();
    updateDisplay(state, sessionStartAt);
    persist();
  },

  toggleAchievements() {
    setAchievementsExpanded(!achievementsExpanded());
  },

  toggleStats() {
    setStatsExpanded(!statsExpanded());
  },

  // Switches the visible shop category. NEW badges stay visible for this
  // view; the category's upgrades are marked seen so its tab dot clears.
  selectShopCategory(id) {
    selectCategory(id);
    syncUpgradeStructure(state);
    markUpgradesSeen(state, categoryUnlockedIds(state, id));
    updateDisplay(state, sessionStartAt);
  },

  saveNow() {
    state.manualSaves++;
    persist({ flash: true });
    sound.save();
    notify({ type: 'save', message: 'Game saved.', priority: 'low', log: false, dedupeKey: 'manual-save' });
    checkAchievements();
  },

  saveQuiet() {
    persist();
  },

  exportSave(slotIndex = null) {
    let payload;
    let suffix = '';
    if (slotIndex === null) {
      persist();
      payload = buildExportPayload(state);
    } else {
      const slot = readSlot(localStorage, slotIndex);
      if (!slot) return;
      payload = buildExportPayload(slot.state);
      suffix = `-slot${slotIndex + 1}`;
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `neon-core-save${suffix}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);

    state.exportsCount++;
    notify({ type: 'success', message: 'Save exported.', priority: 'normal' });
    checkAchievements();
    persist();
  },

  // Opens the file picker; `target` is a slot index or null for the active game.
  requestImport(target) {
    pendingImportSlot = target;
    el.importFile.click();
  },

  async importSaveFile(file) {
    const target = pendingImportSlot;
    pendingImportSlot = null;
    if (!file) return;

    let text;
    try {
      text = await file.text();
    } catch {
      notify({ type: 'error', message: 'The file could not be read.', priority: 'critical' });
      return;
    }

    const result = validateImport(text);
    if (!result.ok) {
      // Current progress is untouched when an import fails validation.
      notify({ type: 'error', title: 'Import failed', message: result.error, priority: 'critical' });
      sound.error();
      return;
    }

    if (target !== null) {
      writeSlot(localStorage, target, result.state, null);
      refreshSlots();
      notify({ type: 'success', title: 'Import complete', message: `Save imported into slot ${target + 1}.`, priority: 'high' });
      return;
    }

    backupCurrentSave(localStorage);
    Object.assign(state, result.state);
    state.importsCount++;
    afterStateReplaced();
    persist({ flash: true });
    notify({ type: 'success', title: 'Import complete', message: 'Save imported successfully.', priority: 'high' });
  },

  async reset() {
    const ok = await showConfirm({
      title: 'Reset all progress?',
      message: 'This wipes energy, upgrades, achievements, stats, Singularities, and Event Horizon progress. Save slots and interface preferences are kept. It cannot be undone.',
      confirmLabel: 'Reset everything'
    });
    if (!ok) return;

    clearActiveSave(localStorage);
    actions.resetState(state);
    clearNotifications();
    clearLog();
    setSurgeVisual(false);
    setSurgeReadyVisual(false);
    afterStateReplaced();
    persist();
    notify({ type: 'success', message: 'Everything reset to zero. Core online.', priority: 'normal' });
  },

  async slotAction(action, index, value) {
    const slots = loadSlots(localStorage);
    const slot = slots[index];

    switch (action) {
      case 'save': {
        if (slot) {
          const ok = await showConfirm({
            title: `Overwrite ${slot.name}?`,
            message: 'The save currently stored in this slot will be replaced with your active progress.',
            confirmLabel: 'Overwrite slot'
          });
          if (!ok) return;
        }
        persist();
        writeSlot(localStorage, index, state, slot?.name);
        state.slotSaves++;
        notify({ type: 'success', message: `Progress saved to slot ${index + 1}.`, priority: 'normal' });
        sound.save();
        break;
      }
      case 'restore': {
        if (!slot) return;
        const ok = await showConfirm({
          title: `Restore ${slot.name}?`,
          message: 'Your active progress will be replaced by this slot. A backup of the current save is kept.',
          confirmLabel: 'Restore slot'
        });
        if (!ok) return;
        const data = readSlot(localStorage, index);
        if (!data) return;
        backupCurrentSave(localStorage);
        Object.assign(state, data.state);
        state.slotRestores++;
        afterStateReplaced();
        persist({ flash: true });
        notify({ type: 'success', message: `Slot ${index + 1} restored.`, priority: 'high' });
        break;
      }
      case 'delete': {
        if (!slot) return;
        const ok = await showConfirm({
          title: `Delete ${slot.name}?`,
          message: 'This save slot will be emptied. Your active progress is not affected.',
          confirmLabel: 'Delete slot'
        });
        if (!ok) return;
        deleteSlot(localStorage, index);
        notify({ type: 'info', message: `Slot ${index + 1} deleted.`, priority: 'normal' });
        break;
      }
      case 'export':
        game.exportSave(index);
        break;
      case 'import':
        game.requestImport(index);
        return; // slots refresh after the file lands
      case 'rename':
        renameSlot(localStorage, index, value);
        break;
      default:
        return;
    }

    refreshSlots();
    checkAchievements();
    updateDisplay(state, sessionStartAt);
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

  setVolume(volume) {
    state.volume = Math.max(0, Math.min(1, volume));
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

// Re-applies UI state after the whole state object was swapped (import,
// slot restore, reset).
function afterStateReplaced() {
  applyTheme(state);
  applyMotionPreference();
  el.volumeSlider.value = Math.round(state.volume * 100);
  setVolumeFill(Math.round(state.volume * 100));
  setSurgeVisual(calc.isSurgeActive(state));
  setSurgeReadyVisual(!calc.isSurgeActive(state) && state.surgeCharge >= SURGE_MAX);
  checkUpgradeUnlocks({ silent: true });
  updateAchievements(state);
  updateDisplay(state, sessionStartAt);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function applyOfflineProgress() {
  if (!loaded || !loaded.savedAt) return;

  const { seconds, gain } = computeOfflineGain(state, loaded.savedAt);
  if (gain <= 0) return;

  addEnergy(state, gain);
  state.offlineEarnedTotal += gain;

  notify({ type: 'offline', title: 'Offline gain', message: `+${fmt(gain)} energy while away.`, priority: 'normal' });
  showOfflineSummary(seconds, gain, calc.offlineCapSeconds(state));
}

function init() {
  initAudio({ muted: () => state.muted, volume: () => state.volume });
  initEffects(() => state);
  initSettings();

  renderAchievements();
  applyTheme(state);
  applyMotionPreference();
  el.volumeSlider.value = Math.round(state.volume * 100);
  setVolumeFill(Math.round(state.volume * 100));
  setSurgeVisual(calc.isSurgeActive(state));

  // Achievements and stats: compact by default on desktop, expanded inside
  // their dedicated mobile tabs.
  const mobile = window.matchMedia('(max-width: 860px)').matches;
  setAchievementsExpanded(mobile);
  setStatsExpanded(mobile);

  // Build the upgrade list without "NEW" fanfare for everything an existing
  // save had already unlocked.
  checkUpgradeUnlocks({ silent: true });

  applyOfflineProgress();
  refreshSlots();
  initEvents(game);

  addLog(loaded ? 'Save loaded. Core online.' : 'Core online. Begin charging.');
  checkAchievements();
  updateAchievements(state);
  updateDisplay(state, sessionStartAt);

  startGameLoop(state, {
    onFrame() {
      const active = calc.isSurgeActive(state);
      if (surgeWasActive && !active) {
        setSurgeVisual(false);
        state.surgeExtendedThisRun = 0;
        sound.surgeEnd();
        notify({ type: 'surge', message: 'Neon Surge ended.', priority: 'low', dedupeKey: 'surge-state' });
      } else if (active && !surgeWasActive) {
        setSurgeVisual(true);
      }
      surgeWasActive = active;

      const ready = !active && state.surgeCharge >= SURGE_MAX;
      if (ready && !surgeWasReady) {
        sound.surgeReady();
        notify({ type: 'surge', message: 'Neon Surge fully charged.', priority: 'normal', dedupeKey: 'surge-state' });
      }
      if (ready !== surgeWasReady) setSurgeReadyVisual(ready);
      surgeWasReady = ready;

      state.bestEps = Math.max(state.bestEps, calc.energyPerSecond(state, false));

      checkUpgradeUnlocks();
      checkMilestones();
      checkAchievements();
      updateDisplay(state, sessionStartAt);
    },
    onAutoSave() {
      persist({ flash: true });
    }
  });
}

init();
