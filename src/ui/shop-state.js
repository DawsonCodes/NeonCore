// Pure state and summaries for the category-based upgrade shop. Kept free of
// DOM access so category selection and badge logic can be unit tested.

import { upgradeCategories, upgradeDefs } from '../config/upgrades.js';
import { costFor, isUpgradeUnlocked, level } from '../core/calc.js';

let selected = upgradeCategories[0].id;

export function selectedCategory() {
  return selected;
}

// Selects a category by id; unknown ids are ignored. Returns the selection.
export function selectCategory(id) {
  if (upgradeCategories.some(category => category.id === id)) {
    selected = id;
  }
  return selected;
}

export function resetCategory() {
  selected = upgradeCategories[0].id;
}

// Summary used by the category tabs and panel: counts of unlocked,
// affordable, and newly unlocked upgrades plus owned levels.
export function categorySummary(state, categoryId) {
  const defs = upgradeDefs.filter(def => def.category === categoryId);
  const unlocked = defs.filter(def => isUpgradeUnlocked(state, def));
  return {
    total: defs.length,
    unlocked: unlocked.length,
    affordable: unlocked.filter(def => state.score >= costFor(state, def.id)).length,
    fresh: unlocked.filter(def => !state.seenUpgrades.includes(def.id)).length,
    levels: unlocked.reduce((sum, def) => sum + level(state, def.id), 0),
    locked: unlocked.length === 0
  };
}

// Ids of unlocked upgrades in a category (used to clear NEW state when the
// player views the category).
export function categoryUnlockedIds(state, categoryId) {
  return upgradeDefs
    .filter(def => def.category === categoryId && isUpgradeUnlocked(state, def))
    .map(def => def.id);
}
