// State creation and basic state mutation. Everything that changes while the
// game runs lives in a single plain state object so it can be saved as JSON.

import { DEFAULT_VOLUME } from '../config/constants.js';
import { upgradeDefs } from '../config/upgrades.js';
import { horizonUpgradeDefs } from '../config/horizon.js';

// Builds a fresh upgrade map with every upgrade at level 0.
export function defaultUpgrades() {
  return Object.fromEntries(upgradeDefs.map(def => [def.id, { level: 0 }]));
}

// Builds a fresh Event Horizon upgrade map with every upgrade at rank 0.
export function defaultHorizonUpgrades() {
  return Object.fromEntries(horizonUpgradeDefs.map(def => [def.id, { rank: 0 }]));
}

// Creates the starting game state. The reset flow reuses this so every value
// can return to ground zero.
export function createInitialState() {
  return {
    // Resources
    score: 0,
    bestScore: 0,
    totalEarned: 0,
    totalSpent: 0,

    // Click stats
    totalClicks: 0,
    totalCrits: 0,
    biggestClick: 0,

    // Time
    playSeconds: 0,

    // Upgrades
    upgrades: defaultUpgrades(),

    // Prestige layer 1: Singularity
    prestige: 0,
    prestigeTotal: 0,

    // Prestige layer 2: Event Horizon
    horizons: 0,
    shards: 0,
    shardsEarnedTotal: 0,
    horizonUpgrades: defaultHorizonUpgrades(),

    // Progression records
    unlockedAchievements: [],
    reachedMilestones: [],
    seenUpgrades: [],
    bestEps: 0,

    // Neon Surge
    surgeCharge: 0,
    surgeEndsAt: 0,
    surgeExtendedThisRun: 0,
    surgeExtendedMs: 0,
    surgesUsed: 0,
    surgeTimeTotal: 0,

    // Offline
    offlineEarnedTotal: 0,

    // Meta stats
    exportsCount: 0,
    importsCount: 0,
    manualSaves: 0,
    slotSaves: 0,
    slotRestores: 0,

    // Preferences
    muted: false,
    volume: DEFAULT_VOLUME,
    theme: 'dark',
    buyMode: 'one',
    reducedMotion: false,

    lastSavedAt: Date.now()
  };
}

// Adds energy and updates total earned and best score.
export function addEnergy(state, amount) {
  const gain = Math.max(0, amount);
  state.score += gain;
  state.totalEarned += gain;
  state.bestScore = Math.max(state.bestScore, state.score);
}

// Removes energy when buying upgrades and tracks total spent.
export function spendEnergy(state, amount) {
  state.score -= amount;
  state.totalSpent += amount;
}

// Counts all upgrade levels combined for achievement checks.
export function totalUpgradeLevels(state) {
  return Object.values(state.upgrades).reduce((sum, upgrade) => sum + upgrade.level, 0);
}

// Counts distinct upgrade types owned at level 1 or higher.
export function distinctUpgradesOwned(state) {
  return Object.values(state.upgrades).filter(upgrade => upgrade.level >= 1).length;
}
