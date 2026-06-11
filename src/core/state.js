// State creation and basic state mutation. Everything that changes while the
// game runs lives in a single plain state object so it can be saved as JSON.

import { upgradeDefs } from '../config/upgrades.js';

// Builds a fresh upgrade map with every upgrade at level 0.
export function defaultUpgrades() {
  return Object.fromEntries(upgradeDefs.map(def => [def.id, { level: 0 }]));
}

// Creates the starting game state. The reset flow reuses this so every value
// can return to ground zero.
export function createInitialState() {
  return {
    score: 0,
    bestScore: 0,
    totalEarned: 0,
    totalSpent: 0,
    totalClicks: 0,
    playSeconds: 0,
    upgrades: defaultUpgrades(),
    prestige: 0,
    unlockedAchievements: [],
    reachedMilestones: [],
    muted: false,
    theme: 'dark',
    buyMode: 'one',
    reducedMotion: false,
    surgeCharge: 0,
    surgeEndsAt: 0,
    surgesUsed: 0,
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
